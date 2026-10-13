import { FEATURED_TOOLS, toolLabel } from "@/lib/utils";
import { MIN_SPAN_DAYS, quantile, spanDays, type BurnRow } from "@/lib/spend-curve";

/**
 * Static editorial facts for the programmatic /compare/[matchup] pages.
 * Live usage numbers (developer counts, top spenders) come from the data
 * layer at render time; these are the slow-moving facts a comparison needs.
 */
export interface CompareToolFacts {
  key: string;
  /** Full search-intent name ("Claude Code", "Gemini CLI") vs the short chip label. */
  label: string;
  /**
   * The name people actually type into search, when it differs from `label`
   * ("codex vs claude code", not "openai codex vs claude code").
   */
  searchLabel?: string;
  provider: string;
  pricing: string;
  models: string;
  oneLiner: string;
  /** One honest "pick this if…" clause. Workflow fit, never a benchmark claim. */
  pickIf: string;
}

export const COMPARE_FACTS: Record<string, CompareToolFacts> = {
  claude: {
    key: "claude",
    label: "Claude Code",
    provider: "Anthropic",
    pricing: "Included with Claude Pro ($20/mo) and Max ($100–$200/mo), or pay-as-you-go via the Claude API",
    models: "Claude models (Opus, Sonnet, Haiku)",
    oneLiner:
      "Anthropic's terminal-first coding agent — the tool that defined the agentic CLI category and still drives the most spend on the board.",
    pickIf: "you want a terminal agent that runs long, multi-step tasks on Claude models and you'll use it enough to justify a Max plan",
  },
  codex: {
    key: "codex",
    label: "OpenAI Codex",
    searchLabel: "Codex",
    provider: "OpenAI",
    pricing: "Included with ChatGPT paid plans, or pay-as-you-go via the OpenAI API",
    models: "OpenAI GPT-5 era Codex models",
    oneLiner:
      "OpenAI's coding agent with CLI, IDE, and cloud modes — the fastest-growing challenger on the leaderboard.",
    pickIf: "you already pay for ChatGPT, prefer OpenAI's models, or want cloud tasks alongside the CLI",
  },
  gemini: {
    key: "gemini",
    label: "Gemini CLI",
    provider: "Google",
    pricing: "Generous free tier with a personal Google account; paid via Gemini API / Google AI plans",
    models: "Gemini models",
    oneLiner:
      "Google's open-source terminal agent — the easiest free entry point into agentic coding.",
    pickIf: "you want to try agentic coding without paying first, or you want Gemini's long context",
  },
  copilot: {
    key: "copilot",
    label: "GitHub Copilot",
    provider: "GitHub (Microsoft)",
    pricing: "GitHub Copilot subscription tiers, from free with limits to Pro+",
    models: "Multi-model (OpenAI, Anthropic, Google)",
    oneLiner:
      "GitHub's assistant grown into a CLI agent — the default choice for teams already living inside GitHub.",
    pickIf: "your team already lives in GitHub and wants one seat that covers autocomplete, chat and an agent",
  },
  opencode: {
    key: "opencode",
    label: "OpenCode",
    provider: "Open source (SST)",
    pricing: "Free and open source — bring your own model subscription or API key",
    models: "Any provider (Anthropic, OpenAI, Google, local models)",
    oneLiner:
      "The open-source terminal agent for people who want Claude Code ergonomics without the lock-in.",
    pickIf: "you want an open-source agent and the freedom to switch model providers",
  },
  cursor: {
    key: "cursor",
    label: "Cursor",
    provider: "Anysphere",
    pricing: "Free Hobby tier; Pro, Pro+ and Ultra subscriptions with usage-based limits",
    models: "Multi-model (OpenAI, Anthropic, Google) plus Cursor's own models",
    oneLiner:
      "The AI-first code editor — a VS Code fork built around inline edits, tab completion and an in-editor agent.",
    pickIf: "you want AI inside an editor, with inline diffs and completions, more than a terminal agent",
  },
  antigravity: {
    key: "antigravity",
    label: "Antigravity",
    provider: "Google",
    pricing: "Free for individuals with rate limits; higher limits through Google AI plans",
    models: "Gemini models, plus selected third-party models",
    oneLiner:
      "Google's agent-first IDE, where agents plan and run work across the editor, terminal and browser.",
    pickIf: "you want an agent-first IDE on Google's stack and are happy with Gemini as the default model",
  },
};

export interface CompareMatchup {
  slug: string;
  a: string;
  b: string;
}

// Ordered pairs in FEATURED_TOOLS order: claude-vs-codex, claude-vs-gemini, …
// Only this ordering is generated; the reversed slug 308s to the canonical one.
// Restricted to the core five — newer boards (hermes, pi, …) get a /tool page
// without exploding the matchup grid into thin pages.
const GRID_TOOLS = ["claude", "codex", "gemini", "copilot", "opencode"];
const COMPARE_TOOLS = FEATURED_TOOLS.filter((t) => GRID_TOOLS.includes(t.key));

// Tools people search against Claude Code specifically ("cursor vs claude
// code", "antigravity vs claude code"). Only the Claude pairing is generated:
// each has real developers on the board, but too few for a full grid. Kiro is
// absent because nobody has submitted Kiro usage yet.
const CLAUDE_ONLY_TOOLS = ["cursor", "antigravity"];

export const COMPARE_MATCHUPS: CompareMatchup[] = [
  ...COMPARE_TOOLS.flatMap((a, i) =>
    COMPARE_TOOLS.slice(i + 1).map((b) => ({ slug: `${a.key}-vs-${b.key}`, a: a.key, b: b.key }))
  ),
  ...CLAUDE_ONLY_TOOLS.map((b) => ({ slug: `claude-vs-${b}`, a: "claude", b })),
];

/** Resolve a slug (either order) to its canonical matchup, or null. */
export function resolveMatchup(slug: string): { matchup: CompareMatchup; canonical: boolean } | null {
  const direct = COMPARE_MATCHUPS.find((m) => m.slug === slug);
  if (direct) return { matchup: direct, canonical: true };
  const parts = slug.split("-vs-");
  if (parts.length !== 2) return null;
  const reversed = COMPARE_MATCHUPS.find((m) => m.a === parts[1] && m.b === parts[0]);
  return reversed ? { matchup: reversed, canonical: false } : null;
}

/** Full search-intent label for a tool key ("Claude Code"), falling back to the chip label. */
export function compareLabel(key: string): string {
  return COMPARE_FACTS[key]?.label ?? toolLabel(key);
}

/** The name as searched: "Codex", not "OpenAI Codex". */
export function searchLabel(key: string): string {
  return COMPARE_FACTS[key]?.searchLabel ?? compareLabel(key);
}

/**
 * The order people type the matchup in. Search volume sits on "<x> vs claude
 * code" (codex vs claude code: 14.8K/mo against 5.4K for the reverse), so
 * Claude Code goes second while the canonical slug keeps it first.
 */
export function queryOrder(m: CompareMatchup): [string, string] {
  return m.a === "claude" ? [m.b, m.a] : [m.a, m.b];
}

export function matchupTitle(m: CompareMatchup): string {
  const [first, second] = queryOrder(m);
  return `${searchLabel(first)} vs ${searchLabel(second)}`;
}

/** The same matchup the other way round, for copy that covers both phrasings. */
export function reversedTitle(m: CompareMatchup): string {
  const [first, second] = queryOrder(m);
  return `${searchLabel(second)} vs ${searchLabel(first)}`;
}

const TITLE_BUDGET = 60;

/**
 * Leads with the exact query and fits the ~60 characters a results page shows,
 * dropping the least important words first.
 */
export function matchupMetaTitle(m: CompareMatchup, developers: number): string {
  const base = `${matchupTitle(m)} (2026)`;
  const n = developers.toLocaleString("en-US");
  const candidates = [
    ...(developers > 0
      ? [
          `${base}: Measured Cost & Usage From ${n} Developers`,
          `${base}: Measured Cost From ${n} Developers`,
          `${base}: Measured Cost From ${n} Devs`,
          `${base}: Real Cost From ${n} Devs`,
        ]
      : []),
    `${base}: Measured Cost & Usage`,
    `${base}: Real Cost & Usage`,
  ];
  return candidates.find((c) => c.length <= TITLE_BUDGET) ?? candidates[candidates.length - 1];
}

// ---------------------------------------------------------------------------
// Measured cohorts
// ---------------------------------------------------------------------------

/** Below this many developers a median is an anecdote, so we don't print one. */
export const MIN_COHORT = 10;

export interface ToolCohort {
  tool: string;
  /** Developers whose submission includes this tool. */
  developers: number;
  /** Median monthly API-equivalent spend of those developers (all their tools), or null below MIN_COHORT. */
  medianMonthlyUsd: number | null;
  /** Median tokens per calendar day, cache reads included, or null below MIN_COHORT. */
  medianTokensPerDay: number | null;
  /** Developers who use this tool and nothing else ccusage tracks. */
  onlyDevelopers: number;
  /** Their median monthly spend: the cleanest per-tool cost, or null below MIN_COHORT. */
  onlyMedianMonthlyUsd: number | null;
}

export interface MatchupStats {
  /** Developers who use either tool. */
  developers: number;
  a: ToolCohort;
  b: ToolCohort;
  /** Developers who use both. */
  both: number;
  /** Share of A's developers who also use B, and vice versa. */
  shareOfAUsingB: number;
  shareOfBUsingA: number;
}

interface CohortRow {
  tools: Set<string>;
  monthlyUsd: number;
  tokensPerDay: number;
}

/**
 * One row per developer (their highest-cost submission), normalised to a
 * 30-day month — the same rules as the /data cost benchmark, so the numbers
 * agree. Rows without a tools list predate tool tracking, which only read
 * Claude Code.
 */
function cohortRows(rows: BurnRow[]): CohortRow[] {
  const best = new Map<string, BurnRow>();
  for (const row of rows) {
    const key = row.username.toLowerCase();
    const current = best.get(key);
    if (!current || row.totalCost > current.totalCost) best.set(key, row);
  }
  const out: CohortRow[] = [];
  for (const row of best.values()) {
    const days = spanDays(row.start, row.end);
    if (days < MIN_SPAN_DAYS || !(row.totalCost > 0)) continue;
    const tools = row.tools && row.tools.length > 0 ? row.tools : ["claude"];
    out.push({
      tools: new Set(tools.map((t) => t.toLowerCase())),
      monthlyUsd: (row.totalCost / days) * 30,
      tokensPerDay: (row.totalTokens ?? 0) / days,
    });
  }
  return out;
}

function medianOrNull(values: number[]): number | null {
  if (values.length < MIN_COHORT) return null;
  return quantile([...values].sort((x, y) => x - y), 0.5);
}

function toolCohort(rows: CohortRow[], tool: string): ToolCohort {
  const users = rows.filter((r) => r.tools.has(tool));
  const only = users.filter((r) => r.tools.size === 1);
  return {
    tool,
    developers: users.length,
    medianMonthlyUsd: medianOrNull(users.map((r) => r.monthlyUsd)),
    medianTokensPerDay: medianOrNull(users.map((r) => r.tokensPerDay)),
    onlyDevelopers: only.length,
    onlyMedianMonthlyUsd: medianOrNull(only.map((r) => r.monthlyUsd)),
  };
}

export function buildMatchupStats(rows: BurnRow[], a: string, b: string): MatchupStats {
  const cohort = cohortRows(rows);
  const statsA = toolCohort(cohort, a);
  const statsB = toolCohort(cohort, b);
  const both = cohort.filter((r) => r.tools.has(a) && r.tools.has(b)).length;
  return {
    developers: statsA.developers + statsB.developers - both,
    a: statsA,
    b: statsB,
    both,
    shareOfAUsingB: statsA.developers > 0 ? both / statsA.developers : 0,
    shareOfBUsingA: statsB.developers > 0 ? both / statsB.developers : 0,
  };
}

// ---------------------------------------------------------------------------
// Copy derived from the measurements
// ---------------------------------------------------------------------------

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Cohort for a tool key, in query order. */
function cohortsInQueryOrder(m: CompareMatchup, s: MatchupStats): [ToolCohort, ToolCohort] {
  const [first] = queryOrder(m);
  return first === m.a ? [s.a, s.b] : [s.b, s.a];
}

/** "Single-tool Codex developers spend a median $X/mo; Claude Code-only, $Y." or null. */
export function costSentence(m: CompareMatchup, s: MatchupStats): string | null {
  const [x, y] = cohortsInQueryOrder(m, s);
  if (x.onlyMedianMonthlyUsd === null || y.onlyMedianMonthlyUsd === null) return null;
  const lx = searchLabel(x.tool);
  const ly = searchLabel(y.tool);
  const cheaper = x.onlyMedianMonthlyUsd <= y.onlyMedianMonthlyUsd ? lx : ly;
  return (
    `Developers who use only ${lx} run a median ${usd(x.onlyMedianMonthlyUsd)}/month of API-equivalent usage ` +
    `(${x.onlyDevelopers.toLocaleString()} developers); ${ly}-only developers run ${usd(y.onlyMedianMonthlyUsd)} ` +
    `(${y.onlyDevelopers.toLocaleString()}). By that measure ${cheaper} users consume less.`
  );
}

/** Short, data-grounded "which should you use?" paragraphs. No benchmarks we didn't run. */
export function whichToUse(m: CompareMatchup, s: MatchupStats): string[] {
  const [x, y] = cohortsInQueryOrder(m, s);
  const lx = searchLabel(x.tool);
  const ly = searchLabel(y.tool);
  const out: string[] = [];

  if (x.developers > 0 && y.developers > 0) {
    const [more, fewer] = x.developers >= y.developers ? [x, y] : [y, x];
    const overlap = s.both / fewer.developers;
    out.push(
      `${searchLabel(more.tool)} has more developers on the board (${more.developers.toLocaleString()} vs ` +
        `${fewer.developers.toLocaleString()}), and ${pct(overlap)} of ${searchLabel(fewer.tool)} developers ` +
        `also use ${searchLabel(more.tool)}. Many people don't pick one; they run both and route work between them.`
    );
  }

  const cost = costSentence(m, s);
  out.push(
    cost
      ? `${cost} Consuming less is not the same as paying less: most developers here are on flat subscriptions, so compare your own volume with the plan prices above.`
      : `There are too few single-tool ${x.onlyDevelopers < MIN_COHORT ? lx : ly} developers on the board yet to quote a fair median cost, so we don't. Compare the plan prices above against your own volume (npx ccusage@latest daily).`
  );

  out.push(`Pick ${lx} if ${COMPARE_FACTS[x.tool].pickIf}. Pick ${ly} if ${COMPARE_FACTS[y.tool].pickIf}.`);
  return out;
}
