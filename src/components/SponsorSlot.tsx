"use client";

import { track } from "@vercel/analytics";
import { getSponsor } from "@/lib/sponsor";

// Single tasteful sponsor line above the leaderboard. Renders nothing unless
// NEXT_PUBLIC_SPONSOR_NAME and NEXT_PUBLIC_SPONSOR_URL are set.
export default function SponsorSlot() {
  const sponsor = getSponsor();
  if (!sponsor) return null;

  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener sponsored"
      onClick={() => track("sponsor_click", { sponsor: sponsor.name, placement: "leaderboard" })}
      className="flex items-center gap-2 px-4 py-2.5 mb-5 rounded-lg border border-border bg-surface-1 hover:border-accent/40 transition-colors group"
    >
      <span className="micro-label flex-shrink-0">Sponsor</span>
      <span className="text-sm font-medium group-hover:text-accent transition-colors">{sponsor.name}</span>
      {sponsor.tagline && (
        <span className="text-sm text-muted truncate hidden sm:inline">— {sponsor.tagline}</span>
      )}
    </a>
  );
}
