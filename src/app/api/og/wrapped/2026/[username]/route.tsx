import { ImageResponse } from "next/og";
import type { YearWrapped } from "@/lib/v2/contract";
import { loadYear } from "@/components/v2/share/load";
import { OG, modelLabel, pct, tokens, topPercent, usd } from "@/components/v2/share/format";
import { monthStarts, yearGrid } from "@/components/v2/share/year";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
import { OgAvatar, OgMark, OgStats, getOgFonts, ogError, ogHeaders } from "@/components/v2/share/og";

export const runtime = "nodejs";

const YEAR = 2026;

interface Ctx {
  params: Promise<{ username: string }>;
}

function Heat({ wrapped }: { wrapped: YearWrapped }) {
  const weeks = yearGrid(wrapped.dailyCost, YEAR);
  const cell = 16;
  const gap = 4;
  const starts = new Map(monthStarts(weeks, YEAR).map((s) => [s.week, s.month]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap, fontFamily: "Geist Mono", fontSize: 17, color: OG.ink3, height: 22 }}>
        {weeks.map((_, w) => (
          <div key={w} style={{ display: "flex", width: cell, overflow: "visible", whiteSpace: "nowrap" }}>
            {starts.has(w) ? MONTHS[starts.get(w) ?? 0] : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap }}>
        {weeks.map((col, w) => (
          <div key={w} style={{ display: "flex", flexDirection: "column", gap }}>
            {col.map((c) => (
              <div
                key={c.date}
                style={{
                  display: "flex",
                  width: cell,
                  height: cell,
                  borderRadius: 2.5,
                  backgroundColor: c.level < 0 ? "transparent" : OG.h[c.level],
                  border: c.level === -2 ? `1px solid ${OG.line}` : "none",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ wrapped }: { wrapped: YearWrapped }) {
  const top = wrapped.topModels[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: OG.bg, padding: "50px 64px 48px", fontFamily: "Geist", color: OG.ink }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <OgAvatar username={wrapped.username} url={wrapped.avatarUrl} size={44} />
          <span style={{ fontSize: 30, fontWeight: 500 }}>{`@${wrapped.username}`}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "Geist Mono", fontSize: 22, color: OG.ink3 }}>
          <OgMark size={26} />
          <span>{`viberank · Wrapped ${YEAR}`}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 30 }}>
        <span style={{ fontSize: 84, fontWeight: 500, letterSpacing: -4, lineHeight: 1 }}>{`${wrapped.activeDays} active days.`}</span>
        <span style={{ fontSize: 84, fontWeight: 500, letterSpacing: -4, lineHeight: 1, color: OG.heat }}>{`Top ${topPercent(wrapped.percentile)}%.`}</span>
      </div>

      <div style={{ display: "flex", marginTop: 34 }}>
        <Heat wrapped={wrapped} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <OgStats
          items={[
            { value: tokens(wrapped.tokens), label: "tokens" },
            { value: usd(wrapped.cost), label: "API-equivalent" },
            { value: `${wrapped.longestStreakDays} days`, label: "longest streak" },
            top ? { value: modelLabel(top.model), label: `top model · ${pct(top.share)}` } : { value: "—", label: "top model" },
          ]}
        />
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const username = decodeURIComponent((await params).username);
    const [wrapped, fonts] = await Promise.all([loadYear(username, YEAR), getOgFonts()]);
    if (!wrapped) return new Response("No Wrapped", { status: 404 });
    return new ImageResponse(<Card wrapped={wrapped} />, { width: 1200, height: 630, fonts, headers: ogHeaders() });
  } catch (e: unknown) {
    return ogError(e);
  }
}
