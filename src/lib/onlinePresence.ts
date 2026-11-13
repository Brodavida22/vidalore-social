import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface PresenceSnapshot {
  onlineUserIds: Set<string>;
  lastSeenByUser: Record<string, string>;
  onlineCount: number;
  isConnected: boolean;
}

type CountListener = (count: number) => void;
type SnapshotListener = (snapshot: PresenceSnapshot) => void;

const LAST_SEEN_STORAGE_KEY = "vidalore_last_seen_v1";
const HEARTBEAT_INTERVAL_MS = 60_000;
const MAX_CACHED_LAST_SEEN = 250;

let activeChannel: RealtimeChannel | null = null;
let activeUserId: string | null = null;
let activeUsername = "";
let currentOnlineUserIds = new Set<string>();
let currentOnlineCount = 0;
let isNetworkOffline = typeof navigator !== "undefined" ? navigator.onLine === false : false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let cleanupLifecycleListeners: (() => void) | null = null;
let lastSeenSyncDisabled = false;
let lastTouchSentAt = 0;

const countListeners = new Set<CountListener>();
const snapshotListeners = new Set<SnapshotListener>();

function loadCachedLastSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof key === "string" &&
        typeof value === "string" &&
        !Number.isNaN(Date.parse(value))
      ) {
        clean[key] = value;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

let lastSeenCache: Record<string, string> = loadCachedLastSeen();

function persistLastSeenCache() {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(lastSeenCache)
      .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
      .slice(0, MAX_CACHED_LAST_SEEN);
    lastSeenCache = Object.fromEntries(entries);
    window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, JSON.stringify(lastSeenCache));
  } catch {
    // Ignore storage quota errors
  }
}

function recordLastSeenTimestamp(userId: string, isoTimestamp: string): boolean {
  if (!userId || !isoTimestamp) return false;
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return false;

  const prev = lastSeenCache[userId];
  if (prev && Date.parse(prev) >= parsed) {
    return false;
  }

  lastSeenCache = { ...lastSeenCache, [userId]: new Date(parsed).toISOString() };
  persistLastSeenCache();
  return true;
}

function getSnapshot(): PresenceSnapshot {
  const effectiveIds = new Set(currentOnlineUserIds);
  if (activeUserId && !isNetworkOffline) {
    effectiveIds.add(activeUserId);
  }
  return {
    onlineUserIds: effectiveIds,
    lastSeenByUser: lastSeenCache,
    onlineCount: Math.max(effectiveIds.size, currentOnlineCount),
    isConnected: !isNetworkOffline && Boolean(activeChannel),
  };
}

function notifyListeners() {
  const snapshot = getSnapshot();
  for (const listener of countListeners) {
    listener(Math.max(1, snapshot.onlineCount));
  }
  for (const listener of snapshotListeners) {
    listener(snapshot);
  }
}

export function extractProfileLastSeen(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const candidate = (profile as { last_seen_at?: unknown }).last_seen_at;
  if (typeof candidate === "string" && !Number.isNaN(Date.parse(candidate))) {
    return candidate;
  }
  return null;
}

export function seedProfileLastSeen(
  profiles: Array<{ id?: string | null; last_seen_at?: string | null } | null | undefined>,
): void {
  let changed = false;
  for (const profile of profiles) {
    if (!profile?.id) continue;
    const lastSeen = extractProfileLastSeen(profile);
    if (lastSeen && recordLastSeenTimestamp(profile.id, lastSeen)) {
      changed = true;
    }
  }
  if (changed) {
    notifyListeners();
  }
}

async function persistOwnLastSeenInDb(userId: string, force = false): Promise<void> {
  if (!userId || lastSeenSyncDisabled || isNetworkOffline) return;

  const now = Date.now();
  if (!force && now - lastTouchSentAt < 15_000) return;
  lastTouchSentAt = now;

  const isoNow = new Date(now).toISOString();
  recordLastSeenTimestamp(userId, isoNow);

  try {
    const rpc = supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ error: { code?: string; message?: string } | null }>;

    const { error } = await rpc("touch_last_seen");
    if (!error) return;

    const msg = (error.message || "").toLowerCase();
    const rpcMissing =
      error.code === "PGRST202" ||
      error.code === "42883" ||
      msg.includes("could not find the function") ||
      msg.includes("does not exist");

    if (!rpcMissing) return;

    // Fallback to direct profile column update if RPC isn't installed yet
    const { error: updateErr } = await (
      supabase as unknown as {
        from: (table: string) => {
          update: (values: Record<string, unknown>) => {
            eq: (
              col: string,
              val: string,
            ) => Promise<{ error: { code?: string; message?: string } | null }>;
          };
        };
      }
    )
      .from("profiles")
      .update({ last_seen_at: isoNow })
      .eq("id", userId);

    if (updateErr) {
      const errMsg = (updateErr.message || "").toLowerCase();
      if (
        updateErr.code === "42703" ||
        updateErr.code === "PGRST204" ||
        errMsg.includes("last_seen_at")
      ) {
        lastSeenSyncDisabled = true;
      }
    }
  } catch {
    // Non-fatal: Realtime Presence still works without DB column
  }
}

function sendUnloadLastSeenBeacon(userId: string): void {
  if (typeof window === "undefined" || !userId || lastSeenSyncDisabled) return;

  const isoNow = new Date().toISOString();
  recordLastSeenTimestamp(userId, isoNow);

  try {
    const supabaseUrl = (
      (supabase as unknown as { supabaseUrl?: string }).supabaseUrl ||
      import.meta.env?.["VITE_SUPABASE_URL"] ||
      ""
    ).replace(/\/+$/, "");
    const supabaseKey =
      (supabase as unknown as { supabaseKey?: string }).supabaseKey ||
      import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
      "";

    if (!supabaseUrl || !supabaseKey) return;

    // Read cached Supabase auth token synchronously during pagehide/beforeunload
    let accessToken = "";
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const raw = window.localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw) as { access_token?: string };
          if (parsed?.access_token) {
            accessToken = parsed.access_token;
            break;
          }
        }
      }
    }

    if (!accessToken) return;

    void fetch(`${supabaseUrl}/rest/v1/rpc/touch_last_seen`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: "{}",
    }).catch(() => {});
  } catch {
    // Ignore unload errors
  }
}

async function trackCurrentUser(channel: RealtimeChannel, userId: string, username: string) {
  if (isNetworkOffline) return;
  try {
    await channel.track({
      userId,
      username,
      onlineAt: new Date().toISOString(),
    });
  } catch {
    // Presence tracking failures are non-fatal
  }
}

function attachPresenceChannel(user: { id: string; username: string }) {
  if (typeof supabase.channel !== "function") return;

  if (typeof supabase.getChannels === "function") {
    const existing = supabase
      .getChannels()
      .find((ch) => ch.topic === "realtime:vidalore:online-presence");
    if (existing) {
      void supabase.removeChannel(existing);
    }
  }

  const channel = supabase.channel("vidalore:online-presence", {
    config: { presence: { key: user.id } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const nextIds = new Set<string>();
      for (const key of Object.keys(state)) {
        if (Array.isArray(state[key]) && state[key].length > 0) {
          nextIds.add(key);
        }
      }
      currentOnlineUserIds = nextIds;
      currentOnlineCount = nextIds.size;
      notifyListeners();
    })
    .on("presence", { event: "join" }, ({ key }) => {
      if (key) {
        currentOnlineUserIds.add(key);
        currentOnlineCount = currentOnlineUserIds.size;
        notifyListeners();
      }
    })
    .on("presence", { event: "leave" }, ({ key }) => {
      if (!key) return;
      const state = channel.presenceState();
      const remaining = state[key];
      if (!Array.isArray(remaining) || remaining.length === 0) {
        currentOnlineUserIds.delete(key);
        currentOnlineCount = currentOnlineUserIds.size;
        recordLastSeenTimestamp(key, new Date().toISOString());
        notifyListeners();
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await trackCurrentUser(channel, user.id, user.username);
        void persistOwnLastSeenInDb(user.id, true);
      }
    });

  activeChannel = channel;
}

export function startOnlinePresence(user: { id: string; username: string }): () => void {
  if (!user.id) return () => {};

  if (activeChannel && activeUserId === user.id) {
    return () => {
      if (activeUserId === user.id) {
        stopOnlinePresence();
      }
    };
  }

  stopOnlinePresence();
  activeUserId = user.id;
  activeUsername = user.username;
  isNetworkOffline = typeof navigator !== "undefined" ? navigator.onLine === false : false;

  if (!isNetworkOffline) {
    currentOnlineUserIds = new Set([user.id]);
    currentOnlineCount = 1;
  }

  attachPresenceChannel(user);
  notifyListeners();

  // Periodic heartbeat to keep DB last_seen_at accurate even before unexpected crashes
  heartbeatTimer = setInterval(() => {
    if (
      activeUserId === user.id &&
      !isNetworkOffline &&
      (typeof document === "undefined" || document.visibilityState === "visible")
    ) {
      void persistOwnLastSeenInDb(user.id);
      if (activeChannel) {
        void trackCurrentUser(activeChannel, user.id, activeUsername);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const handleVisibilityChange = () => {
      if (activeUserId !== user.id) return;
      if (document.visibilityState === "hidden") {
        void persistOwnLastSeenInDb(user.id, true);
      } else if (document.visibilityState === "visible" && !isNetworkOffline) {
        if (activeChannel) {
          void trackCurrentUser(activeChannel, user.id, activeUsername);
        } else {
          attachPresenceChannel(user);
        }
        void persistOwnLastSeenInDb(user.id, true);
      }
    };

    const handlePageExit = () => {
      if (activeUserId !== user.id) return;
      sendUnloadLastSeenBeacon(user.id);
      if (activeChannel) {
        try {
          void activeChannel.untrack();
        } catch {
          // Ignore
        }
      }
    };

    const handleOffline = () => {
      isNetworkOffline = true;
      if (activeUserId) {
        currentOnlineUserIds.delete(activeUserId);
        recordLastSeenTimestamp(activeUserId, new Date().toISOString());
      }
      notifyListeners();
    };

    const handleOnline = () => {
      isNetworkOffline = false;
      if (activeUserId) {
        currentOnlineUserIds.add(activeUserId);
        attachPresenceChannel({ id: activeUserId, username: activeUsername });
        void persistOwnLastSeenInDb(activeUserId, true);
      }
      notifyListeners();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    cleanupLifecycleListeners = () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }

  return () => {
    if (activeUserId === user.id) {
      stopOnlinePresence();
    }
  };
}

export function stopOnlinePresence(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (cleanupLifecycleListeners) {
    cleanupLifecycleListeners();
    cleanupLifecycleListeners = null;
  }

  if (activeUserId) {
    void persistOwnLastSeenInDb(activeUserId, true);
  }

  if (activeChannel) {
    try {
      void activeChannel.untrack();
    } catch {
      // Ignore
    }
    void supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  activeUserId = null;
  activeUsername = "";
  currentOnlineUserIds = new Set();
  currentOnlineCount = 0;
  notifyListeners();
}

export function getOnlineUsersCount(): number {
  return Math.max(1, getSnapshot().onlineCount);
}

export function isUserCurrentlyOnline(userId?: string | null): boolean {
  if (!userId) return false;
  return getSnapshot().onlineUserIds.has(userId);
}

export function getEffectiveLastSeen(
  userId?: string | null,
  dbLastSeenAt?: string | null,
): string | null {
  const cached = userId ? lastSeenCache[userId] : undefined;
  if (cached && dbLastSeenAt) {
    return Date.parse(cached) >= Date.parse(dbLastSeenAt) ? cached : dbLastSeenAt;
  }
  return dbLastSeenAt || cached || null;
}

export function formatLastSeen(lastSeenAt?: string | null, nowMs = Date.now()): string {
  if (!lastSeenAt) return "Offline";
  const ts = Date.parse(lastSeenAt);
  if (Number.isNaN(ts)) return "Offline";

  const diffSeconds = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSeconds < 60) {
    return "Last seen just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "Last seen 1 minute ago" : `Last seen ${diffMinutes} minutes ago`;
  }

  const lastDate = new Date(ts);
  const nowDate = new Date(nowMs);
  const lastDayStart = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate(),
  ).getTime();
  const nowDayStart = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();
  const dayDiff = Math.round((nowDayStart - lastDayStart) / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) {
    const diffHours = Math.floor(diffMinutes / 60);
    return diffHours === 1 ? "Last seen 1 hour ago" : `Last seen ${diffHours} hours ago`;
  }

  if (dayDiff === 1) {
    return "Last seen yesterday";
  }

  if (dayDiff > 1 && dayDiff < 7) {
    return `Last seen ${dayDiff} days ago`;
  }

  return `Last seen ${lastDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(lastDate.getFullYear() !== nowDate.getFullYear() ? { year: "numeric" } : {}),
  })}`;
}

export function subscribeOnlineUsersCount(listener: CountListener): () => void {
  countListeners.add(listener);
  listener(getOnlineUsersCount());
  return () => {
    countListeners.delete(listener);
  };
}

export function subscribeOnlinePresence(listener: SnapshotListener): () => void {
  snapshotListeners.add(listener);
  listener(getSnapshot());
  return () => {
    snapshotListeners.delete(listener);
  };
}

export function useOnlinePresence() {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>(() => getSnapshot());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const unsubscribe = subscribeOnlinePresence(setSnapshot);
    const ticker = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => {
      unsubscribe();
      clearInterval(ticker);
    };
  }, []);

  return {
    onlineUserIds: snapshot.onlineUserIds,
    lastSeenByUser: snapshot.lastSeenByUser,
    onlineCount: snapshot.onlineCount,
    isConnected: snapshot.isConnected,
    nowMs,
    isOnline: (userId?: string | null) => Boolean(userId && snapshot.onlineUserIds.has(userId)),
    getLastSeenLabel: (userId?: string | null, dbLastSeenAt?: string | null) => {
      if (userId && snapshot.onlineUserIds.has(userId)) return "Online";
      const effective = getEffectiveLastSeen(userId, dbLastSeenAt);
      return formatLastSeen(effective, nowMs);
    },
  };
}

export function __resetOnlinePresenceForTests() {
  stopOnlinePresence();
  lastSeenCache = {};
  lastSeenSyncDisabled = false;
  lastTouchSentAt = 0;
  isNetworkOffline = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LAST_SEEN_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
