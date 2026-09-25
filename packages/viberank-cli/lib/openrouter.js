/**
 * OpenRouter real spend: what a developer actually paid, as opposed to the
 * API-equivalent cost ccusage computes from local logs.
 *
 * This is a separate ledger on purpose. Tools that route through OpenRouter
 * (OpenClaw, OpenCode, Hermes, …) already write local logs that ccusage
 * reads, so their usage is on the leaderboard once. Adding OpenRouter's own
 * figures to the board would count it twice. The server stores this in its
 * own tables and never folds it into submission totals or ranks.
 *
 * The OpenRouter key never leaves this machine: the CLI calls OpenRouter
 * directly and sends viberank only daily totals and the all-time total.
 *
 * The aggregation here is pure so it can be tested without a key or network;
 * the fetch helpers take `fetchImpl` for the same reason.
 */

const API = 'https://openrouter.ai/api/v1';

/** OpenRouter's keys start `sk-or-`. Loose on purpose: the verify call is the real check. */
export function looksLikeOpenRouterKey(value) {
  return typeof value === 'string' && /^sk-or-\S{10,}$/.test(value.trim());
}

/** A finite, non-negative number or 0. OpenRouter omits fields rather than sending 0. */
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Floating-point sums of credits drift in the last digits; keep micro-dollars. */
function money(value) {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * `/activity` rows → one entry per date, sorted ascending.
 *
 * `/activity` returns one row per date × model × endpoint, so the same model
 * served by two providers on one day arrives as two rows. Those merge into a
 * single per-model entry: the profile shows what was spent on a model, not
 * which upstream served it.
 *
 * `byok` (spend billed to the user's own provider keys) stays separate from
 * `usage` (OpenRouter credits): it was paid, but not to OpenRouter.
 */
export function aggregateActivity(rows) {
  const byDate = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const date = row?.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(date)) continue;
    const day = date.slice(0, 10);
    const model = typeof row.model === 'string' && row.model ? row.model : 'unknown';

    let entry = byDate.get(day);
    if (!entry) {
      entry = {
        date: day,
        usage: 0,
        byok: 0,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        models: new Map(),
      };
      byDate.set(day, entry);
    }

    const usage = num(row.usage);
    const byok = num(row.byok_usage_inference);
    const requests = num(row.requests);
    const promptTokens = num(row.prompt_tokens);
    const completionTokens = num(row.completion_tokens);

    entry.usage += usage;
    entry.byok += byok;
    entry.requests += requests;
    entry.promptTokens += promptTokens;
    entry.completionTokens += completionTokens;
    entry.reasoningTokens += num(row.reasoning_tokens);

    const m = entry.models.get(model) ?? {
      model,
      usage: 0,
      byok: 0,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
    m.usage += usage;
    m.byok += byok;
    m.requests += requests;
    m.promptTokens += promptTokens;
    m.completionTokens += completionTokens;
    entry.models.set(model, m);
  }

  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      ...entry,
      usage: money(entry.usage),
      byok: money(entry.byok),
      models: Array.from(entry.models.values())
        .map((m) => ({ ...m, usage: money(m.usage), byok: money(m.byok) }))
        // Most expensive first, so a truncated view keeps what matters.
        .sort((a, b) => b.usage + b.byok - (a.usage + a.byok) || a.model.localeCompare(b.model)),
    }));
}

/** The body POSTed to viberank's /api/spend/openrouter. */
export function buildPayload({ scope, lifetimeUsd, lifetimeByokUsd = null, days = [] }) {
  return {
    scope,
    lifetime: {
      usd: money(num(lifetimeUsd)),
      byokUsd: lifetimeByokUsd === null || lifetimeByokUsd === undefined ? null : money(num(lifetimeByokUsd)),
    },
    days,
  };
}

/**
 * Payload for a normal (inference) key, from `/key` alone.
 *
 * Such a key can't read `/activity` or `/credits`, so all we know is this
 * key's cumulative usage and today's spend on it. Today's figure becomes
 * today's row: a daily sync then builds a per-day history one day at a time.
 * No per-model split exists at this level.
 */
export function keyScopePayload(keyData, today = new Date()) {
  const date = today.toISOString().slice(0, 10);
  const usage = money(num(keyData?.usage_daily));
  const byok = money(num(keyData?.byok_usage_daily));
  const days = usage > 0 || byok > 0
    ? [{ date, usage, byok, requests: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0, models: [] }]
    : [];
  return buildPayload({
    scope: 'key',
    lifetimeUsd: keyData?.usage,
    lifetimeByokUsd: keyData?.byok_usage ?? null,
    days,
  });
}

/** Payload for a management key: all-time account spend plus 30 days of detail. */
export function accountScopePayload(creditsData, activityRows) {
  return buildPayload({
    scope: 'account',
    lifetimeUsd: creditsData?.total_usage,
    // /credits has no BYOK figure; say "unknown" rather than claim zero.
    lifetimeByokUsd: null,
    days: aggregateActivity(activityRows),
  });
}

async function getJson(fetchImpl, path, key) {
  const res = await fetchImpl(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/**
 * Read spend from OpenRouter with `key` and build the viberank payload.
 *
 * `/key` says which kind of key this is (`is_management_key`). When it can't
 * say — the call fails, or the flag is missing — `/credits` decides: only a
 * management key can read it. So a management key is still recognised should
 * `/key` ever stop answering for one, and a normal key still works should the
 * flag ever disappear.
 */
export async function readOpenRouterSpend(key, fetchImpl, today = new Date()) {
  const info = await getJson(fetchImpl, '/key', key);
  const keyData = info.body?.data;
  const keyScope = () => ({ payload: keyScopePayload(keyData, today), label: keyData?.label ?? null });

  if (info.ok && keyData?.is_management_key === false) return keyScope();

  const credits = await getJson(fetchImpl, '/credits', key);
  if (!credits.ok) {
    // /key answered but /credits refused: an ordinary key without the flag.
    if (info.ok && keyData?.is_management_key !== true) return keyScope();
    const status = info.ok ? credits.status : info.status;
    throw new Error(
      status === 401 || status === 403
        ? 'OpenRouter rejected the key — it may be revoked or mistyped'
        : `OpenRouter returned ${status}`
    );
  }

  const activity = await getJson(fetchImpl, '/activity', key);
  if (!activity.ok) throw new Error(`OpenRouter /activity returned ${activity.status}`);

  return {
    payload: accountScopePayload(credits.body?.data, activity.body?.data),
    label: keyData?.label ?? null,
  };
}

/** POST a payload to viberank, signed with the viberank API token. */
export async function postSpend(payload, { site, token, cliVersion, fetchImpl }) {
  const res = await fetchImpl(`${site}/api/spend/openrouter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(cliVersion ? { 'X-CLI-Version': cliVersion } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error || `viberank returned ${res.status}`);
  }
  return body;
}

/** One-line summary for logs and the interactive command. */
export function describePayload(payload) {
  const last30 = payload.days.reduce((s, d) => s + d.usage, 0);
  const scope = payload.scope === 'account' ? 'account' : 'this API key only';
  return `$${payload.lifetime.usd.toFixed(2)} all-time (${scope}), $${last30.toFixed(2)} across ${payload.days.length} day${payload.days.length === 1 ? '' : 's'}`;
}
