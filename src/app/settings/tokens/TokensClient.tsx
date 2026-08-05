"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Trash2, KeyRound, AlertTriangle } from "lucide-react";

interface TokenSummary {
  id: string;
  label: string;
  hint: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export default function TokensClient({ signedIn }: { signedIn: boolean }) {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const res = await fetch("/api/tokens");
      if (!res.ok) return;
      const body = await res.json();
      setTokens(body.tokens ?? []);
    } catch {
      // A failed list is not worth an error banner — the create button still works.
    }
  }, [signedIn]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "CLI" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not create a token.");
        return;
      }
      // Held in state only — this is the one moment it exists outside the server.
      setFresh(body.token);
      setCopied(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh);
    setCopied(true);
  };

  if (!signedIn) {
    return (
      <div className="border border-dashed border-border rounded-lg p-8 text-center">
        <p className="text-muted text-sm">
          Sign in with GitHub to create an API token.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {fresh && (
        <div className="border border-accent/40 bg-accent-soft rounded-lg p-4">
          <p className="flex items-center gap-1.5 micro-label mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Copy this now — it is hashed on save and cannot be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-background border border-border rounded px-3 py-2 overflow-x-auto whitespace-nowrap">
              {fresh}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 flex items-center gap-1.5 text-sm px-3 py-2 rounded border border-border hover:border-accent hover:text-accent transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="flex items-center gap-2 text-sm px-4 py-2 rounded bg-accent text-background font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        <KeyRound className="w-4 h-4" />
        {busy ? "Working…" : "Create token"}
      </button>

      <div>
        <p className="micro-label mb-3">Your tokens</p>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm truncate">{t.hint}</p>
                  <p className="text-xs text-muted">
                    {t.label} · created {new Date(t.createdAt).toLocaleDateString()} ·{" "}
                    {t.lastUsedAt
                      ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                      : "never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(t.id)}
                  disabled={busy}
                  aria-label={`Revoke token ${t.hint}`}
                  className="shrink-0 text-muted hover:text-accent transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
