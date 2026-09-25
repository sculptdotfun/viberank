"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TOOL_PLANS } from "@/lib/plans";
import { findPlan } from "@/lib/money";

interface Subscription {
  id: string;
  tool: string;
  planId: string;
  startedOn: string;
  endedOn: string | null;
}

const inputClass =
  "w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent/60";

export default function SubscriptionsClient({ initial }: { initial: Subscription[] }) {
  const [rows, setRows] = useState(initial);
  const [tool, setTool] = useState(TOOL_PLANS[0].id);
  const [planId, setPlanId] = useState(TOOL_PLANS[0].plans[0].id);
  const [startedOn, setStartedOn] = useState("");
  const [endedOn, setEndedOn] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toolPlans = TOOL_PLANS.find((t) => t.id === tool) ?? TOOL_PLANS[0];
  const today = new Date().toISOString().slice(0, 10);

  const changeTool = (next: string) => {
    setTool(next);
    // A plan id means nothing under another tool (both Claude and Codex have
    // a "pro"), so reset rather than carry it across.
    setPlanId((TOOL_PLANS.find((t) => t.id === next) ?? TOOL_PLANS[0]).plans[0].id);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("add");
    setError(null);
    try {
      const res = await fetch("/api/profile/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, planId, startedOn, endedOn: endedOn || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the plan.");
      setRows((r) => [...r, data.subscription].sort((a, b) => a.startedOn.localeCompare(b.startedOn)));
      setStartedOn("");
      setEndedOn("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the plan.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/profile/subscriptions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed.");
      setRows((r) => r.filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          No plans declared. Your profile shows an estimate from list prices until you add one.
        </p>
      ) : (
        rows.map((row) => {
          const plan = findPlan(row.tool, row.planId);
          const toolName = TOOL_PLANS.find((t) => t.id === row.tool)?.label ?? row.tool;
          return (
            <div key={row.id} className="rounded-lg border border-border bg-surface-1 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-0.5">
                  {plan?.name ?? `${toolName} · ${row.planId}`}
                  {!plan && <span className="text-xs text-muted font-normal"> (no longer listed, counted as $0)</span>}
                </p>
                <p className="text-xs text-muted m-0 font-mono">
                  {plan ? `$${plan.monthly}/month · ` : ""}
                  {row.startedOn} → {row.endedOn ?? "now"}
                </p>
              </div>
              <button
                onClick={() => remove(row.id)}
                disabled={busy === row.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {busy === row.id ? "Removing…" : "Remove"}
              </button>
            </div>
          );
        })
      )}

      <form onSubmit={add} className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="micro-label block mb-1">Tool</span>
            <select value={tool} onChange={(e) => changeTool(e.target.value)} className={inputClass}>
              {TOOL_PLANS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="micro-label block mb-1">Plan</span>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
              {toolPlans.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${p.monthly}/month)
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="micro-label block mb-1">From</span>
            <input
              type="date"
              required
              max={today}
              value={startedOn}
              onChange={(e) => setStartedOn(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="micro-label block mb-1">To (empty if you still pay)</span>
            <input
              type="date"
              min={startedOn || undefined}
              max={today}
              value={endedOn}
              onChange={(e) => setEndedOn(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy === "add" || !startedOn}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-foreground hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          {busy === "add" ? "Adding…" : "Add plan"}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
