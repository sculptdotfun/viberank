"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const queryKey = (q: BoardQuery) => `${q.window}|${q.cls}|${q.sort}|${q.tool ?? ""}`;
/** A tab seen within this long is shown as is; older, it is shown and refetched. */
const FRESH_MS = 60_000;
/** Neighbouring tabs load this long after the board settles, off the critical path. */
const PREFETCH_DELAY_MS = 800;

interface Cached {
  result: BoardResult;
  at: number;
}

/**
 * Board data for a query. The server-rendered first page seeds it. Changing
 * a tab shows that tab's last result at once (prefetched after first paint
 * via `neighboursOf`, or seen before) and refreshes it quietly when stale,
 * so a tab switch does not wait on the network once the board has settled.
 * `more` appends the next page. A server render that failed is retried once
 * from the API on mount before the error state is shown.
 */
export function useBoard(
  initial: BoardResult,
  initialQuery: BoardQuery,
  pageSize: number,
  source: BoardSource = apiBoardSource,
  initialFailed = false,
  neighboursOf?: (q: BoardQuery) => BoardQuery[],
) {
  const [query, setQuery] = useState<BoardQuery>(initialQuery);
  const [result, setResult] = useState<BoardResult>(initial);
  const [status, setStatus] = useState<Status>(initialFailed ? "loading" : "ready");
  const loaded = useRef<BoardQuery>(initialQuery);
  const cache = useRef(
    new Map<string, Cached>(initialFailed ? [] : [[queryKey(initialQuery), { result: initial, at: Date.now() }]]),
  );
  const inflight = useRef(new Map<string, Promise<BoardResult>>());
  /** The query on screen, read by loads that finish after a tab change. */
  const latest = useRef<BoardQuery>(initialQuery);
  useEffect(() => {
    latest.current = query;
  }, [query]);

  /** First page of a query, shared between a prefetch and a click on the same tab. */
  const fetchFirst = useCallback(
    (q: BoardQuery): Promise<BoardResult> => {
      const key = queryKey(q);
      const pending = inflight.current.get(key);
      if (pending) return pending;
      const next = source(q, pageSize, 0)
        .then((r) => {
          cache.current.set(key, { result: r, at: Date.now() });
          return r;
        })
        .finally(() => inflight.current.delete(key));
      inflight.current.set(key, next);
      return next;
    },
    [source, pageSize],
  );

  const load = useCallback(
    async (q: BoardQuery, offset: number, background = false) => {
      if (!background) setStatus("loading");
      try {
        if (offset > 0) {
          const next = await source(q, pageSize, offset);
          setResult((prev) => {
            const merged = { ...next, rows: [...prev.rows, ...next.rows] };
            cache.current.set(queryKey(q), { result: merged, at: Date.now() });
            return merged;
          });
          setStatus("ready");
          return;
        }
        const next = await fetchFirst(q);
        // The visitor may have moved to another tab while this one loaded.
        if (!sameQuery(q, latest.current)) return;
        setResult(next);
        loaded.current = q;
        setStatus("ready");
      } catch {
        if (!background && sameQuery(q, latest.current)) setStatus("error");
      }
    },
    [pageSize, source, fetchFirst],
  );

  // The server render failed: one retry from the API before showing the error.
  useEffect(() => {
    if (initialFailed) void load(initialQuery, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sameQuery(query, loaded.current)) return;
    const hit = cache.current.get(queryKey(query));
    if (!hit) {
      void load(query, 0);
      return;
    }
    setResult(hit.result);
    loaded.current = query;
    setStatus("ready");
    // Stale: keep showing it and refresh quietly.
    if (Date.now() - hit.at >= FRESH_MS) void load(query, 0, true);
  }, [query, load]);

  // Warm the neighbouring tabs once the current one has settled, one at a time.
  const neighbours = useMemo(() => neighboursOf?.(query) ?? [], [neighboursOf, query]);
  useEffect(() => {
    if (status !== "ready" || neighbours.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const q of neighbours) {
        if (cancelled) return;
        const hit = cache.current.get(queryKey(q));
        if (hit && Date.now() - hit.at < FRESH_MS) continue;
        // A failed prefetch is not an error: the tab loads on click as before.
        await fetchFirst(q).catch(() => undefined);
      }
    }, PREFETCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, neighbours, fetchFirst]);

  const more = useCallback(() => void load(query, result.rows.length), [load, query, result.rows.length]);
  const retry = useCallback(() => void load(query, 0), [load, query]);

  return { query, setQuery, result, status, more, retry };
}
