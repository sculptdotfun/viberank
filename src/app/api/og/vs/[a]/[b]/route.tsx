import { ImageResponse } from "next/og";
import type { Standing } from "@/lib/v2/contract";
import { loadVs } from "@/components/v2/vs/load";
import { CLASS_LABEL, DAY_INITIALS, OG, dayRange, tokens, usd, weekNumber } from "@/components/v2/share/format";
import { OgAvatar, OgMark, getOgFonts, ogError, ogHeaders } from "@/components/v2/share/og";
import { compareWeek, pairedHeights, parseHandle, sameHandle } from "@/lib/v2/invite";

// Node runtime: the weekly service reads through the server data layer.
export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ a: string; b: string }>;
}

const SIDE = { a: OG.h[3], b: OG.ink2 } as const;

function Header({ a, b, week }: { a: string; b: string; week: Standing["week"] | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "Geist Mono", fontSize: 22, color: OG.ink3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <OgMark size={26} />
        <span>{`viberank${week ? ` · week ${weekNumber(week.id)} · ${dayRange(week.start, week.end)}` : ""}`}</span>
      </div>
      <span>{`viberank.app/vs/${a}/${b}`}</span>
    </div>
  );
}

function Side({ s, name, side, lead, align }: { s: Standing | null; name: string; side: "a" | "b"; lead: boolean; align: "left" | "right" }) {
  const flexAlign = align === "left" ? "flex-start" : "flex-end";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: flexAlign, flex: 1, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexDirection: align === "left" ? "row" : "row-reverse" }}>
        <OgAvatar username={name} url={s?.avatarUrl} size={48} />
        <span style={{ fontSize: 36, fontWeight: 500, color: OG.ink }}>{`@${name}`}</span>
        <div style={{ display: "flex", width: 14, height: 14, borderRadius: 3, backgroundColor: SIDE[side] }} />
      </div>
      <span style={{ fontSize: 150, fontWeight: 500, lineHeight: 0.9, letterSpacing: -8, color: lead ? OG.ink : OG.ink3, marginTop: 8 }}>
        {s ? (s.rank === null ? "–" : `#${s.rank}`) : "?"}
      </span>
      <span style={{ fontFamily: "Geist Mono", fontSize: 24, color: OG.ink2 }}>
        {s ? (s.rank === null ? "no usage yet" : `of ${s.of} on ${CLASS_LABEL[s.cls]}`) : "hasn't joined yet"}
      </span>
      <span style={{ fontFamily: "Geist Mono", fontWeight: 500, fontSize: 34, color: lead ? OG.ink : OG.ink3 }}>
        {s ? `${usd(s.cost)} · ${tokens(s.tokens)}` : "npx viberank-cli"}
      </span>
    </div>
  );
}

function Bars({ a, b }: { a: number[]; b: number[] }) {
  const h = pairedHeights(a, b);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150 }}>
        {DAY_INITIALS.map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: 3, height: "100%" }}>
            {(["a", "b"] as const).map((side) => (
              <div
                key={side}
                style={{ display: "flex", width: 14, height: h[side][i] > 0 ? `${h[side][i]}%` : "3%", borderRadius: 2, backgroundColor: h[side][i] > 0 ? SIDE[side] : OG.h[0] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {DAY_INITIALS.map((d, i) => (
          <span key={i} style={{ display: "flex", justifyContent: "center", width: 31, fontFamily: "Geist Mono", fontSize: 16, color: OG.ink3 }}>{d}</span>
        ))}
      </div>
    </div>
  );
}

function Card({ a, b, sa, sb }: { a: string; b: string; sa: Standing | null; sb: Standing | null }) {
  const week = (sa ?? sb)?.week ?? null;
  const cmp = sa && sb ? compareWeek(sa, sb) : null;
  const zero = [0, 0, 0, 0, 0, 0, 0];
  const missing = !sa ? a : !sb ? b : null;
  const footer = missing
    ? `Your move, @${missing}.`
    : cmp && (cmp.leader === "a" || cmp.leader === "b")
      ? `@${cmp.leader === "a" ? a : b} leads by ${usd(cmp.gap)}`
      : cmp?.leader === "tie"
        ? "Dead level"
        : "No usage yet this week";
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: OG.bg, padding: "48px 64px 44px", fontFamily: "Geist", color: OG.ink }}>
      <Header a={a} b={b} week={week} />
      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 46, gap: 28 }}>
        <Side s={sa} name={a} side="a" lead={cmp?.leader === "a" || (!!sa && !sb)} align="left" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <span style={{ fontFamily: "Geist Mono", fontSize: 26, color: OG.ink3 }}>vs</span>
          <Bars a={sa?.days ?? zero} b={sb?.days ?? zero} />
        </div>
        <Side s={sb} name={b} side="b" lead={cmp?.leader === "b" || (!!sb && !sa)} align="right" />
      </div>
      <div style={{ display: "flex", marginTop: "auto", borderTop: `1px solid ${OG.line2}`, paddingTop: 24, justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 38, fontWeight: 500, letterSpacing: -1, color: OG.ink }}>{footer}</span>
        <span style={{ fontFamily: "Geist Mono", fontSize: 22, color: OG.ink3, whiteSpace: "nowrap" }}>{week && !week.closed ? `day ${week.day} of 7` : week ? "final" : ""}</span>
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { a: rawA, b: rawB } = await params;
    const a = parseHandle(decodeURIComponent(rawA));
    const b = parseHandle(decodeURIComponent(rawB));
    if (!a || !b || sameHandle(a, b)) return new Response("Unknown matchup", { status: 404 });
    const [data, fonts] = await Promise.all([loadVs(a, b), getOgFonts()]);
    return new ImageResponse(<Card a={data.a?.username ?? a} b={data.b?.username ?? b} sa={data.a} sb={data.b} />, {
      width: 1200,
      height: 630,
      fonts,
      headers: ogHeaders(),
    });
  } catch (e: unknown) {
    return ogError(e);
  }
}
