import { ImageResponse } from "next/og";
import type { WeekRecap } from "@/lib/v2/contract";
import { loadRecap } from "@/components/v2/share/load";
import {
  CLASS_LABEL,
  DAY_INITIALS,
  OG,
  barHeights,
  dayRange,
  isWeekId,
  modelSlices,
  movement,
  pct,
  planEq,
  tokens,
  topPercent,
  usd,
  weekNumber,
} from "@/components/v2/share/format";
import { OgArrow, OgAvatar, OgMark, OgStats, getOgFonts, ogError, ogHeaders } from "@/components/v2/share/og";

// Node runtime: the weekly service reads through the server data layer.
export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ weekId: string; username: string }>;
}

const MOVE_COLOR = { up: OG.up, down: OG.down, flat: OG.ink2, new: OG.ink2 } as const;

function Bars({ days }: { days: number[] }) {
  const h = barHeights(days);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 196 }}>
        {h.map((v, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              width: 42,
              height: `${v}%`,
              borderRadius: 3,
              backgroundColor: (days[i] ?? 0) > 0 ? OG.h[3] : OG.h[0],
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {DAY_INITIALS.map((d, i) => (
          <span key={i} style={{ display: "flex", justifyContent: "center", width: 42, fontFamily: "Geist Mono", fontSize: 18, color: OG.ink3 }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

function Mix({ recap }: { recap: WeekRecap }) {
  const slices = modelSlices(recap.topModels, 2);
  if (slices.length === 0) return <div style={{ display: "flex", height: 1 }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", height: 12, gap: 3, borderRadius: 3, overflow: "hidden" }}>
        {slices.map((s) => (
          <div key={s.label} style={{ display: "flex", flexGrow: Math.max(1, Math.round(s.share * 100)), backgroundColor: OG.vendor[s.vendor] }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 30, fontFamily: "Geist Mono", fontSize: 20, color: OG.ink3 }}>
        {slices.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", width: 11, height: 11, borderRadius: 2, backgroundColor: OG.vendor[s.vendor] }} />
            <span>{`${s.label} ${pct(s.share)}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ recap }: { recap: WeekRecap }) {
  const move = movement(recap.movement);
  const moveText = move.tone === "up" || move.tone === "down" ? move.text.slice(1) : move.text;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: OG.bg, padding: "50px 64px 48px", fontFamily: "Geist", color: OG.ink }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <OgAvatar username={recap.username} url={recap.avatarUrl} size={44} />
          <span style={{ fontSize: 30, fontWeight: 500 }}>{`@${recap.username}`}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "Geist Mono", fontSize: 22, color: OG.ink3 }}>
          <OgMark size={26} />
          <span>{`viberank · week ${weekNumber(recap.week.id)} · ${dayRange(recap.week.start, recap.week.end)}`}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 34 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          <span style={{ fontSize: 210, fontWeight: 500, lineHeight: 0.8, letterSpacing: -12 }}>
            {recap.rank === null ? "—" : `#${recap.rank}`}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4 }}>
            <span style={{ fontSize: 30, color: OG.ink2 }}>
              {recap.rank === null ? "no usage this week" : `of ${recap.of} on ${CLASS_LABEL[recap.cls]}`}
            </span>
            <div style={{ display: "flex", alignItems: "center", fontFamily: "Geist Mono", fontWeight: 500, fontSize: 28, color: MOVE_COLOR[move.tone] }}>
              {(move.tone === "up" || move.tone === "down") && <OgArrow up={move.tone === "up"} size={20} color={MOVE_COLOR[move.tone]} />}
              <span>{moveText}</span>
            </div>
            <span style={{ fontFamily: "Geist Mono", fontSize: 22, color: OG.ink3 }}>
              {`top ${topPercent(recap.percentile)}% · ${recap.streakWeeks}-week streak`}
            </span>
          </div>
        </div>
        <Bars days={recap.days} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
        <Mix recap={recap} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <OgStats
          items={[
            { value: usd(recap.cost), label: "API-equivalent" },
            { value: tokens(recap.tokens), label: "tokens" },
            { value: `${recap.activeDays} of 7`, label: "active days" },
            { value: planEq(recap.planEq), label: "plans" },
          ]}
        />
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { weekId: rawWeek, username: rawUser } = await params;
    const weekId = decodeURIComponent(rawWeek).toUpperCase();
    const username = decodeURIComponent(rawUser);
    if (!isWeekId(weekId)) return new Response("Unknown week", { status: 404 });
    const [recap, fonts] = await Promise.all([loadRecap(username, weekId), getOgFonts()]);
    if (!recap) return new Response("No recap", { status: 404 });
    return new ImageResponse(<Card recap={recap} />, { width: 1200, height: 630, fonts, headers: ogHeaders() });
  } catch (e: unknown) {
    return ogError(e);
  }
}
