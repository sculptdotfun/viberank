/**
 * One-step sign-in from the terminal (`gh auth login` style).
 *
 * The CLI asks the server for a short code and a long secret, shows the code
 * and opens /link?code=…, and polls with the secret until the person approves
 * in the browser. The token arrives in the poll that sees the approval, once.
 *
 * `fetch`, `sleep`, `now` and `spawn` are passed in so the loop and the
 * browser opener can be tested without a network, a clock or a desktop.
 */

export const START_PATH = '/api/v2/link/start';
export const POLL_PATH = '/api/v2/link/poll';

/** The line non-interactive runs print instead of prompting. */
export const LINK_HINT = 'Verify with GitHub to join the Ranked board: run `npx viberank-cli login` in your terminal.';

/**
 * Begin a link. { ok: true, userCode, deviceCode, verifyUrl, interval, expiresIn },
 * or { ok: false, reason } where reason is 'unsupported' (a server without
 * the link routes), 'rate' (with retryAfter), 'unreachable' or 'error'.
 */
export async function startLink(site, { fetch, version }) {
  let res;
  try {
    res = await fetch(`${site}${START_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viberank-Client': `cli/${version}` },
      body: '{}',
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (res.status === 404 || res.status === 405) return { ok: false, reason: 'unsupported' };
  const body = await res.json().catch(() => null);
  if (res.status === 429) return { ok: false, reason: 'rate', retryAfter: Number(body?.retryAfter) || null, error: body?.error };
  if (!res.ok || !body || typeof body.userCode !== 'string' || typeof body.deviceCode !== 'string') {
    return { ok: false, reason: 'error', error: body?.error };
  }
  return {
    ok: true,
    userCode: body.userCode,
    deviceCode: body.deviceCode,
    verifyUrl: safeVerifyUrl(site, body.verifyUrl, body.userCode),
    interval: Number(body.interval) > 0 ? Number(body.interval) : 5,
    expiresIn: Number(body.expiresIn) > 0 ? Number(body.expiresIn) : 600,
  };
}

/**
 * The URL to open: the server's, only if it is our own /link page. Anything
 * else is rebuilt from the code, so a tampered response can never make the
 * CLI open an arbitrary URL.
 */
export function safeVerifyUrl(site, verifyUrl, userCode) {
  if (typeof verifyUrl === 'string' && verifyUrl.startsWith(`${site}/link?code=`) && !/\s/.test(verifyUrl)) return verifyUrl;
  return `${site}/link?code=${encodeURIComponent(userCode)}`;
}

/**
 * Poll until approved, expired or out of time. Network errors and 5xx keep
 * waiting (the person may still be signing in); slow_down adds 5 s as
 * RFC 8628 says. Resolves { ok: true, token, username } or
 * { ok: false, reason: 'expired' | 'used' | 'error' }.
 */
export async function waitForApproval(site, link, { fetch, sleep, now = Date.now, onPoll = () => {} }) {
  const deadline = now() + link.expiresIn * 1000;
  let interval = link.interval;
  while (now() < deadline) {
    await sleep(interval * 1000);
    let res;
    try {
      res = await fetch(`${site}${POLL_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode: link.deviceCode }),
      });
    } catch {
      onPoll('offline');
      continue;
    }
    if (res.status >= 500 || res.status === 429) {
      onPoll('retry');
      continue;
    }
    const body = await res.json().catch(() => null);
    const status = body?.status;
    onPoll(status ?? 'error');
    if (status === 'approved' && typeof body.token === 'string') return { ok: true, token: body.token, username: body.username ?? null };
    if (status === 'pending') continue;
    if (status === 'slow_down') { interval += 5; continue; }
    if (status === 'expired') return { ok: false, reason: body.reason === 'used' ? 'used' : 'expired' };
    return { ok: false, reason: 'error' };
  }
  return { ok: false, reason: 'expired' };
}

/** How to open a URL here. No shell: the URL is an argument, never parsed. */
export function browserCommand(platform, url) {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  // Not `cmd /c start`: cmd would parse the URL (& and ^ are special) and
  // Node's argument quoting mangles the empty window title it needs.
  if (platform === 'win32') return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  return { command: 'xdg-open', args: [url] };
}

/** Best effort. Never throws and never waits: a headless box just uses the printed URL. */
export function openBrowser(url, { spawn, platform = process.platform }) {
  try {
    const { command, args } = browserCommand(platform, url);
    const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
    child.on?.('error', () => {});
    child.unref?.();
    return true;
  } catch {
    return false;
  }
}
