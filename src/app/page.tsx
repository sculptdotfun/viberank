import LegacyHomePage from "@/components/legacy/LegacyHomePage";
import V2HomePage from "@/components/v2/landing/V2HomePage";
import { homeVariant } from "@/lib/home-flag";

// Refresh the server-rendered snapshot every 5 min. Either home's client
// fetches live data on mount; this governs how stale the first paint (and
// crawlers) can be.
export const revalidate = 300;

// The release switch: VIBERANK_HOME=v2 serves the weekly league here; unset
// or "legacy" keeps the pre-v2 home. The v2 board is always live at /week.
export default async function Home() {
  return homeVariant() === "v2" ? <V2HomePage /> : <LegacyHomePage />;
}
