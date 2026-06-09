// Fire-themed spend tiers, inspired by ranked ladders (and viberank's flame
// accent). Thresholds are calibrated against the live cost distribution as of
// June 2026 (797 users): median best-submission ≈ $1.25k, p90 ≈ $6.3k,
// top ≈ $57k. Roughly: Ember = active, Flame = top half, Blaze = top 15%,
// Inferno = top 3%, Supernova = top 0.5%.
export interface Tier {
  key: "spark" | "ember" | "flame" | "blaze" | "inferno" | "supernova";
  name: string;
  glyph: string;
  /** Minimum total cost (USD) to hold this tier. */
  min: number;
  /** Text color on dark surfaces. */
  color: string;
  /** Translucent badge background. */
  soft: string;
}

// Ascending order — getTier walks this from the top down.
export const TIERS: Tier[] = [
  { key: "spark", name: "Spark", glyph: "✧", min: 0, color: "#9aa0a8", soft: "rgba(154, 160, 168, 0.12)" },
  { key: "ember", name: "Ember", glyph: "✦", min: 100, color: "#c2703f", soft: "rgba(194, 112, 63, 0.14)" },
  { key: "flame", name: "Flame", glyph: "◆", min: 1_000, color: "#f97316", soft: "rgba(249, 115, 22, 0.14)" },
  { key: "blaze", name: "Blaze", glyph: "❖", min: 5_000, color: "#fbbf24", soft: "rgba(251, 191, 36, 0.13)" },
  { key: "inferno", name: "Inferno", glyph: "✶", min: 15_000, color: "#f87171", soft: "rgba(248, 113, 113, 0.13)" },
  { key: "supernova", name: "Supernova", glyph: "✺", min: 50_000, color: "#dbeafe", soft: "rgba(191, 219, 254, 0.14)" },
];

export function getTier(totalCost: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (totalCost >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[0];
}

export function getNextTier(totalCost: number): Tier | null {
  const current = getTier(totalCost);
  const idx = TIERS.findIndex((t) => t.key === current.key);
  return TIERS[idx + 1] ?? null;
}

/** Progress within the current tier band, for "$X to Blaze" UI. */
export function getTierProgress(totalCost: number): {
  tier: Tier;
  next: Tier | null;
  /** 0–1 within the current band; 1 when at the top tier. */
  progress: number;
  /** Dollars left to the next tier; 0 at the top tier. */
  remaining: number;
} {
  const tier = getTier(totalCost);
  const next = getNextTier(totalCost);
  if (!next) return { tier, next: null, progress: 1, remaining: 0 };
  const span = next.min - tier.min;
  const progress = Math.min(1, Math.max(0, (totalCost - tier.min) / span));
  return { tier, next, progress, remaining: Math.max(0, next.min - totalCost) };
}
