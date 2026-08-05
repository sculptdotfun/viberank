"use client";

import { useMemo, useState } from "react";
import { DollarSign, TrendingDown, Users, AlertTriangle } from "lucide-react";
import { comparePlans, coversBurn, percentileOf, PLANS } from "@/lib/plans";
import { formatUsd } from "@/lib/utils";

interface Props {
  /** Ascending monthly burns for everyone on the board. */
  cohort: number[];
  cohortSize: number;
  medianBurn: number;
}

const PRESETS = [
  { label: "Light", burn: 175 },
  { label: "Typical", burn: 1300 },
  { label: "Heavy", burn: 6450 },
];

export default function CalculatorClient({ cohort, cohortSize, medianBurn }: Props) {
  const [raw, setRaw] = useState("");

  const burn = useMemo(() => {
    const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [raw]);

  const verdict = useMemo(() => comparePlans(burn), [burn]);
  const percentile = useMemo(() => percentileOf(cohort, burn), [cohort, burn]);

  const hasInput = burn > 0;
  const saves = verdict.savingVsApi > 0;

  return (
    <div className="space-y-8">
      {/* Input */}
      <div className="bg-surface-1 border border-border rounded-lg p-5 sm:p-6">
        <label htmlFor="burn" className="block micro-label mb-2">
          Your monthly API-equivalent spend
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-xl font-mono">
            $
          </span>
          <input
            id="burn"
            inputMode="decimal"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder="1,300"
            className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-3 text-2xl font-mono
                       focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-muted mr-1">Try:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setRaw(String(preset.burn))}
              className="text-xs px-2.5 py-1 rounded border border-border hover:border-accent
                         hover:text-accent transition-colors"
            >
              {preset.label} · ${preset.burn.toLocaleString()}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted mt-4 leading-relaxed">
          Run <code className="text-accent">npx ccusage@latest --json</code> and use the{" "}
          <code className="text-accent">totalCost</code> for a month. That figure is what your
          usage <em>would</em> cost at API list prices — not what you actually paid.
        </p>
      </div>

      {!hasInput ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-muted text-sm">
            Enter a number above to see which plan fits and where you rank.
          </p>
        </div>
      ) : (
        <>
          {/* Verdict */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-surface-1 border border-border rounded-lg p-4">
              <p className="flex items-center gap-1.5 micro-label mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                Cheapest plan
              </p>
              <p className="text-xl font-bold">{verdict.recommended.name}</p>
              <p className="text-xs text-muted mt-1">
                ${verdict.recommended.monthly}/mo · {verdict.recommended.blurb}
              </p>
            </div>

            <div
              className={`border rounded-lg p-4 ${
                saves ? "bg-accent-soft border-accent/40" : "bg-surface-1 border-border"
              }`}
            >
              <p className="flex items-center gap-1.5 micro-label mb-1">
                <TrendingDown className="w-3.5 h-3.5" />
                {saves ? "You save" : "API is cheaper"}
              </p>
              <p className={`text-xl font-bold font-mono ${saves ? "text-accent" : ""}`}>
                {formatUsd(Math.abs(verdict.savingVsApi))}
                <span className="text-sm font-sans text-muted">/mo</span>
              </p>
              <p className="text-xs text-muted mt-1">
                {saves
                  ? `the plan pays for itself ${verdict.multiple.toFixed(1)}× over`
                  : "your usage is below the price of a subscription"}
              </p>
            </div>

            <div className="bg-surface-1 border border-border rounded-lg p-4">
              <p className="flex items-center gap-1.5 micro-label mb-1">
                <Users className="w-3.5 h-3.5" />
                Your percentile
              </p>
              <p className="text-xl font-bold font-mono">
                p{percentile}
              </p>
              <p className="text-xs text-muted mt-1">
                of {cohortSize.toLocaleString()} developers on viberank
              </p>
            </div>
          </div>

          {/* Honest caveat where it actually matters */}
          {verdict.exceedsTopPlan && (
            <div className="flex gap-3 border border-border rounded-lg p-4 bg-surface-1">
              <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-sm text-muted leading-relaxed">
                At {formatUsd(burn)}/month of API-equivalent usage you are well past what a
                single Max 20x seat is sized for. The saving above is real arithmetic, but you
                should expect to hit usage limits — plan on multiple seats, or a mix of
                subscription and API.
              </p>
            </div>
          )}

          {/* Plan ladder */}
          <div>
            <p className="micro-label mb-3">Every plan at your usage</p>
            <div className="border border-border rounded-lg overflow-hidden">
              {PLANS.map((plan) => {
                const delta = burn - plan.monthly;
                const isPick = plan.id === verdict.recommended.id;
                // A cheaper plan always looks like the bigger saving on price
                // alone. Say plainly when it can't carry the usage, or the
                // table recommends against itself.
                const covers = coversBurn(plan, burn);
                return (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between gap-4 px-4 py-3 border-b border-border last:border-b-0 ${
                      isPick ? "bg-accent-soft" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        <span className={covers ? "" : "text-muted"}>{plan.name}</span>
                        {isPick && <span className="text-accent text-xs ml-2">← your pick</span>}
                      </p>
                      <p className="text-xs text-muted">${plan.monthly}/mo</p>
                    </div>
                    {covers ? (
                      <p
                        className={`font-mono text-sm shrink-0 ${
                          delta > 0 ? "text-accent" : "text-muted"
                        }`}
                      >
                        {delta > 0 ? "saves " : "costs "}
                        {formatUsd(Math.abs(delta))}
                      </p>
                    ) : (
                      <p className="text-xs text-muted shrink-0 text-right">
                        too small for
                        <br />
                        your usage
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-2">
              Plans below your usage tier are priced lower but would rate-limit you, so no saving
              is shown for them.
            </p>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Compared against the median viberank developer, who burns{" "}
            <span className="text-foreground font-mono">{formatUsd(medianBurn)}</span>/month in
            API-equivalent cost.
          </p>
        </>
      )}
    </div>
  );
}
