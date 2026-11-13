import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vidalore:video-muted";
const EVENT_NAME = "vidalore:sound-pref-changed";

/**
 * Reads persisted sound preference.
 * Defaults to false (unmuted playback preferred when browser autoplay rules permit).
 */
export function getStoredMutedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setStoredMutedPreference(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "true" : "false");
  } catch {
    // Ignore storage quota / privacy mode errors
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { muted } }));
}

export function useVideoAudioPreference() {
  const [preferredMuted, setPreferredMutedState] = useState<boolean>(() =>
    getStoredMutedPreference(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChange = (event: Event) => {
      const custom = event as CustomEvent<{ muted?: boolean }>;
      if (typeof custom.detail?.muted === "boolean") {
        setPreferredMutedState(custom.detail.muted);
      } else {
        setPreferredMutedState(getStoredMutedPreference());
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setPreferredMutedState(event.newValue === "true");
      }
    };

    window.addEventListener(EVENT_NAME, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setPreferredMuted = useCallback((muted: boolean) => {
    setPreferredMutedState(muted);
    setStoredMutedPreference(muted);
  }, []);

  const togglePreferredMuted = useCallback(() => {
    const next = !getStoredMutedPreference();
    setPreferredMutedState(next);
    setStoredMutedPreference(next);
    return next;
  }, []);

  return {
    preferredMuted,
    setPreferredMuted,
    togglePreferredMuted,
  };
}
