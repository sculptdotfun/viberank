// The weekly recap card, as approved on the v2 landing: who and which week,
// a big rank with movement, Mon–Sun bars, the model mix, four numbers.
import type { WeekRecap } from "@/lib/v2/contract";
import { CLASS_LABEL, dayRange, movement, planEq, tokens, topPercent, usd, weekNumber } from "./format";
import { Avatar, ModelMix, StatRow, WeekBars } from "./parts";

const TONE: Record<string, string> = { up: "text-up", down: "text-down", flat: "text-ink-2", new: "text-ink-2" };

export default function WeekCard({ recap }: { recap: WeekRecap }) {
  const move = movement(recap.movement);
  const held = recap.cls !== "ranked";
  return (
    <article className="border border-line-2 rounded-[14px] bg-panel px-5 py-5 sm:px-[30px] sm:py-7 flex flex-col gap-[22px] min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2 font-mono text-[13px] text-ink-3">
        <span className="flex items-center gap-2.5 font-sans text-sm font-medium text-ink">
          <Avatar username={recap.username} url={recap.avatarUrl} />@{recap.username}
        </span>
        <span>
          viberank · week {weekNumber(recap.week.id)} · {dayRange(recap.week.start, recap.week.end)}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-5">
        <b className="font-medium text-[80px] sm:text-[104px] leading-[0.82] tracking-[-0.06em] text-ink">
          {recap.rank === null ? "—" : `#${recap.rank}`}
        </b>
        <div className="text-[15px] text-ink-2 leading-[1.45] pb-1">
          {recap.rank === null ? "no usage this week" : `of ${recap.of} on ${CLASS_LABEL[recap.cls]}`}
          <strong className={`block font-mono text-[15px] font-medium ${TONE[move.tone]}`}>{move.text}</strong>
          <span className="block font-mono text-[13px] text-ink-3">
            top {topPercent(recap.percentile)}% · {recap.streakWeeks}-week streak
          </span>
        </div>
        <div className="w-full sm:w-[190px] sm:ml-auto">
          <WeekBars days={recap.days} fluid />
        </div>
      </div>

      {held && recap.heldReason && (
        <p className="font-mono text-[12.5px] leading-relaxed text-ink-3 border-l-2 border-warn pl-3 m-0">
          <span className="text-warn">held</span> {recap.heldReason}
        </p>
      )}

      <ModelMix models={recap.topModels} />

      <StatRow
        items={[
          { value: usd(recap.cost), label: "API-equivalent" },
          { value: tokens(recap.tokens), label: "tokens" },
          { value: `${recap.activeDays} of 7`, label: "active days" },
          { value: planEq(recap.planEq), label: "plans" },
        ]}
      />
    </article>
  );
}
