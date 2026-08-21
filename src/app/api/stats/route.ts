import { NextResponse } from "next/server";
import { getServerDataLayer } from "@/lib/data";
import { buildCostBenchmark, headlineClaim, CAVEATS, ANTHROPIC_PUBLISHED_RANGE } from "@/lib/cost-benchmark";

/**
 * Public, free, unauthenticated stats endpoint.
 *
 * Every page ranking for "how much does Claude Code cost" republishes
 * Anthropic's own figure, because it's the only number anyone can easily cite.
 * This exists to be a better one to reach for: no key, no rate limit worth
 * mentioning, CORS open, and a `citation` field so whoever lifts it has the
 * attribution line already written.
 *
 * Hourly cache. The numbers move slowly and being hammered is the point.
 */
export const revalidate = 3600;

const SITE = "https://www.viberank.app";

function corsJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      // Public data behind a CDN: serve stale rather than fail while revalidating.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export function OPTIONS() {
  return corsJson({}, 204);
}

export async function GET() {
  try {
    const dataLayer = await getServerDataLayer();
    const [site, spendRows] = await Promise.all([
      dataLayer.stats.getSiteStats(),
      dataLayer.stats.getSpendRows(),
    ]);

    // getSiteStats resolves null when the aggregate RPC is unavailable; a
    // public endpoint should say so plainly rather than emit nulls.
    if (!site) return corsJson({ error: "stats temporarily unavailable" }, 503);

    const benchmark = buildCostBenchmark(spendRows);

    return corsJson({
      meta: {
        source: "Viberank",
        url: SITE,
        endpoint: `${SITE}/api/stats`,
        documentation: `${SITE}/data`,
        license: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        citation: `Viberank, "AI coding usage data", ${SITE}/data (accessed ${new Date().toISOString().slice(0, 10)})`,
        generatedAt: new Date().toISOString(),
        methodology:
          "Developers submit token counts and API-equivalent USD costs computed by ccusage from local session logs. Submissions are validated server-side. Cost is what the usage would cost at model list prices, not amounts billed.",
        caveats: CAVEATS,
      },

      totals: {
        developers: site.totalUsers,
        submissions: site.totalSubmissions,
        apiEquivalentCostUsd: site.totalCost,
        tokens: site.totalTokens,
        inputTokens: site.inputTokens,
        outputTokens: site.outputTokens,
        cacheReadTokens: site.cacheReadTokens,
        cacheCreationTokens: site.cacheCreationTokens,
        cacheReadShare: site.totalTokens > 0 ? site.cacheReadTokens / site.totalTokens : 0,
        firstDate: site.firstDate,
        lastDate: site.lastDate,
        activeDays: site.activeDays,
      },

      // The headline asset: the distribution nobody else publishes.
      monthlySpendPerDeveloper: {
        unit: "USD per developer per month, API-equivalent",
        cohortSize: benchmark.cohortSize,
        median: benchmark.medianMonthlyUsd,
        mean: benchmark.meanMonthlyUsd,
        percentiles: Object.fromEntries(
          benchmark.percentiles.map((entry) => [`p${entry.p}`, entry.monthlyUsd])
        ),
        shareAbove: Object.fromEntries(
          benchmark.sharesAbove.map((entry) => [`usd${entry.thresholdUsd}`, entry.share])
        ),
        topDecileShareOfSpend: benchmark.topDecileShareOfSpend,
        comparison: {
          anthropicPublishedRangeUsdPerMonth: [
            ANTHROPIC_PUBLISHED_RANGE.low,
            ANTHROPIC_PUBLISHED_RANGE.high,
          ],
          claim: headlineClaim(benchmark),
        },
      },

      tools: site.tools,
      models: site.models,
      modelSpend: site.modelSpend,
      monthly: site.monthly ?? [],
      tiers: site.tiers ?? [],
    });
  } catch {
    return corsJson({ error: "stats temporarily unavailable" }, 503);
  }
}
