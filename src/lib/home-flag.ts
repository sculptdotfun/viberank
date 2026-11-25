// The release switch for the v2 home. v2 can merge and run at /week while the
// home stays on the pre-v2 board; flipping VIBERANK_HOME=v2 (and redeploying)
// moves the weekly league onto "/". Server-side only: the value is read when a
// page renders, and the client learns it from the root layout.

export type HomeVariant = "v2" | "legacy";

export const DEFAULT_HOME_VARIANT: HomeVariant = "legacy";

/**
 * "v2" or "legacy" from the raw env value. Unset or blank means legacy.
 * Anything else is a typo in the deploy settings: say so loudly and keep
 * the safe default rather than guessing which home was meant.
 */
export function parseHomeVariant(raw: string | undefined | null): HomeVariant {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return DEFAULT_HOME_VARIANT;
  if (value === "v2" || value === "legacy") return value;
  console.error(`[home-flag] VIBERANK_HOME="${raw}" is not v2 or legacy; serving ${DEFAULT_HOME_VARIANT}`);
  return DEFAULT_HOME_VARIANT;
}

export function homeVariant(env: Record<string, string | undefined> = process.env): HomeVariant {
  return parseHomeVariant(env.VIBERANK_HOME);
}

/** Where "Board" goes: the home once v2 owns it, /week until then. */
export function boardHref(variant: HomeVariant): "/" | "/week" {
  return variant === "v2" ? "/" : "/week";
}
