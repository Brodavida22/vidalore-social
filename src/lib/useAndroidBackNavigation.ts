import { useEffect, useRef } from "react";

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
    closingViaPopstateRef.current = false;

    try {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.pushState(
        { ...currentState, vidaloreOverlay: token },
        "",
        window.location.href,
      );
      pushedHistoryRef.current = true;
    } catch {
      pushedHistoryRef.current = false;
    }

    const handlePopState = () => {
      if (!pushedHistoryRef.current) return;
      pushedHistoryRef.current = false;
      closingViaPopstateRef.current = true;
      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);

      if (pushedHistoryRef.current && !closingViaPopstateRef.current) {
        pushedHistoryRef.current = false;
        try {
          const state = window.history.state as { vidaloreOverlay?: string } | null;
          if (state?.vidaloreOverlay === token) {
            window.history.back();
          }
        } catch {
          // Ignore history cleanup errors
        }
      }
      closingViaPopstateRef.current = false;
    };
  }, [isOpen, stateKey]);
}
