import { useMemo } from "react";

// Decorative floating petals; hidden for users who prefer reduced motion.
export function RosePetals({ count = 16 }: { count?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 61) % 100,
        delay: (i * 1.7) % 14,
        duration: 12 + ((i * 3) % 10),
        size: 10 + ((i * 7) % 14),
        drift: (i % 2 ? 1 : -1) * (30 + ((i * 13) % 70)) + "px",
      })),
    [count],
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((p, i) => (
        <span
          key={i}
          className="animate-petal absolute -top-10 block rounded-[60%_0_60%_0] bg-gradient-rose opacity-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.8,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: p.drift,
          }}
        />
      ))}
    </div>
  );
}
