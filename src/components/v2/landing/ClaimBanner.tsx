"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useCheckClaimableSubmissions, useClaimAndMergeSubmissions } from "@/lib/data/hooks/useSubmissions";

/**
 * Old CLI rows waiting to be claimed by the signed-in GitHub user. Kept from
 * v1. Loaded lazily by the home page: it pulls in the Supabase client, which
 * anonymous visitors never need.
 */
export default function ClaimBanner() {
  const { data: session } = useSession();
  const { data: claimStatus } = useCheckClaimableSubmissions(session?.user?.username || undefined);
  const { mutate: claimAndMerge } = useClaimAndMergeSubmissions();
  const [hidden, setHidden] = useState(false);
  const [merging, setMerging] = useState(false);

  if (hidden || !claimStatus?.actionNeeded || !session?.user?.username) return null;

  const run = async () => {
    setMerging(true);
    try {
      await claimAndMerge();
      setHidden(true);
      window.location.reload();
    } catch (error) {
      console.error("Failed to process:", error);
      alert("Failed to process submissions. Please try again.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="vr-claim">
      <div className="vr-in">
        <span>{claimStatus.actionText}</span>
        <button type="button" className="vr-btn sm" onClick={run} disabled={merging}>
          {merging ? "…" : claimStatus.actionNeeded === "claim" ? "Verify" : "Merge"}
        </button>
        <button type="button" className="vr-linkbtn" onClick={() => setHidden(true)}>Dismiss</button>
      </div>
    </div>
  );
}
