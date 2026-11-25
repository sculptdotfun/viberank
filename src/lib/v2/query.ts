// Query parsing for the public /api/v2 routes and the badge. Pure, so the
// validation rules are unit-tested; the routes only wire them to services.

import type { BoardClass, BoardParams, BoardSort, BoardWindow } from "./contract";
import { isFutureWeek, isWeekId } from "./week";
import { MAX_BOARD_LIMIT } from "./service";

const WINDOWS: BoardWindow[] = ["week", "month", "all"];
const CLASSES: BoardClass[] = ["ranked", "open", "fleets"];
const SORTS: BoardSort[] = ["cost", "tokens", "efficiency"];
const TOOL = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_OFFSET = 10_000;

/**
 * Cache lifetimes per kind of answer. A live week moves with every sync, so
 * the CDN keeps it briefly; a frozen week or a past year never changes.
 */
export const CACHE = {
  live: "public, s-maxage=120, stale-while-revalidate=600",
  frozen: "public, s-maxage=86400, stale-while-revalidate=604800",
  missing: "public, s-maxage=60, stale-while-revalidate=300",
  none: "no-store",
} as const;

export type Parsed<T> = T | { error: string };

function pick<T extends string>(value: string | null, allowed: T[], fallback: T, name: string): Parsed<T> {
  if (value === null || value === "") return fallback;
  return (allowed as string[]).includes(value)
    ? (value as T)
    : { error: `Unknown ${name} "${value.slice(0, 40)}". Use one of: ${allowed.join(", ")}.` };
}

function int(value: string | null, fallback: number, min: number, max: number, name: string): Parsed<number> {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return { error: `${name} must be a whole number.` };
  return Math.min(Math.max(Number(value), min), max);
}

/** A week id that names a real week which has started. */
export function parseWeekParam(value: string | null, now: Date): Parsed<string | undefined> {
  if (value === null || value === "") return undefined;
  if (!isWeekId(value)) return { error: `"${value.slice(0, 20)}" is not an ISO week like 2026-W48.` };
  if (isFutureWeek(value, now)) return { error: `Week ${value} has not started yet.` };
  return value;
}

/** ?window=&cls=&sort=&tool=&week=&limit=&offset= → BoardParams. */
export function parseBoardQuery(params: URLSearchParams, now: Date): Parsed<BoardParams> {
  const window = pick(params.get("window"), WINDOWS, "week", "window");
  if (typeof window === "object") return window;
  const cls = pick(params.get("cls"), CLASSES, "ranked", "class");
  if (typeof cls === "object") return cls;
  const sort = pick(params.get("sort"), SORTS, "cost", "sort");
  if (typeof sort === "object") return sort;

  const rawTool = params.get("tool")?.trim().toLowerCase();
  if (rawTool && !TOOL.test(rawTool)) {
    return { error: `Unknown tool "${rawTool.slice(0, 40)}". Use a tool slug like claude, codex or gemini.` };
  }
  const week = parseWeekParam(params.get("week"), now);
  if (week && typeof week === "object") return week;
  if (week && window !== "week") return { error: "week only applies to window=week." };

  const limit = int(params.get("limit"), 50, 1, MAX_BOARD_LIMIT, "limit");
  if (typeof limit === "object") return limit;
  const offset = int(params.get("offset"), 0, 0, MAX_OFFSET, "offset");
  if (typeof offset === "object") return offset;

  return {
    window,
    cls,
    sort,
    limit,
    offset,
    ...(rawTool ? { tool: rawTool } : {}),
    ...(week ? { weekId: week } : {}),
  };
}

/** A handle from a path segment: decoded, trimmed, 1–64 printable characters. */
export function parseUsername(raw: string): Parsed<string> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    return { error: "Malformed username." };
  }
  if (decoded.length === 0 || decoded.length > 64 || /[\s/\\\u0000-\u001f\u007f]/.test(decoded)) {
    return { error: "Malformed username." };
  }
  return decoded;
}

/** A Wrapped year: 2025 up to the current year. */
export function parseYear(raw: string, now: Date): Parsed<number> {
  if (!/^\d{4}$/.test(raw)) return { error: "Year must look like 2026." };
  const year = Number(raw);
  if (year < 2025 || year > now.getUTCFullYear()) return { error: `No Wrapped for ${year}.` };
  return year;
}
