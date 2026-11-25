/**
 * The standing file and the one-line standing a status line prints.
 *
 * Self-contained on purpose (node built-ins only): the Claude Code plugin
 * ships a byte-identical copy as its status-line script, and a status line
 * runs on every prompt, so it must start fast and never touch the network.
 * test/plugin-statusline.test.mts checks the two copies stay identical.
 *
 * The file is written by the CLI after each successful submit or scheduled
 * sync, from GET /api/v2/standing/{username}.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

export const STANDING_FILE = path.join(os.homedir(), '.viberank', 'standing.json');

/** Bumped when the record's shape changes in a way old readers would misread. */
export const STANDING_VERSION = 1;

export const FORMATS = ['short', 'compact', 'long', 'json'];

/**
 * @typedef {{
 *   version: number, username: string,
 *   weekId: string, weekDay: number, weekClosesAt: string,
 *   cls: 'ranked' | 'open' | 'fleets', heldReason: string | null,
 *   rank: number | null, of: number, movement: number | null,
 *   cost: number, tokens: number, planEq: number,
 *   gap: number | null, above: string | null,
 *   streakWeeks: number, updatedAt: string,
 * }} StandingRecord
 */

/** Write atomically, so a status line never reads half a file. */
export function writeStandingFile(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** The saved record, or null when missing, unreadable or from another version. */
export function readStandingFile(file = STANDING_FILE) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || parsed.version !== STANDING_VERSION) return null;
  if (typeof parsed.weekId !== 'string' || typeof parsed.of !== 'number') return null;
  return parsed;
}

/** "2026-W48" -> "48"; anything else as given. */
export function weekNumber(weekId) {
  const match = /^\d{4}-W(\d{1,2})$/.exec(String(weekId ?? ''));
  return match ? String(Number(match[1])) : String(weekId ?? '');
}

/** "$27", "$1,240", "$12.4K". Gaps round up: $26.10 behind is $27 to pass. */
export function money(value, { up = false } = {}) {
  const n = Number(value) || 0;
  if (n >= 10000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `$${(up ? Math.ceil(n) : Math.round(n)).toLocaleString('en-US')}`;
}

/** 1.1B, 340M, 12K. */
export function compactTokens(value) {
  const n = Number(value) || 0;
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, unit] of units) {
    if (n >= size) return `${(n / size).toFixed(n / size >= 100 ? 0 : 1).replace(/\.0$/, '')}${unit}`;
  }
  return String(Math.round(n));
}

const ANSI = { green: 32, red: 31, gray: 90, yellow: 33 };
const paint = (on, colour, text) => (on ? `\u001b[${ANSI[colour]}m${text}\u001b[39m` : text);

/** ▲6, ▼3, = (no change), new (not on last week's board). */
export function movementMark(movement, color = false) {
  if (movement === null || movement === undefined) return paint(color, 'gray', 'new');
  if (movement > 0) return paint(color, 'green', `▲${movement}`);
  if (movement < 0) return paint(color, 'red', `▼${-movement}`);
  return paint(color, 'gray', '=');
}

/** Whether the week the record describes has closed by `now`. */
export function weekIsOver(record, now = new Date()) {
  const closes = Date.parse(record?.weekClosesAt ?? '');
  return Number.isFinite(closes) && now.getTime() >= closes;
}

const CLASS_LABEL = { ranked: 'Ranked', open: 'Open', fleets: 'Fleets' };

/** Values a custom template can use, e.g. "{rank}/{of} {move}". */
export function templateValues(record, { color = false, now = new Date() } = {}) {
  return {
    rank: record.rank === null ? '-' : String(record.rank),
    of: String(record.of),
    move: movementMark(record.movement, color),
    gap: record.gap === null ? '' : money(record.gap, { up: true }),
    above: record.above ?? '',
    week: weekNumber(record.weekId),
    day: String(record.weekDay),
    cost: money(record.cost),
    tokens: compactTokens(record.tokens),
    plans: (Number(record.planEq) || 0).toFixed(1),
    class: CLASS_LABEL[record.cls] ?? record.cls,
    streak: String(record.streakWeeks ?? 0),
    user: record.username,
    status: weekIsOver(record, now) ? 'final' : 'live',
  };
}

function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? values[key] : whole));
}

/** The chase: "$27 to @palewave", or "top" at #1. */
function chase(record) {
  if (record.rank === 1) return 'top';
  if (record.gap === null || !record.above) return '';
  return `${money(record.gap, { up: true })} to @${record.above}`;
}

/**
 * One line for a status line.
 *
 *   short    vr #41/126 ▲6 · $27 to @palewave
 *   compact  #41 ▲6
 *   long     viberank wk48 d3 · #41/126 Ranked ▲6 · $835 · $27 to @palewave · 4w streak
 *   json     the record
 *   other    a template, e.g. "{rank}/{of} {move}"
 *
 * Off the Ranked board the class is named ("vr open #12/40"). A closed week
 * says "final", since the next sync will start the new one. Null record:
 * a hint to run the CLI once.
 */
export function statusLine(record, { format = 'short', color = false, now = new Date() } = {}) {
  if (!record) return format === 'json' ? '{}' : format === 'compact' ? '' : 'vr · run npx viberank-cli';
  if (format === 'json') return JSON.stringify(record);
  const values = templateValues(record, { color, now });
  if (!FORMATS.includes(format)) return fillTemplate(format, values);

  const over = weekIsOver(record, now);
  const cls = record.cls === 'ranked' ? '' : `${record.cls} `;
  if (record.rank === null) {
    if (format === 'compact') return '';
    return over ? `vr wk${values.week} · no usage` : `vr wk${values.week} · no usage yet`;
  }
  if (format === 'compact') return `#${values.rank} ${values.move}`;

  const head = `#${values.rank}/${values.of}`;
  if (format === 'long') {
    const parts = [
      `viberank wk${values.week} ${over ? 'final' : `d${values.day}`}`,
      `${head} ${values.class} ${values.move}`,
      values.cost,
      chase(record),
      record.streakWeeks > 1 ? `${record.streakWeeks}w streak` : '',
    ];
    return parts.filter(Boolean).join(' · ');
  }
  if (over) return `vr ${cls}wk${values.week} final ${head}`;
  const tail = chase(record);
  return `vr ${cls}${head} ${values.move}${tail ? ` · ${tail}` : ''}`;
}

/** Run as a script: print the line. Used by the Claude Code plugin's status line. */
function main(argv) {
  const at = argv.indexOf('--format');
  const format = at >= 0 && argv[at + 1] ? argv[at + 1] : process.env.VIBERANK_STATUS_FORMAT || 'short';
  const color = !process.env.NO_COLOR && !argv.includes('--no-color');
  process.stdout.write(`${statusLine(readStandingFile(), { format, color })}\n`);
}

function isEntryPoint() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main(process.argv.slice(2));
