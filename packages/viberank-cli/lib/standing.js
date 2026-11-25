/**
 * Your week, after a submit: rank in class, movement, the gap to the person
 * above, and the links to share it.
 *
 * Reads GET /api/v2/standing/{username} (the `Standing` shape in
 * src/lib/v2/contract.ts). Anything short of a well-formed answer, including
 * a 404 from a server that predates v2, is null, and the caller prints what
 * it printed before. Formatting is pure and takes a `paint` object so the
 * tests read plain text and the CLI passes chalk.
 */

import { compactTokens, money, movementMark, STANDING_VERSION, weekIsOver, weekNumber } from './statusline.js';

const plain = { bold: (s) => s, accent: (s) => s, gray: (s) => s, green: (s) => s, red: (s) => s, yellow: (s) => s };

const CLASSES = new Set(['ranked', 'open', 'fleets']);
const CLASS_LABEL = { ranked: 'Ranked', open: 'Open', fleets: 'Fleets' };

/** Enough of the contract's Standing to print and save without guessing. */
export function isStanding(value) {
  if (!value || typeof value !== 'object') return false;
  const week = value.week;
  return typeof value.username === 'string'
    && week && typeof week.id === 'string' && typeof week.day === 'number' && typeof week.closesAt === 'string'
    && CLASSES.has(value.cls)
    && (value.rank === null || Number.isInteger(value.rank))
    && Number.isFinite(value.of)
    && Number.isFinite(value.cost);
}

/**
 * The standing, or null on 404, a non-JSON answer, a bad shape, a network
 * error or a timeout. Never throws: this is decoration on a submit that
 * already succeeded.
 */
export async function fetchStanding(site, username, { fetch: fetchImpl, timeoutMs = 5000, version = '' }) {
  if (!username) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${site}/api/v2/standing/${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/json', 'X-Viberank-Client': `cli/${version}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    return isStanding(body) ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Dollars to pass the row above; null at #1, without a rank, or without a row above. */
export function gapAbove(standing) {
  if (standing.rank === null || standing.rank === 1 || !standing.above) return null;
  return Math.max(0, Number(standing.above.cost) - Number(standing.cost));
}

/** The small record the status line reads (see lib/statusline.js). */
export function toRecord(standing, now = new Date()) {
  return {
    version: STANDING_VERSION,
    username: standing.username,
    weekId: standing.week.id,
    weekDay: standing.week.day,
    weekClosesAt: standing.week.closesAt,
    cls: standing.cls,
    heldReason: standing.heldReason ?? null,
    rank: standing.rank,
    of: standing.of,
    movement: standing.movement ?? null,
    cost: standing.cost,
    tokens: Number(standing.tokens) || 0,
    planEq: Number(standing.planEq) || 0,
    gap: gapAbove(standing),
    above: standing.above?.username ?? null,
    streakWeeks: Number(standing.streakWeeks) || 0,
    updatedAt: now.toISOString(),
  };
}

/** "4d 9h left", "3h left", "closing"; "final" once closed. */
export function timeLeft(closesAt, now = new Date()) {
  const ms = Date.parse(closesAt) - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'final';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'closing';
  const days = Math.floor(hours / 24);
  return days ? `${days}d ${hours % 24}h left` : `${hours}h left`;
}

export function recapUrl(site, weekId, username) {
  return `${site}/recap/${encodeURIComponent(weekId)}/${encodeURIComponent(username)}`;
}

/** The profile link with ?me=, which tells the site whose row to pin. */
export function meUrl(profileUrl, username) {
  const sep = profileUrl.includes('?') ? '&' : '?';
  return `${profileUrl}${sep}me=${encodeURIComponent(username)}`;
}

function movementText(movement, p) {
  if (movement === null || movement === undefined) return p.gray('new this week');
  const mark = movementMark(movement);
  if (movement > 0) return `${p.green(mark)} since last week`;
  if (movement < 0) return `${p.red(mark)} since last week`;
  return p.gray('no change since last week');
}

/**
 * The weekly block, plain lines unless `paint` says otherwise:
 *
 *   Week 48 · day 3 of 7 · 4d 9h left
 *   #41 of 126 Ranked   ▲6 since last week
 *   $835 this week · 1.1B tokens · ≈ 0.6 plans
 *   $27 behind @palewave · 4-week streak
 */
export function standingLines(standing, { paint = plain, now = new Date() } = {}) {
  const p = { ...plain, ...paint };
  const week = `Week ${weekNumber(standing.week.id)}`;
  const closed = standing.week.closed || weekIsOver({ weekClosesAt: standing.week.closesAt }, now);
  const lines = [`${p.bold(week)} ${p.gray('·')} ${closed ? 'final' : `day ${standing.week.day} of 7 ${p.gray('·')} ${timeLeft(standing.week.closesAt, now)}`}`];

  const label = CLASS_LABEL[standing.cls];
  if (standing.rank === null) {
    lines.push(`${p.gray('No usage counted this week yet')} ${p.gray('·')} ${standing.of.toLocaleString('en-US')} on ${label}`);
  } else {
    lines.push(`${p.accent(`#${standing.rank}`)} of ${standing.of.toLocaleString('en-US')} ${p.bold(label)}   ${movementText(standing.movement, p)}`);
  }
  if (standing.cls !== 'ranked') {
    lines.push(p.yellow(`Not ranked: ${standing.heldReason || 'held off the Ranked board'}`));
  }

  lines.push(`${p.bold(money(standing.cost))} this week ${p.gray('·')} ${compactTokens(standing.tokens)} tokens ${p.gray('·')} ≈ ${(Number(standing.planEq) || 0).toFixed(1)} plans`);

  const extra = [];
  const gap = gapAbove(standing);
  if (standing.rank === 1) extra.push(p.green('top of the board'));
  else if (gap !== null) extra.push(`${p.bold(money(gap, { up: true }))} behind @${standing.above.username}`);
  if (standing.streakWeeks > 1) extra.push(`${standing.streakWeeks}-week streak`);
  if (extra.length) lines.push(extra.join(` ${p.gray('·')} `));
  return lines;
}

/** The account a submission landed under, from the profile URL the server returned. */
export function usernameFromProfileUrl(profileUrl) {
  const match = typeof profileUrl === 'string' ? profileUrl.match(/\/profile\/([^/?#]+)/) : null;
  try {
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
