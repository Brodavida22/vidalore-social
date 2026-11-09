import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
  showSub = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showSub?: boolean;
}) {
  const sizeClasses = {
    sm: "text-base tracking-[0.05em]",
    md: "text-xl tracking-[0.06em]",
    lg: "text-2xl sm:text-3xl tracking-[0.07em]",
  }[size];

  const subSizeClasses = {
    sm: "text-[0.55rem] tracking-[0.25em]",
    md: "text-[0.6rem] tracking-[0.28em]",
    lg: "text-[0.7rem] tracking-[0.3em]",
  }[size];

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <div className="leading-none">
        <span className={cn("font-display font-black text-foreground", sizeClasses)}>
          VIDA<span className="text-[#E91E63]">LORE</span>
        </span>
        {showSub && (
          <span
            className={cn(
              "block font-sans font-semibold text-muted-foreground uppercase mt-0.5",
              subSizeClasses,
            )}
          >
            SOCIAL
          </span>
        )}
      </div>
    </div>
  );
}
