import Link from "next/link";
import { Scale } from "lucide-react";
import { formatNumber, formatUsd, toolLabel } from "@/lib/utils";
import { findToolPlans, formatMultiple, type MoneyVsValue as Summary } from "@/lib/money";

/**
 * Money vs value: the profile's API-equivalent total next to what the owner
 * actually paid.
 *
 * Declared and pay-as-you-go figures are the owner's own statements priced
 * from plans.ts. When there are none, the estimate stands in, and it is
 * styled to never pass for a measurement: muted, prefixed with "~", tagged
 * "Estimated", and it never produces a subsidy multiple.
 */
export default function MoneyVsValue({
  summary,
  usedTools,
}: {
  summary: Summary;
  /** Tools with recorded days, to say when value covers more than the declared plans. */
  usedTools: string[];
}) {
  const { value, declared, estimate, payAsYouGo, payAsYouGoTotal, multiple, range } = summary;
  const declaredTools = new Set(declared?.lines.map((line) => line.tool) ?? []);
  const undeclaredTools = declared ? usedTools.filter((tool) => !declaredTools.has(tool)) : [];
  const monthsOverTop = estimate?.lines.reduce((sum, line) => sum + line.monthsOverTopPlan, 0) ?? 0;
  // Two different reasons a tool goes unpriced, and they read differently.
  const unpriced = estimate?.unpricedTools ?? [];
  const noTiers = unpriced.filter((tool) => findToolPlans(tool));
  const noPrices = unpriced.filter((tool) => !findToolPlans(tool));
  const describe = (tool: string) => (tool === "unattributed" ? "days with no recorded tool" : toolLabel(tool));

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-medium flex items-center gap-2">
          <Scale className="w-4 h-4 text-accent" />
          Money vs value
        </h2>
        {range && (
          <span className="micro-label">
            {range.start} → {range.end}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-lg bg-background border border-border-subtle p-4">
          <p className="micro-label mb-1">API-equivalent value, not money spent</p>
          <p className="text-xl font-bold font-mono text-accent">${formatNumber(value)}</p>
          <p className="text-xs text-muted mt-1">What these tokens would cost at list API prices.</p>
        </div>

        {declared ? (
          <div className="rounded-lg bg-background border border-border-subtle p-4">
            <p className="micro-label mb-1">Declared subscriptions</p>
            <p className="text-xl font-bold font-mono">{formatUsd(declared.total)}</p>
            <ul className="text-xs text-muted mt-1 space-y-0.5">
              {declared.lines.map((line, i) => (
                <li key={line.id ?? i} className="font-mono">
                  {line.planName ?? `${toolLabel(line.tool)} ${line.planId} (unlisted, $0)`}
                  {` · ${line.months} mo × $${line.monthly}`}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          estimate && (
            <div className="rounded-lg bg-background border border-dashed border-border p-4">
              <p className="micro-label mb-1 flex items-center gap-1.5">
                Estimated subscription cost
                <span className="px-1.5 py-0.5 rounded bg-surface-3 text-[9px] tracking-[0.1em]">Estimated</span>
              </p>
              {estimate.lines.length > 0 ? (
                <>
                  <p className="text-xl font-bold font-mono text-muted">~{formatUsd(estimate.total)}</p>
                  <ul className="text-xs text-muted mt-1 space-y-0.5">
                    {estimate.lines.flatMap((line) =>
                      Object.entries(line.plans).map(([plan, months]) => (
                        <li key={`${line.tool}-${plan}`} className="font-mono">
                          {plan} · {months} mo
                        </li>
                      ))
                    )}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted">No usage here matches a plan with published prices.</p>
              )}
              <p className="text-[11px] text-muted/70 mt-2">
                Estimated: nothing declared, so this is the cheapest plan sized for each month&apos;s usage, at list
                prices. Not what the owner paid.
              </p>
            </div>
          )
        )}

        {payAsYouGo.length > 0 && (
          <div className="rounded-lg bg-background border border-border-subtle p-4">
            <p className="micro-label mb-1">Pay-as-you-go spend</p>
            <p className="text-xl font-bold font-mono">{formatUsd(payAsYouGoTotal)}</p>
            <ul className="text-xs text-muted mt-1 space-y-0.5">
              {payAsYouGo.map((p) => (
                <li key={p.source} className="font-mono">
                  {p.source} · {formatUsd(p.amount)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {multiple !== null && (
          <div className="rounded-lg bg-background border border-border-subtle p-4">
            <p className="micro-label mb-1">Subsidy multiple</p>
            <p className="text-xl font-bold font-mono text-accent">{formatMultiple(multiple)}×</p>
            <p className="text-xs text-muted mt-1">
              Every $1 paid bought ${formatMultiple(multiple)} of API-equivalent usage.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-muted/70">
        {declared && (
          <p>
            Declared plans are counted in whole months: a plan held for any part of a calendar month counts as that
            month, within this profile&apos;s recorded range.
          </p>
        )}
        {undeclaredTools.length > 0 && (
          <p>
            Value includes {undeclaredTools.map(describe).join(", ")}, with no declared plan
            {multiple !== null ? ", so the multiple overstates the subsidy" : ""}.
          </p>
        )}
        {noPrices.length > 0 && (
          <p>Not estimated, no plan prices on file: {noPrices.map(describe).join(", ")}.</p>
        )}
        {noTiers.length > 0 && (
          <p>
            Not estimated, the vendor publishes no usage tiers to size a plan against:{" "}
            {noTiers.map(describe).join(", ")}.
          </p>
        )}
        {monthsOverTop > 0 && (
          <p>
            {monthsOverTop} month{monthsOverTop === 1 ? "" : "s"} used more than the largest plan is sized for, so
            the real bill was likely higher than this estimate.
          </p>
        )}
        {!declared && (
          <p>
            Is this you?{" "}
            <Link href="/settings/submissions" className="text-accent hover:underline">
              Declare what you pay
            </Link>{" "}
            to show real spend instead of an estimate.
          </p>
        )}
      </div>
    </div>
  );
}
