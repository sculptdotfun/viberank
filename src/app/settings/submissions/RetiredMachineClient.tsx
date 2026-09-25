"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface Preview {
  days: number;
  unattributedCost: number;
  currentTotalCost: number;
  newTotalCost: number;
  unattributedSpan: { first: string; last: string } | null;
  retiredDays: number;
}

export default function RetiredMachineClient() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [span, setSpan] = useState<Preview["unattributedSpan"]>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Days already counted as a retired machine. Read from the server rather
  // than remembered from this visit, so an undo survives a reload.
  const [retiredDays, setRetiredDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/retired-machine").then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load history.");
      return data as Preview;
    }).then((data) => {
      setRetiredDays(data.retiredDays);
      setSpan(data.unattributedSpan);
      setFrom(data.unattributedSpan?.first || "");
      setTo(data.unattributedSpan?.last || "");
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load history."))
      .finally(() => setLoading(false));
  }, []);

  const request = async (method: "GET" | "POST" | "DELETE") => {
    setBusy(true);
    setError(null);
    try {
      const url = method === "GET"
        ? `/api/profile/retired-machine?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        : "/api/profile/retired-machine";
      const res = await fetch(url, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify({ from, to }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update history.");
      if (method === "GET") {
        setPreview(data);
      } else {
        // Re-read the full span: an apply or undo changes what is left.
        const remaining: Preview = await fetch("/api/profile/retired-machine").then((response) => response.json());
        setPreview(null);
        setRetiredDays(remaining.retiredDays);
        setSpan(remaining.unattributedSpan);
        setFrom(remaining.unattributedSpan?.first || "");
        setTo(remaining.unattributedSpan?.last || "");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update history.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-lg border border-border bg-surface-1 p-5">
      <h2 className="font-mono text-lg font-bold mb-3">Usage from a retired machine</h2>
      <p className="text-sm text-muted mb-3">
        History submitted without a machine id is only counted where it goes beyond what your other
        machines report, because it usually duplicates one of them. If it came from a machine that no
        longer submits (replaced or wiped), count it as its own machine.
      </p>
      <p className="text-sm text-amber-500 mb-4">
        Do this only for a machine that no longer submits. If a machine that still submits also sent
        that usage, it will be counted twice.
      </p>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-xs text-muted">From
          <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPreview(null); }}
            disabled={!span || busy} className="block mt-1 rounded-md border border-border bg-background p-2 text-foreground" />
        </label>
        <label className="text-xs text-muted">To
          <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPreview(null); }}
            disabled={!span || busy} className="block mt-1 rounded-md border border-border bg-background p-2 text-foreground" />
        </label>
        <button onClick={() => request("GET")} disabled={!span || !from || !to || busy}
          className="px-3 py-2 rounded-md border border-border text-xs hover:text-accent disabled:opacity-50">Preview</button>
      </div>
      {!loading && !span && !error && <p className="text-sm text-muted">No unattributed history left on your profile.</p>}
      {preview && <p className="text-sm mb-3">
        Adds ${formatCurrency(preview.newTotalCost - preview.currentTotalCost)} across {preview.days} days.
        Your total goes from ${formatCurrency(preview.currentTotalCost)} to ${formatCurrency(preview.newTotalCost)}.
      </p>}
      {preview && preview.days > 0 && <button onClick={() => request("POST")} disabled={busy}
        className="px-3 py-2 rounded-md bg-accent text-background text-xs font-medium disabled:opacity-50">Confirm</button>}
      {retiredDays > 0 && <div className="flex items-center gap-3 text-sm mt-4">
        <span>{retiredDays} {retiredDays === 1 ? "day is" : "days are"} counted as a retired machine.</span>
        <button onClick={() => request("DELETE")} disabled={busy}
          className="px-3 py-2 rounded-md border border-border text-xs disabled:opacity-50">Undo</button>
      </div>}
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </section>
  );
}
