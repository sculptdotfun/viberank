import { formatCurrency } from "@/lib/utils";

interface ActivityHeatmapProps {
  /** Per-date spend, one entry per active day (YYYY-MM-DD). */
  daily: { date: string; cost: number }[];
}

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Opacity steps must be literal class names so Tailwind emits them.
const LEVEL_CLASSES = ["bg-surface-3", "bg-accent/25", "bg-accent/45", "bg-accent/70", "bg-accent"];

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10);
}

/**
 * GitHub-style contribution calendar of the trailing year's daily spend.
 * Server-rendered: plain divs with native title tooltips, no client JS.
 * Cells are fluid (1fr columns, square cells) so the grid fills the card;
 * a min-width keeps it readable on phones via horizontal scroll.
 */
export default function ActivityHeatmap({ daily }: ActivityHeatmapProps) {
  const costByDate = new Map(daily.map((d) => [d.date, d.cost]));

  const todayUtc = toUtc(new Date().toISOString().slice(0, 10));
  // Start on the Sunday on/before one year ago so columns are whole weeks.
  const yearAgo = todayUtc - 364 * DAY_MS;
  const startUtc = yearAgo - new Date(yearAgo).getUTCDay() * DAY_MS;
  const totalDays = Math.round((todayUtc - startUtc) / DAY_MS) + 1;
  const weeks = Math.ceil(totalDays / 7);

  // Spend thresholds from the year's nonzero days (quartiles), so the scale
  // adapts to each profile instead of using fixed dollar cutoffs.
  const nonzero = [] as number[];
  for (let i = 0; i < totalDays; i++) {
    const cost = costByDate.get(toIso(startUtc + i * DAY_MS)) ?? 0;
    if (cost > 0) nonzero.push(cost);
  }
  nonzero.sort((a, b) => a - b);
  const q = (p: number) => nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] ?? 0;
  const thresholds = [q(0.25), q(0.5), q(0.75)];
  const level = (cost: number) => {
    if (cost <= 0) return 0;
    if (cost <= thresholds[0]) return 1;
    if (cost <= thresholds[1]) return 2;
    if (cost <= thresholds[2]) return 3;
    return 4;
  };

  // One cell per day in chronological order; grid-flow-col + 7 rows lays them
  // out column-per-week like GitHub's calendar.
  const cells = [] as { date: string; cost: number; level: number }[];
  for (let i = 0; i < weeks * 7; i++) {
    const utc = startUtc + i * DAY_MS;
    const date = toIso(utc);
    const cost = costByDate.get(date) ?? 0;
    cells.push({ date, cost, level: utc > todayUtc ? -1 : level(cost) });
  }

  // Month labels: mark each column whose first day starts a new month.
  const monthLabels = [] as { label: string; week: number }[];
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const month = new Date(startUtc + w * 7 * DAY_MS).getUTCMonth();
    if (month !== prevMonth) {
      // Skip a label crammed into the very last column.
      if (w < weeks - 2) monthLabels.push({ label: MONTHS[month], week: w });
      prevMonth = month;
    }
  }
  // The first column labels a partial month; drop it when the next label is
  // close enough that the two (each spanning 3 columns) would overlap.
  if (monthLabels.length >= 2 && monthLabels[1].week - monthLabels[0].week < 3) {
    monthLabels.shift();
  }

  const activeDays = nonzero.length;
  const weekColumns = `repeat(${weeks}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div
          className="grid gap-[3px] text-[9px] text-muted/70 font-mono mb-1"
          style={{ gridTemplateColumns: `27px ${weekColumns}` }}
        >
          {monthLabels.map(({ label, week }) => (
            <span key={`${label}-${week}`} style={{ gridColumnStart: week + 2, gridColumnEnd: "span 3" }}>
              {label}
            </span>
          ))}
        </div>
        <div
          className="grid grid-flow-col gap-[3px]"
          style={{ gridTemplateColumns: `27px ${weekColumns}`, gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
        >
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={`wd-${i}`} className="text-[9px] text-muted/70 font-mono leading-none self-center">
              {label}
            </span>
          ))}
          {cells.map(({ date, cost, level }) =>
            level < 0 ? (
              <span key={date} className="w-full aspect-square" />
            ) : (
              <span
                key={date}
                title={`${date}: $${formatCurrency(cost)}`}
                className={`w-full aspect-square rounded-[2px] ${LEVEL_CLASSES[level]}`}
              />
            )
          )}
        </div>
        <div className="flex items-center justify-between mt-2 pl-[30px]">
          <span className="text-[11px] text-muted">
            {activeDays} active day{activeDays === 1 ? "" : "s"} in the last year
          </span>
          <div className="flex items-center gap-1 text-[9px] text-muted/70 font-mono">
            <span className="mr-0.5">Less</span>
            {LEVEL_CLASSES.map((cls) => (
              <span key={cls} className={`w-[10px] h-[10px] rounded-[2px] ${cls}`} />
            ))}
            <span className="ml-0.5">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
