"use client";

import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";
import { Calendar, TrendingUp, Zap } from "lucide-react";
import type { TooltipProps } from "@/types/chart";

interface ChartData {
  date: string;
  cost: number;
  tokens: number;
}

interface TokenChartProps {
  data: ChartData[];
  type?: "bar" | "line" | "area";
}

export default function TokenChart({ data, type = "area" }: TokenChartProps) {
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 rounded-lg border border-border shadow-lg">
          <p className="text-sm font-medium flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4" />
            {label}
          </p>
          <p className="text-sm flex items-center gap-2">
            <span className="text-foreground/60">Cost:</span>
            <span className="font-mono font-medium">${payload[0].value.toFixed(2)}</span>
          </p>
          <p className="text-sm flex items-center gap-2">
            <span className="text-foreground/60">Tokens:</span>
            <span className="font-mono">{payload[1]?.value.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const chartComponents = {
    bar: (
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" stroke="var(--foreground)" fontSize={12} />
        <YAxis yAxisId="left" stroke="var(--foreground)" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" stroke="var(--foreground)" fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Bar yAxisId="left" dataKey="cost" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="tokens" fill="var(--accent)" opacity={0.5} radius={[4, 4, 0, 0]} />
      </BarChart>
    ),
    line: (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" stroke="var(--foreground)" fontSize={12} />
        <YAxis yAxisId="left" stroke="var(--foreground)" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" stroke="var(--foreground)" fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="cost"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ fill: "var(--accent)", r: 4 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="tokens"
          stroke="var(--accent)"
          strokeWidth={2}
          opacity={0.5}
          dot={{ fill: "var(--accent)", r: 4 }}
        />
      </LineChart>
    ),
    area: (
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" stroke="var(--foreground)" fontSize={12} />
        <YAxis yAxisId="left" stroke="var(--foreground)" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" stroke="var(--foreground)" fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="cost"
          stroke="var(--accent)"
          fillOpacity={1}
          fill="url(#colorCost)"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="tokens"
          stroke="var(--accent)"
          fillOpacity={1}
          fill="url(#colorTokens)"
        />
      </AreaChart>
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-lg border border-border p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          Usage Trends
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-accent rounded-full" />
            <span className="text-foreground/60">Cost ($)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-accent/50 rounded-full" />
            <span className="text-foreground/60">Tokens</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {chartComponents[type]}
      </ResponsiveContainer>
    </motion.div>
  );
}