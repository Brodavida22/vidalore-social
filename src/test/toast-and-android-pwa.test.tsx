import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

const mockSonnerCalls = vi.hoisted(() => {
  const base = vi.fn(() => "id-default");
  const success = vi.fn(() => "id-success");
  const error = vi.fn(() => "id-error");
  const warning = vi.fn(() => "id-warning");
  const info = vi.fn(() => "id-info");
  const loading = vi.fn(() => "id-loading");
  const dismiss = vi.fn();
  const promise = vi.fn();
  const custom = vi.fn();
  const message = vi.fn();
  const capturedToasterProps: Record<string, unknown>[] = [];

  const toastObj = Object.assign(base, {
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
    promise,
    custom,
    message,
  });

  return {
    base,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
    toastObj,
    capturedToasterProps,
  };
});

vi.mock("sonner", () => ({
  toast: mockSonnerCalls.toastObj,
  Toaster: (props: Record<string, unknown>) => {
    mockSonnerCalls.capturedToasterProps.push(props);
    return (
      <div
        data-testid="sonner-toaster"
        data-position={String(props["position"] ?? "")}
        data-visible-toasts={String(props["visibleToasts"] ?? "")}
        data-gap={String(props["gap"] ?? "")}
        data-close-button={String(Boolean(props["closeButton"]))}
      />
    );
  },
}));

import { toast, notify, __resetToastDedupeForTests } from "@/lib/toast";
import { Toaster, getResponsiveToastPosition } from "@/components/ui/sonner";
import { __resetPWAInstallStateForTests, isStandaloneInstalled } from "@/lib/pwaInstall";
import { useAndroidBackNavigation } from "@/lib/useAndroidBackNavigation";
import {
  computeKeyboardMetrics,
  isEditableElement,
  useVisualKeyboard,
} from "@/lib/useVisualKeyboard";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

describe("VIDALORE Unified Toast System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSonnerCalls.capturedToasterProps.length = 0;
    __resetToastDedupeForTests();
  });

  it("dispatches semantic variants with VIDALORE defaults, close button, and progress duration", () => {
    expect(notify).toBe(toast);

    toast.success("Saved changes");
    expect(mockSonnerCalls.success).toHaveBeenCalledWith(
      "Saved changes",
      expect.objectContaining({
        duration: 3500,
        closeButton: true,
        className: expect.stringContaining("vidalore-toast-success"),
        style: expect.objectContaining({ "--toast-duration": "3500ms" }),
      }),
    );

    toast.warning("Slow network detected");
    expect(mockSonnerCalls.warning).toHaveBeenCalledWith(
      "Slow network detected",
      expect.objectContaining({
        duration: 4500,
        closeButton: true,
        className: expect.stringContaining("vidalore-toast-warning"),
        style: expect.objectContaining({ "--toast-duration": "4500ms" }),
      }),
    );

    toast.error("Could not upload media");
    expect(mockSonnerCalls.error).toHaveBeenCalledWith(
      "Could not upload media",
      expect.objectContaining({
        duration: 5500,
        closeButton: true,
        className: expect.stringContaining("vidalore-toast-error"),
        style: expect.objectContaining({ "--toast-duration": "5500ms" }),
      }),
    );

    toast.info("New update ready");
    expect(mockSonnerCalls.info).toHaveBeenCalledWith(
      "New update ready",
      expect.objectContaining({
        duration: 3500,
        closeButton: true,
        className: expect.stringContaining("vidalore-toast-info"),
      }),
    );

    toast.loading("Uploading reel...");
    expect(mockSonnerCalls.loading).toHaveBeenCalledWith(
      "Uploading reel...",
      expect.objectContaining({
        duration: Number.POSITIVE_INFINITY,
        className: expect.stringContaining("vidalore-toast-persistent"),
      }),
    );

    toast.persistent("Offline mode active", { kind: "warning" });
    expect(mockSonnerCalls.warning).toHaveBeenLastCalledWith(
      "Offline mode active",
      expect.objectContaining({
        duration: Number.POSITIVE_INFINITY,
        className: expect.stringContaining("vidalore-toast-persistent"),
      }),
    );
  });

  it("suppresses duplicate notifications within the cooldown window unless allowDuplicate is set", () => {
    toast.success("Post link copied");
    toast.success("Post link copied");
    expect(mockSonnerCalls.success).toHaveBeenCalledTimes(1);

    toast.success("Post link copied", { allowDuplicate: true });
    expect(mockSonnerCalls.success).toHaveBeenCalledTimes(2);
  });

  it("positions Toaster top-center on mobile (<768px) and top-right on desktop (>=768px) with light/dark theme tokens", () => {
    expect(getResponsiveToastPosition(false)).toBe("top-center");
    expect(getResponsiveToastPosition(true)).toBe("top-right");

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = render(<Toaster />);
    const toasterEl = screen.getByTestId("sonner-toaster");
    expect(toasterEl).toHaveAttribute("data-position", "top-center");
    expect(toasterEl).toHaveAttribute("data-visible-toasts", "4");
    expect(toasterEl).toHaveAttribute("data-gap", "10");
    expect(toasterEl).toHaveAttribute("data-close-button", "true");

    const captured = mockSonnerCalls.capturedToasterProps.at(-1) as {
      toastOptions?: { classNames?: { toast?: string } };
    };
    expect(captured?.toastOptions?.classNames?.toast).toContain("bg-card");
    expect(captured?.toastOptions?.classNames?.toast).toContain("text-card-foreground");
    expect(captured?.toastOptions?.classNames?.toast).toContain("border-border");
    unmount();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width: 768px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<Toaster />);
    expect(screen.getByTestId("sonner-toaster")).toHaveAttribute("data-position", "top-right");
    window.matchMedia = originalMatchMedia;
  });
});

describe("Android WebAPK & PWA Configuration", () => {
  afterEach(() => {
    __resetPWAInstallStateForTests();
  });

  it("ships a valid standalone manifest.json with clean SVG + maskable icons and app shortcuts", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      name: string;
      short_name: string;
      display: string;
      icons: Array<{ src?: string; type?: string; purpose?: string; sizes?: string }>;
      shortcuts?: Array<{ name: string; url: string }>;
    };

    expect(manifest.display).toBe("standalone");
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(
      manifest.icons.some(
        (i) => i.src === "/icon.svg" && i.type === "image/svg+xml" && i.purpose === "any",
      ),
    ).toBe(true);
    expect(
      manifest.icons.some(
        (i) =>
          i.src === "/icon-maskable.svg" && i.type === "image/svg+xml" && i.purpose === "maskable",
      ),
    ).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === "any")).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    expect(manifest.icons.every((i) => i.purpose !== "any maskable")).toBe(true);
    expect(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length).toBeGreaterThan(0);

    const iconSvg = fs.readFileSync(path.resolve(process.cwd(), "public/icon.svg"), "utf8");
    const maskSvg = fs.readFileSync(
      path.resolve(process.cwd(), "public/icon-maskable.svg"),
      "utf8",
    );
    expect(iconSvg).toContain("<svg");
    expect(iconSvg).toContain('viewBox="0 0 512 512"');
    expect(maskSvg).toContain("<svg");
    expect(maskSvg).toContain("scale(0.8)");
  });

  it("configures Service Worker with branded offline fallback, SVG icon precache, and Supabase/range bypass", () => {
    const swPath = path.resolve(process.cwd(), "public/sw.js");
    const swSource = fs.readFileSync(swPath, "utf8");

    expect(swSource).toContain("/icon.svg");
    expect(swSource).toContain("/icon-maskable.svg");
    expect(swSource).toContain("OFFLINE_HTML");
    expect(swSource).toContain("/rest/v1/");
    expect(swSource).toContain("/auth/v1/");
    expect(swSource).toContain("/storage/v1/");
    expect(swSource).toContain('request.headers.get("range")');
  });

  it("detects standalone installed mode accurately", () => {
    __resetPWAInstallStateForTests();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(isStandaloneInstalled()).toBe(true);
    window.matchMedia = originalMatchMedia;
  });
});

describe("Android Back Navigation, Visual Keyboard & Pull-to-Refresh", () => {
  it("integrates modal closing with popstate Back and Escape key", () => {
    const onClose = vi.fn();
    const pushSpy = vi.spyOn(window.history, "pushState");

    const { unmount } = renderHook(
      ({ open }) => useAndroidBackNavigation(open, onClose, "testModal"),
      { initialProps: { open: true } },
    );

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ vidaloreOverlay: expect.stringContaining("testModal-") }),
      "",
      expect.any(String),
    );

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    // Re-open and close via Escape
    onClose.mockClear();
    const escapeHook = renderHook(() => useAndroidBackNavigation(true, onClose, "escapeModal"));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    escapeHook.unmount();

    pushSpy.mockRestore();
  });

  it("computes mobile virtual keyboard inset and syncs CSS viewport tokens", () => {
    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);
    const check = document.createElement("input");
    check.type = "checkbox";
    document.body.appendChild(check);

    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(check)).toBe(false);

    const openMetrics = computeKeyboardMetrics({
      innerHeight: 800,
      innerWidth: 390,
      visualHeight: 480,
      hasFocusedEditable: true,
    });
    expect(openMetrics.isKeyboardOpen).toBe(true);
    expect(openMetrics.keyboardInset).toBe(320);
    expect(openMetrics.appHeight).toBe(480);

    const desktopMetrics = computeKeyboardMetrics({
      innerHeight: 900,
      innerWidth: 1280,
      visualHeight: 900,
      hasFocusedEditable: true,
    });
    expect(desktopMetrics.isKeyboardOpen).toBe(false);
    expect(desktopMetrics.keyboardInset).toBe(0);

    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(window, "visualViewport", {
      value: {
        height: 490,
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    });

    input.focus();
    const { unmount } = renderHook(() => useVisualKeyboard());
    expect(document.documentElement.style.getPropertyValue("--app-vh")).toBe("490px");
    expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("310px");
    expect(document.body.dataset["keyboardOpen"]).toBe("true");
    unmount();

    expect(document.body.dataset["keyboardOpen"]).toBeUndefined();
    Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
    Object.defineProperty(window, "innerHeight", {
      value: originalInnerHeight,
      configurable: true,
    });
    input.remove();
    check.remove();
  });

  it("triggers PullToRefresh on downward pull at scroll top on /home and ignores non-home routes, touch-action restrictions, dialogs, and scrolled views", async () => {
    const originalPath = window.location.pathname;
    window.history.pushState({}, "", "/home");

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div data-testid="feed-body">Feed content</div>
        <div data-testid="touch-none-zone" style={{ touchAction: "none" }}>
          Canvas area
        </div>
        <div data-testid="touch-pan-x-zone" style={{ touchAction: "pan-x" }}>
          Horizontal swipe area
        </div>
        <div data-testid="touch-pan-y-zone" style={{ touchAction: "pan-y" }}>
          Vertical swipe area
        </div>
        <div role="dialog" data-testid="modal-body">
          Dialog content
        </div>
      </PullToRefresh>,
    );

    const feedBody = screen.getByTestId("feed-body");

    // Guard 1: ignored when scrolled down
    Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
    fireEvent.touchStart(feedBody, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(feedBody, { touches: [{ clientX: 100, clientY: 280 }] });
    await act(async () => {
      fireEvent.touchEnd(feedBody);
    });
    expect(onRefresh).not.toHaveBeenCalled();

    // Guard 2: ignored inside [role="dialog"]
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    const modalBody = screen.getByTestId("modal-body");
    fireEvent.touchStart(modalBody, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(modalBody, { touches: [{ clientX: 100, clientY: 280 }] });
    await act(async () => {
      fireEvent.touchEnd(modalBody);
    });
    expect(onRefresh).not.toHaveBeenCalled();

    // Guard 3: respects touch-action: none and touch-action: pan-x
    const touchNoneZone = screen.getByTestId("touch-none-zone");
    fireEvent.touchStart(touchNoneZone, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(touchNoneZone, { touches: [{ clientX: 100, clientY: 280 }] });
    await act(async () => {
      fireEvent.touchEnd(touchNoneZone);
    });
    expect(onRefresh).not.toHaveBeenCalled();

    const touchPanXZone = screen.getByTestId("touch-pan-x-zone");
    fireEvent.touchStart(touchPanXZone, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(touchPanXZone, { touches: [{ clientX: 100, clientY: 280 }] });
    await act(async () => {
      fireEvent.touchEnd(touchPanXZone);
    });
    expect(onRefresh).not.toHaveBeenCalled();

    // Guard 4: ignored outside main feed page (/home)
    window.history.pushState({}, "", "/explore");
    fireEvent.touchStart(feedBody, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(feedBody, { touches: [{ clientX: 100, clientY: 280 }] });
    await act(async () => {
      fireEvent.touchEnd(feedBody);
    });
    expect(onRefresh).not.toHaveBeenCalled();

    // Trigger valid pull at scroll top on /home
    window.history.pushState({}, "", "/home");
    fireEvent.touchStart(feedBody, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(feedBody, { touches: [{ clientX: 100, clientY: 130 }] });
    fireEvent.touchMove(feedBody, { touches: [{ clientX: 100, clientY: 270 }] });
    await act(async () => {
      fireEvent.touchEnd(feedBody);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Also allows pull inside touch-action: pan-y on /home
    const touchPanYZone = screen.getByTestId("touch-pan-y-zone");
    fireEvent.touchStart(touchPanYZone, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(touchPanYZone, { touches: [{ clientX: 100, clientY: 130 }] });
    fireEvent.touchMove(touchPanYZone, { touches: [{ clientX: 100, clientY: 270 }] });
    await act(async () => {
      fireEvent.touchEnd(touchPanYZone);
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);

    window.history.pushState({}, "", originalPath);
  });

  it("renders responsive DialogContent with safe-area scroll bounds and >=44px close button", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Responsive Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("w-[calc(100%-1.5rem)]");
    expect(dialog.className).toContain("overflow-y-auto");
    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(closeBtn.className).toContain("h-11");
    expect(closeBtn.className).toContain("w-11");
  });
});
