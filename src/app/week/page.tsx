import type { Metadata } from "next";
import V2HomePage from "@/components/v2/landing/V2HomePage";
import { homeVariant } from "@/lib/home-flag";

const SITE = "https://www.viberank.app";

export const revalidate = 300;

// Once the home is v2, "/" and /week are the same page; point search at "/".
export function generateMetadata(): Metadata {
  const canonical = homeVariant() === "v2" ? SITE : `${SITE}/week`;
  const title = "This Week's AI Coding Leaderboard · Weekly League | viberank";
  const description =
    "This week's viberank league: GitHub-verified developers ranked by AI coding spend and tokens since Monday 00:00 UTC, across Claude Code, Codex, OpenCode and every tool ccusage reads.";
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: "This week · viberank", description, url: canonical, siteName: "Viberank", type: "website" },
  };
}

// The v2 weekly board, live regardless of VIBERANK_HOME, so it is linkable
// before the home flips.
export default function WeekPage() {
  return <V2HomePage />;
}
