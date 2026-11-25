// Wrapped 2026. A static "2026" segment outranks the dynamic [month] route,
// so /wrapped/2026/{user} lands here while /wrapped/2026-11/{user} still
// reaches the monthly page (which only accepts YYYY-MM).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import type { YearWrapped } from "@/lib/v2/contract";
import ShareActions from "@/components/v2/share/ShareActions";
import TrackView from "@/components/v2/TrackView";
import YearHeatmap from "@/components/v2/share/YearHeatmap";
import { Avatar } from "@/components/v2/share/parts";
import { loadYear } from "@/components/v2/share/load";
import { yearInProgress } from "@/components/v2/share/year";
import {
  MONTH_INITIALS,
  SITE,
  modelLabel,
  pct,
  recapPath,
  shortDate,
  tokens,
  toolLabel,
  topPercent,
  usd,
  vendorVar,
  weekNumber,
  wrappedPath,
  wrappedPostText,
} from "@/components/v2/share/format";

const YEAR = 2026;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const revalidate = 3600;

interface WrappedParams {
  params: Promise<{ username: string }>;
}

async function read(params: WrappedParams["params"]) {
  const username = decodeURIComponent((await params).username);
  return { username, wrapped: await loadYear(username, YEAR) };
}

export async function generateMetadata({ params }: WrappedParams): Promise<Metadata> {
  const { username, wrapped } = await read(params);
  if (!wrapped) return { robots: { index: false, follow: false } };
  const title = `${username}'s Wrapped ${YEAR} · viberank`;
  const description = `${wrapped.activeDays} active days, ${tokens(wrapped.tokens)} tokens, ${usd(wrapped.cost)} API-equivalent, a ${wrapped.longestStreakDays}-day streak. Top ${topPercent(wrapped.percentile)}%.`;
  const url = `${SITE}${wrappedPath(username)}`;
  const og = `/api/og/wrapped/${YEAR}/${encodeURIComponent(username)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: true },
    openGraph: { title, description, url, siteName: "Viberank", type: "article", images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

function Slide({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <section className="v2-slide flex flex-col justify-center py-14 sm:py-20 border-b border-line last:border-b-0">
      <p className="font-mono text-[12.5px] text-ink-3 mb-5">
        {String(n).padStart(2, "0")} · {label}
      </p>
      {children}
    </section>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-line pt-4 min-w-0">
      <b className="block font-mono font-medium text-[34px] sm:text-[44px] tracking-[-0.04em] leading-none text-ink">{value}</b>
      <span className="block font-mono text-xs text-ink-3 mt-2">{label}</span>
    </div>
  );
}

function Months({ months }: { months: number[] }) {
  const max = Math.max(...months, 1);
  const peak = months.indexOf(Math.max(...months));
  return (
    <div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 items-end h-48 sm:h-64">
        {months.map((c, i) => (
          <div key={i} className="flex flex-col justify-end h-full" title={`${MONTH_NAMES[i]}: ${usd(c)}`}>
            <i
              className={`block rounded-[2px] ${c <= 0 ? "bg-h0" : i === peak ? "bg-heat" : "bg-h3"}`}
              style={{ height: c > 0 ? `${Math.max(4, (c / max) * 100)}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 mt-2">
        {MONTH_INITIALS.map((m, i) => (
          <span key={i} className={`text-center font-mono text-[11px] ${i === peak ? "text-ink" : "text-ink-3"}`}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShareList({ items }: { items: { label: string; share: number; color: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 font-mono text-[13px]">
          <span className="truncate text-ink-2">{it.label}</span>
          <span className="h-2 rounded-[2px] bg-h0 overflow-hidden">
            <i className="block h-full rounded-[2px]" style={{ width: `${Math.max(2, it.share * 100)}%`, background: it.color }} />
          </span>
          <span className="text-right text-ink">{pct(it.share)}</span>
        </div>
      ))}
    </div>
  );
}

function lastActive(w: YearWrapped): string | null {
  return w.dailyCost.reduce<string | null>((m, [d]) => (m === null || d > m ? d : m), null);
}

export default async function Wrapped2026Page({ params }: WrappedParams) {
  const { username, wrapped } = await read(params);
  if (!wrapped) notFound();

  const running = yearInProgress(YEAR);
  const last = lastActive(wrapped);
  const peak = wrapped.months.indexOf(Math.max(...wrapped.months));
  const url = `${SITE}${wrappedPath(username)}`;
  const top = topPercent(wrapped.percentile);

  return (
    <div className="min-h-screen bg-bg">
      <NavBar />
      <TrackView event="wrapped_view" props={{ year: YEAR }} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6">
        <Slide n={1} label={`Wrapped ${YEAR}${running ? ` · so far, through ${last ? shortDate(last) : "today"}` : ""}`}>
          <div className="flex items-center gap-3 mb-6 text-ink font-medium">
            <Avatar username={username} url={wrapped.avatarUrl} size={32} />@{username}
          </div>
          <h1 className="text-[44px] sm:text-[72px] font-medium leading-[0.98] tracking-[-0.05em] text-ink mb-10">
            {wrapped.activeDays} active days.
            <br />
            <span className="text-ink-3">Top {top}% of the year.</span>
          </h1>
          <YearHeatmap dailyCost={wrapped.dailyCost} year={YEAR} />
        </Slide>

        <Slide n={2} label="The year in numbers">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8">
            <BigStat value={tokens(wrapped.tokens)} label="tokens" />
            <BigStat value={usd(wrapped.cost)} label="API-equivalent dollars" />
            <BigStat value={`${wrapped.longestStreakDays} days`} label="longest streak" />
            <BigStat value={String(wrapped.activeDays)} label="active days" />
          </div>
          <p className="text-ink-2 text-[15px] mt-10 max-w-xl">
            More than {Math.round(wrapped.percentile)}% of the developers on viberank in {YEAR}. From real ccusage data; dollars
            are what the tokens would cost at list API prices, not money paid.
          </p>
        </Slide>

        <Slide n={3} label="Month by month">
          <h2 className="text-[32px] sm:text-[44px] font-medium tracking-[-0.045em] leading-[1.02] text-ink mb-10">
            {wrapped.months[peak] > 0 ? `${MONTH_NAMES[peak]} ran hottest: ${usd(wrapped.months[peak])}.` : "A quiet year so far."}
          </h2>
          <Months months={wrapped.months} />
        </Slide>

        {wrapped.bestWeek && (
          <Slide n={4} label="Best week">
            <h2 className="text-[32px] sm:text-[44px] font-medium tracking-[-0.045em] leading-[1.02] text-ink mb-6">
              Week {weekNumber(wrapped.bestWeek.weekId)}: {usd(wrapped.bestWeek.cost)}
              {wrapped.bestWeek.rank !== null && (
                <>
                  {" "}
                  at <span className="text-heat">#{wrapped.bestWeek.rank}</span>
                </>
              )}
              .
            </h2>
            <Link
              href={recapPath(wrapped.bestWeek.weekId, username)}
              className="self-start inline-flex items-center h-9 px-3.5 rounded-md border border-line-2 text-[13px] text-ink hover:bg-raised"
            >
              Open that week&apos;s card →
            </Link>
          </Slide>
        )}

        {(wrapped.topModels.length > 0 || wrapped.tools.length > 0) && (
          <Slide n={wrapped.bestWeek ? 5 : 4} label="What it ran on">
            <div className="grid gap-10 sm:grid-cols-2">
              {wrapped.topModels.length > 0 && (
                <div>
                  <p className="font-mono text-xs text-ink-3 mb-4">Models, by spend</p>
                  <ShareList items={wrapped.topModels.slice(0, 6).map((m) => ({ label: modelLabel(m.model), share: m.share, color: vendorVar(m.model) }))} />
                </div>
              )}
              {wrapped.tools.length > 0 && (
                <div>
                  <p className="font-mono text-xs text-ink-3 mb-4">Tools</p>
                  <ShareList items={wrapped.tools.slice(0, 6).map((t) => ({ label: toolLabel(t.tool), share: t.share, color: "var(--ink-2)" }))} />
                </div>
              )}
            </div>
          </Slide>
        )}

        <Slide n={wrapped.bestWeek ? 6 : 5} label="Share it">
          <h2 className="text-[32px] sm:text-[44px] font-medium tracking-[-0.045em] leading-[1.02] text-ink mb-6">That was {YEAR}.</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- the OG card itself, so what you see is what posts. */}
          <img
            src={`/api/og/wrapped/${YEAR}/${encodeURIComponent(username)}`}
            alt={`${username}'s Wrapped ${YEAR} card`}
            width={1200}
            height={630}
            className="w-full h-auto rounded-[14px] border border-line-2 mb-5"
          />
          <ShareActions
            url={url}
            owner={username}
            text={wrappedPostText(wrapped, true)}
            visitorText={wrappedPostText(wrapped, false)}
            imagePath={`/api/og/wrapped/${YEAR}/${encodeURIComponent(username)}`}
            fileName={`viberank-wrapped-${YEAR}-${username}.png`}
            card="wrapped"
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10 pt-6 border-t border-line text-sm text-ink-2">
            <Link href={`/profile/${encodeURIComponent(username)}`} className="hover:text-ink">
              {username}&apos;s profile →
            </Link>
            <span>
              Yours: <code className="font-mono text-ink">npx viberank-cli</code>
            </span>
          </div>
        </Slide>
      </main>
      <Footer />
    </div>
  );
}
