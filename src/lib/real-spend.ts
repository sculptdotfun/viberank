/**
 * Real spend: money a developer actually paid a provider (OpenRouter today),
 * published by the CLI from the provider's own billing API.
 *
 * This is a separate ledger from the leaderboard. The board ranks
 * API-equivalent usage that ccusage computes from local logs, and tools that
 * route through OpenRouter (OpenClaw, OpenCode, Hermes, …) are already in
 * those logs. Folding OpenRouter's figures into submission totals would count
 * that usage twice, so nothing here ever touches `submissions` or
 * `daily_breakdowns` — it lives in `real_spend_days` / `real_spend_totals`
 * (migration 023) and is only ever shown beside the board.
 *
 * Pure functions only, so every validation rule and aggregate is unit-tested
 * without a database or a request.
 */

export const REAL_SPEND_SOURCES = ["openrouter"] as const;
export type RealSpendSource = (typeof REAL_SPEND_SOURCES)[number];

/**
 * "account" — a management key: all-time spend for the whole account.
 * "key" — a normal inference key: only that key's spend, and labelled so.
 */
export type RealSpendScope = "account" | "key";

export interface RealSpendModel {
  model: string;
  usage: number;
  byok: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

export interface RealSpendDayInput {
  date: string;
  /** USD paid in OpenRouter credits. */
  usage: number;
  /** USD billed through the user's own provider keys (BYOK). */
  byok: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  models: RealSpendModel[];
}

export interface RealSpendPayload {
  scope: RealSpendScope;
  lifetime: { usd: number; byokUsd: number | null };
  days: RealSpendDayInput[];
}

/** Limits, exported so tests and docs quote the same numbers the code enforces. */
export const SPEND_LIMITS = {
  /** No real OpenRouter account has spent this; above it the number is junk. */
  maxLifetimeUsd: 10_000_000,
  /** /activity covers 30 completed days; one more for a key's "today" row. */
  maxDays: 31,
  /** Oldest accepted date. A little past 30 so a sync delayed a few days still lands. */
  maxAgeDays: 40,
  maxDayUsd: 100_000,
  maxModelsPerDay: 200,
  maxModelNameLength: 200,
} as const;

/** The window "last 30 days" figures cover: today and the 30 days before it (UTC). */
export const LAST_30_WINDOW_DAYS = 30;

/** Fewer reporters than this and /stats hides the aggregate: a sum of two people is a person. */
export const MIN_STATS_DEVELOPERS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

type Result = { ok: true; value: RealSpendPayload } | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A finite, non-negative number. Strings, NaN, Infinity and negatives are all refused. */
function isAmount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** Midnight UTC of a YYYY-MM-DD string, or null if it isn't a real calendar date. */
function utcDay(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  // Date.parse rolls 2026-02-30 over to March; round-tripping catches that.
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null;
  return ms;
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** First date inside the "last 30 days" window, as YYYY-MM-DD. */
export function last30Start(now: Date = new Date()): string {
  const today = Date.parse(`${todayUtc(now)}T00:00:00Z`);
  return new Date(today - LAST_30_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Strictly validate a spend payload from the CLI.
 *
 * Strict because the figures are published as money someone paid, under a
 * signed identity; a malformed block is refused whole rather than partly
 * stored. Returns the normalized payload (counts truncated to integers).
 */
export function validateSpendPayload(input: unknown, now: Date = new Date()): Result {
  const fail = (error: string): Result => ({ ok: false, error });
  if (!isObject(input)) return fail("Body must be a JSON object");

  const { scope, lifetime, days } = input;
  if (scope !== "account" && scope !== "key") return fail('scope must be "account" or "key"');

  if (!isObject(lifetime)) return fail("lifetime is required");
  const lifetimeUsd = lifetime.usd;
  if (!isAmount(lifetimeUsd) || lifetimeUsd >= SPEND_LIMITS.maxLifetimeUsd) {
    return fail(`lifetime.usd must be a non-negative number below ${SPEND_LIMITS.maxLifetimeUsd}`);
  }
  const byokUsd = lifetime.byokUsd ?? null;
  if (byokUsd !== null && (!isAmount(byokUsd) || byokUsd >= SPEND_LIMITS.maxLifetimeUsd)) {
    return fail(`lifetime.byokUsd must be null or a non-negative number below ${SPEND_LIMITS.maxLifetimeUsd}`);
  }

  if (!Array.isArray(days)) return fail("days must be an array");
  if (days.length > SPEND_LIMITS.maxDays) return fail(`At most ${SPEND_LIMITS.maxDays} days per sync`);

  const today = Date.parse(`${todayUtc(now)}T00:00:00Z`);
  const oldest = today - SPEND_LIMITS.maxAgeDays * DAY_MS;
  const seen = new Set<string>();
  const out: RealSpendDayInput[] = [];

  for (const day of days) {
    if (!isObject(day)) return fail("Each day must be an object");
    const date = day.date;
    const ms = typeof date === "string" ? utcDay(date) : null;
    if (ms === null || typeof date !== "string") return fail(`Invalid date: ${String(date).slice(0, 20)}`);
    if (ms > today) return fail(`Future date: ${date}`);
    if (ms < oldest) return fail(`Date older than ${SPEND_LIMITS.maxAgeDays} days: ${date}`);
    // One row per date: a duplicate would make the upsert touch a row twice,
    // which Postgres refuses for the whole statement.
    if (seen.has(date)) return fail(`Duplicate date: ${date}`);
    seen.add(date);

    for (const field of ["usage", "byok", "requests", "promptTokens", "completionTokens"] as const) {
      if (!isAmount(day[field])) return fail(`${date}: ${field} must be a finite, non-negative number`);
    }
    const usage = day.usage as number;
    const byok = day.byok as number;
    if (usage >= SPEND_LIMITS.maxDayUsd || byok >= SPEND_LIMITS.maxDayUsd) {
      return fail(`${date}: daily cost must be below $${SPEND_LIMITS.maxDayUsd}`);
    }

    const models = day.models ?? [];
    if (!Array.isArray(models)) return fail(`${date}: models must be an array`);
    if (models.length > SPEND_LIMITS.maxModelsPerDay) {
      return fail(`${date}: at most ${SPEND_LIMITS.maxModelsPerDay} models per day`);
    }
    const outModels: RealSpendModel[] = [];
    for (const m of models) {
      if (!isObject(m)) return fail(`${date}: each model must be an object`);
      if (typeof m.model !== "string" || !m.model || m.model.length > SPEND_LIMITS.maxModelNameLength) {
        return fail(`${date}: model names must be 1-${SPEND_LIMITS.maxModelNameLength} characters`);
      }
      for (const field of ["usage", "byok", "requests", "promptTokens", "completionTokens"] as const) {
        if (!isAmount(m[field])) return fail(`${date}: ${m.model.slice(0, 60)} ${field} must be a finite, non-negative number`);
      }
      outModels.push({
        model: m.model,
        usage: m.usage as number,
        byok: m.byok as number,
        requests: Math.trunc(m.requests as number),
        promptTokens: Math.trunc(m.promptTokens as number),
        completionTokens: Math.trunc(m.completionTokens as number),
      });
    }

    out.push({
      date,
      usage,
      byok,
      requests: Math.trunc(day.requests as number),
      promptTokens: Math.trunc(day.promptTokens as number),
      completionTokens: Math.trunc(day.completionTokens as number),
      models: outModels,
    });
  }

  return {
    ok: true,
    value: {
      scope: scope as RealSpendScope,
      lifetime: { usd: lifetimeUsd, byokUsd: byokUsd as number | null },
      days: out,
    },
  };
}

// ============================================================================
// READ SIDE
// ============================================================================

export interface RealSpendDay {
  date: string;
  costUsd: number;
  byokCostUsd: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  models: RealSpendModel[];
}

export interface RealSpend {
  /** Every stored day, oldest first. */
  days: RealSpendDay[];
  /** Credits spent from today back 30 days (UTC). */
  last30Usd: number;
  /** Credits spent across every stored day, including ones older syncs kept past OpenRouter's window. */
  windowUsd: number;
  lifetime: {
    usd: number;
    byokUsd: number | null;
    scope: RealSpendScope;
    observedAt: string;
  } | null;
}

export interface RealSpendStats {
  /** Developers with an all-time figure on file. */
  developers: number;
  lifetimeUsd: number;
  last30Usd: number;
  medianLifetimeUsd: number;
  /** Models by credits spent in the last 30 days, across everyone. */
  topModels: { model: string; usd: number }[];
}

/** Row shapes as PostgREST returns them; NUMERIC may arrive as a string. */
export interface RealSpendDayRow {
  username?: string;
  date: string;
  cost_usd: number | string;
  byok_cost_usd: number | string | null;
  requests: number | null;
  prompt_tokens: number | string | null;
  completion_tokens: number | string | null;
  models: RealSpendModel[] | null;
}

export interface RealSpendTotalRow {
  username?: string;
  scope: RealSpendScope;
  lifetime_usd: number | string;
  lifetime_byok_usd: number | string | null;
  observed_at: string;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const EMPTY_REAL_SPEND: RealSpend = { days: [], last30Usd: 0, windowUsd: 0, lifetime: null };

export function summarizeRealSpend(
  dayRows: RealSpendDayRow[],
  total: RealSpendTotalRow | null,
  now: Date = new Date()
): RealSpend {
  const from = last30Start(now);
  const days = dayRows
    .map((r) => ({
      date: String(r.date).slice(0, 10),
      costUsd: n(r.cost_usd),
      byokCostUsd: n(r.byok_cost_usd),
      requests: n(r.requests),
      promptTokens: n(r.prompt_tokens),
      completionTokens: n(r.completion_tokens),
      models: Array.isArray(r.models) ? r.models : [],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    last30Usd: days.filter((d) => d.date >= from).reduce((s, d) => s + d.costUsd, 0),
    windowUsd: days.reduce((s, d) => s + d.costUsd, 0),
    lifetime: total
      ? {
          usd: n(total.lifetime_usd),
          byokUsd: total.lifetime_byok_usd === null ? null : n(total.lifetime_byok_usd),
          scope: total.scope,
          observedAt: total.observed_at,
        }
      : null,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Site aggregate for /stats. `recentDays` must already be limited to the
 * last-30 window; this only sums what it is given.
 */
export function aggregateRealSpendStats(
  totals: RealSpendTotalRow[],
  recentDays: RealSpendDayRow[],
  topN = 8
): RealSpendStats {
  const lifetimes = totals.map((t) => n(t.lifetime_usd));
  const perModel = new Map<string, number>();
  for (const day of recentDays) {
    for (const m of Array.isArray(day.models) ? day.models : []) {
      if (typeof m?.model !== "string") continue;
      perModel.set(m.model, (perModel.get(m.model) ?? 0) + n(m.usage));
    }
  }
  return {
    developers: totals.length,
    lifetimeUsd: lifetimes.reduce((s, v) => s + v, 0),
    last30Usd: recentDays.reduce((s, d) => s + n(d.cost_usd), 0),
    medianLifetimeUsd: median(lifetimes),
    topModels: Array.from(perModel.entries())
      .filter(([, usd]) => usd > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([model, usd]) => ({ model, usd })),
  };
}

/**
 * One pay-as-you-go line for a profile's money-vs-value comparison: the
 * all-time USD actually paid, or null when nothing is on file.
 *
 * Kept deliberately small so a profile section that lists what someone pays
 * per source can take it as-is. Only credits paid to OpenRouter count; BYOK
 * spend was billed by the user's own provider and is left out rather than
 * guessed at (OpenRouter's account-wide total doesn't report it).
 */
export function payAsYouGoFromRealSpend(
  spend: Pick<RealSpend, "lifetime"> | null | undefined
): { source: "OpenRouter"; amount: number } | null {
  const amount = spend?.lifetime?.usd;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return { source: "OpenRouter", amount };
}

/** Rows for the upsert, one per day. Username is lowercased: GitHub handles are case-insensitive. */
export function toDayRows(username: string, source: RealSpendSource, payload: RealSpendPayload, now: Date = new Date()) {
  const updatedAt = now.toISOString();
  return payload.days.map((d) => ({
    username: username.toLowerCase(),
    source,
    date: d.date,
    cost_usd: d.usage,
    byok_cost_usd: d.byok,
    requests: d.requests,
    prompt_tokens: d.promptTokens,
    completion_tokens: d.completionTokens,
    models: d.models,
    updated_at: updatedAt,
  }));
}

export function toTotalRow(username: string, source: RealSpendSource, payload: RealSpendPayload, now: Date = new Date()) {
  return {
    username: username.toLowerCase(),
    source,
    scope: payload.scope,
    lifetime_usd: payload.lifetime.usd,
    lifetime_byok_usd: payload.lifetime.byokUsd,
    observed_at: now.toISOString(),
  };
}
