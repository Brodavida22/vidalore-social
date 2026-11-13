import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type PresenceListener = (count: number) => void;

let activeChannel: RealtimeChannel | null = null;
let activeUserId: string | null = null;
let currentOnlineCount = 1;
const listeners = new Set<PresenceListener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentOnlineCount);
  }
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
      currentOnlineCount = Math.max(1, Object.keys(state).length);
      notifyListeners();
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await channel.track({
            userId: user.id,
            username: user.username,
            onlineAt: new Date().toISOString(),
          });
        } catch {
          // Presence tracking failures are non-fatal
        }
      }
    });

  activeChannel = channel;

  return () => {
    if (activeChannel === channel) {
      stopOnlinePresence();
    }
  };
}

export function stopOnlinePresence(): void {
  if (activeChannel) {
    void supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
  activeUserId = null;
  currentOnlineCount = 1;
}

export function getOnlineUsersCount(): number {
  return currentOnlineCount;
}

export function subscribeOnlineUsersCount(listener: PresenceListener): () => void {
  listeners.add(listener);
  listener(currentOnlineCount);
  return () => {
    listeners.delete(listener);
  };
}
