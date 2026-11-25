// Dev-only gallery of the v2 share surfaces on fixture data. The OG images
// and the real pages render fixtures only with VIBERANK_SHARE_FIXTURES=1.
import { notFound } from "next/navigation";
import Link from "next/link";
import WeekCard from "@/components/v2/share/WeekCard";
import ThisWeek from "@/components/v2/share/ThisWeek";
import YearHeatmap from "@/components/v2/share/YearHeatmap";
import { fixtureHeldStanding, fixtureRecap, fixtureStanding, fixtureYear } from "@/components/v2/share/__fixtures__";

export const metadata = { robots: { index: false, follow: false } };

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <p className="font-mono text-[12.5px] text-ink-3 mb-3">{title}</p>
      {children}
    </section>
  );
}

export default function SharePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const user = fixtureRecap.username;
  return (
    <main className="min-h-screen bg-bg max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-medium tracking-[-0.04em] text-ink mb-10">v2 share preview</h1>

      <Block title="Week card · ranked, closed week">
        <WeekCard recap={fixtureRecap} />
      </Block>
      <Block title="Week card · held on Open">
        <WeekCard recap={{ ...fixtureRecap, ...fixtureHeldStanding, week: fixtureRecap.week, days: fixtureRecap.days }} />
      </Block>
      <Block title="Profile · this week (live)">
        <ThisWeek username={user} standing={fixtureStanding} />
      </Block>
      <Block title="Profile · this week (held)">
        <ThisWeek username={user} standing={fixtureHeldStanding} />
      </Block>
      <Block title="Profile · this week (no usage)">
        <ThisWeek username={user} standing={{ ...fixtureStanding, rank: null, cost: 0, days: [0, 0, 0, 0, 0, 0, 0] }} />
      </Block>
      <Block title="Year heatmap">
        <YearHeatmap dailyCost={fixtureYear.dailyCost} year={2026} />
      </Block>
      <Block title="OG images (need VIBERANK_SHARE_FIXTURES=1)">
        <div className="grid gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/og/week/2026-W47/${user}`} alt="week OG" className="w-full rounded-lg border border-line" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/og/wrapped/2026/${user}`} alt="wrapped OG" className="w-full rounded-lg border border-line" />
        </div>
      </Block>
      <p className="font-mono text-xs text-ink-3">
        Pages: <Link href={`/recap/2026-W47/${user}`} className="underline">recap</Link> ·{" "}
        <Link href={`/wrapped/2026/${user}`} className="underline">wrapped 2026</Link> ·{" "}
        <Link href={`/wrapped/2026-11/${user}`} className="underline">monthly wrapped</Link>
      </p>
    </main>
  );
}
