import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import PageHead from "@/components/v2/PageHead";
import CopyBlock from "@/components/v2/start/CopyBlock";
import UploadButton from "@/components/v2/start/UploadButton";
import { currentWeek } from "@/components/v2/week";
import { weekNumber } from "@/components/v2/format";
import {
  AGENT_PROMPT,
  CCUSAGE_EXPORT_COMMAND,
  CLI_COMMAND,
  PLUGIN_INSTALL_COMMAND,
  PLUGIN_MARKETPLACE_COMMAND,
  PLUGIN_STATUSLINE_JSON,
} from "@/lib/commands";

const SITE = "https://www.viberank.app";

export const metadata: Metadata = {
  title: "Join the weekly league · viberank",
  description:
    "Every way onto viberank, simplest first: one terminal command, the Claude Code plugin, a prompt for your agent, or a file upload. Only daily totals leave your machine.",
  alternates: { canonical: `${SITE}/start` },
  openGraph: {
    title: "Join the weekly league · viberank",
    description: "One command: npx viberank-cli. Or the Claude Code plugin, your agent, or a file upload.",
    url: `${SITE}/start`,
    siteName: "Viberank",
    type: "website",
  },
};

function Way({ n, title, sub, children, id }: { n: string; title: string; sub: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10 py-8 border-t border-line">
      <div className="min-w-0">
        <p className="font-mono text-[12.5px] text-ink-3 m-0">{n}</p>
        <h2 className="text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-ink mt-1.5 mb-2">{title}</h2>
        <div className="text-[14.5px] leading-relaxed text-ink-2">{sub}</div>
      </div>
      <div className="min-w-0 flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[12px] leading-relaxed text-ink-3 m-0">{children}</p>;
}

function Privacy() {
  const sent = [
    "Daily totals from ccusage: tokens, API-equivalent cost, models and tools",
    "Your GitHub handle, and a token if you signed in (to mark the row verified)",
    "A random machine ID, so a laptop and a desktop add up",
    "Per-month file and byte counts of your session-log folder",
  ];
  const never = ["Prompts or replies", "Code or file contents", "File names or paths", "Your transcripts"];
  return (
    <section aria-labelledby="privacy-h" className="border border-line-2 rounded-[14px] bg-panel p-5 sm:p-6 my-8">
      <h2 id="privacy-h" className="text-[17px] font-medium tracking-[-0.015em] text-ink m-0 mb-4">
        What leaves your machine
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[12px] text-ink-3 m-0 mb-2">sent</p>
          <ul className="m-0 p-0 list-none grid gap-1.5 text-[14px] text-ink-2">
            {sent.map((s) => (
              <li key={s} className="flex gap-2"><span className="text-up font-mono">+</span>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[12px] text-ink-3 m-0 mb-2">never sent</p>
          <ul className="m-0 p-0 list-none grid gap-1.5 text-[14px] text-ink-2">
            {never.map((s) => (
              <li key={s} className="flex gap-2"><span className="text-down font-mono">–</span>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[13.5px] text-ink-3 mt-4 mb-0">
        Usage figures and your handle are public; that is the leaderboard. The rest is server-only.{" "}
        <Link href="/privacy" className="vr-ul text-ink-2">Privacy, in full</Link>
      </p>
    </section>
  );
}

export default function StartPage() {
  const wk = weekNumber(currentWeek());
  return (
    <div className="vr">
      <NavBar />
      <main className="vr-in">
        <PageHead eyebrow={<span suppressHydrationWarning>Week {wk} · closes Monday 00:00 UTC</span>} title="Join the weekly league.">
          Pick whichever way suits you; they all end in the same place: your rank this week, among people at your
          scale. The first one takes about ten seconds.
        </PageHead>

        <Way
          n="01 · terminal"
          title="One command"
          sub={
            <>
              Reads your Claude Code, Codex, OpenCode and Gemini usage locally with ccusage, then shows your rank this
              week and the gap to the person above. It offers to sign you in (a verified row) and to sync once a day.
            </>
          }
        >
          <CopyBlock text={CLI_COMMAND} prompt="$" />
          <Note>Node 18+. Only totals leave the machine. Run it again any time; it never double-counts.</Note>
        </Way>

        <Way
          n="02 · claude code"
          title="The plugin"
          sub={
            <>
              Your rank in the status line (<span className="font-mono text-[13px] text-ink">vr #41/126 ▲6 · $27 to @palewave</span>)
              and a quiet sync when sessions start and end, at most hourly. Run the command above once first, so the
              plugin has your token.
            </>
          }
        >
          <CopyBlock text={PLUGIN_MARKETPLACE_COMMAND} prompt=">" />
          <CopyBlock text={PLUGIN_INSTALL_COMMAND} prompt=">" />
          <Note>Inside Claude Code. Then add the status line to ~/.claude/settings.json:</Note>
          <CopyBlock text={PLUGIN_STATUSLINE_JSON} />
        </Way>

        <Way
          n="03 · ask your agent"
          title="Let your agent do it"
          sub="Paste this into Claude Code, Codex or Cursor. It runs the CLI for you, reads back your rank, and asks before turning on daily sync."
        >
          <CopyBlock text={AGENT_PROMPT} multiline label="Copy prompt" />
        </Way>

        <Way
          n="04 · no terminal"
          title="Upload a file"
          sub="Make the export wherever your tools run, then sign in with GitHub and drop it in. A one-off: your rank stays where it was on the day you uploaded."
        >
          <CopyBlock text={CCUSAGE_EXPORT_COMMAND} prompt="$" />
          <div className="flex flex-wrap items-center gap-3">
            <UploadButton />
            <Note>Writes cc.json in the current folder.</Note>
          </div>
        </Way>

        <Privacy />

        <Way
          n="then"
          id="league"
          title="Start a league for your team"
          sub="A private board for your team or friends: this week's ranks for members only, with an all-time view. Up to five leagues each; invite by link."
        >
          <div className="flex flex-wrap gap-2">
            <Link href="/leagues" className="inline-flex items-center h-9 px-3.5 rounded-md bg-btn text-btn-ink! text-[13px] font-medium hover:opacity-90">
              Start a league
            </Link>
          </div>
          <Note>Needs a GitHub sign-in. Members show up as soon as they sync.</Note>
        </Way>

        <Way
          n="or"
          title="Challenge one person"
          sub={
            <>
              Head-to-head pages live at <span className="font-mono text-[13px] text-ink">viberank.app/vs/you/them</span>.
              Use the Challenge button on your profile or week card; if they are not on viberank yet, the page invites them.
            </>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="inline-flex items-center h-9 px-3.5 rounded-md border border-line-2 text-[13px] font-medium text-ink! hover:bg-raised">
              See this week&apos;s board
            </Link>
          </div>
        </Way>
      </main>
      <Footer />
    </div>
  );
}
