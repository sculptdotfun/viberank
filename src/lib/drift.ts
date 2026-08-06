/**
 * Classifying why a month came back smaller than we last saw it.
 *
 * Pure so the rule can be tested without a database, and so the reasoning
 * lives in one readable place rather than inside a merge loop.
 */

export interface CorpusSize {
  files: number;
  bytes: number;
}

export type DriftVerdict =
  /** Files disappeared: the user removed history. Honour their lower number. */
  | "deleted"
  /** Corpus is intact or larger but totals fell: the runtime rewrote it. */
  | "rewritten"
  /** No prior observation for this month — nothing to compare against yet. */
  | "unknown";

/**
 * Compare this month's corpus against the last one recorded for the same
 * (machine, month).
 *
 * `files` is the primary signal. `bytes` is the tiebreak for the one case
 * month-scoping cannot separate: inside the *current* month, deletions and
 * new sessions land in the same bucket, so a deletion can leave the file count
 * flat or higher. Bytes move the right way there more often than files do.
 */
export function classifyDrift(
  prior: CorpusSize | null | undefined,
  current: CorpusSize | null | undefined
): DriftVerdict {
  if (!prior || !current) return "unknown";
  if (!Number.isFinite(prior.files) || !Number.isFinite(current.files)) return "unknown";

  if (current.files < prior.files) return "deleted";

  // Same file count but materially less content is a deletion hiding behind a
  // flat count — a session cleared in place, or removed and replaced. The 2%
  // margin keeps ordinary compaction from reading as intent.
  if (
    current.files === prior.files &&
    Number.isFinite(prior.bytes) &&
    Number.isFinite(current.bytes) &&
    current.bytes < prior.bytes * 0.98
  ) {
    return "deleted";
  }

  return "rewritten";
}

/**
 * The one tool the corpus is evidence about.
 *
 * `collectCorpus` walks ~/.claude/projects and nothing else, so a file count
 * says something about Claude Code and nothing whatsoever about Codex, Gemini,
 * Copilot or OpenCode — all of which reach viberank through the same ccusage
 * payload.
 */
export const CORPUS_AGENT = "claude";

/**
 * Whether a drift verdict may be applied to a day at all.
 *
 * A month can legitimately mix tools: Claude Code transcripts pruned while the
 * same month's Codex usage is untouched. The month-level verdict is derived
 * from Claude files alone, so it may only lower Claude-attributed days.
 *
 * An empty agent list means the payload came from a single-source report that
 * carries no agent fields — historically `ccusage claude daily --json`. Those
 * are Claude, so they stay in scope; treating unknown as out-of-scope would
 * quietly switch the feature off for the exact users it was built for.
 */
export function corpusCoversDay(agents: readonly string[] | null | undefined): boolean {
  if (!agents || agents.length === 0) return true;
  return agents.some((agent) => agent.toLowerCase() === CORPUS_AGENT);
}

/** 'YYYY-MM' for a 'YYYY-MM-DD' date, or null if it isn't one. */
export function monthOfDate(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 7) : null;
}

/**
 * Months whose lower re-report should be accepted rather than overridden by
 * the high-water mark.
 */
export function monthsUserDeleted(
  prior: Record<string, CorpusSize> | null | undefined,
  incoming: Record<string, CorpusSize> | null | undefined
): Set<string> {
  const deleted = new Set<string>();
  if (!incoming) return deleted;

  for (const [month, current] of Object.entries(incoming)) {
    if (classifyDrift(prior?.[month], current) === "deleted") deleted.add(month);
  }

  // A month absent from `incoming` is deliberately NOT treated as deletion.
  //
  // It used to be, on the reasoning that a month the client stops reporting was
  // emptied entirely, and that without the rule a cleared month keeps its total
  // forever. Both halves of that are true. The rule was still wrong, because
  // absence has three causes and only one of them is deletion:
  //
  //   1. the user cleared the month                        — deletion
  //   2. the month aged out of ~/.claude/projects          — not deletion
  //      (Claude Code prunes on `cleanupPeriodDays`, 30 by default, so for
  //      most users most history is missing as a matter of course)
  //   3. the user never used Claude Code that month        — not deletion
  //      (the corpus scans ~/.claude/projects only, while viberank accepts
  //      Codex, Gemini, Copilot and OpenCode through the same payload)
  //
  // Nothing in the payload separates them. On production data at the time this
  // was removed, every single absent month — 20 of 20, across 5 users — was
  // cause 3: Codex or Gemini history from users with no Claude Code usage that
  // month at all. Cause 1 did not appear once.
  //
  // The cost of dropping it is that clearing an entire month is no longer
  // honoured, which is #111's documented behaviour anyway. The cost of keeping
  // it was disabling the high-water mark across those users' whole non-Claude
  // history on the strength of a file count that was never evidence about it.

  return deleted;
}
