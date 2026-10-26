import fs from 'fs';
import path from 'path';

/**
 * The scheduled run's own record: one dated line per run in
 * ~/.viberank/autosubmit.log, and the arithmetic `status` does on it.
 *
 * Only launchd used to log, and only because its plist pointed stdout at the
 * file. systemd sent the output to a journal nobody reads and Task Scheduler
 * dropped it, so on two of three platforms a failing job left no trace. The
 * CLI writes the line itself now, on every platform.
 */

/** Enough for months of daily runs; small enough to never matter on disk. */
export const MAX_LOG_LINES = 200;

const HOUR_MS = 60 * 60 * 1000;

/** How long without a success before `status` says something is wrong. A
 * day's slack on top of the daily schedule, so one missed run (a laptop shut
 * over a weekend night) is not an alarm. */
export const OVERDUE_MS = 48 * HOUR_MS;

/**
 * `2026-10-26T09:37:02.114Z ok HTTP 200 — submitted 41 days as @you`
 *
 * @param {{ outcome: 'ok' | 'fail' | 'skip', status?: number | null, detail: string, time?: Date }} entry
 *   `status` is the HTTP status when the server answered; a failure without
 *   one is logged as `error`.
 */
export function formatLogLine({ outcome, status = null, detail, time = new Date() }) {
  const code = status != null ? `HTTP ${status}` : outcome === 'fail' ? 'error' : '';
  const text = String(detail ?? '').replace(/\s+/g, ' ').trim();
  return [time.toISOString(), outcome, code, code || text ? '—' : '', text].filter(Boolean).join(' ');
}

/** The last `max` non-empty lines of `text`. */
export function trimLines(text, max = MAX_LOG_LINES) {
  return String(text ?? '').split(/\r?\n/).filter((line) => line.trim()).slice(-max);
}

/**
 * Append `line` and keep the file to the last `max` lines.
 *
 * Rewritten in place rather than replaced by a rename: under launchd this
 * same file is the job's stdout, held open in append mode, and a rename would
 * leave that descriptor writing into a file nobody can see.
 */
export function appendLog(file, line, max = MAX_LOG_LINES) {
  let existing = '';
  try {
    existing = fs.readFileSync(file, 'utf8');
  } catch {
    // First run.
  }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${trimLines(`${existing}\n${line}`, max).join('\n')}\n`);
}

/** The last `count` lines of the log, or none. */
export function readLog(file, count = 5) {
  try {
    return trimLines(fs.readFileSync(file, 'utf8'), count);
  } catch {
    return [];
  }
}

/** The most recent successful submission this machine recorded, as a Date. */
export function lastSuccess(config) {
  const times = [config?.lastSubmit, config?.lastAutosubmit]
    .map((value) => (typeof value === 'string' ? Date.parse(value) : NaN))
    .filter((ms) => !Number.isNaN(ms));
  return times.length ? new Date(Math.max(...times)) : null;
}

/** "just now", "25 min ago", "5 h ago", "3 days ago". */
export function timeAgo(then, now = new Date()) {
  const ms = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(ms / HOUR_MS);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * Whether autosubmit is on but has not landed a submission in OVERDUE_MS.
 * The clock starts at the later of the last success and the moment autosubmit
 * was turned on, so a job switched on an hour ago is not "overdue" because of
 * a manual submission from last month.
 */
export function isOverdue({ enabled, last, enabledAt, now = new Date() }) {
  if (!enabled) return false;
  const times = [last?.getTime(), enabledAt ? Date.parse(enabledAt) : NaN]
    .filter((ms) => Number.isFinite(ms));
  if (!times.length) return false;
  return now.getTime() - Math.max(...times) > OVERDUE_MS;
}
