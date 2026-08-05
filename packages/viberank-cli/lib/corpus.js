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

/** How much of each end of a transcript to read looking for a timestamp. */
const EDGE_BYTES = 64 * 1024;

const TIMESTAMP = /"timestamp"\s*:\s*"([^"]+)"/g;

function firstStamp(text) {
  TIMESTAMP.lastIndex = 0;
  const m = TIMESTAMP.exec(text);
  return m ? m[1] : null;
}

function lastStamp(text) {
  TIMESTAMP.lastIndex = 0;
  let found = null;
  let m;
  while ((m = TIMESTAMP.exec(text)) !== null) found = m[1];
  return found;
}

/**
 * First and last ISO timestamps in a transcript.
 *
 * Reads only the two ends rather than the whole file. Records are written
 * chronologically, so the earliest and latest stamps sit at the edges — and on
 * a real corpus this is the difference between a usable scan and an unusable
 * one: 922 transcripts totalling 853 MB took 12.6s and 541 MB of RSS when this
 * read every byte, against roughly a tenth of that reading edges. It runs on
 * every submission, so that cost would have been paid constantly for a figure
 * the user never sees.
 */
function boundsOf(file) {
  let fd;
  try {
    const size = fs.statSync(file).size;
    if (size === 0) return null;
    fd = fs.openSync(file, 'r');

    const headLen = Math.min(size, EDGE_BYTES);
    const head = Buffer.allocUnsafe(headLen);
    fs.readSync(fd, head, 0, headLen, 0);
    const headText = head.toString('utf8');
    let first = firstStamp(headText);

    if (!first) {
      // No stamp in the first chunk. Reading the edges is an optimisation, not
      // a definition of the corpus, so fall back to a full scan rather than
      // dropping the file — silently skipping it would undercount exactly the
      // way the recursive-walk bug does. Measured at 17 of 922 files on a real
      // corpus, and rare enough that the full read costs nothing overall.
      const whole = fs.readFileSync(file, 'utf8');
      const only = firstStamp(whole);
      if (!only) return null;
      return { first: only, last: lastStamp(whole) ?? only };
    }

    // Small enough that the head already covered the whole file.
    if (size <= EDGE_BYTES) {
      return { first, last: lastStamp(headText) ?? first };
    }

    const tailLen = Math.min(size, EDGE_BYTES);
    const tail = Buffer.allocUnsafe(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    // A stamp split across the boundary simply is not matched here; the head's
    // value still bounds the file, so the month is right either way.
    const last = lastStamp(tail.toString('utf8')) ?? first;

    return { first, last };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }
  }
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
