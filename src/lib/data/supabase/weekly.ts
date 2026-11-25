// Supabase source for the v2 WeeklyService: the window RPCs and frozen-week
// tables from migration 024. Kept out of client.ts so the browser bundle that
// only needs the old board does not grow, and so client.ts can import it
// without a cycle.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardClass, TrustMark } from "@/lib/v2/contract";
import type {
  FrozenWeek,
  UserHistory,
  WeekEntry,
  WeeklySource,
  WindowEntry,
  WindowQuery,
} from "@/lib/v2/service";

/** Errors that mean "migration 024 is not applied yet". */
const MISSING_CODES = new Set(["PGRST202", "PGRST205", "42P01", "42883"]);

const PAGE = 1000;

type Json = Record<string, unknown>;

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** One row of v2_window_totals, as the service expects it. */
export function parseWindowRow(row: Json): WindowEntry & {
  submissionId?: string;
  submittedAt?: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  dayDetail?: { date: string; cost: number; tokens: number; inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number }[];
} {
  const series = Array.isArray(row.days) ? (row.days as unknown[][]) : undefined;
  const dayDetail = series?.map((day) => ({
    date: String(day[0]),
    cost: num(day[1]),
    tokens: num(day[2]),
    inputTokens: num(day[3]),
    outputTokens: num(day[4]),
    cacheCreationTokens: num(day[5]),
    cacheReadTokens: num(day[6]),
  }));
  return {
    userKey: String(row.userKey),
    username: String(row.username ?? row.userKey),
    ...(str(row.avatarUrl) ? { avatarUrl: str(row.avatarUrl) } : {}),
    verified: row.verified === true,
    source: str(row.source) ?? null,
    reviewReasons: strings(row.reviewReasons),
    tools: strings(row.tools),
    cost: num(row.cost),
    tokens: num(row.tokens),
    inputTokens: num(row.inputTokens),
    outputTokens: num(row.outputTokens),
    cacheCreationTokens: num(row.cacheCreationTokens),
    cacheReadTokens: num(row.cacheReadTokens),
    activeDays: num(row.activeDays),
    firstDate: str(row.firstDate) ?? null,
    lastDate: str(row.lastDate) ?? null,
    ...(dayDetail ? { days: dayDetail.map(({ date, cost, tokens }) => ({ date, cost, tokens })), dayDetail } : {}),
    ...(Array.isArray(row.activeWeeks) ? { activeWeeks: strings(row.activeWeeks) } : {}),
    ...(str(row.submissionId) ? { submissionId: str(row.submissionId) } : {}),
    ...(str(row.submittedAt) ? { submittedAt: str(row.submittedAt) } : {}),
  };
}

export interface WindowTotalsArgs extends WindowQuery {
  sort?: "cost" | "tokens" | "efficiency";
  limit?: number;
  offset?: number;
  verifiedOnly?: boolean;
}

export interface WindowTotalsResult {
  total: number;
  developers: number;
  cost: number;
  tokens: number;
  rows: ReturnType<typeof parseWindowRow>[];
}

/** Calls v2_window_totals. Throws when the RPC fails: an empty board would hide the outage. */
export async function fetchWindowTotals(client: SupabaseClient, args: WindowTotalsArgs): Promise<WindowTotalsResult> {
  const { data, error } = await client.rpc("v2_window_totals", {
    p_from: args.from,
    p_to: args.to,
    p_tool: args.tool ?? null,
    p_sort: args.sort ?? "cost",
    p_with_days: args.withDays ?? false,
    p_history_from: args.historyFrom ?? null,
    p_limit: args.limit ?? null,
    p_offset: args.offset ?? 0,
    p_verified_only: args.verifiedOnly ?? false,
  });
  if (error) throw new Error(`v2_window_totals failed: ${error.message}`);
  const body = (data ?? {}) as Json;
  return {
    total: num(body.total),
    developers: num(body.developers),
    cost: num(body.cost),
    tokens: num(body.tokens),
    rows: (Array.isArray(body.rows) ? (body.rows as Json[]) : []).map(parseWindowRow),
  };
}

function parseHistory(body: Json): UserHistory {
  const days = Array.isArray(body.days) ? (body.days as Json[]) : [];
  return {
    userKey: String(body.userKey),
    username: String(body.username ?? body.userKey),
    ...(str(body.avatarUrl) ? { avatarUrl: str(body.avatarUrl) } : {}),
    verified: body.verified === true,
    source: str(body.source) ?? null,
    reviewReasons: strings(body.reviewReasons),
    days: days.map((day) => ({
      date: String(day.date),
      cost: num(day.cost),
      tokens: num(day.tokens),
      agents: strings(day.agents),
      models: (Array.isArray(day.models) ? (day.models as Json[]) : []).map((model) => ({
        model: String(model.model ?? ""),
        cost: num(model.cost),
      })),
    })),
  };
}

interface WeekResultRow {
  user_key: string;
  username: string;
  avatar_url: string | null;
  cls: BoardClass;
  rank: number | null;
  movement: number | null;
  cost: number | string;
  tokens: number | string;
  days: (number | string)[];
  plan_eq: number;
  trust: TrustMark;
  under_review: boolean;
  held_reason: string | null;
  tools: string[] | null;
  streak_weeks: number;
}

function entryFromRow(row: WeekResultRow): WeekEntry {
  return {
    userKey: row.user_key,
    username: row.username,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    tools: row.tools ?? [],
    cost: num(row.cost),
    tokens: num(row.tokens),
    days: (row.days ?? []).map(num),
    planEq: num(row.plan_eq),
    trust: row.trust,
    cls: row.cls,
    underReview: row.under_review,
    ...(row.held_reason ? { heldReason: row.held_reason } : {}),
    streakWeeks: row.streak_weeks,
    ...(row.rank !== null ? { rank: row.rank } : {}),
    movement: row.movement,
  };
}

export function createSupabaseWeeklySource(client: SupabaseClient, canWrite: boolean): WeeklySource {
  const source: WeeklySource = {
    async windowEntries(query) {
      return (await fetchWindowTotals(client, query)).rows;
    },

    async userHistory(username, from, to) {
      const { data, error } = await client.rpc("v2_user_history", {
        p_username: username,
        p_from: from,
        p_to: to,
      });
      if (error) throw new Error(`v2_user_history failed: ${error.message}`);
      return data ? parseHistory(data as Json) : null;
    },

    async frozenWeek(weekStart): Promise<FrozenWeek | null> {
      const { data: marker, error } = await client
        .from("v2_weeks")
        .select("week_start, frozen_at, developers, tokens, cost")
        .eq("week_start", weekStart)
        .maybeSingle();
      if (error) {
        // Before migration 024 there is nothing frozen; the week is computed live.
        if (MISSING_CODES.has(error.code ?? "")) return null;
        throw new Error(`Failed to read frozen week ${weekStart}: ${error.message}`);
      }
      if (!marker) return null;

      const rows: WeekResultRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error: pageError } = await client
          .from("v2_week_results")
          .select("*")
          .eq("week_start", weekStart)
          .order("user_key", { ascending: true })
          .range(from, from + PAGE - 1);
        if (pageError) throw new Error(`Failed to read week results ${weekStart}: ${pageError.message}`);
        rows.push(...((data ?? []) as WeekResultRow[]));
        if (!data || data.length < PAGE) break;
      }

      return {
        weekStart,
        frozenAt: String(marker.frozen_at),
        totals: {
          developers: num(marker.developers),
          tokens: num(marker.tokens),
          cost: num(marker.cost),
        },
        entries: rows.map(entryFromRow),
      };
    },
  };

  if (canWrite) {
    source.storeWeek = async (week) => {
      const { error } = await client.rpc("v2_store_week", { p_week: week });
      if (error && !MISSING_CODES.has(error.code ?? "")) {
        throw new Error(`v2_store_week failed: ${error.message}`);
      }
    };
  }

  return source;
}
