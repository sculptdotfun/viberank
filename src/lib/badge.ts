/**
 * Shields-style SVG badges for READMEs.
 *
 * Hand-built SVG rather than an ImageResponse: a badge is two rectangles and
 * two strings, it needs to be a few hundred bytes and cacheable at the edge,
 * and rasterising it would make it heavier and blurrier than the surrounding
 * shields.io badges it will sit next to.
 */

import { formatTokensCompact } from "./utils";

export type BadgeMetric = "rank" | "cost" | "tokens";

export const BADGE_METRICS: BadgeMetric[] = ["rank", "cost", "tokens"];

export function isBadgeMetric(value: string | null): value is BadgeMetric {
  return value !== null && (BADGE_METRICS as string[]).includes(value);
}

/**
 * Approximate text width for the DejaVu/Verdana-ish stack shields uses.
 *
 * SVG cannot measure text, so the geometry has to be computed up front. Real
 * per-character widths would be exact but need a font table; this stays within
 * a couple of pixels across the digits and short words badges actually
 * contain, which is the difference between snug and slightly roomy padding —
 * not between readable and clipped.
 */
function textWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (/[iIl.,:;'|!]/.test(char)) width += 3.2;
    else if (/[A-Z@#%&W]/.test(char)) width += 8.4;
    else if (/[fjrt ]/.test(char)) width += 4.6;
    else width += 7;
  }
  return Math.ceil(width);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface BadgeInput {
  label: string;
  value: string;
  /** Accent for the value half. */
  color?: string;
}

export function renderBadge({ label, value, color = "#f97316" }: BadgeInput): string {
  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(value);

  const padding = 11;
  const labelWidth = textWidth(label) + padding * 2;
  const valueWidth = textWidth(value) + padding * 2;
  const total = labelWidth + valueWidth;

  // textLength pins each string to the width the geometry was computed from,
  // so a viewer whose font metrics differ slightly still gets text centred in
  // its half rather than drifting over the divider.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${safeLabel}: ${safeValue}">
  <title>${safeLabel}: ${safeValue}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#1a1a1f"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14" fill="#010101" fill-opacity=".3" textLength="${labelWidth - padding * 2}">${safeLabel}</text>
    <text x="${labelWidth / 2}" y="13" textLength="${labelWidth - padding * 2}">${safeLabel}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14" fill="#010101" fill-opacity=".3" textLength="${valueWidth - padding * 2}">${safeValue}</text>
    <text x="${labelWidth + valueWidth / 2}" y="13" textLength="${valueWidth - padding * 2}">${safeValue}</text>
  </g>
</svg>`;
}

/** Compact money for a badge: $1.2K, $205K, $1.4M. */
export function badgeCost(cost: number): string {
  const value = Number.isFinite(cost) && cost > 0 ? cost : 0;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

/** Compact tokens: 940M, 26.1B, 1.2T. The same formatter the share cards use. */
export const badgeTokens = formatTokensCompact;

export function badgeLabelFor(metric: BadgeMetric, range?: BadgeRange): string {
  const base = metric === "rank" ? "viberank" : metric === "cost" ? "ai spend" : "tokens";
  if (!range) return base;
  return `${base} ${range === "week" ? "this week" : range}`;
}

// ----------------------------------------------------------------------------
// Rolling-window badges (#198): ?range=7d|30d|week&sort=tokens|cost
// ----------------------------------------------------------------------------

/** 7d / 30d: the last 7 or 30 days, today included. week: Monday (UTC) to today. */
export type BadgeRange = "7d" | "30d" | "week";
export type BadgeSort = "cost" | "tokens";

export const BADGE_RANGES: BadgeRange[] = ["7d", "30d", "week"];

export function isBadgeRange(value: string | null): value is BadgeRange {
  return value !== null && (BADGE_RANGES as string[]).includes(value);
}

/** Unknown or missing sorts fall back to cost, the board's default. */
export function badgeSortFrom(value: string | null): BadgeSort {
  return value === "tokens" ? "tokens" : "cost";
}

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Inclusive YYYY-MM-DD bounds of a range, in UTC like the board's dates. */
export function badgeRangeWindow(range: BadgeRange, now: Date): { from: string; to: string } {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (range === "week") {
    const sinceMonday = (new Date(today).getUTCDay() + 6) % 7;
    return { from: isoDay(today - sinceMonday * DAY_MS), to: isoDay(today) };
  }
  const days = range === "7d" ? 7 : 30;
  return { from: isoDay(today - (days - 1) * DAY_MS), to: isoDay(today) };
}

export interface WindowRankRow {
  userKey: string;
  username: string;
  cost: number;
  tokens: number;
}

/**
 * A developer's position on a window board: every developer with usage in
 * the window, ordered by `sort` (ties by the other metric, then handle).
 * Matches the handle on either the merged username or the GitHub login.
 */
export function rankInWindow(
  rows: WindowRankRow[],
  handle: string,
  sort: BadgeSort
): { rank: number; of: number; cost: number; tokens: number } | null {
  const wanted = handle.toLowerCase();
  const primary = (row: WindowRankRow) => (sort === "tokens" ? row.tokens : row.cost);
  const secondary = (row: WindowRankRow) => (sort === "tokens" ? row.cost : row.tokens);
  const ordered = rows
    .filter((row) => row.cost > 0 || row.tokens > 0)
    .sort((a, b) => primary(b) - primary(a) || secondary(b) - secondary(a) || a.userKey.localeCompare(b.userKey));
  const index = ordered.findIndex((row) => row.userKey === wanted || row.username.toLowerCase() === wanted);
  if (index < 0) return null;
  const row = ordered[index];
  return { rank: index + 1, of: ordered.length, cost: row.cost, tokens: row.tokens };
}
