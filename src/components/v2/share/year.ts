// The year heatmap's grid, shared by the Wrapped page and its OG image:
// one column per ISO week, Monday on top, levels 0–4 from the year's own
// quartiles so the scale fits each person.

const DAY = 86_400_000;

export interface YearCell {
  date: string;
  cost: number;
  /** 0–4 heat level; -1 for days outside the year, -2 for days not yet reached. */
  level: number;
}

function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function yearGrid(dailyCost: [string, number][], year: number, today: string = iso(Date.now())): YearCell[][] {
  const cost = new Map(dailyCost);
  const jan1 = Date.UTC(year, 0, 1);
  const dec31 = Date.UTC(year, 11, 31);
  const start = jan1 - ((new Date(jan1).getUTCDay() + 6) % 7) * DAY;
  const last = Math.min(dec31, Date.parse(`${today}T00:00:00Z`));

  const nonzero = dailyCost.map(([, c]) => c).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p: number) => nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] ?? 0;
  const [t1, t2, t3] = [q(0.25), q(0.5), q(0.75)];
  const level = (c: number) => (c <= 0 ? 0 : c <= t1 ? 1 : c <= t2 ? 2 : c <= t3 ? 3 : 4);

  const weeks: YearCell[][] = [];
  for (let w = start; w <= dec31; w += 7 * DAY) {
    const col: YearCell[] = [];
    for (let d = 0; d < 7; d++) {
      const t = w + d * DAY;
      const date = iso(t);
      const c = cost.get(date) ?? 0;
      col.push({ date, cost: c, level: t < jan1 || t > dec31 ? -1 : t > last ? -2 : level(c) });
    }
    weeks.push(col);
  }
  return weeks;
}

/** Column index where each month starts, for labels above the grid. */
export function monthStarts(weeks: YearCell[][], year: number): { month: number; week: number }[] {
  const out: { month: number; week: number }[] = [];
  weeks.forEach((col, w) => {
    const first = col.find((c) => c.date.startsWith(`${year}-`) && c.date.endsWith("-01"));
    if (first) out.push({ month: Number(first.date.slice(5, 7)) - 1, week: w });
  });
  return out;
}

/** "2026-11-25" → whether the year is still running on that day. */
export function yearInProgress(year: number, today: string = iso(Date.now())): boolean {
  return today < `${year}-12-31`;
}
