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

  // A month the client no longer reports at all was emptied entirely. Without
  // this, clearing a whole month leaves its stored total untouched forever,
  // because nothing arrives to compare against.
  for (const month of Object.keys(prior ?? {})) {
    if (!(month in incoming)) deleted.add(month);
  }

  return deleted;
}
