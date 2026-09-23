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

// Bump when normalizeCcData's behavior changes. Stored alongside each raw
// payload in the raw_submissions archive so history can be re-parsed with a
// newer normalizer and backfilled.
export const PARSER_VERSION = "viberank-normalize-v1";

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
  /**
   * Per-agent split of this row, present only with `ccusage daily --by-agent`.
   * Note the shape clash: this is an array of objects, while `agents` on our
   * own normalized entry is a list of names. Kept `unknown` so the sanitiser
   * is the only thing that decides what it means.
   */
  agents?: unknown;
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

/**
 * One agent's measured share of a day.
 *
 * Exists so a drift verdict can be applied to the tool it is actually evidence
 * about. The corpus scan reads ~/.claude/projects, so it says nothing about a
 * Codex or Gemini day — but before this, a mixed day was stored as one lump and
 * lowering the lump took the untouched tools down with it (#125).
 */
export interface AgentSlice {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
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
  /**
   * Per-agent split for the day, keyed by agent name. Absent for payloads from
   * a CLI that predates `--by-agent`, which is most of the board — every
   * consumer must treat it as optional and fall back to whole-slice behaviour.
   */
  agentBreakdowns?: Record<string, AgentSlice>;
}

/** Agents we will store a slice for. Anything else is summed into the day but
 * not tracked separately — an unbounded key space here is a storage hazard. */
const MAX_AGENTS_PER_DAY = 12;

/**
 * Rebuild the `--by-agent` array into a name-keyed map, field by field.
 *
 * The payload is user-supplied, so nothing here trusts the shape: a hostile or
 * merely old client can send any JSON at all. Slices that don't parse are
 * dropped rather than coerced, and the caller checks the survivors still sum to
 * the day before using them.
 */
function sanitizeAgentSlices(value: unknown): Record<string, AgentSlice> | undefined {
  if (!Array.isArray(value)) return undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const out: Record<string, AgentSlice> = {};
  for (const item of value.slice(0, MAX_AGENTS_PER_DAY)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.agent === "string" ? row.agent.trim().toLowerCase() : "";
    if (!name) continue;
    const slice: AgentSlice = {
      inputTokens: num(row.inputTokens),
      outputTokens: num(row.outputTokens),
      cacheCreationTokens: num(row.cacheCreationTokens),
      cacheReadTokens: num(row.cacheReadTokens),
      totalTokens: num(row.totalTokens),
      totalCost: num(row.totalCost),
    };
    // Sum rather than overwrite: a payload repeating an agent for one date is
    // malformed, but dropping half its tokens would be worse than adding them.
    const prior = out[name];
    out[name] = prior ? addSlices(prior, slice) : slice;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function addSlices(a: AgentSlice, b: AgentSlice): AgentSlice {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    totalCost: a.totalCost + b.totalCost,
  };
}

/** Merge two per-agent maps by summing each agent's slice. */
function mergeAgentMaps(
  a: Record<string, AgentSlice> | undefined,
  b: Record<string, AgentSlice> | undefined
): Record<string, AgentSlice> | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: Record<string, AgentSlice> = { ...a };
  for (const [name, slice] of Object.entries(b)) {
    out[name] = out[name] ? addSlices(out[name], slice) : slice;
  }
  return out;
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

// ---------------------------------------------------------------------------
// Per-machine daily merge (issue #43)
// ---------------------------------------------------------------------------
// ccusage exposes no machine identifier, so the server can't tell "different
// machine, same day" (should sum) from "re-submit, same day" (should replace).
// The CLI now sends a stable `X-Machine-Id`; we record each machine's slice of
// a day under that id so overlapping dates from distinct machines sum while a
// re-submission from the same machine replaces only its own slice. The daily
// row keeps aggregate (summed) fields for display — the per-machine map is
// bookkeeping the merge needs and the UI never reads.
//
// The "default" bucket (no X-Machine-Id: web uploads, pre-1.2 CLIs, legacy
// rows) is NOT a machine — it is unattributable data that in practice usually
// comes from a machine that also submits with an id. Summing it against UUID
// slices double-counts the same history (#81). Deleting it loses history
// instead: an id'd submission used to drop it, a no-id submission used to
// wipe every id'd slice, and the claim merge threw whole rows away (#138,
// #152). So it is kept alongside id'd slices but never added to them: the day
// shows whichever is larger, the unattributed slice or the sum of the id'd
// ones. Cross-machine summing still only happens between id'd slices.

/** One machine's contribution to a single day. */
export interface MachineContribution {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  agents: string[];
  modelBreakdowns?: NormalizedModelBreakdown[];
  /** Per-agent split, when the submitting CLI was new enough to send one. */
  agentBreakdowns?: Record<string, AgentSlice>;
}

/** Aggregate of every machine's slice for a day — what the row stores/displays. */
export interface DailyAggregate {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  agents: string[];
  modelBreakdowns?: NormalizedModelBreakdown[];
}

/** Sentinel machine id for submissions that carry no `X-Machine-Id` header. */
export const DEFAULT_MACHINE_ID = "default";

/**
 * A machine's estimated slice: Claude Code days rebuilt from
 * ~/.claude/stats-cache.json after the transcripts behind them were deleted
 * (#138). It is keyed apart from the machine's measured slice so the two sum
 * rather than compete for the per-machine high-water mark: the measured slice
 * on those days is usually another tool (Codex), which an estimate must not
 * displace.
 */
export const ESTIMATED_SLICE_SUFFIX = ":estimated";

/** The only tool stats-cache.json can speak for. */
const ESTIMATED_AGENT = "claude";

export function estimatedSliceKey(machineId: string): string {
  return `${machineId}${ESTIMATED_SLICE_SUFFIX}`;
}

export function isEstimatedSliceKey(key: string): boolean {
  return key.endsWith(ESTIMATED_SLICE_SUFFIX);
}

function measuresEstimatedAgent(slice: MachineContribution): boolean {
  return (
    slice.agents.includes(ESTIMATED_AGENT) ||
    slice.modelsUsed.some((model) => inferToolFromModel(model) === ESTIMATED_AGENT)
  );
}

/**
 * The slices that count toward a day. An estimate stands in for Claude usage
 * nobody can measure any more, so once any measured slice reports Claude for
 * the day — from any machine, whichever arrived first — every estimate steps
 * aside. Keyed to the day rather than to the machine because the machine id
 * is the client's own claim: an estimate under an invented id must not add to
 * Claude that was measured under the real one.
 */
function countedSlices(
  contributions: Record<string, MachineContribution>
): Record<string, MachineContribution> {
  const measuredClaude = Object.entries(contributions).some(
    ([key, slice]) => !isEstimatedSliceKey(key) && measuresEstimatedAgent(slice)
  );
  if (!measuredClaude) return contributions;
  return Object.fromEntries(Object.entries(contributions).filter(([key]) => !isEstimatedSliceKey(key)));
}

/** Whether an estimated slice counts toward this day (see countedSlices). */
export function dayIsEstimated(contributions: Record<string, MachineContribution>): boolean {
  return Object.keys(countedSlices(contributions)).some(isEstimatedSliceKey);
}

/**
 * Whether observation `a` of one day should win over `b`. Cost decides; total
 * tokens break ties so unpriced models ($0) still keep the larger observation.
 * Compared whole rather than per-field, so the winner is a slice that was
 * actually observed rather than tokens from one run and cost from another.
 */
export function outweighs(
  a: Pick<MachineContribution, "totalCost" | "totalTokens">,
  b: Pick<MachineContribution, "totalCost" | "totalTokens">
): boolean {
  if (a.totalCost !== b.totalCost) return a.totalCost > b.totalCost;
  return a.totalTokens > b.totalTokens;
}

export function aggregateContributions(
  contributions: Record<string, MachineContribution>
): DailyAggregate {
  const { [DEFAULT_MACHINE_ID]: unattributed, ...attributed } = countedSlices(contributions);
  const summed = sumContributions(Object.values(attributed));
  // max(unattributed, Σ attributed): the unattributed slice may be any of the
  // id'd machines, so it can hold a day up but never add to it (#81).
  if (unattributed && (Object.keys(attributed).length === 0 || outweighs(unattributed, summed))) {
    return sumContributions([unattributed]);
  }
  return summed;
}

function sumContributions(slices: MachineContribution[]): DailyAggregate {
  const agg: DailyAggregate = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    modelsUsed: [],
    agents: [],
    modelBreakdowns: undefined,
  };
  const models = new Set<string>();
  const agents = new Set<string>();
  for (const c of slices) {
    agg.inputTokens += c.inputTokens;
    agg.outputTokens += c.outputTokens;
    agg.cacheCreationTokens += c.cacheCreationTokens;
    agg.cacheReadTokens += c.cacheReadTokens;
    agg.totalTokens += c.totalTokens;
    agg.totalCost += c.totalCost;
    c.modelsUsed.forEach((m) => models.add(m));
    c.agents.forEach((a) => agents.add(a));
    agg.modelBreakdowns = mergeModelBreakdowns(agg.modelBreakdowns, c.modelBreakdowns);
  }
  agg.modelsUsed = Array.from(models);
  agg.agents = Array.from(agents);
  return agg;
}

/**
 * Fold one machine's slice for a day into the existing per-machine map and
 * recompute the day's aggregate. Pure so it can be unit-tested.
 *
 * @param existing prior per-machine map. Callers pass a legacy row's columns as
 *   a "default" slice (see storedContributions) so its history is kept.
 *   Every slice survives the merge; only the submitting machine's slice can
 *   change, and it only goes down when `acceptLower` says so.
 */
/**
 * The tool the drift corpus is evidence about.
 *
 * Duplicated from drift.ts rather than imported: this module is the one the CLI
 * and the archive re-parser both pull in, and it stays free of dependencies on
 * the storage layer. drift.ts owns the *policy* of when a month counts as
 * deleted; this owns the *mechanics* of applying it to one slice.
 */
const CORPUS_AGENT = "claude";

/**
 * Rebuild a machine's slice, taking the named agent's re-report even when it is
 * lower, while every other agent keeps the larger of the two observations.
 *
 * Returns null when either side lacks a per-agent split, which is the caller's
 * signal to fall back to whole-slice behaviour. Deliberately not a per-*field*
 * max: within one agent the slice is still swapped whole, because mixing tokens
 * from one run with cost from another would synthesise a slice nobody observed.
 * Across agents it is safe, because each agent's slice was measured
 * independently.
 */
function lowerOneAgent(
  prior: MachineContribution,
  incoming: MachineContribution,
  agent: string
): MachineContribution | null {
  const p = prior.agentBreakdowns;
  const i = incoming.agentBreakdowns;
  if (!p || !i) return null;

  const merged: Record<string, AgentSlice> = {};
  for (const name of new Set([...Object.keys(p), ...Object.keys(i)])) {
    if (name === agent) {
      // The pruned tool: honour the new observation, including its absence.
      // A user who deleted a month's transcripts should not keep its total.
      if (i[name]) merged[name] = i[name];
      continue;
    }
    const a = p[name];
    const b = i[name];
    if (a && b) merged[name] = b.totalCost >= a.totalCost ? b : a;
    else merged[name] = (b ?? a)!;
  }

  const slices = Object.values(merged);
  if (slices.length === 0) return incoming;
  const totals = slices.reduce(addSlices);
  return {
    ...incoming,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheCreationTokens: totals.cacheCreationTokens,
    cacheReadTokens: totals.cacheReadTokens,
    totalTokens: totals.totalTokens,
    totalCost: totals.totalCost,
    agentBreakdowns: merged,
  };
}

export function mergeMachineContribution(
  existing: Record<string, MachineContribution> | null | undefined,
  machineId: string,
  incoming: MachineContribution,
  /**
   * Accept a lower re-report for this day instead of holding the high-water
   * mark. Set when the corpus shows the user deleted history for the month
   * (#112) — preserving a figure they deliberately erased is the one case
   * where the high-water mark is wrong.
   */
  acceptLower = false
): {
  contributions: Record<string, MachineContribution>;
  aggregate: DailyAggregate;
  /** True when a lower re-report was rejected in favour of the stored slice. */
  retainedPrior: boolean;
} {
  const others = existing ?? {};
  const prior = others[machineId];
  let slice = incoming;
  let retainedPrior = false;

  // High-water mark per (day, machine) — including the unattributed slice.
  //
  // Claude Code rewrites its own session JSONLs on resume/compact, so a
  // later run can report *less* for a day that already happened. #83 has two
  // independent confirmations: a month-to-date total falling 11% between
  // submissions 16h apart while the file count rose, and 5 assistant
  // messages vanishing from one transcript between scans. Replacing the
  // slice unconditionally meant the board silently took the lower number
  // and a user's total decayed through no fault of their own.
  //
  // A past day can only ever be under-reported by a rewrite, never
  // over-reported by one, so keeping the larger observation is the accurate
  // choice rather than a generous one. Today's day still grows normally,
  // because a later run legitimately reports more and simply wins.
  if (acceptLower && prior && machineId !== DEFAULT_MACHINE_ID) {
    // The verdict is evidence about one tool. Lower that tool's slice and
    // leave every other tool at its high-water mark, so a Claude cleanup
    // stops dragging the same day's Codex tokens down with it (#125).
    //
    // Only reachable when both sides carry a split — which means a recent
    // CLI on both submissions. Everything older falls through to the
    // whole-slice path and behaves exactly as it did before.
    // An unattributed slice for the same day is left alone: nothing ties it
    // to this machine's deletion, and dropping it is how history got lost.
    slice = lowerOneAgent(prior, incoming, CORPUS_AGENT) ?? incoming;
  } else if (prior && outweighs(prior, incoming) && !isEstimatedSliceKey(machineId)) {
    // (Not for an estimate: it is recomputed, not re-read, so the rationale
    // above doesn't apply and a newer estimate replaces the older one.)
    slice = prior;
    retainedPrior = true;
  }

  const contributions = { ...others, [machineId]: slice };
  return { contributions, aggregate: aggregateContributions(contributions), retainedPrior };
}

/**
 * Fold several stored per-machine maps for one day into one — the claim merge,
 * which combines a user's separate submission rows. The same machine seen in
 * two rows is one machine, so its slices are high-water compared rather than
 * summed; distinct machines keep summing; the unattributed slice follows the
 * same max rule as everywhere else. Nothing a row held is dropped (#152).
 */
export function combineContributionMaps(
  maps: Array<Record<string, MachineContribution>>
): { contributions: Record<string, MachineContribution>; aggregate: DailyAggregate } {
  const contributions: Record<string, MachineContribution> = {};
  for (const map of maps) {
    for (const [machineId, slice] of Object.entries(map)) {
      const held = contributions[machineId];
      if (!held || outweighs(slice, held)) contributions[machineId] = slice;
    }
  }
  return { contributions, aggregate: aggregateContributions(contributions) };
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
  if (m.startsWith("deepseek")) return "deepseek";
  if (m.includes("codex")) return "codex";
  return "other";
}

function inferAgents(modelsUsed: string[]): string[] {
  return Array.from(new Set(modelsUsed.map(inferToolFromModel)));
}

/**
 * Canonical tool keys. Different ccusage versions have emitted variant names
 * for the same source (e.g. `claude-code` vs `claude`), which fragments the
 * per-tool boards into separate chips.
 */
const TOOL_ALIASES: Record<string, string> = {
  "claude-code": "claude",
  "claude_code": "claude",
  "gemini-cli": "gemini",
  "copilot-cli": "copilot",
  "hermes-agent": "hermes",
  "pi-agent": "pi",
  // DeepSeek Harness (#154). ccusage has no reader for ~/.dsh yet, so these
  // arrive from an exporter; the aliases keep hand-rolled spellings together.
  "deepseek-harness": "deepseek",
  "deepseek-harness-cli": "deepseek",
  dsh: "deepseek",
};

export function canonicalToolKey(tool: string): string {
  const key = tool.toLowerCase();
  return TOOL_ALIASES[key] ?? key;
}

/** Resolve the agents for a single raw daily row. */
function resolveAgents(entry: RawDailyEntry): string[] {
  const fromMeta = entry.metadata?.agents;
  if (Array.isArray(fromMeta) && fromMeta.length > 0) {
    return Array.from(new Set(fromMeta.map((a) => canonicalToolKey(a))));
  }
  // Single-agent rows (per-source report) carry `agent` directly.
  if (entry.agent && entry.agent !== "all") return [canonicalToolKey(entry.agent)];
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
 * A per-agent split for this row, but only if it reconciles with the row.
 *
 * Tolerance is a cent and one token — enough to absorb float noise in a sum of
 * many slices, far too tight to hide a fabricated one.
 */
function reconciledAgentSlices(entry: RawDailyEntry): Record<string, AgentSlice> | undefined {
  const slices = sanitizeAgentSlices(entry.agents);
  if (!slices) return undefined;
  const sum = Object.values(slices).reduce(addSlices);
  const costOk = Math.abs(sum.totalCost - entry.totalCost) <= 0.01;
  const tokensOk = Math.abs(sum.totalTokens - entry.totalTokens) <= TOKEN_SLOP;
  return costOk && tokensOk ? slices : undefined;
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
    // Only keep a per-agent split that actually reconciles with the row it
    // claims to divide. ccusage's own output does — measured at $0.000000 drift
    // across a real 103-day report — so a split that doesn't add up is a
    // malformed or hostile payload, and storing it would let a caller inflate
    // one agent while the day's headline total stayed believable.
    const agentSplit = reconciledAgentSlices(entry);
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
      existing.agentBreakdowns = mergeAgentMaps(existing.agentBreakdowns, agentSplit);
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
        agentBreakdowns: agentSplit,
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
// Absolute token ceiling. Cache-read tokens are ~free (≈1/10th the input
// price) and dominate `totalTokens` for heavy context-reuse users, so they're
// excluded from this cap — counting them produced false rejections for genuine
// high-cache submissions that sit far under the cost ceiling (#77). The cost
// cap and the cost/token ratio band remain the primary anti-inflation guards.
const MAX_DAILY_TOKENS = 250_000_000; // 250M non-cache-read tokens/day
const MIN_COST_PER_TOKEN = 0.0000001; // cache reads are very cheap
const MAX_COST_PER_TOKEN = 0.1; // sanity ceiling on cost/token

/**
 * Model families whose price lists sit far below the default floor's
 * assumption that a cached read costs about a tenth of fresh input. DeepSeek
 * bills cache hits at 2% of a miss and agentic loops are ~99% cache reads, so
 * an honest DeepSeek day lands near 1e-8 (#154); OpenCode's MiMo and MiniMax
 * models and the free big-pickle land near 2e-8 (#150). Matched on the model
 * name, not the tool: Claude Code and OpenCode can both route to these.
 */
const CHEAP_MODEL_PATTERN = /deepseek|mimo|minimax|big-pickle/i;
const CHEAP_MODEL_MIN_COST_PER_TOKEN = 0.000000001;

function minCostPerTokenForModel(modelName: string): number {
  return CHEAP_MODEL_PATTERN.test(modelName)
    ? CHEAP_MODEL_MIN_COST_PER_TOKEN
    : MIN_COST_PER_TOKEN;
}

/**
 * The least a report could honestly cost: each model's tokens at that model's
 * floor. With only default-floor models this is exactly totalTokens × the
 * default floor — the old ratio check — so nothing loosens for them. Tokens a
 * day reports beyond its per-model split (reasoning tokens, or no split at
 * all) are charged at the cheapest floor present that day.
 */
function minimumPlausibleCost(daily: NormalizedDaily[]): number {
  let minimum = 0;
  for (const day of daily) {
    let covered = 0;
    let cheapestFloor = MIN_COST_PER_TOKEN;
    for (const model of day.modelBreakdowns ?? []) {
      const tokens =
        model.inputTokens + model.outputTokens + model.cacheCreationTokens + model.cacheReadTokens;
      const floor = minCostPerTokenForModel(model.modelName);
      minimum += tokens * floor;
      covered += tokens;
      cheapestFloor = Math.min(cheapestFloor, floor);
    }
    for (const modelName of day.modelsUsed ?? []) {
      cheapestFloor = Math.min(cheapestFloor, minCostPerTokenForModel(modelName));
    }
    minimum += Math.max(0, day.totalTokens - covered) * cheapestFloor;
  }
  return minimum;
}

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
  // Exclude cache-read tokens: they're ~free and legitimately balloon
  // `totalTokens` for heavy context-reuse, so they don't belong against a
  // "realistic tokens" bound (#77).
  const nonCacheReadTokens =
    ccData.totals.totalTokens - ccData.totals.cacheReadTokens;
  if (nonCacheReadTokens > MAX_DAILY_TOKENS * 365) {
    throw new Error("Total tokens exceed realistic limits.");
  }

  // Cost/token ratio is the primary anti-inflation guard now that the token-sum
  // check is one-sided: inflating tokens drives the ratio below the floor,
  // inflating cost drives it above the ceiling.
  //
  // The floor is priced per model (see minimumPlausibleCost), so a mixed
  // report can't hide inflated Claude tokens behind a cheap model's rows:
  // every model's tokens have to be paid for at that model's own floor.
  if (ccData.totals.totalTokens > 0) {
    const costPerToken = ccData.totals.totalCost / ccData.totals.totalTokens;
    const tokensUnpaidFor =
      ccData.totals.totalCost < minimumPlausibleCost(ccData.daily) * (1 - 1e-9);
    if (tokensUnpaidFor || costPerToken > MAX_COST_PER_TOKEN) {
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
