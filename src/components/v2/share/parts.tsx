// Small server-rendered pieces shared by the week card, Wrapped and the
// profile block: avatar tile, Mon–Sun bars, model mix, stat row.
import { DAY_INITIALS, barHeights, modelSlices, pct, type V2Vendor } from "./format";
import { formatUsd } from "@/lib/utils";

export function Avatar({ username, url, size = 24 }: { username: string; url?: string; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- GitHub CDN avatar, already sized.
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-md flex-none bg-raised"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="rounded-md flex-none grid place-items-center bg-h4 text-bg font-mono font-medium"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Seven bars, Monday first. `today` (1–7) marks a live week: days after it
 * have not happened yet and are drawn as empty outlines, not as zero.
 */
export function WeekBars({
  days,
  today,
  height = 84,
  barWidth = 22,
  fluid = false,
}: {
  days: number[];
  today?: number;
  height?: number;
  barWidth?: number;
  fluid?: boolean;
}) {
  const heights = barHeights(days);
  return (
    <div
      className="grid items-end gap-x-1.5 gap-y-[5px]"
      style={{
        gridTemplateColumns: `repeat(7, ${fluid ? "minmax(0, 1fr)" : `${barWidth}px`})`,
        gridTemplateRows: `${height}px auto`,
      }}
      role="img"
      aria-label={`Usage by day, Monday to Sunday: ${days.map((d) => formatUsd(d)).join(", ")}`}
    >
      {heights.map((h, i) => {
        const future = today !== undefined && i + 1 > today;
        const zero = (days[i] ?? 0) <= 0;
        return (
          <i
            key={i}
            className={`block rounded-[2px] ${future ? "border border-dashed border-line-2" : zero ? "bg-h0" : "bg-h3"}`}
            style={{ height: future ? "100%" : `${h}%` }}
            title={future ? undefined : formatUsd(days[i] ?? 0)}
          />
        );
      })}
      {DAY_INITIALS.map((d, i) => (
        <span
          key={`l${i}`}
          className={`text-center font-mono text-[11px] ${today === i + 1 ? "text-ink" : "text-ink-3"}`}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

const VENDOR_BG: Record<V2Vendor, string> = {
  anthropic: "bg-v-anthropic",
  openai: "bg-v-openai",
  google: "bg-v-google",
  open: "bg-v-open",
};

export function ModelMix({ models, named = 2 }: { models: { model: string; share: number }[]; named?: number }) {
  const slices = modelSlices(models, named);
  if (slices.length === 0) return null;
  return (
    <div>
      <div className="flex h-2 rounded-[2px] overflow-hidden gap-0.5">
        {slices.map((s) => (
          <i key={s.label} className={`block ${VENDOR_BG[s.vendor]}`} style={{ flex: Math.max(1, Math.round(s.share * 100)) }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 font-mono text-xs text-ink-3">
        {slices.map((s) => (
          <span key={s.label} className="inline-flex items-center">
            <i className={`inline-block w-[7px] h-[7px] rounded-[1.5px] mr-1.5 ${VENDOR_BG[s.vendor]}`} />
            {s.label} {pct(s.share)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StatRow({ items, cols = 4 }: { items: { value: string; label: string }[]; cols?: 2 | 3 | 4 }) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[cols];
  return (
    <div className={`grid ${grid} gap-3 border-t border-line pt-[18px]`}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <b className="block font-mono text-xl font-medium tracking-[-0.03em] text-ink">{it.value}</b>
          <span className="block font-mono text-xs text-ink-3 mt-[5px]">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[12.5px] text-ink-3 m-0">{children}</p>;
}
