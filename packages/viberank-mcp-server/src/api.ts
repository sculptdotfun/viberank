import type { FetchLike } from './identity.js';

/**
 * Requests to viberank.app, and an honest reading of what came back.
 *
 * The one distinction that matters is between "the server answered no" and
 * "the server could not answer". A 404 with a JSON `{ error }` body is the
 * route saying the thing does not exist. A 404 with an HTML body is the site
 * saying the route does not exist, which is what an older deployment returns
 * for /api/leaderboard and /api/profile. Reporting the second as "no such
 * user" would be a lie, so they are kept apart.
 */

export const SITE = 'https://www.viberank.app';

export type ApiResult =
  | { kind: 'ok'; status: number; body: Record<string, unknown> }
  | { kind: 'rejected'; status: number; error: string; body: Record<string, unknown> }
  | { kind: 'no_route'; status: number }
  | { kind: 'unreachable'; error: string };

export interface ApiDeps {
  fetch: FetchLike;
  userAgent: string;
  timeoutMs?: number;
}

export async function requestJson(url: string, init: RequestInit, deps: ApiDeps): Promise<ApiResult> {
  let res: Response;
  try {
    res = await deps.fetch(url, {
      ...init,
      headers: { Accept: 'application/json', 'User-Agent': deps.userAgent, ...(init.headers as Record<string, string>) },
      signal: AbortSignal.timeout(deps.timeoutMs ?? 15000),
    });
  } catch (error) {
    const reason = (error as Error)?.name === 'TimeoutError' ? 'timed out' : (error as Error)?.message || 'network error';
    return { kind: 'unreachable', error: `Could not reach ${new URL(url).host}: ${reason}.` };
  }

  const isJson = /\bjson\b/i.test(res.headers.get('content-type') ?? '');
  let body: unknown = null;
  if (isJson) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  }
  const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;

  if (res.ok && record) return { kind: 'ok', status: res.status, body: record };
  if (!record) {
    // A 404 page, a proxy error page, or an empty body: not an answer.
    return res.status === 404
      ? { kind: 'no_route', status: res.status }
      : { kind: 'unreachable', error: `${new URL(url).host} returned HTTP ${res.status} without a JSON body.` };
  }
  const error = typeof record.error === 'string' && record.error ? record.error : `HTTP ${res.status}`;
  return { kind: 'rejected', status: res.status, error, body: record };
}

export const getJson = (path: string, deps: ApiDeps) => requestJson(`${SITE}${path}`, { method: 'GET' }, deps);
