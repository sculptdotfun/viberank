// Formatting shared by the week card, Wrapped 2026, the profile's this-week
// block and their OG images, so a number reads the same in every place it is
// shared.
import type { BoardClass } from "@/lib/v2/contract";
import { vendorOfModel } from "@/lib/chartColors";
import { prettyModelName, toolLabel } from "@/lib/utils";

export type V2Vendor = "anthropic" | "openai" | "google" | "open";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
export const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/** Hex values of the v2 tokens in globals.css, for next/og (Satori has no CSS variables). */
export const OG = {
  bg: "#0b0a09",
  panel: "#121110",
  raised: "#191816",
  line: "rgba(255, 244, 230, 0.09)",
  line2: "rgba(255, 244, 230, 0.17)",
  ink: "#f3f0eb",
  ink2: "#b5aea4",
  ink3: "#7f786e",
  heat: "#ff6b1a",
  heatSoft: "rgba(255, 107, 26, 0.13)",
  up: "#3fcf8e",
  down: "#f0575c",
  h: ["#1c1a17", "#4a2410", "#8a3a10", "#d15412", "#ff8a3d"],
  vendor: { anthropic: "#d97757", openai: "#e8e6e1", google: "#6ea8fe", open: "#9a948a" } as Record<V2Vendor, string>,
} as const;

export function vendorOf(model: string): V2Vendor {
  const v = vendorOfModel(model);
  return v === "anthropic" || v === "openai" || v === "google" ? v : "open";
}

/** CSS colour for a model in the browser: the v2 vendor token. */
export function vendorVar(model: string): string {
  return `var(--v-${vendorOf(model)})`;
}

/** "claude-opus-4-5-20251101" → "Opus 4.5", "gpt-5.1-codex" → "GPT-5.1 Codex". */
export function modelLabel(raw: string): string {
  const m = prettyModelName(raw).toLowerCase();
  const claude = m.match(/^claude-(opus|sonnet|haiku|fable)-(\d+)(?:[-.](\d+))?/);
  if (claude) return `${cap(claude[1])} ${claude[2]}${claude[3] ? `.${claude[3]}` : ""}`;
  const gpt = m.match(/^gpt-([\d.]+)(.*)$/);
  if (gpt) return `GPT-${gpt[1]}${words(gpt[2])}`;
  const gem = m.match(/^gemini-([\d.]+)(.*)$/);
  if (gem) return `Gemini ${gem[1]}${words(gem[2])}`;
  return prettyModelName(raw);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function words(rest: string): string {
  const parts = rest.split("-").filter(Boolean);
  return parts.length ? ` ${parts.map(cap).join(" ")}` : "";
}

export { toolLabel };

/** $1,146 under $10k, $12.4K above, $1.2M above that. */
export function usd(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function tokens(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0;
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${Math.round(v / 1e6)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return String(Math.round(v));
}

/** "≈ 0.9" plans; whole numbers past 10. */
export function planEq(n: number): string {
  return `≈ ${n >= 10 ? Math.round(n) : n.toFixed(1)}`;
}

export const CLASS_LABEL: Record<BoardClass, string> = { ranked: "Ranked", open: "Open", fleets: "Fleets" };

/** Contract percentile is "share below you"; people read "top X%". */
export function topPercent(percentile: number): number {
  return Math.min(100, Math.max(1, Math.round(100 - percentile)));
}

export type Movement = { text: string; tone: "up" | "down" | "flat" | "new" };

/** Positive movement = places climbed since last week's final rank. */
export function movement(m: number | null): Movement {
  if (m === null) return { text: "new this week", tone: "new" };
  if (m > 0) return { text: `▲${m} since last week`, tone: "up" };
  if (m < 0) return { text: `▼${-m} since last week`, tone: "down" };
  return { text: "held since last week", tone: "flat" };
}

/** "2026-W48" → 48. */
export function weekNumber(weekId: string): number {
  return Number(weekId.split("-W")[1] ?? 0);
}

/** Monday and Sunday of an ISO week, YYYY-MM-DD (UTC). */
export function weekRange(weekId: string): { start: string; end: string } | null {
  const m = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  // ISO week 1 contains January 4th.
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7;
  const monday = jan4 - jan4Dow * 86_400_000 + (week - 1) * 7 * 86_400_000;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { start: iso(monday), end: iso(monday + 6 * 86_400_000) };
}

export function isWeekId(weekId: string): boolean {
  return weekRange(weekId) !== null;
}

/** "Nov 23–29" or "Nov 30 – Dec 6". */
export function dayRange(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return sm === em ? `${MONTHS[sm - 1]} ${sd}–${ed}` : `${MONTHS[sm - 1]} ${sd} – ${MONTHS[em - 1]} ${ed}`;
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "4d 12h" until an ISO timestamp. */
export function closesIn(iso: string, now: number = Date.now()): string {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/** Bar heights (0–100) for a Mon–Sun series; zero days get a stub. */
export function barHeights(days: number[]): number[] {
  const max = Math.max(...days, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const v = days[i] ?? 0;
    return v > 0 && max > 0 ? Math.max(8, Math.round((v / max) * 100)) : 4;
  });
}

/** Top models folded to at most `n` named slices plus "other". */
export function modelSlices(
  models: { model: string; share: number }[],
  n = 2
): { label: string; share: number; vendor: V2Vendor }[] {
  const named = models.slice(0, n).map((m) => ({ label: modelLabel(m.model), share: m.share, vendor: vendorOf(m.model) }));
  const rest = models.slice(n).reduce((s, m) => s + m.share, 0);
  return rest > 0.005 ? [...named, { label: "other", share: rest, vendor: "open" as const }] : named;
}

/** Shares come as 0–1; print whole percents. */
export function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export const SITE = "https://www.viberank.app";

export function recapPath(weekId: string, username: string): string {
  return `/recap/${weekId}/${encodeURIComponent(username)}`;
}

export function wrappedPath(username: string): string {
  return `/wrapped/2026/${encodeURIComponent(username)}`;
}

/** Post text for a week recap: first person for the owner, third for anyone else. */
export function recapPostText(
  r: { username: string; week: { id: string }; rank: number | null; of: number; cls: BoardClass; movement: number | null; cost: number; tokens: number; activeDays: number; percentile: number },
  owner: boolean
): string {
  const wk = `week ${weekNumber(r.week.id)}`;
  const head = owner ? `My ${wk} on viberank` : `${r.username}'s ${wk} on viberank`;
  const place = r.rank === null ? "no usage yet" : `#${r.rank} of ${r.of} on ${CLASS_LABEL[r.cls]}`;
  const move = r.movement !== null && r.movement !== 0 ? `, ${movement(r.movement).text}` : "";
  return `${head}: ${place}${move}.\n\n${usd(r.cost)} API-equivalent · ${tokens(r.tokens)} tokens · ${r.activeDays} of 7 days · top ${topPercent(r.percentile)}%\n\nWhere do you rank?`;
}

/** Post text for Wrapped 2026. */
export function wrappedPostText(
  y: { username: string; year: number; activeDays: number; cost: number; tokens: number; longestStreakDays: number; percentile: number },
  owner: boolean
): string {
  const head = owner ? `My ${y.year} in AI coding` : `${y.username}'s ${y.year} in AI coding`;
  return `${head}: ${y.activeDays} active days, ${tokens(y.tokens)} tokens, ${usd(y.cost)} API-equivalent, a ${y.longestStreakDays}-day streak. Top ${topPercent(y.percentile)}% on viberank.\n\nWrapped ${y.year}:`;
}
