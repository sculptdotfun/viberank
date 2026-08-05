/**
 * Subscription-vs-API comparison for AI coding usage.
 *
 * ccusage reports what your usage *would* cost at API list prices. Almost
 * nobody actually pays that — most people are on a flat subscription. The gap
 * between those two numbers is the thing this file computes, and it is the
 * single most useful thing viberank's data can tell an individual developer.
 *
 * Every price here is a monthly-billing list price in USD, checked against the
 * vendor's own pricing page on 2026-08-05. They are asserted in the tests, so
 * an unsourced edit fails CI rather than quietly misinforming someone.
 */

export interface Plan {
  id: string;
  name: string;
  monthly: number;
  blurb: string;
  /**
   * Usage capacity relative to the tool's entry paid plan, when the vendor
   * publishes one. `null` means they don't, and we must not invent it — see
   * `coversBurn` for what that changes.
   */
  usageMultiple: number | null;
}

export interface ToolPlans {
  id: string;
  /** Matches the `tools` values stored on a submission. */
  label: string;
  plans: Plan[];
  /**
   * API-equivalent burn the entry paid plan is sized for. An estimate — every
   * vendor states capacity relative to their own tiers, never in dollars — so
   * it only ever picks which plan to *suggest*. No saving figure depends on it.
   */
  entryPlanBurn: number;
  /** Shown verbatim on the page so the numbers are auditable. */
  source: string;
  /** Set when the vendor publishes no comparable usage tiers. */
  capacityUnknownNote?: string;
}

export const TOOL_PLANS: ToolPlans[] = [
  {
    id: "claude",
    label: "Claude Code",
    entryPlanBurn: 100,
    source: "claude.com/pricing and the Max plan help centre article",
    plans: [
      { id: "pro", name: "Claude Pro", monthly: 20, blurb: "Everyday coding, a few hours a day.", usageMultiple: 1 },
      { id: "max5", name: "Claude Max 5x", monthly: 100, blurb: "Most of a working day in Claude Code.", usageMultiple: 5 },
      { id: "max20", name: "Claude Max 20x", monthly: 200, blurb: "All day, every day, plus parallel agents.", usageMultiple: 20 },
    ],
  },
  {
    id: "codex",
    label: "Codex",
    entryPlanBurn: 100,
    source: "learn.chatgpt.com/docs/pricing",
    plans: [
      { id: "go", name: "ChatGPT Go", monthly: 8, blurb: "Lightweight coding tasks.", usageMultiple: 0.4 },
      { id: "plus", name: "ChatGPT Plus", monthly: 20, blurb: "A few focused coding sessions a week.", usageMultiple: 1 },
      // OpenAI states Pro as "5x higher rate limits than Plus".
      { id: "pro", name: "ChatGPT Pro", monthly: 100, blurb: "5× the rate limits of Plus.", usageMultiple: 5 },
      { id: "pro200", name: "ChatGPT Pro ($200 tier)", monthly: 200, blurb: "Highest limits, plus unlimited voice.", usageMultiple: 5 },
    ],
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    entryPlanBurn: 100,
    source: "github.com/features/copilot/plans",
    capacityUnknownNote:
      "GitHub does not publish usage tiers as multiples of each other, so no plan is marked as too small — only the break-even arithmetic is shown.",
    plans: [
      { id: "pro", name: "Copilot Pro", monthly: 10, blurb: "Individual developers.", usageMultiple: null },
      { id: "proplus", name: "Copilot Pro+", monthly: 39, blurb: "Heavier agent use.", usageMultiple: null },
      { id: "max", name: "Copilot Max", monthly: 100, blurb: "Sustained, high-volume agent workflows.", usageMultiple: null },
    ],
  },
];

export const DEFAULT_TOOL = TOOL_PLANS[0];

export function toolPlansFor(toolId: string): ToolPlans {
  return TOOL_PLANS.find((tool) => tool.id === toolId) ?? DEFAULT_TOOL;
}

/**
 * Whether a plan's usage tier plausibly carries this much burn.
 *
 * This is what stops the comparison table from lying. Raw arithmetic says the
 * cheapest plan always "saves" the most — Claude Pro appears to beat Max
 * against a $1,300/month burn, because it costs less. But Pro would rate-limit
 * that user at a fraction of their usage, so presenting it as the bigger
 * saving is nonsense.
 *
 * When a vendor publishes no usage multiples we return `true` rather than
 * guess: showing an invented "too small" label would be a different kind of
 * lie from the one we're fixing.
 */
export function coversBurn(tool: ToolPlans, plan: Plan, monthlyApiCost: number): boolean {
  if (plan.usageMultiple === null) return true;
  return monthlyApiCost <= tool.entryPlanBurn * plan.usageMultiple;
}

export interface PlanVerdict {
  /**
   * `null` when the vendor publishes no usage tiers. Picking the cheapest plan
   * in that case would claim a $10 seat carries $1,300/month of usage — the
   * same lie the capacity check exists to prevent, just from the other side.
   * Better to show the prices and decline to rank them.
   */
  recommended: Plan | null;
  /** Monthly saving vs paying API list prices for the same usage. */
  savingVsApi: number;
  multiple: number;
  /** Burn exceeds what even the largest plan is sized for. */
  exceedsTopPlan: boolean;
}

export function comparePlans(tool: ToolPlans, monthlyApiCost: number): PlanVerdict {
  const burn = Number.isFinite(monthlyApiCost) && monthlyApiCost > 0 ? monthlyApiCost : 0;
  const top = tool.plans[tool.plans.length - 1];
  const ranked = tool.plans.some((plan) => plan.usageMultiple !== null);

  const recommended = ranked
    ? tool.plans.find((plan) => coversBurn(tool, plan, burn)) ?? top
    : null;

  // Not clamped at zero: below the price of the cheapest plan the API is
  // genuinely cheaper, and the tool should say so rather than manufacture a
  // win. A calculator that can never tell you "don't buy this" isn't useful.
  const savingVsApi = recommended ? burn - recommended.monthly : 0;

  return {
    recommended,
    savingVsApi,
    multiple: recommended && recommended.monthly > 0 ? burn / recommended.monthly : 0,
    exceedsTopPlan:
      top.usageMultiple !== null && burn > tool.entryPlanBurn * top.usageMultiple,
  };
}

/** Whether this tool publishes enough to rank its plans by capacity. */
export function hasCapacityData(tool: ToolPlans): boolean {
  return tool.plans.some((plan) => plan.usageMultiple !== null);
}

/**
 * Where a burn figure sits against a sorted array of everyone else's.
 * Returns 0-100. An empty cohort yields 0 rather than dividing by zero.
 */
export function percentileOf(sortedBurns: number[], burn: number): number {
  if (sortedBurns.length === 0) return 0;

  // Count strictly-below, so the cheapest developer lands at p0 rather than
  // inheriting a percentile from ties above them.
  let below = 0;
  for (const value of sortedBurns) {
    if (value < burn) below++;
    else break;
  }

  return Math.round((below / sortedBurns.length) * 100);
}

/** Monthly burn implied by a total spend over a span of days. */
export function monthlyBurn(totalCost: number, days: number): number {
  if (!(days > 0) || !(totalCost > 0)) return 0;
  return (totalCost / days) * 30;
}
