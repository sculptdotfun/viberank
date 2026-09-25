const { computeWorkInsights, comparableInsights, buildWorkInsightBaselines, percentile } = await import("../src/lib/work-insights.ts");

let passed = 0;
let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
}
function close(name: string, actual: number | null, expected: number) {
  eq(name, actual !== null && Math.abs(actual - expected) < 1e-9, true);
}

const day = (date: string, overrides = {}) => ({
  date, inputTokens: 10, outputTokens: 10, cacheCreationTokens: 10,
  cacheReadTokens: 20, totalTokens: 50, totalCost: 5,
  modelsUsed: ["a"], agents: ["tool-a"], machineCount: 1, ...overrides,
});

console.log("computeWorkInsights");
const empty = computeWorkInsights([]);
eq("empty metrics are null", Object.values(empty).slice(1).every((value) => value === null), true);
const days = [
  day("2026-01-01", { totalCost: 2, agents: ["a", "a", "b"], modelsUsed: ["m1", "m2"], machineCount: 2 }),
  day("2026-01-03", { totalCost: 4, agents: ["a"], modelsUsed: ["m1"], machineCount: 1 }),
  day("2026-01-04", { totalCost: 6, agents: [], modelsUsed: [], machineCount: 3 }),
];
const result = computeWorkInsights(days);
eq("active days use the deduped input, including its gap", result.activeDays, 3);
eq("caller supplies deduped days", computeWorkInsights([days[0], days[0]]).activeDays, 2);
close("cache hit rate", result.cacheHitRate, 0.5);
close("cache reuse", result.cacheReuse, 2);
close("blended cost per million", result.costPerMillionTokens, 80_000);
close("output share", result.outputShare, 0.2);
close("parallel tool share uses distinct agents", result.parallelToolShare, 1 / 3);
close("average tools", result.averageTools, 1);
close("average machines", result.averageMachines, 2);
eq("maximum machines", result.maxMachines, 3);
close("parallel machine share", result.parallelMachineShare, 2 / 3);
close("models per day", result.averageModels, 1);
close("cost variation is population standard deviation / mean", result.costVariation, Math.sqrt(8 / 3) / 4);
close("active days / inclusive calendar span", result.activeDayShare, 3 / 4);
eq("machine metrics hidden for partial history", computeWorkInsights([days[0], day("2026-01-02", { machineCount: undefined })]).averageMachines, null);

const zero = computeWorkInsights([day("2026-01-01", {
  inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
  totalTokens: 0, totalCost: 0,
})]);
eq("zero denominators are null", [zero.cacheHitRate, zero.cacheReuse, zero.costPerMillionTokens, zero.outputShare, zero.costVariation], [null, null, null, null, null]);
eq("zero tools is a defined count", zero.averageTools, 1);
eq("zero reads with positive creation is zero reuse", comparableInsights({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 1, cacheReadTokens: 0, totalTokens: 1, totalCost: 0 }).cacheReuse, 0);

const baseline = buildWorkInsightBaselines([
  { username: "Dev", inputTokens: 10, outputTokens: 10, cacheCreationTokens: 10, cacheReadTokens: 20, totalTokens: 50, totalCost: 60 },
  { username: "dev", inputTokens: 10, outputTokens: 10, cacheCreationTokens: 10, cacheReadTokens: 20, totalTokens: 50, totalCost: 50 },
  { username: "small", inputTokens: 1, outputTokens: 1, cacheCreationTokens: 1, cacheReadTokens: 1, totalTokens: 4, totalCost: 99 },
], 100);
eq("baseline groups usernames before applying $100 floor", baseline.values.cacheHitRate, [0.5]);
eq("baseline uses grouped token and cost totals", baseline.values.costPerMillionTokens, [1_100_000]);
eq("baseline retains an eligible user's value for self-exclusion", baseline.byUser.dev.cacheReuse, 2);

console.log("percentile");
eq("higher best", percentile(4, [1, 2, 4], "higher"), 67);
eq("higher worst", percentile(1, [1, 2, 4], "higher"), 0);
eq("lower best", percentile(1, [1, 2, 4], "lower"), 67);
eq("lower worst", percentile(4, [1, 2, 4], "lower"), 0);
eq("ties are not counted as worse, higher", percentile(2, [1, 2, 2, 4], "higher"), 25);
eq("ties are not counted as worse, lower", percentile(2, [1, 2, 2, 4], "lower"), 25);
eq("higher direction excludes the profile from the cohort", percentile(4, [1, 2, 4], "higher", 4), 100);
eq("lower direction excludes the profile from the cohort", percentile(1, [1, 2, 4], "lower", 1), 100);
eq("single developer has no comparison", percentile(1, [1], "higher", 1), null);
eq("no cohort", percentile(2, [], "higher"), null);
eq("undefined value", percentile(null, [1], "lower"), null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
