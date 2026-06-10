"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { BriefcaseBusiness, Loader2 } from "lucide-react";
import { track } from "@vercel/analytics";

interface OpenToWorkToggleProps {
  profileGithubUsername?: string;
  initialOpen: boolean;
}

// Shown only to the profile's owner. Toggles the opt-in flag that puts them
// on /hire and adds the badge to their public profile.
export default function OpenToWorkToggle({ profileGithubUsername, initialOpen }: OpenToWorkToggleProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(false);

  const isOwner =
    !!session?.user?.username &&
    !!profileGithubUsername &&
    session.user.username.toLowerCase() === profileGithubUsername.toLowerCase();

  // Visitors see a static badge when the profile has opted in; only the
  // owner gets the interactive toggle.
  if (!isOwner) {
    if (!initialOpen) return null;
    return (
      <a
        href="/hire"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
      >
        <BriefcaseBusiness className="w-3.5 h-3.5" />
        Open to work
      </a>
    );
  }

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !open;
    try {
      const res = await fetch("/api/profile/open-to-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: next }),
      });
      if (res.ok) {
        setOpen(next);
        track("open_to_work_toggled", { open: next });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={open ? "Shown on viberank.app/hire — click to opt out" : "List yourself on viberank.app/hire"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full border transition-colors ${
        open
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
          : "border-border text-muted hover:text-foreground hover:bg-surface-2"
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BriefcaseBusiness className="w-3.5 h-3.5" />}
      {open ? "Open to work" : "Set open to work"}
    </button>
  );
}
