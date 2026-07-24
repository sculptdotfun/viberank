"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";

// Categorical palette for the dark surface (#0f0f12), validated with the
// dataviz six-check script (lightness band, chroma floor, CVD separation,
// normal-vision floor, contrast). Hues are assigned to models in fixed
// order of total spend — a model keeps its color across range switches.
const SERIES_COLORS = ["#d95926", "#3987e5", "#199e70", "#c98500", "#d55181", "#9085e9"];
const OTHER_COLOR = "#6e6e78";
const SURFACE = "#0f0f12";

export const OTHER_KEY = "Other";

export interface StackedDay {
  date: string;
  total: number;
  /** Cost per pretty model name; unattributed spend sits under OTHER_KEY. */
  byModel: Record<string, number>;
}

interface UsageChartProps {
  daily: StackedDay[];
  /** Top models by total cost, in fixed color-assignment order (≤ 5). */
  modelKeys: string[];
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => (p.value ?? 0) > 0);
  const total = rows.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 shadow-xl">
      <p className="text-[11px] text-muted mb-1.5">
        {new Date(`${label}T00:00:00Z`).toLocaleDateString("en", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })}
      </p>
      <div className="space-y-1">
        {[...rows].reverse().map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: p.color }} />
              <span className="font-mono truncate max-w-[140px]">{p.name}</span>
            </span>
            <span className="font-mono text-xs">${formatCurrency(p.value ?? 0)}</span>
          </div>
        ))}
      </div>
      {rows.length > 1 && (
        <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-border-subtle">
          <span className="text-xs text-muted">Total</span>
          <span className="font-mono text-xs font-semibold">${formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}

export default function UsageChart({ daily, modelKeys }: UsageChartProps) {
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");

  const data = [...daily]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(range === "7d" ? -7 : range === "30d" ? -30 : 0);

  const rangeTotal = data.reduce((s, d) => s + d.total, 0);
  const hasOther = data.some((d) => (d.byModel[OTHER_KEY] ?? 0) > 0);

  // Series in stack order (bottom→top). With no model splits at all, the
  // whole chart would be one gray "Other" stack — render it as a single
  // accent-colored "Spend" series instead.
  const legacyOnly = modelKeys.length === 0;
  const series = legacyOnly
    ? [{ key: OTHER_KEY, label: "Spend", color: SERIES_COLORS[0] }]
    : [
        ...modelKeys.map((key, i) => ({ key, label: key, color: SERIES_COLORS[i % SERIES_COLORS.length] })),
        ...(hasOther ? [{ key: OTHER_KEY, label: OTHER_KEY, color: OTHER_COLOR }] : []),
      ];

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 sm:p-5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Usage over time
          <span className="hidden sm:inline font-mono text-xs text-muted font-normal">
            ${formatNumber(rangeTotal)} in range
          </span>
        </h2>
        <div className="flex gap-1">
          {(["7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                range === r
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="#26262d" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                stroke="transparent"
                interval="preserveStartEnd"
                minTickGap={28}
                tick={{ fontSize: 10, fill: "#9a9aa5" }}
                tickFormatter={(date: string) =>
                  new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })
                }
              />
              <YAxis
                stroke="transparent"
                width={44}
                tick={{ fontSize: 10, fill: "#9a9aa5" }}
                tickFormatter={(value: number) => `$${formatNumber(value)}`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  name={s.label}
                  stackId="cost"
                  maxBarSize={28}
                  dataKey={(row: StackedDay) => row.byModel[s.key] ?? 0}
                  fill={s.color}
                  // 2px surface gap between stacked segments so adjacent
                  // hues never touch (CVD-safe secondary encoding).
                  stroke={SURFACE}
                  strokeWidth={2}
                  radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {!legacyOnly && series.length > 1 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 px-1">
              {series.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: s.color }} />
                  <span className="font-mono">{s.label}</span>
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-muted text-sm">
          No data for selected time range
        </div>
      )}
    </div>
  );
}
