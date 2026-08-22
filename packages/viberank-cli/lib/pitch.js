/**
 * What to say when offering autosubmit.
 *
 * Kept out of cli.js and free of side effects because the wording *is* the
 * feature here: the previous pitch ("keep your rank up to date") is the vanity
 * reason and converts badly — 62 of ~1,100 people have ever sent a second
 * report. This one leads with the thing that is actually at stake.
 *
 * Claude Code deletes session transcripts older than `cleanupPeriodDays` — 30
 * by default — on startup, with no warning and no recovery. Every tool that
 * reads ~/.claude/projects loses that history at the same moment. A report
 * already sent to viberank is unaffected, which is the one thing this tool can
 * offer that a local reader cannot.
 */

/** Claude Code's default `cleanupPeriodDays`. */
export const DEFAULT_CLEANUP_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Oldest/newest day in a ccusage report, and how far back it reaches. */
export function historyWindow(ccData, today = new Date()) {
  // ccusage's aggregate report keys days as `period`, not `date` — the server's
  // normalizer already does `date ?? period` and the CLI reads the raw file, so
  // reading only `date` here silently yielded nothing on every real report.
  const dates = (ccData?.daily ?? [])
    .map((d) => d?.date ?? d?.period)
    .filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) return null;
  const oldest = dates[0];
  // Compare date to date. Using the raw clock made the answer depend on the
  // time of day the CLI happened to run — the same report read 29 days at
  // midnight and 30 at noon, which is not a distinction anyone wants surfaced.
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const reachDays = Math.round((todayUtc - Date.parse(`${oldest}T00:00:00Z`)) / DAY_MS);
  return { oldest, newest: dates[dates.length - 1], days: dates.length, reachDays };
}

/**
 * True when the report reaches back roughly as far as the default cleanup and
 * no further — the shape of history that has started aging out.
 *
 * Deliberately a *suspicion*, never asserted to the user as fact: someone who
 * installed Claude Code five weeks ago looks identical from here, and telling
 * them their data was deleted when it never existed would be worse than saying
 * nothing. The caller states the default and the user's own reach, and lets
 * them draw the conclusion.
 */
export function looksTruncated(window) {
  if (!window) return false;
  return window.reachDays >= DEFAULT_CLEANUP_DAYS - 3 && window.reachDays <= DEFAULT_CLEANUP_DAYS + 10;
}

/** Lines to print above the autosubmit prompt. Plain text; caller styles it. */
export function autosubmitPitch(ccData, today = new Date()) {
  const w = historyWindow(ccData, today);
  const lines = [
    '',
    `Claude Code deletes session history older than ${DEFAULT_CLEANUP_DAYS} days by default,`,
    'without warning. Every tool that reads those files loses it too.',
  ];
  if (w) {
    lines.push(`Your report reaches back to ${w.oldest} — ${w.reachDays} days.`);
    if (looksTruncated(w)) {
      lines.push('That is about where the default cleanup starts, so you may');
      lines.push('already be losing the oldest of it.');
    }
  }
  lines.push('');
  lines.push('What you send here is kept. Autosubmit sends once a day, so the');
  lines.push('record stays complete even after the local files are gone.');
  return lines;
}

/** How to stop the deletion at the source. Shown once, after enabling. */
export function keepLocalHistoryHint() {
  return `Tip: add "cleanupPeriodDays": 3650 to ~/.claude/settings.json to stop Claude Code deleting it locally too.`;
}
