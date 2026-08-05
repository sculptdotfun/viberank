import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Per-month corpus size, for the drift discriminator (#112).
 *
 * The server needs to tell "the runtime rewrote a transcript" from "the user
 * deleted history", and totals alone cannot: both look like a month coming
 * back lower. File counts distinguish them — but only if they are scoped to
 * the month they describe.
 *
 * A global count is useless here and actively misleading: at ~23 new
 * transcript files a day, deleting a month with 91 files is masked within a
 * few days of ordinary work, so the server would read "files went up" and keep
 * a figure the user meant to erase.
 *
 * Month is the finest scope that is well defined. Long sessions cross days —
 * measured at 51 of 1,323 files carrying 36% of records, overshooting a
 * per-day count by 8.2% — while only 5 of 1,323 cross a month boundary (0.4%).
 * A file spanning two months is counted in both, which is harmless because
 * every comparison is against the same client's own earlier count.
 */

/** Where Claude Code keeps session transcripts. */
export const DEFAULT_ROOT = path.join(os.homedir(), '.claude', 'projects');

/**
 * Every .jsonl under root, recursively.
 *
 * Recursion is load-bearing, not tidiness: subagent transcripts live in
 * `<session>/subagents/`, and a flat glob has been measured seeing 75 files
 * where the true count was 1,398. That undercount makes the discriminator
 * confidently wrong rather than merely noisy, which is why it has a test.
 */
export function listTranscripts(root = DEFAULT_ROOT) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — skip rather than abort the scan
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) found.push(full);
    }
  };
  walk(root);
  return found;
}

/** First and last ISO timestamps in a transcript, without holding it in memory. */
function boundsOf(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }

  const stamps = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    // Records are chronological, so the first and last datable lines bound the
    // file. Parsing every line would be exact and much slower for no gain.
    const m = /"timestamp"\s*:\s*"([^"]+)"/.exec(line);
    if (m) {
      stamps.push(m[1]);
      if (stamps.length === 1) continue;
    }
  }
  if (stamps.length === 0) return null;
  return { first: stamps[0], last: stamps[stamps.length - 1] };
}

const monthOf = (iso) => (typeof iso === 'string' ? iso.slice(0, 7) : null);

/** Every month a file touches, inclusive of both ends. */
function monthsSpanned(first, last) {
  const a = monthOf(first);
  const b = monthOf(last);
  if (!a || !/^\d{4}-\d{2}$/.test(a)) return [];
  if (!b || !/^\d{4}-\d{2}$/.test(b) || b < a) return [a];

  const months = [];
  let [y, m] = a.split('-').map(Number);
  const [ey, em] = b.split('-').map(Number);
  // Bounded so a corrupt far-future timestamp can't spin here.
  for (let i = 0; i < 240 && (y < ey || (y === ey && m <= em)); i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

/**
 * `{ "2026-07": { files, bytes }, … }` — the shape the server expects.
 * Returns null when there is nothing to report, so the CLI can omit the block
 * rather than send an empty object the server has to special-case.
 */
export function collectCorpus(root = DEFAULT_ROOT) {
  const files = listTranscripts(root);
  if (files.length === 0) return null;

  const byMonth = {};
  for (const file of files) {
    const bounds = boundsOf(file);
    if (!bounds) continue;

    let size = 0;
    try {
      size = fs.statSync(file).size;
    } catch {
      continue;
    }

    for (const month of monthsSpanned(bounds.first, bounds.last)) {
      byMonth[month] ??= { files: 0, bytes: 0 };
      byMonth[month].files += 1;
      byMonth[month].bytes += size;
    }
  }

  return Object.keys(byMonth).length > 0 ? byMonth : null;
}
