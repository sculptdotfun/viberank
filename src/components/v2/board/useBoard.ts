"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardClass, BoardResult, BoardSort, BoardWindow } from "@/lib/v2/contract";

export interface BoardQuery {
  window: BoardWindow;
  cls: BoardClass;
  sort: BoardSort;
  tool: string | null;
}

const WINDOWS: BoardWindow[] = ["week", "month", "all"];
const CLASSES: BoardClass[] = ["ranked", "open", "fleets"];
const SORTS: BoardSort[] = ["cost", "tokens", "efficiency"];

export function sameQuery(a: BoardQuery, b: BoardQuery): boolean {
  return a.window === b.window && a.cls === b.cls && a.sort === b.sort && a.tool === b.tool;
}

function boardUrl(q: BoardQuery, limit: number, offset: number): string {
  const p = new URLSearchParams({ window: q.window, cls: q.cls, sort: q.sort, limit: String(limit), offset: String(offset) });
  if (q.tool) p.set("tool", q.tool);
  return `/api/v2/board?${p.toString()}`;
}

/** Board params from the address bar; anything unknown keeps the fallback. */
export function queryFromUrl(fallback: BoardQuery, lockedTool: boolean): BoardQuery {
  const p = new URLSearchParams(window.location.search);
  const pick = <T extends string>(key: string, allowed: T[], dflt: T): T => {
    const v = p.get(key) as T | null;
    return v && allowed.includes(v) ? v : dflt;
  };
  return {
    window: pick("window", WINDOWS, fallback.window),
    cls: pick("cls", CLASSES, fallback.cls),
    sort: pick("sort", SORTS, fallback.sort),
    tool: lockedTool ? fallback.tool : p.get("tool") || fallback.tool,
  };
}

/** Mirrors non-default params into the URL so a sorted board can be shared (#200). */
export function writeQueryToUrl(q: BoardQuery, defaults: BoardQuery, lockedTool: boolean) {
  const url = new URL(window.location.href);
  const set = (key: string, value: string | null, dflt: string | null) => {
    if (value && value !== dflt) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  };
  set("window", q.window, defaults.window);
  set("cls", q.cls, defaults.cls);
  set("sort", q.sort, defaults.sort);
  if (!lockedTool) set("tool", q.tool, defaults.tool);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

type Status = "ready" | "loading" | "error";

/** Where board pages come from. The API by default; the dev preview passes fixtures. */
export type BoardSource = (q: BoardQuery, limit: number, offset: number, signal?: AbortSignal) => Promise<BoardResult>;

export const apiBoardSource: BoardSource = async (q, limit, offset, signal) => {
  const res = await fetch(boardUrl(q, limit, offset), { signal });
  if (!res.ok) throw new Error(`board ${res.status}`);
  return (await res.json()) as BoardResult;
};

/**
 * Board data for a query. The server-rendered first page seeds it; changing
 * a tab refetches from /api/v2/board, and `more` appends the next page.
 */
export function useBoard(
  initial: BoardResult,
  initialQuery: BoardQuery,
  pageSize: number,
  source: BoardSource = apiBoardSource,
  initialFailed = false,
) {
  const [query, setQuery] = useState<BoardQuery>(initialQuery);
  const [result, setResult] = useState<BoardResult>(initial);
  const [status, setStatus] = useState<Status>(initialFailed ? "error" : "ready");
  const loaded = useRef<BoardQuery>(initialQuery);

  const load = useCallback(
    async (q: BoardQuery, offset: number, signal?: AbortSignal) => {
      setStatus("loading");
      try {
        const next = await source(q, pageSize, offset, signal);
        setResult((prev) => (offset > 0 ? { ...next, rows: [...prev.rows, ...next.rows] } : next));
        loaded.current = q;
        setStatus("ready");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("error");
      }
    },
    [pageSize, source],
  );

  useEffect(() => {
    if (sameQuery(query, loaded.current)) return;
    const ctrl = new AbortController();
    void load(query, 0, ctrl.signal);
    return () => ctrl.abort();
  }, [query, load]);

  const more = useCallback(() => void load(query, result.rows.length), [load, query, result.rows.length]);
  const retry = useCallback(() => void load(query, 0), [load, query]);

  return { query, setQuery, result, status, more, retry };
}
