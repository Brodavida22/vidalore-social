import { toast as sonnerToast, type ExternalToast } from "sonner";

export type NotificationKind = "default" | "success" | "error" | "warning" | "info" | "loading";

export interface AppToastOptions extends ExternalToast {
  /** Override duplicate suppression for intentional repeated alerts. */
  allowDuplicate?: boolean;
  /** Keep the toast visible until manually dismissed. */
  persistent?: boolean;
  /** Cooldown window in ms for deduplicating identical toasts. */
  dedupeWindowMs?: number;
}

const DEFAULT_DURATIONS: Record<NotificationKind, number> = {
  default: 3500,
  success: 3500,
  info: 3500,
  warning: 4500,
  error: 5500,
  loading: Number.POSITIVE_INFINITY,
};

const DEFAULT_DEDUPE_WINDOW_MS = 2500;
const recentToastMap = new Map<string, { id: string | number; expiresAt: number }>();

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function buildDedupeKey(
  kind: NotificationKind,
  message: unknown,
  options?: AppToastOptions,
): string | null {
  const titleText = normalizeText(message);
  if (!titleText) return null;
  const descText = normalizeText(options?.description);
  return `${kind}::${titleText}::${descText}`;
}

function prepareOptions(kind: NotificationKind, options?: AppToastOptions): ExternalToast {
  const {
    allowDuplicate: _allowDuplicate,
    persistent,
    dedupeWindowMs: _dedupeWindowMs,
    duration,
    className,
    style,
    closeButton,
    ...rest
  } = options ?? {};

  const resolvedDuration = persistent
    ? Number.POSITIVE_INFINITY
    : typeof duration === "number"
      ? duration
      : DEFAULT_DURATIONS[kind];

  const isTimed = Number.isFinite(resolvedDuration) && resolvedDuration > 0;
  const mergedStyle: React.CSSProperties = {
    ...(style ?? {}),
    ...(isTimed ? ({ "--toast-duration": `${resolvedDuration}ms` } as React.CSSProperties) : {}),
  };

  const progressClass = isTimed ? "vidalore-toast-timed" : "vidalore-toast-persistent";
  const mergedClassName = ["vidalore-toast", `vidalore-toast-${kind}`, progressClass, className]
    .filter(Boolean)
    .join(" ");

  return {
    ...rest,
    duration: resolvedDuration,
    closeButton: closeButton ?? true,
    className: mergedClassName,
    style: mergedStyle,
  };
}

function dispatchToast(
  kind: NotificationKind,
  message: Parameters<typeof sonnerToast>[0],
  options?: AppToastOptions,
): string | number {
  const dedupeKey =
    !options?.allowDuplicate && !options?.id && kind !== "loading"
      ? buildDedupeKey(kind, message, options)
      : null;

  const now = Date.now();
  if (dedupeKey) {
    const existing = recentToastMap.get(dedupeKey);
    if (existing && existing.expiresAt > now) {
      return existing.id;
    }
  }

  const prepared = prepareOptions(kind, options);
  let id: string | number;

  switch (kind) {
    case "success":
      id = sonnerToast.success(message, prepared);
      break;
    case "error":
      id = sonnerToast.error(message, prepared);
      break;
    case "warning":
      id = sonnerToast.warning(message, prepared);
      break;
    case "info":
      id = sonnerToast.info(message, prepared);
      break;
    case "loading":
      id = sonnerToast.loading(message, prepared);
      break;
    default:
      id = sonnerToast(message, prepared);
      break;
  }

  if (dedupeKey) {
    const windowMs = options?.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
    recentToastMap.set(dedupeKey, { id, expiresAt: now + windowMs });
    if (recentToastMap.size > 64) {
      for (const [k, v] of recentToastMap.entries()) {
        if (v.expiresAt <= now) recentToastMap.delete(k);
      }
    }
  }

  return id;
}

export function __resetToastDedupeForTests(): void {
  recentToastMap.clear();
}

type ToastCallable = ((
  message: Parameters<typeof sonnerToast>[0],
  options?: AppToastOptions,
) => string | number) & {
  success: (
    message: Parameters<typeof sonnerToast>[0],
    options?: AppToastOptions,
  ) => string | number;
  error: (message: Parameters<typeof sonnerToast>[0], options?: AppToastOptions) => string | number;
  warning: (
    message: Parameters<typeof sonnerToast>[0],
    options?: AppToastOptions,
  ) => string | number;
  info: (message: Parameters<typeof sonnerToast>[0], options?: AppToastOptions) => string | number;
  loading: (
    message: Parameters<typeof sonnerToast>[0],
    options?: AppToastOptions,
  ) => string | number;
  persistent: (
    message: Parameters<typeof sonnerToast>[0],
    options?: AppToastOptions & { kind?: Exclude<NotificationKind, "loading"> },
  ) => string | number;
  promise: typeof sonnerToast.promise;
  dismiss: typeof sonnerToast.dismiss;
  custom: typeof sonnerToast.custom;
  message: typeof sonnerToast.message;
};

const toastFn = ((message: Parameters<typeof sonnerToast>[0], options?: AppToastOptions) =>
  dispatchToast("default", message, options)) as ToastCallable;

toastFn.success = (message, options) => dispatchToast("success", message, options);
toastFn.error = (message, options) => dispatchToast("error", message, options);
toastFn.warning = (message, options) => dispatchToast("warning", message, options);
toastFn.info = (message, options) => dispatchToast("info", message, options);
toastFn.loading = (message, options) => dispatchToast("loading", message, options);
toastFn.persistent = (message, options) => {
  const { kind = "info", ...rest } = options ?? {};
  return dispatchToast(kind, message, {
    ...rest,
    persistent: true,
    duration: Number.POSITIVE_INFINITY,
  });
};
toastFn.promise = sonnerToast.promise;
toastFn.dismiss = sonnerToast.dismiss;
toastFn.custom = sonnerToast.custom;
toastFn.message = sonnerToast.message;

export const toast = toastFn;
export const notify = toastFn;
