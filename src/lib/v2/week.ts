// ISO-week helpers for v2. Pure: every function takes its clock as an
// argument, so the board, the API and the tests agree on what "this week"
// means. All dates are UTC; a week runs Monday 00:00 to the next Monday 00:00.

import { WEEK_GRACE_HOURS, type WeekRef } from "./contract";

const DAY_MS = 86_400_000;
const WEEK_ID = /^(\d{4})-W(\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD for a UTC instant. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC of a YYYY-MM-DD string; NaN-time Date when malformed. */
export function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) return new Date(NaN);
  const date = new Date(`${value}T00:00:00Z`);
  // Date rolls 2026-02-31 over to March; refuse it instead.
  return isoDate(date) === value ? date : new Date(NaN);
}

export function addDays(date: string, days: number): string {
  return isoDate(new Date(parseIsoDate(date).getTime() + days * DAY_MS));
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
function weekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function mondayOf(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(midnight - weekdayIndex(new Date(midnight)) * DAY_MS);
}

/** Monday of ISO week 1: the week holding 4 January. */
function firstMonday(year: number): Date {
  return mondayOf(new Date(Date.UTC(year, 0, 4)));
}

/** Number of ISO weeks in a year (52 or 53). */
export function weeksInYear(year: number): number {
  const next = firstMonday(year + 1).getTime();
  return Math.round((next - firstMonday(year).getTime()) / (7 * DAY_MS));
}

function formatWeekId(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** ISO week id ("2026-W48") holding a UTC instant or YYYY-MM-DD date. */
export function weekIdOf(at: Date | string): string {
  const date = typeof at === "string" ? parseIsoDate(at) : at;
  const monday = mondayOf(date);
  // The ISO year is the year of the week's Thursday.
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.round((monday.getTime() - firstMonday(year).getTime()) / (7 * DAY_MS)) + 1;
  return formatWeekId(year, week);
}

/** { year, week } for a well-formed id that names a real week; null otherwise. */
export function parseWeekId(id: string): { year: number; week: number } | null {
  const match = WEEK_ID.exec(id);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (year < 2000 || year > 2999 || week < 1 || week > weeksInYear(year)) return null;
  return { year, week };
}

export function isWeekId(id: string): boolean {
  return parseWeekId(id) !== null;
}

/** Monday (YYYY-MM-DD) of a week id. Throws on a malformed id. */
export function weekStart(id: string): string {
  const parsed = parseWeekId(id);
  if (!parsed) throw new Error(`Not an ISO week id: ${id}`);
  return isoDate(new Date(firstMonday(parsed.year).getTime() + (parsed.week - 1) * 7 * DAY_MS));
}

/** Sunday (YYYY-MM-DD) of a week id. */
export function weekEnd(id: string): string {
  return addDays(weekStart(id), 6);
}

/** The seven dates of a week, Monday first. */
export function weekDates(id: string): string[] {
  const start = weekStart(id);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** When the week closes: the next Monday 00:00 UTC, as an ISO timestamp. */
export function closesAt(id: string): string {
  return `${addDays(weekStart(id), 7)}T00:00:00.000Z`;
}

/** When a closed week stops accepting late days (WEEK_GRACE_HOURS after close). */
export function freezesAt(id: string): string {
  return new Date(Date.parse(closesAt(id)) + WEEK_GRACE_HOURS * 3_600_000).toISOString();
}

export function isClosed(id: string, now: Date): boolean {
  return now.getTime() >= Date.parse(closesAt(id));
}

/** True once the grace period is over and the week's result is final. */
export function isFrozen(id: string, now: Date): boolean {
  return now.getTime() >= Date.parse(freezesAt(id));
}

/** A week that has not started yet. */
export function isFutureWeek(id: string, now: Date): boolean {
  return Date.parse(`${weekStart(id)}T00:00:00Z`) > now.getTime();
}

export function shiftWeek(id: string, weeks: number): string {
  return weekIdOf(addDays(weekStart(id), weeks * 7));
}

export function previousWeekId(id: string): string {
  return shiftWeek(id, -1);
}

/**
 * 1 = Monday … 7 = Sunday for a date inside the week; 0 when the date is
 * outside it.
 */
export function dayOfWeek(id: string, date: string): number {
  const offset = daysBetween(weekStart(id), date);
  return offset >= 0 && offset < 7 ? offset + 1 : 0;
}

/** The WeekRef for a week id (default: the week holding `now`). */
export function weekRef(id: string | undefined, now: Date): WeekRef {
  const weekId = id ?? weekIdOf(now);
  const closed = isClosed(weekId, now);
  const today = dayOfWeek(weekId, isoDate(now));
  return {
    id: weekId,
    start: weekStart(weekId),
    end: weekEnd(weekId),
    // A week that has not started yet reports day 1; callers reject those ids.
    day: closed ? 7 : Math.max(1, today),
    closesAt: closesAt(weekId),
    closed,
  };
}

export function currentWeek(now: Date): WeekRef {
  return weekRef(undefined, now);
}

/** Calendar month to date (UTC) holding `now`; `days` counts elapsed days. */
export function monthWindow(now: Date): { from: string; to: string; days: number } {
  const from = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const to = isoDate(now);
  return { from, to, days: daysBetween(from, to) + 1 };
}

/** The last `days` days ending today (UTC), inclusive: the badge's 7d / 30d. */
export function rollingWindow(days: number, now: Date): { from: string; to: string } {
  const to = isoDate(now);
  return { from: addDays(to, -(days - 1)), to };
}
