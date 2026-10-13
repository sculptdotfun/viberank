/**
 * Who a submission will be filed under, decided before anything is sent.
 *
 * Both helpers take `fetch` as an argument so they can be tested without the
 * network, and both time out rather than hold up the prompt: a slow answer is
 * treated like no answer.
 */

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether a repository remote's owner is a GitHub *user* — the only kind of
 * account that can sign in and own a profile.
 *
 * Running the CLI inside an organization's repository used to pre-fill the
 * organization's name, and one Enter created a profile nobody can sign in as
 * (#181). Returns 'user', 'organization', or 'unknown' (rate limited, offline,
 * timed out); callers should only pre-fill on 'user'. Unauthenticated, and the
 * owner name is the only thing sent.
 */
export async function remoteOwnerKind(owner, { fetch: fetchImpl, timeoutMs = 2000 }) {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      `https://api.github.com/users/${encodeURIComponent(owner)}`,
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'viberank-cli' } },
      timeoutMs
    );
    if (!res.ok) return 'unknown';
    const body = await res.json();
    if (body?.type === 'Organization') return 'organization';
    if (body?.type === 'User') return 'user';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * The account a saved token files submissions under, per the server.
 *
 * The server ignores X-GitHub-User once a token is present and uses the
 * token's owner, so that owner — not a typed or remembered name — is what the
 * confirmation has to show (#181).
 *
 * Returns { status, username }:
 *   'ok'          username is the token's owner
 *   'rejected'    the token is revoked or mistyped (401)
 *   'unsupported' the server predates /api/token/whoami (404)
 *   'unreachable' network error, timeout or a 5xx
 */
export async function whoami(site, token, { fetch: fetchImpl, timeoutMs = 5000 }) {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      `${site}/api/token/whoami`,
      { headers: { Authorization: `Bearer ${token}` } },
      timeoutMs
    );
    if (res.status === 401) return { status: 'rejected', username: null };
    if (res.status === 404) return { status: 'unsupported', username: null };
    if (!res.ok) return { status: 'unreachable', username: null };
    const body = await res.json();
    return typeof body?.username === 'string' && body.username
      ? { status: 'ok', username: body.username }
      : { status: 'unreachable', username: null };
  } catch {
    return { status: 'unreachable', username: null };
  }
}

/**
 * The token's owner for this run: the server's answer when it gives one, the
 * owner saved at login when it can't (offline, old server), else null.
 * `rejected` is passed through so callers can stop before a doomed upload.
 */
export async function resolveTokenOwner(site, token, saved, deps) {
  const result = await whoami(site, token, deps);
  if (result.status === 'ok') return { username: result.username, rejected: false, fresh: true };
  if (result.status === 'rejected') return { username: null, rejected: true, fresh: false };
  return { username: saved ?? null, rejected: false, fresh: false };
}
