/**
 * Subscription-vs-API comparison for Claude Code usage.
 *
 * ccusage reports what your usage *would* cost at API list prices. Almost
 * nobody actually pays that — most people are on a flat subscription. The gap
 * between those two numbers is the thing this file computes, and it is the
 * single most useful thing viberank's data can tell an individual developer.
 *
 * Prices verified 2026-08-05 against claude.com/pricing and the Max plan help
 * centre article. They are monthly-billing list prices in USD.
 */

export interface Plan {
  id: string;
  name: string;
  /** Monthly price in USD, billed monthly. */
  monthly: number;
  /** What the plan is for, in one line. */
  blurb: string;
  /**
   * Rough ceiling on sustainable API-equivalent burn, expressed as a multiple
   * of Pro. Anthropic publishes Max as "5x" and "20x" Pro usage rather than a
   * dollar figure, so this is a relative capacity hint, not a billing cap.
   */
  usageMultiple: number;
}

export const PLANS: Plan[] = [
  {
    id: "pro",
    name: "Claude Pro",
    monthly: 20,
    blurb: "Everyday coding, a few hours a day.",
    usageMultiple: 1,
  },
  {
    id: "max5",
    name: "Claude Max 5x",
    monthly: 100,
    blurb: "Most of a working day in Claude Code.",
    usageMultiple: 5,
  },
  {
    id: "max20",
    name: "Claude Max 20x",
    monthly: 200,
    blurb: "All day, every day, plus parallel agents.",
    usageMultiple: 20,
  },
];

/** Anthropic API list prices, USD per million tokens. Verified 2026-08-05. */
export const API_PRICES = [
  { model: "Claude Opus 5", input: 5, output: 25 },
  { model: "Claude Sonnet 5", input: 3, output: 15 },
  { model: "Claude Haiku 4.5", input: 1, output: 5 },
] as const;

export interface PlanVerdict {
  /** The cheapest plan whose usage tier plausibly covers this burn. */
  recommended: Plan;
  /** Monthly saving vs paying API list prices for the same usage. */
  savingVsApi: number;
  /** How many times over the plan pays for itself. Infinity guarded to 0 burn. */
  multiple: number;
  /**
   * True when burn is high enough that even the largest plan's usage limits
   * are likely to bind. The saving is still real, but so are the rate limits.
   */
  exceedsTopPlan: boolean;
}

/**
 * Pro is sized for roughly this much API-equivalent burn per month. Derived
 * from viberank's own distribution rather than published limits: Anthropic
 * states Max as a multiple of Pro, never as a dollar figure, so any absolute
 * number here is an estimate. Used only to pick which plan to *suggest* — the
 * saving figure below never depends on it.
 */
const PRO_EQUIVALENT_BURN = 100;

/**
 * Whether a plan's usage tier plausibly carries this much burn.
 *
 * This is what stops the comparison table from lying. Raw arithmetic says the
 * cheapest plan always "saves" the most — Pro appears to save more than Max
 * against a $1,300/month burn, because it costs less. But Pro would rate-limit
 * that user at a fraction of their usage, so presenting it as the bigger
 * saving is nonsense. The table has to show capacity alongside price.
 */
export function coversBurn(plan: Plan, monthlyApiCost: number): boolean {
  return monthlyApiCost <= PRO_EQUIVALENT_BURN * plan.usageMultiple;
}

/**
 * Given an API-equivalent monthly burn, work out which plan to be on and what
 * it saves. `monthlyApiCost` is what ccusage says the month would cost at list
 * prices.
 */
export function comparePlans(monthlyApiCost: number): PlanVerdict {
  const burn = Number.isFinite(monthlyApiCost) && monthlyApiCost > 0 ? monthlyApiCost : 0;

  const recommended =
    PLANS.find((plan) => burn <= PRO_EQUIVALENT_BURN * plan.usageMultiple) ??
    PLANS[PLANS.length - 1];

  // The saving is burn minus the subscription price — not clamped at zero,
  // because a negative number is the honest answer for light users: below
  // ~$20/month of usage, the API is genuinely the cheaper option and the tool
  // should say so rather than manufacture a win.
  const savingVsApi = burn - recommended.monthly;

  return {
    recommended,
    savingVsApi,
    multiple: recommended.monthly > 0 ? burn / recommended.monthly : 0,
    exceedsTopPlan: burn > PRO_EQUIVALENT_BURN * PLANS[PLANS.length - 1].usageMultiple,
  };
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
