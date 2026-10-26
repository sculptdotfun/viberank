/**
 * Sending a report to viberank, and reading what came back.
 *
 * Shared by the interactive, unattended and scheduled paths so they retry the
 * same things the same way. `fetch` and `sleep` are passed in, so the retry
 * rules can be tested without a network or a clock.
 */

export const SITE = 'https://www.viberank.app';

/** The longest rate-limit wait a scheduled run sits out rather than fails. A
 * scheduled run has nobody waiting on it, but it should not hold a job open
 * for most of an hour either. */
export const SCHEDULED_WAIT_LIMIT_S = 10 * 60;

const RETRY_DELAY_MS = 5000;
const ATTEMPTS = 3;

/** Statuses worth another try: the server or its gateway, momentarily. */
const TRANSIENT = new Set([502, 503, 504]);

/** Connection failures, as node-fetch reported them and as Node's own fetch
 * does: undici wraps the system error in `cause` and calls the outer one
 * "fetch failed". */
const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT',
]);

export function networkErrorCode(error) {
  const code = error?.code ?? error?.cause?.code;
  return NETWORK_CODES.has(code) ? code : null;
}

export function submitHeaders({ version, machineId, githubUser, token }) {
  return {
    'Content-Type': 'application/json',
    // The header is a claim anyone can make; the token is proof. Sending both
    // keeps older servers working and lets a token-authenticated submission
    // come back verified.
    'X-GitHub-User': githubUser,
    'X-CLI-Version': version,
    // Which client sent it, so the server can tell the CLI from the MCP
    // server and a hand-rolled curl without parsing a bare version number.
    'X-Viberank-Client': `cli/${version}`,
    'X-Machine-Id': machineId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Seconds a 429 asked us to wait: the Retry-After header (seconds or an HTTP
 * date), else the body's `retryAfter`, else the number in the message
 * ("Please wait 2400 seconds…"). Null when none of them says.
 */
export function retryAfterSeconds({ header, body, now = Date.now() }) {
  const value = typeof header === 'string' ? header.trim() : '';
  if (/^\d+$/.test(value)) return Number(value);
  if (value) {
    const at = Date.parse(value);
    if (!Number.isNaN(at)) return Math.max(0, Math.ceil((at - now) / 1000));
  }
  if (Number.isFinite(body?.retryAfter) && body.retryAfter >= 0) return body.retryAfter;
  const match = String(body?.error ?? '').match(/(\d+)\s*seconds?/i);
  return match ? Number(match[1]) : null;
}

/** "40 min", "2 h", "45 s": a wait, said the way a person would. */
export function describeWait(seconds) {
  if (seconds < 90) return `${seconds} s`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

/** The server refusing an unsigned submission to a verified profile. */
export function isVerifiedRefusal(outcome) {
  return outcome?.status === 403 && /\bis verified\b/.test(String(outcome?.body?.error ?? ''));
}

/** One line saying why a submission failed. */
export function failureMessage(outcome) {
  if (outcome.error) {
    const code = networkErrorCode(outcome.error);
    return code ? `could not reach viberank.app (${code})` : outcome.error.message;
  }
  const base = outcome.body?.error || `server returned ${outcome.status}`;
  return outcome.body?.requestId ? `${base} (Request ID: ${outcome.body.requestId})` : base;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST a report, retrying only what a retry can fix: a dropped connection or
 * a 502/503/504, up to three attempts; and, for a scheduled run alone, one
 * 429 whose wait is at most SCHEDULED_WAIT_LIMIT_S. An interactive 429 is
 * returned at once with `retryAfter`, so the person can be told how long.
 *
 * Never throws for anything the server or network does.
 *
 * @returns {Promise<{ ok: boolean, status: number | null, body: any,
 *   error: Error | null, retryAfter?: number | null, waitedSeconds: number }>}
 */
export async function postReport({
  fetch, url = `${SITE}/api/submit`, headers, payload, scheduled = false,
  sleep = defaultSleep, onRetry = () => {},
}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let waitedSeconds = 0;
  let outcome = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, { method: 'POST', headers, body });
    } catch (error) {
      outcome = { ok: false, status: null, body: null, error, waitedSeconds };
      if (!networkErrorCode(error) || attempt === ATTEMPTS) return outcome;
      onRetry({ reason: 'network', attempt, delayMs: RETRY_DELAY_MS * attempt });
      await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }

    const parsed = await response.json().catch(() => null);
    if (response.ok && parsed?.success) {
      return { ok: true, status: response.status, body: parsed, error: null, waitedSeconds };
    }
    outcome = { ok: false, status: response.status, body: parsed, error: null, waitedSeconds };

    if (response.status === 429) {
      outcome.retryAfter = retryAfterSeconds({ header: response.headers?.get?.('retry-after'), body: parsed });
      const wait = outcome.retryAfter;
      if (!scheduled || waitedSeconds > 0 || wait === null || wait > SCHEDULED_WAIT_LIMIT_S) return outcome;
      onRetry({ reason: 'rate-limit', attempt, delayMs: wait * 1000 });
      // A second of slack, so the retry does not land a hair early.
      await sleep((wait + 1) * 1000);
      waitedSeconds = wait + 1;
      // Sitting out a rate limit is not a failed attempt.
      attempt--;
      continue;
    }

    if (!TRANSIENT.has(response.status) || attempt === ATTEMPTS) return outcome;
    onRetry({ reason: 'server', attempt, status: response.status, delayMs: RETRY_DELAY_MS * attempt });
    await sleep(RETRY_DELAY_MS * attempt);
  }
  return outcome;
}
