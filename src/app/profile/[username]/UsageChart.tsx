"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DailyPoint = { date: string; cost: number; tokens: number };

export default function UsageChart({ daily }: { daily: DailyPoint[] }) {
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");

  const data = [...daily]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(range === "7d" ? -7 : range === "30d" ? -30 : 0);

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Usage over time
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
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262d" strokeOpacity={0.6} />
            <XAxis
              dataKey="date"
              stroke="#9a9aa5"
              tick={{ fontSize: 11, fill: "#9a9aa5" }}
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              stroke="#9a9aa5"
              tick={{ fontSize: 11, fill: "#9a9aa5" }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#16161a",
                border: "1px solid #26262d",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]}
              labelFormatter={(date) =>
                new Date(date).toLocaleDateString("en", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              }
            />
            {/* Flat fill (solid colour at low opacity — no gradient) */}
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#f97316"
              strokeWidth={2}
              fill="#f97316"
              fillOpacity={0.12}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-muted text-sm">
          No data for selected time range
        </div>
      )}
    </div>
  );
}
