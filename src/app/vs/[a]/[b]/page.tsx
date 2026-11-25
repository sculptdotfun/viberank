import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ShareActions from "@/components/v2/share/ShareActions";
import { Avatar } from "@/components/v2/share/parts";
import { CLASS_LABEL, closesIn, dayRange, usd, weekNumber } from "@/components/v2/share/format";
import { loadVs, loadVsHistory } from "@/components/v2/vs/load";
import { History, JoinSteps, PairedBars, SideKey, Tape } from "@/components/v2/vs/parts";
import type { Standing } from "@/lib/v2/contract";
import { compareWeek, inviteText, parseHandle, sameHandle, tallyWeeks, vsPath, vsUrl } from "@/lib/v2/invite";

interface VsParams {
  params: Promise<{ a: string; b: string }>;
}

// The live week moves; ten minutes keeps a posted link fresh enough.
export const revalidate = 600;

async function read(params: VsParams["params"]) {
  const { a: rawA, b: rawB } = await params;
  const a = parseHandle(decodeURIComponent(rawA));
  const b = parseHandle(decodeURIComponent(rawB));
  if (!a || !b) notFound();
  if (sameHandle(a, b)) redirect(`/profile/${encodeURIComponent(a)}`);
  const data = await loadVs(a, b);
  return { a: data.a?.username ?? a, b: data.b?.username ?? b, sa: data.a, sb: data.b };
}

export async function generateMetadata({ params }: VsParams): Promise<Metadata> {
  const { a, b, sa, sb } = await read(params);
  const week = (sa ?? sb)?.week;
  const wk = week ? ` · week ${weekNumber(week.id)}` : "";
  const title = `${a} vs ${b}${wk} · viberank`;
  const missing = !sa ? a : !sb ? b : null;
  const description = missing
    ? `${missing} hasn't joined viberank yet. One command to join the weekly league for AI coding: npx viberank-cli.`
    : `Head to head this week: ${a} ${sa?.rank ? `#${sa.rank}` : "unranked"} with ${usd(sa?.cost ?? 0)}, ${b} ${sb?.rank ? `#${sb.rank}` : "unranked"} with ${usd(sb?.cost ?? 0)}.`;
  const og = `/api/og/vs/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;
  return {
    title,
    description,
    alternates: { canonical: vsUrl(a, b) },
    robots: { index: false, follow: true },
    openGraph: { title, description, url: vsUrl(a, b), siteName: "Viberank", type: "article", images: [{ url: og, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

function Head({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <header className="pt-10 sm:pt-14 pb-7">
      <p className="font-mono text-[12.5px] text-ink-3 m-0 mb-3" suppressHydrationWarning>{eyebrow}</p>
      <h1 className="text-[34px] sm:text-[48px] font-medium leading-[1.02] tracking-[-0.045em] text-ink m-0 mb-3 break-words">{title}</h1>
      <div className="text-ink-2 text-[15px] sm:text-[16px] leading-relaxed max-w-2xl">{children}</div>
    </header>
  );
}

function weekLine(s: Standing): string {
  const w = s.week;
  return `Head to head · week ${weekNumber(w.id)} · ${dayRange(w.start, w.end)} · ${w.closed ? "closed" : `closes in ${closesIn(w.closesAt)}`}`;
}

/** One side has joined, the other hasn't: the invite. */
function NotJoined({ joined, missing, joinedIsA }: { joined: Standing; missing: string; joinedIsA: boolean }) {
  const challenger = joined.username;
  const link = joinedIsA ? vsUrl(challenger, missing) : vsUrl(missing, challenger);
  const text = inviteText(challenger, missing);
  return (
    <>
      <Head eyebrow={weekLine(joined)} title={`${missing} hasn't joined yet.`}>
        {challenger} wants a head-to-head this week
        {joined.rank !== null ? `, from #${joined.rank} on ${CLASS_LABEL[joined.cls]} with ${usd(joined.cost)} so far` : ""}. Join and this page
        turns into the race.
      </Head>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <JoinSteps handle={missing} />
        <section className="border border-line rounded-[14px] bg-panel p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar username={challenger} url={joined.avatarUrl} size={36} />
            <div className="min-w-0">
              <Link href={`/profile/${encodeURIComponent(challenger)}`} className="block truncate text-ink! font-medium hover:underline">{challenger}</Link>
              <span className="block font-mono text-xs text-ink-3">
                {joined.rank !== null ? `#${joined.rank} of ${joined.of} · ${usd(joined.cost)} this week` : "no usage yet this week"}
              </span>
            </div>
          </div>
          <PairedBars a={joined.days} b={[0, 0, 0, 0, 0, 0, 0]} today={joined.week.closed ? undefined : joined.week.day} height={80} />
          <div className="border-t border-line pt-4">
            <p className="text-sm text-ink-2 m-0 mb-3">Send {missing} the invite:</p>
            <p className="font-mono text-[12.5px] leading-relaxed text-ink-2 bg-raised border border-line rounded-md px-3 py-2.5 m-0 mb-3">
              {text} {link.replace("https://www.", "")}
            </p>
            <ShareActions url={link} owner={challenger} text={text} visitorText={text} imagePath={`/api/og/vs/${encodeURIComponent(joinedIsA ? challenger : missing)}/${encodeURIComponent(joinedIsA ? missing : challenger)}`} fileName={`viberank-${challenger}-vs-${missing}.png`} />
          </div>
        </section>
      </div>
    </>
  );
}

function Neither({ a, b }: { a: string; b: string }) {
  return (
    <>
      <Head eyebrow="Head to head" title={`Neither ${a} nor ${b} is on viberank yet.`}>
        Whoever joins first gets the head start. The race shows up here once you have both synced.
      </Head>
      <div className="max-w-xl">
        <JoinSteps handle="You" />
      </div>
    </>
  );
}

export default async function VsPage({ params }: VsParams) {
  const { a, b, sa, sb } = await read(params);

  let body: React.ReactNode;
  if (!sa && !sb) body = <Neither a={a} b={b} />;
  else if (!sb && sa) body = <NotJoined joined={sa} missing={b} joinedIsA />;
  else if (!sa && sb) body = <NotJoined joined={sb} missing={a} joinedIsA={false} />;
  else body = await Race({ sa: sa as Standing, sb: sb as Standing });

  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <div className="max-w-4xl">{body}</div>
      </main>
      <Footer />
    </div>
  );
}

async function Race({ sa, sb }: { sa: Standing; sb: Standing }) {
  const a = sa.username;
  const b = sb.username;
  const week = sa.week;
  const cmp = compareWeek(sa, sb);
  const history = await loadVsHistory(a, b, week.id);
  const tally = history ? tallyWeeks(history) : null;
  const daysLeft = week.closed ? 0 : 7 - week.day;
  const leader = cmp.leader === "a" ? a : cmp.leader === "b" ? b : null;
  const trailer = cmp.leader === "a" ? b : a;

  const lede =
    cmp.leader === "none"
      ? "Neither has usage this week yet. First to sync takes the lead."
      : cmp.leader === "tie"
        ? "Dead level this week."
        : `${leader} leads by ${usd(cmp.gap)}${cmp.ratio ? ` (${cmp.ratio}×)` : ""}${week.closed ? ", final." : daysLeft > 0 ? ` with ${daysLeft} ${daysLeft === 1 ? "day" : "days"} to go.` : " on the last day."}`;

  const url = vsUrl(a, b);
  const ownerText = leader
    ? `${leader === a ? "I'm" : `@${b} is`} ahead ${leader === a ? `of @${b}` : "of me"} on viberank this week by ${usd(cmp.gap)}. Week ${weekNumber(week.id)}:`
    : `@${b}, it's level on viberank this week. Week ${weekNumber(week.id)}:`;
  const visitorText = `${a} vs ${b} on viberank, week ${weekNumber(week.id)}:`;

  return (
    <>
      <Head eyebrow={weekLine(sa)} title={`${a} vs ${b}.`}>
        {lede}
        {tally && tally.played > 1 && (
          <> Over the last {history?.length} weeks it is {tally.a}–{tally.b}{tally.streak && tally.streak.weeks > 1 ? `, ${tally.streak.side === "a" ? a : b} on a ${tally.streak.weeks}-week run` : ""}.</>
        )}
      </Head>

      <section className="border border-line-2 rounded-[14px] bg-panel p-5 sm:p-6 mb-4">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <span className="block font-mono text-xs text-ink-3">gap</span>
            <b className="block font-medium text-[44px] sm:text-[56px] leading-[0.9] tracking-[-0.05em] text-ink mt-1">
              {cmp.leader === "a" || cmp.leader === "b" ? usd(cmp.gap) : "$0"}
            </b>
            <span className="block font-mono text-[12.5px] text-ink-3 mt-1.5">
              {leader ? `${trailer} needs ${usd(cmp.gap + 0.01)} to pass` : "nobody ahead"}
              {cmp.leadChanges > 0 ? ` · lead changed ${cmp.leadChanges}×` : ""}
            </span>
          </div>
          <div className="flex gap-4">
            <SideKey side="a" username={a} />
            <SideKey side="b" username={b} />
          </div>
        </div>
        <PairedBars a={sa.days} b={sb.days} today={week.closed ? undefined : week.day} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tape a={sa} b={sb} dayWins={cmp.dayWins} />
        {history && tally ? (
          <History weeks={history} a={a} b={b} tally={tally} currentWeekId={week.id} />
        ) : (
          <section className="border border-line rounded-[14px] bg-panel p-5 font-mono text-[12.5px] text-ink-3">Week-by-week history is unavailable right now.</section>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <ShareActions url={url} owner={a} text={ownerText} visitorText={visitorText} imagePath={`/api/og/vs/${encodeURIComponent(a)}/${encodeURIComponent(b)}`} fileName={`viberank-${a}-vs-${b}-week-${weekNumber(week.id)}.png`} />
        <p className="font-mono text-[12px] text-ink-3 m-0">
          Ranks are within each person&apos;s own board. Dollars are API-equivalent, not money paid.{" "}
          <Link href={vsPath(b, a)} className="vr-ul">Flip sides</Link> ·{" "}
          <Link href="/start" className="vr-ul">Not on the board? Join</Link>
        </p>
      </div>
    </>
  );
}
