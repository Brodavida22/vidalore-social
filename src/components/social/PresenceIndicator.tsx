import { cn } from "@/lib/utils";
import { formatLastSeen } from "@/lib/onlinePresence";

const SIZE_CLASSES = {
  xs: "h-2 w-2 ring-1",
  sm: "h-2.5 w-2.5 ring-2",
  md: "h-3 w-3 ring-2",
  lg: "h-4 w-4 ring-2",
} as const;

export function PresenceDot({
  isOnline,
  lastSeenAt,
  size = "sm",
  className,
}: {
  isOnline: boolean;
  lastSeenAt?: string | null | undefined;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const label = isOnline ? "Online" : formatLastSeen(lastSeenAt);

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        "inline-block rounded-full ring-card transition-colors",
        SIZE_CLASSES[size],
        isOnline ? "bg-[#22C55E]" : "bg-zinc-500",
        className,
      )}
    />
  );
}

export function PresenceStatusText({
  isOnline,
  lastSeenAt,
  nowMs,
  showDot = false,
  className,
}: {
  isOnline: boolean;
  lastSeenAt?: string | null | undefined;
  nowMs?: number;
  showDot?: boolean;
  className?: string;
}) {
  const label = isOnline ? "Online" : formatLastSeen(lastSeenAt, nowMs);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px]",
        isOnline ? "text-[#22C55E] font-medium" : "text-muted-foreground",
        className,
      )}
    >
      {showDot && (
        <span
          className={cn("h-2 w-2 rounded-full shrink-0", isOnline ? "bg-[#22C55E]" : "bg-zinc-500")}
        />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}
