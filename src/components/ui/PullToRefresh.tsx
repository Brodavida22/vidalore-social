import { useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD_PX = 68;
const MAX_PULL_PX = 96;
const DEFAULT_ALLOWED_PATHS = ["/home"];

function normalizePath(pathname: string): string {
  const cleaned = pathname.replace(/\/+$/, "");
  return cleaned || "/";
}

function doesTouchActionAllowVerticalPull(
  target: EventTarget | null,
  boundary: HTMLElement | null,
): boolean {
  if (!(target instanceof Element) || typeof window === "undefined") {
    return true;
  }

  let current: Element | null = target;
  while (current) {
    const computed = window.getComputedStyle(current);
    const inlineTouchAction = current instanceof HTMLElement ? current.style.touchAction : "";
    const raw = (inlineTouchAction || computed.touchAction || "").trim().toLowerCase();

    if (raw === "none") {
      return false;
    }

    if (raw && raw !== "auto" && raw !== "manipulation") {
      const tokens = raw.split(/\s+/);
      if (!tokens.includes("pan-y") && !tokens.includes("pan-down")) {
        return false;
      }
    } else if (current.classList.length > 0) {
      const cls = current.classList;
      if (cls.contains("touch-none")) {
        return false;
      }
      const hasRestrictiveTouchClass =
        cls.contains("touch-pan-x") ||
        cls.contains("touch-pan-left") ||
        cls.contains("touch-pan-right") ||
        cls.contains("touch-pan-up") ||
        cls.contains("touch-pinch-zoom");
      const hasVerticalAllowClass =
        cls.contains("touch-pan-y") ||
        cls.contains("touch-pan-down") ||
        cls.contains("touch-manipulation") ||
        cls.contains("touch-auto");
      if (hasRestrictiveTouchClass && !hasVerticalAllowClass) {
        return false;
      }
    }

    if (current === boundary || current === document.body) {
      break;
    }
    current = current.parentElement;
  }

  return true;
}

function isAtScrollTop(target: EventTarget | null, boundary: HTMLElement | null): boolean {
  if (typeof window === "undefined") return false;
  if (window.scrollY > 2) return false;
  if ((document.documentElement?.scrollTop ?? 0) > 2) return false;
  if ((document.body?.scrollTop ?? 0) > 2) return false;

  if (target instanceof Element) {
    let current: Element | null = target;
    while (current) {
      if (current.scrollTop > 2 && current.scrollHeight > current.clientHeight) {
        return false;
      }
      if (current === boundary || current === document.body) {
        break;
      }
      current = current.parentElement;
    }
  }

  return true;
}

export function PullToRefresh({
  onRefresh,
  isRefreshing = false,
  disabled = false,
  allowedPaths = DEFAULT_ALLOWED_PATHS,
  children,
}: {
  onRefresh: () => Promise<unknown> | void;
  isRefreshing?: boolean;
  disabled?: boolean;
  allowedPaths?: string[];
  children: ReactNode;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  const activeRefreshing = isRefreshing || internalRefreshing;

  function isOnAllowedRoute(): boolean {
    if (typeof window === "undefined") return false;
    const currentPath = normalizePath(window.location.pathname);
    return allowedPaths.some((p) => normalizePath(p) === currentPath);
  }

  function canStartPull(target: EventTarget | null): boolean {
    if (disabled || activeRefreshing || typeof window === "undefined") return false;
    if (!isOnAllowedRoute()) return false;
    if (document.body.dataset["activeChat"] === "true") return false;
    if (!isAtScrollTop(target, containerRef.current)) return false;
    if (!doesTouchActionAllowVerticalPull(target, containerRef.current)) return false;

    if (target instanceof Element) {
      if (
        target.closest(
          '[role="dialog"], [data-no-pull-refresh="true"], textarea, input, select, [contenteditable="true"]',
        )
      ) {
        return false;
      }
      // Do not hijack horizontal scrollers like the Stories strip
      const horizontalScroller = target.closest(".overflow-x-auto");
      if (horizontalScroller && horizontalScroller.scrollWidth > horizontalScroller.clientWidth) {
        return false;
      }
    }
    return true;
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1 || !canStartPull(e.target)) {
      startYRef.current = null;
      startXRef.current = null;
      pullingRef.current = false;
      return;
    }
    startYRef.current = e.touches[0]?.clientY ?? null;
    startXRef.current = e.touches[0]?.clientX ?? null;
    pullingRef.current = false;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (startYRef.current === null || startXRef.current === null || activeRefreshing) return;
    if (!isOnAllowedRoute()) {
      startYRef.current = null;
      startXRef.current = null;
      pullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0]?.clientY ?? startYRef.current;
    const currentX = e.touches[0]?.clientX ?? startXRef.current;
    const deltaY = currentY - startYRef.current;
    const deltaX = Math.abs(currentX - startXRef.current);

    if (!pullingRef.current) {
      if (deltaY < 10) return;
      if (deltaX > deltaY || !isAtScrollTop(e.target, containerRef.current)) {
        startYRef.current = null;
        startXRef.current = null;
        return;
      }
      pullingRef.current = true;
    }

    if (deltaY <= 0) {
      setPullDistance(0);
      return;
    }

    const damped = Math.min(MAX_PULL_PX, Math.round(deltaY * 0.5));
    setPullDistance(damped);
  }

  async function handleTouchEnd() {
    const reachedThreshold =
      pullingRef.current && pullDistance >= PULL_THRESHOLD_PX && isOnAllowedRoute();
    startYRef.current = null;
    startXRef.current = null;
    pullingRef.current = false;

    if (reachedThreshold && !activeRefreshing) {
      setInternalRefreshing(true);
      setPullDistance(48);
      try {
        await onRefresh();
      } finally {
        setInternalRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }

  const showIndicator = pullDistance > 8 || activeRefreshing;
  const readyToTrigger = pullDistance >= PULL_THRESHOLD_PX;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => void handleTouchEnd()}
      onTouchCancel={() => {
        startYRef.current = null;
        startXRef.current = null;
        pullingRef.current = false;
        setPullDistance(0);
      }}
      className="relative touch-manipulation overscroll-y-contain"
    >
      {showIndicator && (
        <div
          aria-live="polite"
          style={{ height: `${Math.max(activeRefreshing ? 44 : pullDistance, 36)}px` }}
          className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm">
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#E91E63] transition-transform ${
                activeRefreshing ? "animate-spin" : readyToTrigger ? "rotate-180" : ""
              }`}
            />
            <span>
              {activeRefreshing
                ? "Refreshing..."
                : readyToTrigger
                  ? "Release to refresh"
                  : "Pull to refresh"}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
