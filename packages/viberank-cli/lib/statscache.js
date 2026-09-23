// Rebuild Claude Code usage that ccusage can no longer see (#138).
//
// Claude Code deletes transcripts after `cleanupPeriodDays`, but its /stats
// counter (~/.claude/stats-cache.json) keeps lifetime per-model totals and
// per-day totals for recent days. Two kinds of day can therefore be estimated:
// days the counter still itemises whose transcripts are gone (exact per day),
// and the window before it itemised anything (the lifetime total minus every
// itemised day, spread over those days by Claude Code's own message count).
//
// The counter sums `usage` from every transcript line of an assistant message,
// and Claude Code writes one line per content block, so a thinking+text+
// tool_use turn is counted three times; ccusage deduplicates by message id. The
// ratio is measured here, per machine, per model and per token type, on days
// where the counter can be reproduced from transcripts to the token, and
// divided out. Days after the counter started itemising that it nonetheless
// skipped are subtracted at their reproduced value where a transcript
// survives, since ccusage measured those.
//
// It is still an allocation: the window's per-day split follows message
// counts, not tokens. Everything built here is submitted flagged `estimated`:
// it counts on the board, stays out of the monthly reports, and the server
// drops it on any day where Claude usage was measured.

import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

export const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

/** Days reproduced to the token before the duplication factor is trusted. */
export const MIN_FACTOR_DAYS = 5;

const FIELDS = [
  ['inputTokens', 'inputTokens', 'input_cost_per_token'],
  ['outputTokens', 'outputTokens', 'output_cost_per_token'],
  ['cacheReadInputTokens', 'cacheReadTokens', 'cache_read_input_token_cost'],
  ['cacheCreationInputTokens', 'cacheCreationTokens', 'cache_creation_input_token_cost'],
];

const USAGE_KEYS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];

/** Claude Code's config dir, as Claude Code itself resolves it. */
export function claudeConfigDir(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

export function readStatsCache(dir) {
  const file = path.join(dir, 'stats-cache.json');
  const cache = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!cache || typeof cache.modelUsage !== 'object' || !Array.isArray(cache.dailyModelTokens)) {
    throw new Error(`${file} has no modelUsage/dailyModelTokens — this Claude Code version's counter isn't supported`);
  }
  return cache;
}

/**
 * The transcripts the counter reads: `projects/<project>/*.jsonl` and
 * `projects/<project>/<session>/subagents/agent-*.jsonl`. Deeper files (for
 * example workflow subagents) are not part of the counter, so they are not
 * part of the comparison either.
 */
export function counterFiles(dir) {
  const projects = path.join(dir, 'projects');
  const files = [];
  if (!fs.existsSync(projects)) return files;
  for (const project of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(projects, project.name);
    for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
      const full = path.join(projectDir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(full);
      } else if (entry.isDirectory()) {
        const subagents = path.join(full, 'subagents');
        if (!fs.existsSync(subagents)) continue;
        for (const name of fs.readdirSync(subagents)) {
          if (name.startsWith('agent-') && name.endsWith('.jsonl')) files.push(path.join(subagents, name));
        }
      }
    }
  }
  return files;
}

const ZERO = [0, 0, 0, 0];
const vecTotal = (vec) => vec.reduce((a, b) => a + b, 0);
const dayTotal = (byModel) => [...(byModel?.values() ?? [])].reduce((sum, vec) => sum + vecTotal(vec), 0);

function addInto(acc, vec) {
  vec.forEach((v, i) => { acc[i] += v; });
}

function add(map, key, model, vec) {
  const byModel = map.get(key) ?? new Map();
  const acc = byModel.get(model) ?? [0, 0, 0, 0];
  addInto(acc, vec);
  byModel.set(model, acc);
  map.set(key, byModel);
}

/**
 * Per UTC day and model, per token type (input, output, cache read, cache
 * write): tokens as the counter adds them (every line) and as ccusage does
 * (once per message id + request id), plus the first day any transcript has
 * usage on.
 */
export async function scanTranscripts(files) {
  const perLine = new Map();
  const dedup = new Map();
  const seen = new Set();
  let firstDate = null;

  for (const file of files) {
    const isSubagent = file.includes(`${path.sep}subagents${path.sep}`);
    const lines = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.includes('"usage"')) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry?.type !== 'assistant') continue;
      if (!isSubagent && entry.isSidechain) continue;
      const message = entry.message;
      const usage = message?.usage;
      if (!usage) continue;
      const model = message.model || 'unknown';
      if (model === '<synthetic>') continue;
      const date = utcDate(entry.timestamp);
      if (!date) continue;

      const vec = USAGE_KEYS.map((key) => usage[key] || 0);
      if (vecTotal(vec) <= 0) continue;
      if (!firstDate || date < firstDate) firstDate = date;
      add(perLine, date, model, vec);

      const id = (message.id || entry.requestId) ? `${message.id}|${entry.requestId}` : `uuid|${entry.uuid}`;
      if (seen.has(id)) continue;
      seen.add(id);
      add(dedup, date, model, vec);
    }
  }

  return { perLine, dedup, firstDate };
}

function utcDate(timestamp) {
  const ms = Date.parse(timestamp ?? '');
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

/**
 * counter ÷ ccusage on the same transcripts, measured only on days where the
 * counter's itemised total is reproduced exactly — a day whose transcript was
 * rewritten or deleted since would skew the ratio in either direction.
 *
 * The ratio is kept per token type, because a message with more content blocks
 * (tool calls, thinking) tends to carry more output and cache writes, so those
 * are duplicated more than cache reads. It is also kept per model wherever
 * that model appears on enough reproduced days; other models fall back to the
 * pooled ratios.
 */
export function measureFactor(cache, scan) {
  const days = [];
  const pooled = { counter: [0, 0, 0, 0], deduped: [0, 0, 0, 0] };
  const models = new Map();
  for (const day of cache.dailyModelTokens) {
    const itemised = Object.values(day.tokensByModel ?? {}).reduce((a, b) => a + b, 0);
    const lines = scan.perLine.get(day.date);
    if (itemised <= 0 || dayTotal(lines) !== itemised) continue;
    days.push(day.date);
    for (const [model, vec] of lines) {
      const deduped = scan.dedup.get(day.date)?.get(model) ?? ZERO;
      const m = models.get(model) ?? { counter: [0, 0, 0, 0], deduped: [0, 0, 0, 0], days: 0 };
      addInto(m.counter, vec);
      addInto(m.deduped, deduped);
      addInto(pooled.counter, vec);
      addInto(pooled.deduped, deduped);
      m.days += 1;
      models.set(model, m);
    }
  }
  if (days.length < MIN_FACTOR_DAYS) {
    throw new Error(
      `the counter could be reproduced on only ${days.length} day(s) (need ${MIN_FACTOR_DAYS}), so its duplication factor can't be measured on this machine`
    );
  }
  const factor = vecTotal(pooled.counter) / vecTotal(pooled.deduped);
  if (!(factor >= 1)) throw new Error(`measured factor ${factor.toFixed(3)} is below 1 — the counter can't count less than ccusage`);

  const ratios = (acc, fallback) =>
    acc.counter.map((c, i) => (acc.deduped[i] > 0 && c >= acc.deduped[i] ? c / acc.deduped[i] : fallback[i]));
  const pooledByType = ratios(pooled, [factor, factor, factor, factor]);
  const byModel = {};
  for (const [model, m] of models) {
    if (m.days >= MIN_FACTOR_DAYS) byModel[model] = ratios(m, pooledByType);
  }
  return { factor, pooled: pooledByType, byModel, days };
}

/**
 * The estimate, in raw counter tokens per day and model first:
 *
 * - the window before the first itemised day or transcript: what no itemised
 *   day accounts for, spread over the window's days by message count;
 * - days the counter itemises whose transcripts are gone: exactly as itemised.
 *
 * Each model is then split into token types by its lifetime mix, divided by
 * that model's per-type factor, and priced from LiteLLM (the table ccusage
 * prices with).
 */
export function buildBackfill(cache, scan, { factor, pooled, byModel, days: factorDays }, pricing) {
  const itemisedDates = new Set(cache.dailyModelTokens.map((d) => d.date));
  const itemisedStart = [...itemisedDates].sort()[0];
  const windowEnd = [itemisedStart, scan.firstDate].filter(Boolean).sort()[0];
  if (!windowEnd) throw new Error('no itemised counter days and no transcripts — nothing to anchor the window to');

  // Raw counter tokens per model that no itemised day accounts for.
  const unitemised = new Map();
  for (const [model, usage] of Object.entries(cache.modelUsage)) {
    unitemised.set(model, FIELDS.reduce((sum, [key]) => sum + (usage[key] || 0), 0));
  }
  for (const day of cache.dailyModelTokens) {
    for (const [model, tokens] of Object.entries(day.tokensByModel ?? {})) {
      unitemised.set(model, (unitemised.get(model) ?? 0) - tokens);
    }
  }
  // Active days after the window that the counter skipped. Where a transcript
  // survives, ccusage already measured the day, so take out what the counter
  // would have added for it. Where none does, the day is as invisible to
  // ccusage as the window itself, so it joins the window.
  const skipped = (cache.dailyActivity ?? []).filter(
    (d) => d.date >= windowEnd && d.messageCount > 0 && !itemisedDates.has(d.date)
  );
  for (const day of skipped) {
    for (const [model, vec] of scan.perLine.get(day.date) ?? []) {
      unitemised.set(model, (unitemised.get(model) ?? 0) - vecTotal(vec));
    }
  }

  const raw = new Map(); // date -> Map(model -> raw counter tokens)
  const place = (date, model, tokens) => {
    const byModel = raw.get(date) ?? new Map();
    byModel.set(model, (byModel.get(model) ?? 0) + tokens);
    raw.set(date, byModel);
  };

  const windowDays = (cache.dailyActivity ?? []).filter(
    (d) => d.messageCount > 0 && (d.date < windowEnd || (skipped.includes(d) && !scan.perLine.has(d.date)))
  );
  const messages = windowDays.reduce((sum, d) => sum + d.messageCount, 0);
  if (messages > 0) {
    for (const day of windowDays) {
      for (const [model, tokens] of unitemised) {
        if (tokens > 0) place(day.date, model, tokens * (day.messageCount / messages));
      }
    }
  }

  // Itemised to the token, but no transcript left for ccusage to read.
  const lost = cache.dailyModelTokens.filter((d) => !scan.perLine.has(d.date));
  for (const day of lost) {
    for (const [model, tokens] of Object.entries(day.tokensByModel ?? {})) {
      if (tokens > 0) place(day.date, model, tokens);
    }
  }

  const unpriced = new Set();
  const leftOut = new Set();
  let counterTokens = 0;
  const daily = [...raw.keys()].sort().map((date) => {
    const modelBreakdowns = [];
    for (const [model, tokens] of raw.get(date)) {
      counterTokens += tokens;
      // The server accepts an estimate for Claude models only, by name, so a
      // Bedrock id or a non-Anthropic model behind a base URL is left out
      // rather than getting the whole estimate refused.
      if (!model.toLowerCase().startsWith('claude')) {
        leftOut.add(model);
        continue;
      }
      const price = priceFor(pricing, model);
      const usage = cache.modelUsage[model];
      const lifetime = usage ? FIELDS.reduce((sum, [key]) => sum + (usage[key] || 0), 0) : 0;
      if (!price || lifetime <= 0) {
        unpriced.add(model);
        continue;
      }
      const factors = byModel[model] ?? pooled;
      const row = { modelName: model, cost: 0 };
      FIELDS.forEach(([key, field, priceKey], i) => {
        row[field] = Math.round((tokens * ((usage[key] || 0) / lifetime)) / factors[i]);
        row.cost += row[field] * price[priceKey];
      });
      modelBreakdowns.push(row);
    }
    const sum = (field) => modelBreakdowns.reduce((acc, m) => acc + m[field], 0);
    return {
      date,
      inputTokens: sum('inputTokens'),
      outputTokens: sum('outputTokens'),
      cacheReadTokens: sum('cacheReadTokens'),
      cacheCreationTokens: sum('cacheCreationTokens'),
      totalTokens: sum('inputTokens') + sum('outputTokens') + sum('cacheReadTokens') + sum('cacheCreationTokens'),
      totalCost: sum('cost'),
      modelsUsed: modelBreakdowns.map((m) => m.modelName),
      modelBreakdowns,
      metadata: { agents: ['claude'] },
    };
  }).filter((day) => day.totalTokens > 0);

  const total = (field) => daily.reduce((acc, d) => acc + d[field], 0);
  return {
    daily,
    totals: {
      inputTokens: total('inputTokens'),
      outputTokens: total('outputTokens'),
      cacheReadTokens: total('cacheReadTokens'),
      cacheCreationTokens: total('cacheCreationTokens'),
      totalTokens: total('totalTokens'),
      totalCost: total('totalCost'),
    },
    provenance: {
      estimated: true,
      source: 'claude-code-stats-cache',
      window: { start: daily[0]?.date ?? null, end: daily[daily.length - 1]?.date ?? null },
      counterTokens,
      factor,
      typeFactors: { pooled, byModel },
      factorDays: factorDays.length,
      skippedDays: skipped.map((d) => d.date),
      lostItemisedDays: lost.map((d) => d.date),
      unpricedModels: [...unpriced],
      nonClaudeModels: [...leftOut],
    },
  };
}

export function priceFor(pricing, model) {
  const entry = pricing?.[model] ?? pricing?.[`anthropic/${model}`];
  if (!entry) return null;
  const price = {};
  for (const [, , key] of FIELDS) {
    if (typeof entry[key] !== 'number') return null;
    price[key] = entry[key];
  }
  return price;
}
