/**
 * Per-model *economics* — what developers actually spend on a model in real
 * work, as opposed to what it costs on a price list.
 *
 * Deliberately not a model directory. Specs, context windows and list pricing
 * are well covered elsewhere (modelgrep among others) and there is no reason to
 * write the fifteenth page about Opus's context window. The one thing viberank
 * can say that nobody else can is the observed economics: how much real money a
 * model accounts for, how many developers reach for it, and therefore what it
 * costs the median person who actually uses it.
 *
 * That spread is the story. Haiku shows up for hundreds of developers and
 * almost no spend; the frontier models invert it. A price-per-token table
 * cannot tell you that, because it doesn't know how people use them.
 */

import { prettyModelName } from "@/lib/utils";

export interface ModelEconomics {
  /** URL slug, e.g. "claude-opus-4-8". */
  slug: string;
  /** Display label, e.g. "claude-opus-4-8". */
  name: string;
  /** Total API-equivalent spend attributed to this model, USD. */
  spendUsd: number;
  /** Developers observed using it. 0 when it falls outside the tracked top-N. */
  developers: number;
  /** Share of all tracked model spend, 0–1. */
  spendShare: number;
  /** Spend per developer — the number that separates workhorses from frontier. */
  spendPerDeveloper: number;
  /** Raw strings that folded into this model, for transparency on the page. */
  variants: string[];
}

/**
 * A model needs this many observed developers before it earns a page. Thin
 * programmatic pages are worse than no pages — the existing /compare set makes
 * that case well enough.
 */
export const MIN_DEVELOPERS_FOR_PAGE = 20;

export function modelSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\./g, "-");
}

/**
 * Fold raw ccusage model strings into one canonical model.
 *
 * `prettyModelName` already strips the `[harness]` prefix, the provider path
 * and a trailing date stamp, which is exactly the normalisation wanted here:
 * `[pi] claude-opus-5` and `claude-opus-5` are the same model reached through
 * different harnesses, and splitting them would understate both.
 */
export function canonicalModel(raw: string): string {
  return prettyModelName(raw).toLowerCase();
}

export function buildModelEconomics(
  modelSpend: { model: string; cost: number }[],
  models: { model: string; users: number }[]
): ModelEconomics[] {
  const spend = new Map<string, { usd: number; variants: Set<string> }>();
  for (const row of modelSpend) {
    if (!row?.model) continue;
    const key = canonicalModel(row.model);
    const entry = spend.get(key) ?? { usd: 0, variants: new Set<string>() };
    entry.usd += Number(row.cost) || 0;
    entry.variants.add(row.model);
    spend.set(key, entry);
  }

  // Developer counts are per raw string too. A developer using a model through
  // two harnesses would be double-counted by summing, so take the max instead —
  // it understates slightly and never overstates, which is the right direction
  // for a number we publish.
  const devs = new Map<string, number>();
  for (const row of models) {
    if (!row?.model) continue;
    const key = canonicalModel(row.model);
    devs.set(key, Math.max(devs.get(key) ?? 0, Number(row.users) || 0));
  }

  const total = [...spend.values()].reduce((sum, e) => sum + e.usd, 0);

  return [...spend.entries()]
    .map(([name, entry]) => {
      const developers = devs.get(name) ?? 0;
      return {
        slug: modelSlug(name),
        name,
        spendUsd: entry.usd,
        developers,
        spendShare: total > 0 ? entry.usd / total : 0,
        spendPerDeveloper: developers > 0 ? entry.usd / developers : 0,
        variants: [...entry.variants].sort(),
      };
    })
    .sort((a, b) => b.spendUsd - a.spendUsd);
}

/** Models that clear the thin-content bar and get their own page. */
export function publishableModels(all: ModelEconomics[]): ModelEconomics[] {
  return all.filter((m) => m.developers >= MIN_DEVELOPERS_FOR_PAGE && m.spendUsd > 0);
}

/**
 * How a model is used, inferred from spend per developer relative to the set.
 * Stated as an observation about this cohort, never as a recommendation.
 */
export function usageProfile(model: ModelEconomics, all: ModelEconomics[]): {
  label: string;
  blurb: string;
} {
  const perDev = all.map((m) => m.spendPerDeveloper).filter((v) => v > 0).sort((a, b) => a - b);
  if (perDev.length === 0 || model.spendPerDeveloper <= 0) {
    return { label: "Unclassified", blurb: "Not enough observed usage to characterise." };
  }
  const rank = perDev.filter((v) => v < model.spendPerDeveloper).length / perDev.length;

  if (rank >= 0.75) {
    return {
      label: "Frontier workload",
      blurb:
        "High spend concentrated in relatively few developers — the pattern of a model reserved for long agentic runs rather than everyday edits.",
    };
  }
  if (rank <= 0.25) {
    return {
      label: "Everyday workhorse",
      blurb:
        "Broad adoption and low spend per developer — reached for constantly, and cheap enough that it barely registers on the bill.",
    };
  }
  return {
    label: "Mixed use",
    blurb:
      "Spend per developer sits mid-pack: used for real work without being the default for the heaviest sessions.",
  };
}
