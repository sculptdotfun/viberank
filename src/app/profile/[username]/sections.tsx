// The profile's slower reads, each streamed in its own Suspense boundary so
// the header, all-time stats and charts paint without waiting for them.
import { Gauge } from "lucide-react";
import ThisWeek from "@/components/v2/share/ThisWeek";
import { loadStanding } from "@/components/v2/share/load";
import { formatCurrency } from "@/lib/utils";
import { percentile, type ComparableMetric, type WorkInsights } from "@/lib/work-insights";
import { getWorkInsightBaselinesCached } from "@/lib/work-insight-baselines";

/** This week's standing. A failed read says so instead of claiming no usage. */
export async function ThisWeekSection({ username }: { username: string }) {
  try {
    return <ThisWeek username={username} standing={await loadStanding(username)} />;
  } catch (err) {
    console.error(`profile: standing for ${username} failed`, err);
    return <ThisWeek username={username} standing={null} failed />;
  }
}

type Baselines = Awaited<ReturnType<typeof getWorkInsightBaselinesCached>>;

function tilesFor(insights: WorkInsights, username: string, baselines: Baselines | null) {
  const comparison = (metric: ComparableMetric) => {
    const values = baselines?.values[metric];
    const ownValue = baselines?.byUser[username.toLowerCase()]?.[metric] ?? null;
    const lower = metric === "costPerMillionTokens";
    const rank = values ? percentile(insights[metric], values, lower ? "lower" : "higher", ownValue) : null;
    return rank === null ? null : `${lower ? "Lower" : "Higher"} than ${rank}% of developers`;
  };
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const decimal = (value: number) => value.toFixed(1);
  return [
    { label: "cache hit rate", value: insights.cacheHitRate === null ? null : pct(insights.cacheHitRate), detail: "Input served from cache", comparison: comparison("cacheHitRate") },
    { label: "cache reuse", value: insights.cacheReuse === null ? null : `${decimal(insights.cacheReuse)}×`, detail: "Reads per cached token", comparison: comparison("cacheReuse") },
    { label: "cost per 1M tokens", value: insights.costPerMillionTokens === null ? null : `$${formatCurrency(insights.costPerMillionTokens)}`, detail: "Blended cost across all tokens", comparison: comparison("costPerMillionTokens") },
    { label: "output share", value: insights.outputShare === null ? null : pct(insights.outputShare), detail: "Tokens generated as output", comparison: comparison("outputShare") },
    { label: "parallel tools", value: insights.parallelToolShare === null ? null : pct(insights.parallelToolShare), detail: `Days with 2+ tools · ${decimal(insights.averageTools ?? 0)} avg/day`, comparison: null },
    { label: "parallel machines", value: insights.parallelMachineShare === null ? null : pct(insights.parallelMachineShare), detail: `Days with 2+ machines · ${decimal(insights.averageMachines ?? 0)} avg, ${insights.maxMachines} max`, comparison: null },
    { label: "models per active day", value: insights.averageModels === null ? null : decimal(insights.averageModels), detail: "Distinct models used each day", comparison: null },
    { label: "daily cost variation", value: insights.costVariation === null ? null : decimal(insights.costVariation), detail: "Coefficient of variation; lower is steadier", comparison: null },
    { label: "active days in span", value: insights.activeDayShare === null ? null : pct(insights.activeDayShare), detail: "First to last active day", comparison: null },
  ].filter((tile) => tile.value !== null);
}

/** The Workflow tiles. Rendered without comparisons first, then with them. */
export function WorkflowTiles({ insights, username, baselines }: { insights: WorkInsights; username: string; baselines: Baselines | null }) {
  const tiles = tilesFor(insights, username, baselines);
  if (insights.activeDays < 3 || tiles.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="work-insights-heading">
      <h2 id="work-insights-heading" className="text-[15px] font-medium text-ink mb-3 flex items-center gap-2">
        <Gauge className="w-4 h-4 text-ink-3" aria-hidden />
        Workflow
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border border-line rounded-[14px] bg-panel overflow-hidden">
        {tiles.map((tile) => (
          <div key={tile.label} className="p-4 border-line border-r border-b -mr-px -mb-px min-w-0">
            <p className="font-mono text-xs text-ink-3 m-0">{tile.label}</p>
            <p className="font-mono text-xl font-medium tracking-[-0.03em] text-ink mt-1.5 mb-0 break-words">{tile.value}</p>
            <p className="text-xs text-ink-2 mt-1 mb-0">{tile.detail}</p>
            {tile.comparison ? (
              <p className="font-mono text-[11.5px] text-ink-3 mt-1.5 mb-0">{tile.comparison}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export async function WorkflowSection({ insights, username }: { insights: WorkInsights; username: string }) {
  const baselines = insights.activeDays >= 3 ? await getWorkInsightBaselinesCached().catch(() => null) : null;
  return <WorkflowTiles insights={insights} username={username} baselines={baselines} />;
}
