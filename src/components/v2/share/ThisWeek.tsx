// The profile's top block: where this person stands in the live week, and
// the two things worth sharing (the week card and Wrapped 2026).
import Link from "next/link";
import type { Standing } from "@/lib/v2/contract";
import CopyBadge from "./CopyBadge";
import ChallengeButton from "./ChallengeButton";
import { WeekBars } from "./parts";
import { CLASS_LABEL, closesIn, dayRange, movement, planEq, recapPath, tokens, usd, weekNumber, wrappedPath } from "./format";

const TONE: Record<string, string> = { up: "text-up", down: "text-down", flat: "text-ink-2", new: "text-ink-2" };

function monthLinks(): { label: string; month: string }[] {
  return [0, 1].map((back) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - back);
    return { label: back === 0 ? "this month" : "last month", month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` };
  });
}

function Actions({ username, standing }: { username: string; standing: Standing | null }) {
  const enc = encodeURIComponent(username);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {standing && standing.rank !== null && (
        <Link
          href={recapPath(standing.week.id, username)}
          className="inline-flex items-center h-9 px-3.5 rounded-md bg-btn text-btn-ink text-[13px] font-medium hover:opacity-90"
        >
          Share week
        </Link>
      )}
      <Link
        href={wrappedPath(username)}
        className="inline-flex items-center h-9 px-3.5 rounded-md border border-line-2 text-[13px] font-medium text-ink hover:bg-raised"
      >
        Wrapped 2026
      </Link>
      <ChallengeButton owner={username} />
      <CopyBadge username={username} />
      <span className="font-mono text-xs text-ink-3 sm:ml-2">
        monthly:{" "}
        {monthLinks().map((m, i) => (
          <span key={m.month}>
            {i > 0 && " · "}
            <Link href={`/wrapped/${m.month}/${enc}`} className="hover:text-ink underline-offset-2 hover:underline">
              {m.label}
            </Link>
          </span>
        ))}
      </span>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-xs text-ink-3">{label}</span>
      <b className="block font-mono text-lg font-medium tracking-[-0.03em] text-ink mt-1 whitespace-nowrap">{value}</b>
      {sub && <span className="block font-mono text-[11.5px] text-ink-3 mt-0.5 truncate">{sub}</span>}
    </div>
  );
}

/** Same frame and rough height as the block, while the standing streams in. */
export function ThisWeekSkeleton() {
  return (
    <section aria-label="This week" aria-busy="true" className="border border-line-2 rounded-[14px] bg-panel p-5 sm:p-7 flex flex-col gap-6 animate-pulse">
      <div className="h-4 w-56 max-w-full rounded bg-raised" />
      <div className="flex flex-wrap items-end gap-6">
        <div className="h-[70px] w-[120px] rounded bg-raised" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 min-w-[220px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[52px] rounded bg-raised" />
          ))}
        </div>
      </div>
      <div className="border-t border-line pt-5 flex gap-2">
        <div className="h-9 w-28 rounded-md bg-raised" />
        <div className="h-9 w-28 rounded-md bg-raised" />
      </div>
    </section>
  );
}

/**
 * The profile's week block. `failed` means the standing could not be read,
 * and says so: it used to fall through to "no usage", which was wrong for
 * people sitting at #1 whenever the read timed out.
 */
export default function ThisWeek({
  username,
  standing,
  failed = false,
}: {
  username: string;
  standing: Standing | null;
  failed?: boolean;
}) {
  if (!standing || standing.rank === null) {
    const streak = standing && standing.streakWeeks > 0 ? standing.streakWeeks : 0;
    return (
      <section aria-label="This week" className="border border-line-2 rounded-[14px] bg-panel p-5 sm:p-7 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[12.5px] text-ink-3">
          <span>
            This week{standing ? ` · week ${weekNumber(standing.week.id)} · ${dayRange(standing.week.start, standing.week.end)}` : ""}
          </span>
          {standing && !standing.week.closed && <span>closes in {closesIn(standing.week.closesAt)}</span>}
        </div>
        <div>
          <p className="text-ink text-xl font-medium tracking-[-0.02em] m-0">
            {failed ? "This week's standing could not be loaded." : "No usage this week yet."}
          </p>
          <p className="text-sm text-ink-2 mt-1.5 mb-0 max-w-[60ch]">
            {failed
              ? "The rest of the profile is current. Refresh in a moment to see the week."
              : streak > 0
                ? `A ${streak}-week streak is on the line: one submission before Monday 00:00 UTC keeps it.`
                : "The week runs Monday to Sunday, UTC. One submission puts this profile on the board."}
          </p>
        </div>
        <div className="border-t border-line pt-5">
          <Actions username={username} standing={standing} />
        </div>
      </section>
    );
  }

  const s = standing;
  const move = movement(s.movement);
  const gap = s.above ? s.above.cost - s.cost : null;

  return (
    <section aria-label="This week" className="border border-line-2 rounded-[14px] bg-panel p-5 sm:p-7 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[12.5px] text-ink-3">
        <span>
          This week · week {weekNumber(s.week.id)} · {dayRange(s.week.start, s.week.end)}
        </span>
        <span>
          {s.week.closed ? "closed" : `day ${s.week.day} of 7 · closes in ${closesIn(s.week.closesAt)}`}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-end">
        <div className="flex items-end gap-4">
          <b className="font-medium text-[72px] sm:text-[88px] leading-[0.82] tracking-[-0.06em] text-ink">#{s.rank}</b>
          <div className="text-[15px] text-ink-2 leading-[1.45] pb-0.5">
            of {s.of} on {CLASS_LABEL[s.cls]}
            <strong className={`block font-mono text-[14px] font-medium ${TONE[move.tone]}`}>{move.text}</strong>
            <span className="block font-mono text-[12.5px] text-ink-3">
              {gap !== null && s.above
                ? gap > 0
                  ? `${usd(gap)} behind ${s.above.username}`
                  : `level with ${s.above.username}`
                : "nobody above"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 xl:px-6 xl:border-l xl:border-line">
          <Fact label="spend" value={usd(s.cost)} sub="API-equivalent" />
          <Fact label="tokens" value={tokens(s.tokens)} sub={`${planEq(s.planEq)} plans`} />
          <Fact label="streak" value={`${s.streakWeeks} wk`} sub="weeks in a row" />
          <Fact
            label="best week"
            value={s.bestWeek ? usd(s.bestWeek.cost) : "—"}
            sub={s.bestWeek ? `week ${weekNumber(s.bestWeek.weekId)}${s.bestWeek.rank !== null ? ` · #${s.bestWeek.rank}` : ""}` : undefined}
          />
        </div>

        <div className="w-full sm:max-w-[320px] xl:w-[190px]">
          <WeekBars days={s.days} today={s.week.closed ? undefined : s.week.day} height={64} fluid />
        </div>
      </div>

      {s.heldReason && (
        <p className="font-mono text-[12.5px] leading-relaxed text-ink-3 border-l-2 border-warn pl-3 m-0">
          <span className="text-warn">held</span> {s.heldReason}
        </p>
      )}

      <div className="border-t border-line pt-5">
        <Actions username={username} standing={s} />
      </div>
    </section>
  );
}
