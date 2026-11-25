"use client";

import { track } from "@vercel/analytics";
import { getSponsor } from "@/lib/sponsor";

// One quiet sponsor line under the board. Renders nothing unless
// NEXT_PUBLIC_SPONSOR_NAME and NEXT_PUBLIC_SPONSOR_URL are set.
export default function SponsorSlot({ placement = "board" }: { placement?: string }) {
  const sponsor = getSponsor();
  if (!sponsor) return null;

  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener sponsored"
      onClick={() => track("sponsor_click", { sponsor: sponsor.name, placement })}
      className="vr-sponsor"
    >
      <span className="k">Sponsor</span>
      <b>{sponsor.name}</b>
      {sponsor.tagline && <span className="t">{sponsor.tagline}</span>}
    </a>
  );
}
