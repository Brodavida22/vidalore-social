import { useEffect, useRef } from "react";

const activeOverlayStack: string[] = [];
let suppressHistoryBackUntilMs = 0;

/**
 * Call immediately before closing a drawer or modal when the close is part of
 * a route navigation, sign-out, or transition to another overlay. This prevents
 * unmount/close cleanup from calling window.history.back() asynchronously and
 * cancelling the navigation or closing the newly opened overlay.
 */
export function suppressOverlayHistoryBack(durationMs = 800): void {
  suppressHistoryBackUntilMs = Math.max(suppressHistoryBackUntilMs, Date.now() + durationMs);
}

/**
 * Integrates modal/drawer overlays with Android hardware/gesture Back (popstate)
 * and Escape key so pressing Back closes the top overlay cleanly instead of exiting
 * the WebAPK or navigating away from the current screen.
 */
export function useAndroidBackNavigation(
  isOpen: boolean,
  onClose: () => void,
  stateKey = "vidaloreOverlay",
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const pushedHistoryRef = useRef(false);
  const closingViaPopstateRef = useRef(false);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const token = `${stateKey}-${Math.random().toString(36).slice(2, 9)}`;
    const pushedHref = window.location.href;
    closingViaPopstateRef.current = false;
    activeOverlayStack.push(token);

    try {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.pushState({ ...currentState, vidaloreOverlay: token }, "", pushedHref);
      pushedHistoryRef.current = true;
    } catch {
      pushedHistoryRef.current = false;
    }

    const handlePopState = () => {
      if (!pushedHistoryRef.current) return;
      // Only let the topmost active overlay respond to Back so closing an
      // earlier overlay never accidentally closes a newly opened modal.
      if (activeOverlayStack[activeOverlayStack.length - 1] !== token) {
        return;
      }
      pushedHistoryRef.current = false;
      closingViaPopstateRef.current = true;
      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeOverlayStack[activeOverlayStack.length - 1] !== token) {
          return;
        }
        onCloseRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);

      const idx = activeOverlayStack.lastIndexOf(token);
      if (idx !== -1) {
        activeOverlayStack.splice(idx, 1);
      }

      const wasClosedViaPopstate = closingViaPopstateRef.current;
      closingViaPopstateRef.current = false;

      if (!pushedHistoryRef.current || wasClosedViaPopstate) {
        pushedHistoryRef.current = false;
        return;
      }

      pushedHistoryRef.current = false;

      // Never pop browser history when navigating away, signing out, or handing off
      // directly to another modal/overlay.
      if (
        Date.now() < suppressHistoryBackUntilMs ||
        activeOverlayStack.length > 0 ||
        window.location.href !== pushedHref
      ) {
        return;
      }

      // Defer one microtask so @tanstack/history can flush any queued pushState/replaceState
      // from a <Link> or router.navigate() call before we decide whether to pop the dummy entry.
      queueMicrotask(() => {
        if (
          Date.now() < suppressHistoryBackUntilMs ||
          activeOverlayStack.length > 0 ||
          window.location.href !== pushedHref
        ) {
          return;
        }
        try {
          const state = window.history.state as { vidaloreOverlay?: string } | null;
          if (state?.vidaloreOverlay === token) {
            window.history.back();
          }
        } catch {
          // Ignore history cleanup errors
        }
      });
    };
  }, [isOpen, stateKey]);
}
