import rose from "@/assets/vidalore-rose.png";
import { cn } from "@/lib/utils";

export function RoseMark({ className }: { className?: string }) {
  return <img src={rose} alt="" aria-hidden="true" width={816} height={816} className={cn("h-9 w-9 drop-shadow-[0_0_14px_var(--color-primary)]", className)} />;
}

export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <RoseMark className={size === "lg" ? "h-16 w-16" : undefined} />
      <div className="leading-none">
        <span className={cn("font-display font-bold tracking-[0.18em] text-gradient-rose", size === "lg" ? "text-4xl" : "text-xl")}>
          VIDALORE
        </span>
        <span className={cn("block font-sans font-semibold tracking-[0.5em] text-muted-foreground", size === "lg" ? "mt-1 text-xs" : "text-[0.55rem]")}>
          SOCIAL
        </span>
      </div>
    </div>
  );
}
