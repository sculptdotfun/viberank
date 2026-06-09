import { getTier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  totalCost: number;
  size?: "xs" | "sm" | "md";
  /** Glyph-only, no pill background — for tight spots like table cells. */
  bare?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  xs: "text-[9px] px-1 py-px gap-0.5",
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-1 gap-1.5",
};

export default function TierBadge({ totalCost, size = "sm", bare = false, className }: TierBadgeProps) {
  const tier = getTier(totalCost);
  // White-hot top tier gets a faint glow.
  const glow = tier.key === "supernova" ? { textShadow: "0 0 10px rgba(191, 219, 254, 0.5)" } : undefined;

  if (bare) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 font-mono uppercase tracking-[0.12em]", SIZE_CLASSES[size].split(" ")[0], className)}
        style={{ color: tier.color, ...glow }}
        title={`${tier.name} tier — $${tier.min.toLocaleString()}+ spent`}
      >
        <span aria-hidden>{tier.glyph}</span>
        {tier.name}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-mono font-medium uppercase tracking-[0.12em] leading-none",
        SIZE_CLASSES[size],
        className
      )}
      style={{ color: tier.color, background: tier.soft, ...glow }}
      title={`${tier.name} tier — $${tier.min.toLocaleString()}+ spent`}
    >
      <span aria-hidden>{tier.glyph}</span>
      {tier.name}
    </span>
  );
}
