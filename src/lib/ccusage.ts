/**
 * Normalization for ccusage `--json` output.
 *
 * ccusage v20 changed the default report. A bare `ccusage daily --json`
 * (what the viberank CLI runs) now emits the aggregated "all-agents" report:
 * each daily row is keyed by `period` (not `date`) and carries `agent` and
 * `metadata.agents`. Older / single-source reports (`ccusage claude daily
 * --json`) still key rows by `date` and have no agent fields.
 *
 * This module collapses every shape into one canonical form the data layer can
 * persist, so the rest of the app never has to care which ccusage report it was
 * given. See issues #49 (period vs date) and #48 (reasoning tokens inflate the
 * total beyond the four components).
 */

// Reasoning/thinking tokens are folded into `totalTokens` but ccusage does not
// serialize them as a separate field, so `totalTokens` can legitimately exceed
// input+output+cacheCreation+cacheRead. We tolerate a tiny rounding slop only
// when checking the *lower* bound; the real anti-cheat lives in cost/token
// ratio checks downstream.
const TOKEN_SLOP = 1;

/** A daily entry as it arrives from ccusage, before normalization. */
interface RawDailyEntry {
  date?: string;
  period?: string;
  agent?: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed?: string[];
  modelBreakdowns?: unknown;
  metadata?: { agents?: string[] };
}

interface RawCcData {
  totals: Record<string, number>;
  daily: RawDailyEntry[];
}

export interface NormalizedModelBreakdown {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
}

/** A daily entry after normalization — always keyed by `date`, agents resolved. */
export interface NormalizedDaily {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  agents: string[];
  /** Per-model split for the day, when the report provides it. */
  modelBreakdowns?: NormalizedModelBreakdown[];
}

// Per-model day splits come straight from user-supplied JSON, so rebuild them
// field-by-field and cap the count — never trust the shape.
const MAX_MODELS_PER_DAY = 50;
function sanitizeModelBreakdowns(value: unknown): NormalizedModelBreakdown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const out: NormalizedModelBreakdown[] = [];
  for (const item of value.slice(0, MAX_MODELS_PER_DAY)) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.modelName !== "string" || o.modelName.length === 0) continue;
    out.push({
      modelName: o.modelName.slice(0, 200),
      inputTokens: num(o.inputTokens),
      outputTokens: num(o.outputTokens),
      cacheCreationTokens: num(o.cacheCreationTokens),
      cacheReadTokens: num(o.cacheReadTokens),
      cost: num(o.cost),
    });
  }
  return out.length > 0 ? out : undefined;
}

function mergeModelBreakdowns(
  a: NormalizedModelBreakdown[] | undefined,
  b: NormalizedModelBreakdown[] | undefined
): NormalizedModelBreakdown[] | undefined {
  if (!a) return b;
  if (!b) return a;
  const byModel = new Map<string, NormalizedModelBreakdown>();
  for (const m of [...a, ...b]) {
    const cur = byModel.get(m.modelName);
    if (cur) {
      cur.inputTokens += m.inputTokens;
      cur.outputTokens += m.outputTokens;
      cur.cacheCreationTokens += m.cacheCreationTokens;
      cur.cacheReadTokens += m.cacheReadTokens;
      cur.cost += m.cost;
    } else {
      byModel.set(m.modelName, { ...m });
    }
  }
  return Array.from(byModel.values());
}

export interface NormalizedCcData {
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    totalCost: number;
  };
  daily: NormalizedDaily[];
  /** Union of every tool/agent that contributed to this submission. */
  tools: string[];
}

/**
 * Best-effort mapping of a ccusage model name to its source tool. Only used as a
 * fallback for single-source reports that lack `metadata.agents`; when ccusage
 * supplies `metadata.agents` we trust that instead. Model names are not a
 * reliable tool signal (e.g. codex reports bare `gpt-5`, openclaw reports
 * `gemini` models), so this stays deliberately conservative.
 */
export function inferToolFromModel(modelName: string): string {
  // Some tools prefix the model, e.g. "[openclaw] google/gemini-3-pro".
  const prefixed = modelName.match(/^\[([a-z0-9_-]+)\]/i);
  if (prefixed) return prefixed[1].toLowerCase();

  const m = modelName.toLowerCase();
  if (m.startsWith("claude")) return "claude";
  if (m.startsWith("gemini")) return "gemini";
  if (m.includes("codex")) return "codex";
  return "other";
}

function inferAgents(modelsUsed: string[]): string[] {
  return Array.from(new Set(modelsUsed.map(inferToolFromModel)));
}

/** Resolve the agents for a single raw daily row. */
function resolveAgents(entry: RawDailyEntry): string[] {
  const fromMeta = entry.metadata?.agents;
  if (Array.isArray(fromMeta) && fromMeta.length > 0) {
    return Array.from(new Set(fromMeta.map((a) => a.toLowerCase())));
  }
  // Single-agent rows (per-source report) carry `agent` directly.
  if (entry.agent && entry.agent !== "all") return [entry.agent.toLowerCase()];
  return inferAgents(entry.modelsUsed ?? []);
}

/**
 * Choose which rows represent the authoritative daily totals.
 *
 * The aggregate report emits one `agent: "all"` row per period. A hypothetical
 * payload could also include per-agent rows for the same period — summing both
 * would double-count. So when any `agent` field is present we prefer the "all"
 * rows; only if there are none do we fall back to summing per-agent rows.
 */
function selectAuthoritativeRows(rows: RawDailyEntry[]): RawDailyEntry[] {
  const hasAgentField = rows.some((r) => r.agent !== undefined);
  if (!hasAgentField) return rows;

  // Decide per-date: if a date has an `agent: "all"` aggregate row, use only
  // that (avoids double-counting against its per-agent siblings); otherwise
  // keep every row for that date (they get summed downstream). Deciding
  // per-date — not globally — means a payload that mixes aggregate dates with
  // per-agent-only dates never silently drops the per-agent-only days.
  const byDate = new Map<string, RawDailyEntry[]>();
  for (const row of rows) {
    const key = row.date ?? row.period ?? "__unknown__";
    byDate.set(key, [...(byDate.get(key) ?? []), row]);
  }
  return Array.from(byDate.values()).flatMap((dateRows) => {
    const allRow = dateRows.find((r) => r.agent === "all");
    return allRow ? [allRow] : dateRows;
  });
}

/**
 * Normalize raw ccusage JSON into one canonical, deduped, date-keyed shape.
 * Throws validation-style Errors (message surfaced to the client) for input
 * that cannot be made sense of.
 */
export function normalizeCcData(raw: RawCcData): NormalizedCcData {
  if (!Array.isArray(raw.daily) || raw.daily.length === 0) {
    throw new Error("Invalid cc.json format. 'daily' must be a non-empty array.");
  }

  const rows = selectAuthoritativeRows(raw.daily);

  // Collapse to exactly one entry per date: sum tokens/cost, union models and
  // agents. For the default aggregate report this is a no-op (already unique).
  const byDate = new Map<string, NormalizedDaily>();
  for (const entry of rows) {
    const date = entry.date ?? entry.period;
    if (!date) {
      throw new Error("Invalid date format: undefined. Expected YYYY-MM-DD");
    }

    const agents = resolveAgents(entry);
    const models = entry.modelsUsed ?? [];
    const breakdowns = sanitizeModelBreakdowns(entry.modelBreakdowns);
    const existing = byDate.get(date);

    if (existing) {
      existing.inputTokens += entry.inputTokens;
      existing.outputTokens += entry.outputTokens;
      existing.cacheCreationTokens += entry.cacheCreationTokens;
      existing.cacheReadTokens += entry.cacheReadTokens;
      existing.totalTokens += entry.totalTokens;
      existing.totalCost += entry.totalCost;
      existing.modelsUsed = Array.from(new Set([...existing.modelsUsed, ...models]));
      existing.agents = Array.from(new Set([...existing.agents, ...agents]));
      existing.modelBreakdowns = mergeModelBreakdowns(existing.modelBreakdowns, breakdowns);
    } else {
      byDate.set(date, {
        date,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        cacheCreationTokens: entry.cacheCreationTokens,
        cacheReadTokens: entry.cacheReadTokens,
        totalTokens: entry.totalTokens,
        totalCost: entry.totalCost,
        modelsUsed: [...models],
        agents: [...agents],
        modelBreakdowns: breakdowns,
      });
    }
  }

  const daily = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Recompute totals from the normalized daily rows so the stored submission is
  // always internally consistent, regardless of which report shape we got.
  const totals = daily.reduce(
    (acc, d) => ({
      inputTokens: acc.inputTokens + d.inputTokens,
      outputTokens: acc.outputTokens + d.outputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + d.cacheCreationTokens,
      cacheReadTokens: acc.cacheReadTokens + d.cacheReadTokens,
      totalTokens: acc.totalTokens + d.totalTokens,
      totalCost: acc.totalCost + d.totalCost,
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      totalCost: 0,
    }
  );

  const tools = Array.from(new Set(daily.flatMap((d) => d.agents))).sort();

  return { totals, daily, tools };
}

// Realistic-range constants (shared, ported from the original Convex checks).
const MAX_DAILY_COST = 5000; // $5k/day is already extreme usage
const MAX_DAILY_TOKENS = 250_000_000; // 250M tokens/day
const MIN_COST_PER_TOKEN = 0.0000001; // cache reads are very cheap
const MAX_COST_PER_TOKEN = 0.1; // sanity ceiling on cost/token

/**
 * Validate normalized ccusage data. Throws validation-style Errors whose
 * messages are surfaced to the client. Pure and side-effect free so it can be
 * unit-tested and reused across ingestion paths.
 *
 * @param now injectable clock for the future-date check (defaults to real time)
 */
export function validateCcData(
  ccData: { totals: NormalizedCcData["totals"]; daily: NormalizedDaily[] },
  now: Date = new Date()
): void {
  // Token accounting. Reasoning/thinking tokens (Gemini, Codex, Claude extended
  // thinking) are included in `totalTokens` but ccusage does not serialize them
  // as a component, so `totalTokens` can legitimately exceed the four
  // components. Reject only when the total is *less* than its known parts
  // (malformed/tampered); upward inflation is bounded by the ratio check. (#48)
  const componentTokens =
    ccData.totals.inputTokens +
    ccData.totals.outputTokens +
    ccData.totals.cacheCreationTokens +
    ccData.totals.cacheReadTokens;

  if (ccData.totals.totalTokens < componentTokens - TOKEN_SLOP) {
    throw new Error(
      "Token totals don't match. Please use official ccusage tool."
    );
  }

  if (ccData.totals.totalCost < 0 || ccData.totals.totalTokens < 0) {
    throw new Error("Negative values are not allowed.");
  }
  if (ccData.totals.totalCost > MAX_DAILY_COST * 365) {
    throw new Error("Total cost exceeds realistic limits.");
  }
  if (ccData.totals.totalTokens > MAX_DAILY_TOKENS * 365) {
    throw new Error("Total tokens exceed realistic limits.");
  }

  // Cost/token ratio is the primary anti-inflation guard now that the token-sum
  // check is one-sided: inflating tokens drives the ratio below the floor,
  // inflating cost drives it above the ceiling.
  if (ccData.totals.totalTokens > 0) {
    const costPerToken = ccData.totals.totalCost / ccData.totals.totalTokens;
    if (costPerToken < MIN_COST_PER_TOKEN || costPerToken > MAX_COST_PER_TOKEN) {
      throw new Error(
        "Cost per token ratio is unrealistic. Please check your data."
      );
    }
  }

  // Per-day validation. cc.json dates are emitted in the user's *local*
  // timezone (ccusage groups by local day), so the server's UTC date can lag
  // the user's by up to a full day at extreme offsets (UTC+14 / UTC-12). Allow
  // tomorrow-UTC as the cutoff to cover any global timezone.
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const cutoffUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      23,
      59,
      59,
      999
    )
  );

  for (const day of ccData.daily) {
    if (!dateRegex.test(day.date)) {
      throw new Error(`Invalid date format: ${day.date}. Expected YYYY-MM-DD`);
    }
    if (new Date(day.date + "T00:00:00Z") > cutoffUTC) {
      throw new Error(`Future date detected: ${day.date}`);
    }
    if (
      day.totalCost < 0 ||
      day.totalTokens < 0 ||
      day.inputTokens < 0 ||
      day.outputTokens < 0 ||
      day.cacheCreationTokens < 0 ||
      day.cacheReadTokens < 0
    ) {
      throw new Error("Negative values are not allowed in daily data.");
    }
    const dayComponents =
      day.inputTokens +
      day.outputTokens +
      day.cacheCreationTokens +
      day.cacheReadTokens;
    if (day.totalTokens < dayComponents - TOKEN_SLOP) {
      throw new Error(`Token components don't sum correctly for ${day.date}.`);
    }
  }
}

export { TOKEN_SLOP };
