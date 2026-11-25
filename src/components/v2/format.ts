// Display helpers shared by the v2 boards and landing. Pure functions only,
// so server and client components render the same text.
import { vendorOfTool } from "@/lib/chartColors";
import { toolLabel } from "@/lib/utils";
import type { BoardSort, BoardWindow, WeekRef } from "@/lib/v2/contract";

/** "2026-W48" -> 48. */
export function weekNumber(week: Pick<WeekRef, "id">): number {
  const n = Number(week.id.split("-W")[1]);
  return Number.isFinite(n) ? n : 0;
}

/** Whole dollars with separators: $1,146. Under $10 keeps cents. */
export function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const cents = Math.abs(v) > 0 && Math.abs(v) < 10;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
}

/** Compact money for tight cells and facts: $1.2K, $3.4M. */
export function moneyCompact(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `$${(v / 1e3).toFixed(1)}K`;
  return money(v);
}

/** Tokens: 940M, 1.1B, 45.9T. */
export function tokens(n: number): string {
  const v = Number.isFinite(n) && n > 0 ? n : 0;
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${Math.round(v / 1e6)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
}

/** Plan-equivalents: 0.9, 1.5, 32. */
export function plans(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1);
}

/** Tokens per API-equivalent dollar, the efficiency sort's figure. */
export function tokensPerDollar(tok: number, cost: number): string {
  if (!cost) return "–";
  const v = tok / cost;
  // Efficiency rows sit close together, so keep two significant decimals.
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M/$`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K/$`;
  return `${Math.round(v)}/$`;
}

/** Time left until an ISO timestamp, as "4d 9h" (or "9h 12m" on the last day). */
export function countdown(closesAt: string, now: number = Date.now()): string {
  const ms = Math.max(0, new Date(closesAt).getTime() - now);
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 23–29" or "Nov 30–Dec 6" from the week's UTC dates. */
export function weekRange(week: Pick<WeekRef, "start" | "end">): string {
  const [, sm, sd] = week.start.split("-").map(Number);
  const [, em, ed] = week.end.split("-").map(Number);
  const a = `${MONTHS[sm - 1]} ${sd}`;
  return sm === em ? `${a}–${ed}` : `${a}–${MONTHS[em - 1]} ${ed}`;
}

/** Two-letter chip for a tool, the way the mock writes CC / CX / OC. */
const TOOL_ABBR: Record<string, string> = {
  claude: "CC",
  codex: "CX",
  opencode: "OC",
  gemini: "GM",
  antigravity: "AG",
  copilot: "CP",
  openclaw: "OW",
  amp: "AM",
  droid: "DR",
  goose: "GS",
  qwen: "QW",
  kimi: "KM",
  hermes: "HM",
  pi: "PI",
  codebuff: "CB",
  kilo: "KL",
  deepseek: "DS",
  grok: "GK",
  zcode: "ZC",
};

export function toolAbbr(tool: string): string {
  return TOOL_ABBR[tool.toLowerCase()] ?? tool.slice(0, 2).toUpperCase();
}

/** Vendor colour token for a tool; harnesses that run any model are neutral. */
export function toolColor(tool: string): string {
  const vendor = vendorOfTool(tool);
  if (vendor === "anthropic") return "var(--v-anthropic)";
  if (vendor === "openai") return "var(--v-openai)";
  if (vendor === "google") return "var(--v-google)";
  return "var(--v-open)";
}

export function toolName(tool: string): string {
  return tool === "claude" ? "Claude Code" : toolLabel(tool);
}

const AVATAR_TINTS = ["var(--h4)", "var(--v-openai)", "var(--v-google)", "var(--v-anthropic)", "var(--up)", "var(--warn)", "var(--ink-2)"];

/** A stable tint for the initial-letter avatar when there is no GitHub image. */
export function avatarTint(handle: string): string {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) hash = (hash * 31 + handle.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

/** Column header for the value cell, which follows the sort. */
export function valueHeader(sort: BoardSort, window: BoardWindow): string {
  if (sort === "tokens") return "Tokens";
  if (sort === "efficiency") return "Tokens / $";
  return window === "week" ? "This week" : window === "month" ? "This month" : "All-time";
}

export const WINDOW_LABEL: Record<BoardWindow, string> = { week: "This week", month: "Month", all: "All-time" };
