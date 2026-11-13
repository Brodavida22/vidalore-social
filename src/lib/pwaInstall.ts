import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PWAInstallOutcome =
  "accepted" | "dismissed" | "already-installed" | "ios-instructions" | "manual-instructions";

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let appInstalledFlag = false;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore subscriber callback errors
    }
  });
}

export function isStandaloneInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (appInstalledFlag) return true;

  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      return true;
    }
    if (window.matchMedia?.("(display-mode: window-controls-overlay)").matches) {
      return true;
    }
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) {
      return true;
    }
  } catch {
    // Ignore matchMedia errors
  }

  return false;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleHandheld = /iphone|ipad|ipod/i.test(ua);
  const isIPadOSDesktopUA =
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return isAppleHandheld || isIPadOSDesktopUA;
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

export function initPWAInstallListener(): void {
  if (typeof window === "undefined" || listenersInitialized) return;
  listenersInitialized = true;

  if (isStandaloneInstalled()) {
    appInstalledFlag = true;
  }

  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener("appinstalled", () => {
    appInstalledFlag = true;
    deferredInstallPrompt = null;
    notifySubscribers();
  });
}

// Initialize immediately on client module evaluation so early prompts are never missed
if (typeof window !== "undefined") {
  initPWAInstallListener();
}

export function __resetPWAInstallStateForTests(): void {
  deferredInstallPrompt = null;
  appInstalledFlag = false;
  listenersInitialized = false;
  subscribers.clear();
}

export function usePWAInstall() {
  const [canPromptInstall, setCanPromptInstall] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [platform, setPlatform] = useState<{ isIOS: boolean; isAndroid: boolean }>({
    isIOS: false,
    isAndroid: false,
  });
  const [isInstalling, setIsInstalling] = useState(false);

  const syncState = useCallback(() => {
    setCanPromptInstall(Boolean(deferredInstallPrompt));
    setIsInstalled(isStandaloneInstalled());
  }, []);

  useEffect(() => {
    initPWAInstallListener();
    syncState();
    setPlatform({
      isIOS: isIOSDevice(),
      isAndroid: isAndroidDevice(),
    });
    subscribers.add(syncState);

    const media = window.matchMedia?.("(display-mode: standalone)");
    const handleMediaChange = () => syncState();
    media?.addEventListener?.("change", handleMediaChange);

    return () => {
      subscribers.delete(syncState);
      media?.removeEventListener?.("change", handleMediaChange);
    };
  }, [syncState]);

  const promptInstall = useCallback(async (): Promise<PWAInstallOutcome> => {
    if (isStandaloneInstalled()) {
      appInstalledFlag = true;
      syncState();
      return "already-installed";
    }

    if (deferredInstallPrompt) {
      setIsInstalling(true);
      try {
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          appInstalledFlag = true;
          deferredInstallPrompt = null;
          syncState();
          return "accepted";
        }
        syncState();
        return "dismissed";
      } catch (err) {
        console.warn("PWA install prompt error:", err);
        syncState();
      } finally {
        setIsInstalling(false);
      }
    }

    if (isIOSDevice()) {
      return "ios-instructions";
    }

    return "manual-instructions";
  }, [syncState]);

  return {
    canPromptInstall,
    isInstalled,
    isIOS: platform.isIOS,
    isAndroid: platform.isAndroid,
    isInstalling,
    promptInstall,
  };
}
