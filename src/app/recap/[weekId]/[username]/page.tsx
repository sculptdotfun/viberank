import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import type { BoardRow, WeekRecap } from "@/lib/v2/contract";
import WeekCard from "@/components/v2/share/WeekCard";
import ShareActions from "@/components/v2/share/ShareActions";
import { Avatar } from "@/components/v2/share/parts";
import { loadRecap } from "@/components/v2/share/load";
import {
  CLASS_LABEL,
  SITE,
  closesIn,
  dayRange,
  isWeekId,
  recapPath,
  recapPostText,
  tokens,
  topPercent,
  usd,
  weekNumber,
  wrappedPath,
} from "@/components/v2/share/format";

interface RecapParams {
  params: Promise<{ weekId: string; username: string }>;
}

// Closed weeks are frozen; the live week moves, so an hour is the ceiling.
export const revalidate = 3600;

async function read(params: RecapParams["params"]) {
  const { weekId: rawWeek, username: rawUser } = await params;
  const weekId = decodeURIComponent(rawWeek).toUpperCase();
  const username = decodeURIComponent(rawUser);
  if (!isWeekId(weekId)) return { weekId, username, recap: null };
  return { weekId, username, recap: await loadRecap(username, weekId) };
}

export async function generateMetadata({ params }: RecapParams): Promise<Metadata> {
  const { weekId, username, recap } = await read(params);
  if (!recap) return { robots: { index: false, follow: false } };
  const wk = weekNumber(weekId);
  const title = `${username}'s week ${wk} · viberank`;
  const place = recap.rank === null ? "No usage" : `#${recap.rank} of ${recap.of} on ${CLASS_LABEL[recap.cls]}`;
  const description = `${place}. ${usd(recap.cost)} API-equivalent, ${tokens(recap.tokens)} tokens, ${recap.activeDays} of 7 days, top ${topPercent(recap.percentile)}%.`;
  const url = `${SITE}${recapPath(weekId, username)}`;
  const og = `/api/og/week/${weekId}/${encodeURIComponent(username)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Personal recaps are for sharing, not for search results.
    robots: { index: false, follow: true },
    openGraph: { title, description, url, siteName: "Viberank", type: "article", images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

function Neighbours({ recap }: { recap: WeekRecap }) {
  const me = recap.bracket.findIndex((r) => r.username.toLowerCase() === recap.username.toLowerCase());
  if (me < 0) return null;
  const rows: BoardRow[] = recap.bracket.slice(Math.max(0, me - 2), me + 3);
  return (
    <section className="border border-line rounded-[14px] bg-panel overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-line font-mono text-xs text-ink-3">
        <span>Around {recap.username}</span>
        <span>{CLASS_LABEL[recap.cls]} · week {weekNumber(recap.week.id)}</span>
      </div>
      {rows.map((r) => {
        const you = r.username.toLowerCase() === recap.username.toLowerCase();
        return (
          <Link
            key={r.username}
            href={`/profile/${encodeURIComponent(r.username)}`}
            className={`flex items-center gap-3 px-5 py-2.5 border-b border-line last:border-b-0 font-mono text-[13px] hover:bg-raised ${you ? "bg-heat-soft" : ""}`}
          >
            <span className={`w-7 ${you ? "text-heat" : "text-ink-3"}`}>{r.rank}</span>
            <Avatar username={r.username} url={r.avatarUrl} size={20} />
            <span className={`flex-1 truncate font-sans text-sm ${you ? "text-ink font-medium" : "text-ink-2"}`}>{r.username}</span>
            <span className="text-ink">{usd(r.cost)}</span>
          </Link>
        );
      })}
    </section>
  );
}

export default async function RecapPage({ params }: RecapParams) {
  const { weekId, username, recap } = await read(params);
  if (!recap) notFound();

  const wk = weekNumber(weekId);
  const url = `${SITE}${recapPath(weekId, username)}`;
  const gap = recap.above ? recap.above.cost - recap.cost : null;

  return (
    <div className="min-h-screen bg-bg">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <p className="font-mono text-[12.5px] text-ink-3 mb-3">
          Week {wk} · {dayRange(recap.week.start, recap.week.end)} ·{" "}
          {recap.week.closed ? "closed" : `closes in ${closesIn(recap.week.closesAt)}`}
        </p>
        <h1 className="text-[34px] sm:text-[44px] font-medium leading-[1.02] tracking-[-0.045em] text-ink mb-3">
          {username}&apos;s week {wk}.
        </h1>
        <p className="text-ink-2 text-[15px] leading-relaxed mb-8 max-w-xl">
          {recap.rank === null
            ? "No usage was recorded this week."
            : gap !== null && gap > 0
              ? `${usd(gap)} short of ${recap.above?.username} at #${recap.rank - 1}.`
              : recap.rank === 1
                ? `First of ${recap.of} on ${CLASS_LABEL[recap.cls]} this week.`
                : `#${recap.rank} of ${recap.of} on ${CLASS_LABEL[recap.cls]}.`}{" "}
          From real ccusage data; dollars are API-equivalent, not money paid.
        </p>

        <WeekCard recap={recap} />

        <div className="mt-5">
          <ShareActions
            url={url}
            owner={username}
            text={recapPostText(recap, true)}
            visitorText={recapPostText(recap, false)}
            imagePath={`/api/og/week/${weekId}/${encodeURIComponent(username)}`}
            fileName={`viberank-week-${wk}-${username}.png`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-10">
          <Neighbours recap={recap} />
          <section className="border border-line rounded-[14px] bg-panel p-5 flex flex-col gap-4">
            <div className="font-mono text-[13px] text-ink-3 leading-relaxed">
              <p className="m-0">
                streak <b className="text-ink font-medium">{recap.streakWeeks} weeks</b>
              </p>
              {recap.bestWeek && (
                <p className="m-0">
                  best week <b className="text-ink font-medium">{usd(recap.bestWeek.cost)}</b> in week{" "}
                  {weekNumber(recap.bestWeek.weekId)}
                  {recap.bestWeek.rank !== null && <> at #{recap.bestWeek.rank}</>}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <Link href={`/profile/${encodeURIComponent(username)}`} className="px-3 h-8 inline-flex items-center rounded-md border border-line-2 text-ink hover:bg-raised">
                Profile
              </Link>
              <Link href={wrappedPath(username)} className="px-3 h-8 inline-flex items-center rounded-md border border-line-2 text-ink hover:bg-raised">
                Wrapped 2026
              </Link>
            </div>
            <div className="mt-auto border-t border-line pt-4">
              <p className="text-sm text-ink-2 mb-2">Where do you rank? A card like this every Monday.</p>
              <code className="font-mono text-[13px] text-ink">
                <span className="text-ink-3">$ </span>npx viberank-cli
              </code>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
