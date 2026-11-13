import { useEffect } from "react";

export interface KeyboardViewportMetrics {
  appHeight: number;
  keyboardInset: number;
  isKeyboardOpen: boolean;
}

const KEYBOARD_MIN_INSET_PX = 110;

export function isEditableElement(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    const nonTextTypes = new Set([
      "checkbox",
      "radio",
      "file",
      "button",
      "submit",
      "reset",
      "range",
      "color",
      "hidden",
    ]);
    return !nonTextTypes.has((input.type || "text").toLowerCase());
  }
  return el.isContentEditable;
}

export function computeKeyboardMetrics(params: {
  innerHeight: number;
  innerWidth: number;
  visualHeight: number;
  visualOffsetTop?: number;
  hasFocusedEditable: boolean;
}): KeyboardViewportMetrics {
  const { innerHeight, innerWidth, visualHeight, visualOffsetTop = 0, hasFocusedEditable } = params;
  const isMobile = innerWidth < 768;
  const rawInset = Math.max(0, Math.round(innerHeight - visualHeight - visualOffsetTop));
  const keyboardInset = isMobile && rawInset >= KEYBOARD_MIN_INSET_PX ? rawInset : 0;
  const isKeyboardOpen = isMobile && (keyboardInset > 0 || (hasFocusedEditable && rawInset > 60));

  return {
    appHeight: Math.round(visualHeight || innerHeight),
    keyboardInset,
    isKeyboardOpen,
  };
}

/**
 * Tracks mobile virtual keyboard open/close state via window.visualViewport and focus events.
 * Updates --app-vh, --keyboard-inset, and body[data-keyboard-open] so fixed bottom navigation
 * yields cleanly to the soft keyboard and focused inputs remain reachable.
 */
export function useVisualKeyboard(): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;
    let baselineHeight = window.innerHeight;
    let focusTimer: number | undefined;

    const syncMetrics = () => {
      const vv = window.visualViewport;
      const currentInner = window.innerHeight;
      if (currentInner > baselineHeight && !isEditableElement(document.activeElement)) {
        baselineHeight = currentInner;
      }

      const referenceHeight = Math.max(baselineHeight, currentInner);
      const metrics = computeKeyboardMetrics({
        innerHeight: referenceHeight,
        innerWidth: window.innerWidth,
        visualHeight: vv ? vv.height : currentInner,
        visualOffsetTop: vv ? vv.offsetTop : 0,
        hasFocusedEditable: isEditableElement(document.activeElement),
      });

      root.style.setProperty("--app-vh", `${metrics.appHeight}px`);
      root.style.setProperty("--keyboard-inset", `${metrics.keyboardInset}px`);

      if (metrics.isKeyboardOpen) {
        body.dataset.keyboardOpen = "true";
      } else {
        delete body.dataset.keyboardOpen;
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (!isEditableElement(target)) return;
      syncMetrics();

      if (window.innerWidth < 768 && target instanceof HTMLElement) {
        window.clearTimeout(focusTimer);
        focusTimer = window.setTimeout(() => {
          syncMetrics();
          if (typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }, 220);
      }
    };

    const handleFocusOut = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(syncMetrics, 120);
    };

    syncMetrics();
    window.addEventListener("resize", syncMetrics);
    window.visualViewport?.addEventListener("resize", syncMetrics);
    window.visualViewport?.addEventListener("scroll", syncMetrics);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("resize", syncMetrics);
      window.visualViewport?.removeEventListener("resize", syncMetrics);
      window.visualViewport?.removeEventListener("scroll", syncMetrics);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      delete body.dataset.keyboardOpen;
      root.style.removeProperty("--app-vh");
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
