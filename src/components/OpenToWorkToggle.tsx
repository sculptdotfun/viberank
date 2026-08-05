"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { BriefcaseBusiness, Loader2, Mail } from "lucide-react";
import { track } from "@vercel/analytics";
import { buildWorkEmailHref, normalizeWorkEmail } from "@/lib/open-to-work";

interface OpenToWorkToggleProps {
  profileGithubUsername?: string;
  initialOpen: boolean;
  initialEmail?: string;
}

// Shown only to the profile's owner. Toggles the opt-in flag that puts them
// on /hire and adds the badge to their public profile.
export default function OpenToWorkToggle({ profileGithubUsername, initialOpen, initialEmail }: OpenToWorkToggleProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(initialOpen);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner =
    !!session?.user?.username &&
    !!profileGithubUsername &&
    session.user.username.toLowerCase() === profileGithubUsername.toLowerCase();

  // Visitors see a static badge when the profile has opted in; only the
  // owner gets the interactive toggle.
  if (!isOwner) {
    if (!initialOpen) return null;
    const content = (
      <>
        <BriefcaseBusiness className="w-3.5 h-3.5" />
        Open to work
      </>
    );

    return initialEmail ? (
      <a
        href={buildWorkEmailHref(initialEmail)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
      >
        {content}
      </a>
    ) : (
      <a
        href="/hire"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
      >
        {content}
      </a>
    );
  }

  const save = async (nextOpen: boolean) => {
    if (busy) return;
    setError(null);

    let normalizedEmail: string | null = null;
    try {
      normalizedEmail = nextOpen ? normalizeWorkEmail(email) : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enter a valid contact email.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/profile/open-to-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: nextOpen, email: normalizedEmail }),
      });
      if (res.ok) {
        setOpen(nextOpen);
        setEmail(normalizedEmail ?? "");
        track("open_to_work_toggled", { open: nextOpen, has_email: Boolean(normalizedEmail) });
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Update failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex max-w-full flex-col gap-1.5">
      <div className="inline-flex max-w-full flex-wrap items-center gap-1.5">
        <label className="relative">
          <Mail className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="email"
            aria-label="Contact email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="contact email"
            disabled={busy}
            className="h-7 w-48 rounded-md border border-border bg-background pl-7 pr-2 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy}
          title={open ? "Save open-to-work contact email" : "List yourself on viberank.app/hire"}
          className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-mono font-medium transition-colors ${
            open
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
              : "border-border text-muted hover:text-foreground hover:bg-surface-2"
          }`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BriefcaseBusiness className="w-3.5 h-3.5" />}
          {open ? "Save contact" : "Set open to work"}
        </button>
        {open && (
          <button
            type="button"
            onClick={() => save(false)}
            disabled={busy}
            className="h-7 rounded-md border border-border px-2.5 text-xs font-mono text-muted transition-colors hover:text-foreground hover:bg-surface-2"
          >
            Opt out
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
