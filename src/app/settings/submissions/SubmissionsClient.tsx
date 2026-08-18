"use client";

import { useState } from "react";
import { BadgeCheck, Trash2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Row {
  id: string;
  totalCost: number;
  totalTokens: number;
  dateRange: { start: string; end: string };
  verified: boolean;
}

export default function SubmissionsClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/submissions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      setRows((r) => r.filter((row) => row.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  if (rows.length === 0) {
    return <p className="text-sm text-muted">No submissions on your profile.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-border bg-surface-1 p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium flex items-center gap-1.5 mb-0.5">
              {row.dateRange.start} → {row.dateRange.end}
              {row.verified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
            </p>
            <p className="text-xs text-muted m-0 font-mono">
              ${formatCurrency(row.totalCost)} · {formatNumber(row.totalTokens)} tokens
            </p>
          </div>
          {confirming === row.id ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => remove(row.id)}
                disabled={busy === row.id}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy === row.id ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(row.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
