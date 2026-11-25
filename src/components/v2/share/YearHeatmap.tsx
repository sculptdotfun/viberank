// Year heatmap for Wrapped: 53 fluid columns so it fits a phone without
// scrolling, CSS tooltips aligned inward at the edges so none are clipped.
import { formatUsd } from "@/lib/utils";
import { MONTH_INITIALS, shortDate } from "./format";
import { monthStarts, yearGrid } from "./year";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LEVEL = ["bg-h0", "bg-h1", "bg-h2", "bg-h3", "bg-h4"];
const EDGE_WEEKS = 8;

export default function YearHeatmap({ dailyCost, year }: { dailyCost: [string, number][]; year: number }) {
  const weeks = yearGrid(dailyCost, year);
  const cols = `repeat(${weeks.length}, minmax(0, 1fr))`;
  return (
    <div>
      <div className="grid gap-[2px] sm:gap-[3px] mb-1.5 font-mono text-[10px] sm:text-[11px] text-ink-3" style={{ gridTemplateColumns: cols }}>
        {monthStarts(weeks, year).map(({ month, week }) => (
          <span key={month} className="whitespace-nowrap" style={{ gridColumn: `${week + 1} / span 4` }}>
            <span className="sm:hidden">{MONTH_INITIALS[month]}</span>
            <span className="hidden sm:inline">{MONTHS[month]}</span>
          </span>
        ))}
      </div>
      <div
        className="grid gap-[2px] sm:gap-[3px]"
        style={{ gridTemplateColumns: cols, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column" }}
      >
        {weeks.flatMap((col, w) =>
          col.map((c) =>
            c.level < 0 ? (
              <i key={c.date} className={`block aspect-square rounded-[1.5px] ${c.level === -2 ? "border border-line" : ""}`} />
            ) : (
              <i
                key={c.date}
                data-tip={`${shortDate(c.date)} · ${formatUsd(c.cost)}`}
                data-tip-align={w < EDGE_WEEKS ? "start" : w >= weeks.length - EDGE_WEEKS ? "end" : undefined}
                className={`block aspect-square rounded-[1.5px] ${LEVEL[c.level]}`}
              />
            )
          )
        )}
      </div>
      <div className="flex justify-end items-center gap-1 mt-2.5 font-mono text-[11px] text-ink-3">
        <span className="mr-1">less</span>
        {LEVEL.map((cls) => (
          <i key={cls} className={`block w-2.5 h-2.5 rounded-[1.5px] ${cls}`} />
        ))}
        <span className="ml-1">more</span>
      </div>
    </div>
  );
}
