import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  phase,
  text,
}: {
  icon: LucideIcon;
  title: string;
  phase: number;
  text: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E91E63] text-white shadow-sm">
        <Icon className="h-8 w-8" />
      </span>
      <h1 className="mt-6 text-3xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#E91E63] font-semibold">
        Arriving in Phase {phase}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
