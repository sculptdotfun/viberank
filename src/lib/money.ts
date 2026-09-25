/**
 * Money vs value: what a developer actually paid, next to what their usage
 * would have cost at API list prices.
 *
 * Every dollar figure ccusage produces is API-equivalent *value*. Almost
 * nobody pays it: most people are on a flat subscription that subsidises it
 * many times over, so "$436K" on a profile reads as money spent when the owner
 * may have paid a few thousand. This file keeps the two apart.
 *
 * Three kinds of number come out of here, and the UI must never blur them:
 *  - measured value: the ccusage total, labelled API-equivalent;
 *  - declared spend: plans the owner told us they pay for, priced from
 *    plans.ts, plus pay-as-you-go bills from a connected source;
 *  - estimated spend: what the cheapest adequate plan would have cost, for
 *    profiles that declared nothing. Always labelled "Estimated".
 *
 * Everything is pure so the leaderboard can reuse it later without a page.
 */

import { TOOL_PLANS, comparePlans, type Plan, type ToolPlans } from "@/lib/plans";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A real calendar date in YYYY-MM-DD. The regex alone accepts 2026-02-31,
 * which Postgres would reject on insert with an unhelpful 500.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** Today in UTC as YYYY-MM-DD, the same day boundary ccusage buckets by. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Months since year 0, so two dates subtract to a month distance. */
function monthIndex(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

export interface DateRange {
  start: string;
  end: string;
}

/**
 * Calendar months a plan was held during the active range.
 *
 * A plan active for any part of a month counts as the whole month: that is
 * how subscriptions bill, and it keeps the arithmetic explainable in one
 * footnote. An open-ended plan (`endedOn` null) runs to the end of the range,
 * which never passes today because the range is built from recorded days.
 * A plan entirely outside the range contributes nothing, so declaring an old
 * subscription can't inflate spend for months with no measured usage.
 */
export function overlapMonths(
  startedOn: string,
  endedOn: string | null,
  range: DateRange
): number {
  const start = startedOn > range.start ? startedOn : range.start;
  const planEnd = endedOn ?? range.end;
  const end = planEnd < range.end ? planEnd : range.end;
  if (start > end) return 0;
  return monthIndex(end) - monthIndex(start) + 1;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/**
 * Exact lookup. `toolPlansFor` deliberately falls back to Claude for the
 * calculator's default tab; here a fallback would price a Gemini user's usage
 * as a Claude plan, so an unknown tool must stay unknown.
 */
export function findToolPlans(toolId: string): ToolPlans | null {
  return TOOL_PLANS.find((tool) => tool.id === toolId) ?? null;
}

export function findPlan(toolId: string, planId: string): Plan | null {
  return findToolPlans(toolId)?.plans.find((plan) => plan.id === planId) ?? null;
}

// ---------------------------------------------------------------------------
// Declared subscriptions
// ---------------------------------------------------------------------------

/** The fields of a declaration the math needs; rows carry more. */
export interface SubscriptionSpan {
  id?: string;
  tool: string;
  planId: string;
  startedOn: string;
  endedOn: string | null;
}

export interface DeclaredLine {
  id?: string;
  tool: string;
  planId: string;
  /** Null when the plan has since been removed from plans.ts. */
  planName: string | null;
  monthly: number;
  months: number;
  cost: number;
}

export interface DeclaredCost {
  total: number;
  lines: DeclaredLine[];
}

/**
 * Monthly price × months overlapping the active range, per declared plan.
 *
 * A declaration naming a plan plans.ts no longer lists is kept as a line at
 * $0 rather than dropped, so the owner can still see and remove it; guessing
 * a price for it would put an invented number into "money spent".
 */
export function declaredSubscriptionCost(
  subscriptions: SubscriptionSpan[],
  range: DateRange | null
): DeclaredCost {
  const lines = subscriptions.map((sub): DeclaredLine => {
    const plan = findPlan(sub.tool, sub.planId);
    const months = range ? overlapMonths(sub.startedOn, sub.endedOn, range) : 0;
    const monthly = plan?.monthly ?? 0;
    return {
      id: sub.id,
      tool: sub.tool,
      planId: sub.planId,
      planName: plan?.name ?? null,
      monthly,
      months,
      cost: monthly * months,
    };
  });
  return { total: lines.reduce((sum, line) => sum + line.cost, 0), lines };
}

// ---------------------------------------------------------------------------
// Subsidy multiple
// ---------------------------------------------------------------------------

/**
 * API-equivalent value bought per dollar actually paid.
 *
 * Null, not Infinity or 0, when nothing was paid: "every $1 bought $∞" is
 * meaningless, and 0 would read as "got nothing for the money".
 */
export function subsidyMultiple(value: number, spend: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(spend)) return null;
  if (spend <= 0 || value < 0) return null;
  return value / spend;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Estimate for profiles that declared nothing
// ---------------------------------------------------------------------------

export interface DayUsage {
  date: string;
  totalCost: number;
  agents?: string[];
}

export interface ToolMonthBurn {
  tool: string;
  /** YYYY-MM */
  month: string;
  cost: number;
}

/**
 * API-equivalent burn per tool per calendar month.
 *
 * A day that mixed tools is split evenly between them. That is crude, and it
 * is why nothing built on it is ever shown as measured: the stored rows carry
 * no reliable per-tool cost (the profile's own tool chart counts days for the
 * same reason). Days with no recorded agents are left unattributed rather
 * than assumed to be Claude.
 */
export function burnByToolMonth(days: DayUsage[]): ToolMonthBurn[] {
  const burn = new Map<string, ToolMonthBurn>();
  for (const day of days) {
    const agents = day.agents && day.agents.length > 0 ? day.agents : ["unattributed"];
    const share = (Number.isFinite(day.totalCost) ? day.totalCost : 0) / agents.length;
    const month = day.date.slice(0, 7);
    for (const tool of agents) {
      const key = `${tool}\u0000${month}`;
      const entry = burn.get(key) ?? { tool, month, cost: 0 };
      entry.cost += share;
      burn.set(key, entry);
    }
  }
  return Array.from(burn.values()).sort(
    (a, b) => a.tool.localeCompare(b.tool) || a.month.localeCompare(b.month)
  );
}

export interface EstimateLine {
  tool: string;
  /** Months with usage that were priced. */
  months: number;
  cost: number;
  /** Plan name → months it was the pick, so the page can say which plans. */
  plans: Record<string, number>;
  /** Months whose burn exceeds even the largest plan's sizing. */
  monthsOverTopPlan: number;
}

export interface SubscriptionEstimate {
  total: number;
  lines: EstimateLine[];
  /**
   * Tools with usage that can't be priced: no plans in plans.ts, or a vendor
   * that publishes no usage tiers (Copilot), where picking the cheapest seat
   * would claim $10 carries any burn. Named on the page, never guessed.
   */
  unpricedTools: string[];
}

/**
 * For each tool and month with usage, the cheapest plan sized for that
 * month's burn (plans.ts `comparePlans`), summed.
 *
 * When a month's burn outruns the largest plan it is still priced at that
 * plan and counted in `monthsOverTopPlan`: the real bill was probably higher
 * (extra seats or usage credits) and the page says so.
 */
export function estimateSubscriptionCost(burn: ToolMonthBurn[]): SubscriptionEstimate {
  const lines = new Map<string, EstimateLine>();
  const unpriced = new Set<string>();

  for (const { tool, cost } of burn) {
    if (!(cost > 0)) continue;
    const toolPlans = findToolPlans(tool);
    const verdict = toolPlans ? comparePlans(toolPlans, cost) : null;
    if (!verdict?.recommended) {
      unpriced.add(tool);
      continue;
    }
    const line = lines.get(tool) ?? { tool, months: 0, cost: 0, plans: {}, monthsOverTopPlan: 0 };
    line.months += 1;
    line.cost += verdict.recommended.monthly;
    line.plans[verdict.recommended.name] = (line.plans[verdict.recommended.name] ?? 0) + 1;
    if (verdict.exceedsTopPlan) line.monthsOverTopPlan += 1;
    lines.set(tool, line);
  }

  const sorted = Array.from(lines.values()).sort((a, b) => b.cost - a.cost);
  return {
    total: sorted.reduce((sum, line) => sum + line.cost, 0),
    lines: sorted,
    unpricedTools: Array.from(unpriced).sort(),
  };
}

// ---------------------------------------------------------------------------
// The profile summary
// ---------------------------------------------------------------------------

/**
 * A pay-as-you-go bill from a connected source (OpenRouter, an API console).
 * Nothing feeds this yet; the profile renders the row only when it's non-empty.
 */
export interface PayAsYouGo {
  source: string;
  amount: number;
}

export interface MoneyVsValue {
  /** ccusage total. API-equivalent value, not money spent. */
  value: number;
  range: DateRange | null;
  declared: DeclaredCost | null;
  payAsYouGo: PayAsYouGo[];
  payAsYouGoTotal: number;
  /** Declared subscriptions + pay-as-you-go: money the owner says they paid. */
  realSpend: number;
  /** Only when realSpend > 0; an estimate never produces a multiple. */
  multiple: number | null;
  /** Only when nothing was declared. */
  estimate: SubscriptionEstimate | null;
}

/** First and last recorded day. Null when the profile has no days. */
export function activeRange(days: { date: string }[]): DateRange | null {
  if (days.length === 0) return null;
  let start = days[0].date;
  let end = days[0].date;
  for (const { date } of days) {
    if (date < start) start = date;
    if (date > end) end = date;
  }
  return { start, end };
}

export function moneyVsValue(input: {
  value: number;
  days: DayUsage[];
  subscriptions: SubscriptionSpan[];
  payAsYouGo?: PayAsYouGo[];
}): MoneyVsValue {
  const range = activeRange(input.days);
  const payAsYouGo = (input.payAsYouGo ?? []).filter((p) => Number.isFinite(p.amount) && p.amount > 0);
  const payAsYouGoTotal = payAsYouGo.reduce((sum, p) => sum + p.amount, 0);
  const declared =
    input.subscriptions.length > 0 ? declaredSubscriptionCost(input.subscriptions, range) : null;
  const realSpend = (declared?.total ?? 0) + payAsYouGoTotal;

  return {
    value: input.value,
    range,
    declared,
    payAsYouGo,
    payAsYouGoTotal,
    realSpend,
    multiple: subsidyMultiple(input.value, realSpend),
    estimate: declared ? null : estimateSubscriptionCost(burnByToolMonth(input.days)),
  };
}

// ---------------------------------------------------------------------------
// Site-wide
// ---------------------------------------------------------------------------

/**
 * Below this many declarers the median is withheld: with two or three people
 * it is close to publishing one person's plan, and it swings on a single row.
 */
export const MIN_DECLARED_FOR_STATS = 5;

export interface DeclaredProfile {
  value: number;
  range: DateRange | null;
  subscriptions: SubscriptionSpan[];
}

export interface DeclaredCohortSummary {
  /** Developers whose declarations produce a multiple. */
  declared: number;
  /** Null below MIN_DECLARED_FOR_STATS. */
  medianMultiple: number | null;
}

/**
 * Median subsidy multiple across developers who declared what they pay.
 * A declarer whose plans don't overlap any recorded usage has no multiple
 * and isn't counted, rather than dragging the median toward zero.
 */
export function declaredCohortSummary(
  profiles: DeclaredProfile[],
  minDeclared: number = MIN_DECLARED_FOR_STATS
): DeclaredCohortSummary {
  const multiples: number[] = [];
  for (const profile of profiles) {
    const spend = declaredSubscriptionCost(profile.subscriptions, profile.range).total;
    const multiple = subsidyMultiple(profile.value, spend);
    if (multiple !== null) multiples.push(multiple);
  }
  return {
    declared: multiples.length,
    medianMultiple: multiples.length >= minDeclared ? median(multiples) : null,
  };
}

// ---------------------------------------------------------------------------
// Route validation
// ---------------------------------------------------------------------------

export interface SubscriptionInput {
  tool: string;
  planId: string;
  startedOn: string;
  endedOn: string | null;
}

export type SubscriptionValidation =
  | { ok: true; value: SubscriptionInput }
  | { ok: false; error: string };

/**
 * Validate a POSTed declaration. Pure so it can be tested without a session:
 * tool and plan must exist in plans.ts (a price we can't source can't be
 * shown as money spent), dates must be real YYYY-MM-DD days, and
 * started_on <= ended_on <= today. A future start is refused too: a plan you
 * haven't paid for yet isn't spend.
 */
export function validateSubscriptionInput(body: unknown, today: string): SubscriptionValidation {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected JSON body: { tool, planId, startedOn, endedOn? }" };
  }
  const { tool, planId, startedOn, endedOn } = body as Record<string, unknown>;

  if (typeof tool !== "string" || !findToolPlans(tool)) {
    return { ok: false, error: `Unknown tool. Choose one of: ${TOOL_PLANS.map((t) => t.id).join(", ")}.` };
  }
  if (typeof planId !== "string" || !findPlan(tool, planId)) {
    return { ok: false, error: `Unknown plan for ${tool}.` };
  }
  if (!isIsoDate(startedOn)) {
    return { ok: false, error: "Start date must be a real date in YYYY-MM-DD form." };
  }
  const end = endedOn === undefined || endedOn === null || endedOn === "" ? null : endedOn;
  if (end !== null && !isIsoDate(end)) {
    return { ok: false, error: "End date must be a real date in YYYY-MM-DD form, or empty if you still pay." };
  }
  if (startedOn > today) {
    return { ok: false, error: "Start date can't be in the future." };
  }
  if (end !== null && end < startedOn) {
    return { ok: false, error: "End date can't be before the start date." };
  }
  if (end !== null && end > today) {
    return { ok: false, error: "End date can't be in the future. Leave it empty if you still pay." };
  }
  return { ok: true, value: { tool, planId, startedOn, endedOn: end } };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * "87.3" / "412": one decimal only where it carries meaning. A multiple of
 * 412.6 claims a precision a whole-month price model doesn't have.
 */
export function formatMultiple(multiple: number): string {
  if (!Number.isFinite(multiple)) return "0";
  return multiple < 10
    ? multiple.toFixed(1)
    : Math.round(multiple).toLocaleString("en-US");
}
