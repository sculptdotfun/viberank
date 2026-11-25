// Builds the landing's "what the board ran last month" strip from the
// existing stats service. Server only.
import { getServerDataLayer } from "@/lib/data";
import { vendorOfModel, vendorOfTool } from "@/lib/chartColors";
import { prettyModelName, toolLabel } from "@/lib/utils";
import type { MonthStrip } from "./Sections";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function vendorColor(vendor: string | null): string {
  if (vendor === "anthropic") return "var(--v-anthropic)";
  if (vendor === "openai") return "var(--v-openai)";
  if (vendor === "google") return "var(--v-google)";
  return "var(--v-open)";
}

function lastMonth(now: Date = new Date()): { key: string; label: string } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { key, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
}

function modelShares(rows: { model: string; cost: number }[]) {
  // Merge dated variants ("claude-opus-4-20250514" and "claude-opus-4") before ranking.
  const merged = new Map<string, number>();
  for (const r of rows) merged.set(prettyModelName(r.model), (merged.get(prettyModelName(r.model)) ?? 0) + r.cost);
  const total = [...merged.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, cost]) => ({ name, share: (cost / total) * 100, color: vendorColor(vendorOfModel(name)) }));
}

function toolShares(rows: { tool: string; users: number }[], developers: number) {
  if (developers <= 0) return [];
  return [...rows]
    .sort((a, b) => b.users - a.users)
    .slice(0, 5)
    .map((r) => ({ name: r.tool === "claude" ? "Claude Code" : toolLabel(r.tool), share: (r.users / developers) * 100, color: vendorColor(vendorOfTool(r.tool)) }));
}

export async function loadMonthStrip(): Promise<MonthStrip | null> {
  try {
    const dataLayer = await getServerDataLayer();
    const month = lastMonth();
    const stats = await dataLayer.stats.getMonthStats(month.key);
    if (stats && stats.users > 0) {
      return { label: month.label, developers: stats.users, models: modelShares(stats.perModel), tools: toolShares(stats.perTool, stats.users) };
    }
    const site = await dataLayer.stats.getSiteStats();
    if (!site || site.totalUsers <= 0) return null;
    return { label: "All time", developers: site.totalUsers, models: modelShares(site.modelSpend), tools: toolShares(site.tools, site.totalUsers) };
  } catch (err) {
    console.error("[v2] month strip failed", err);
    return null;
  }
}
