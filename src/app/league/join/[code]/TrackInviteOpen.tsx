"use client";

import { useEffect } from "react";
import { leagueInviteOpened } from "@/lib/analytics";

/**
 * Fires once when an invite link is opened.
 *
 * `signedIn` is the important dimension: it splits "the auth wall lost them"
 * from "they weren't interested", which the database alone can never tell apart
 * because both outcomes look identical — no new member row.
 */
export default function TrackInviteOpen({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    leagueInviteOpened(signedIn);
  }, [signedIn]);
  return null;
}
