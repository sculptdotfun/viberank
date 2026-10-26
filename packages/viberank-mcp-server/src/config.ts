import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The CLI's saved state in ~/.viberank, shared rather than duplicated.
 *
 * Every rule here mirrors packages/viberank-cli/lib/config.js. If the two
 * disagreed on where the token lives or what the machine id is, one machine
 * would show up on the server as two, and an MCP submission would not be
 * signed the way a CLI one is.
 */

export const CONFIG_DIR = path.join(os.homedir(), '.viberank');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const MACHINE_ID_FILE = path.join(CONFIG_DIR, 'machine-id');

export const TOKEN_PREFIX = 'vbr_';
export const TOKENS_PAGE = 'https://www.viberank.app/settings/tokens';

interface SavedConfig {
  token?: unknown;
  username?: unknown;
  tokenOwner?: { username?: unknown; token?: unknown };
}

/** Same shape check as the CLI, so a bad paste is caught before any request. */
export function looksLikeToken(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith(TOKEN_PREFIX)) return false;
  const body = value.slice(TOKEN_PREFIX.length);
  return body.length === 43 && /^[A-Za-z0-9_-]+$/.test(body);
}

export function readConfig(): SavedConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as SavedConfig;
  } catch {
    return {};
  }
}

export type TokenState =
  | { status: 'none' }
  | { status: 'ok'; token: string; source: 'env' | 'config' }
  | { status: 'malformed'; source: 'env' };

/**
 * The API token, preferring VIBERANK_TOKEN so an MCP config can carry it.
 *
 * A VIBERANK_TOKEN that is set but malformed is reported rather than skipped.
 * Skipping it would quietly fall back to an unsigned submission under a typed
 * name, which is the exact mistake the token exists to prevent. The most
 * likely cause is the README's `vbr_…` placeholder pasted as-is.
 */
export function readToken(env: NodeJS.ProcessEnv = process.env): TokenState {
  const fromEnv = env.VIBERANK_TOKEN?.trim();
  if (fromEnv) {
    return looksLikeToken(fromEnv)
      ? { status: 'ok', token: fromEnv, source: 'env' }
      : { status: 'malformed', source: 'env' };
  }
  const { token } = readConfig();
  return looksLikeToken(token) ? { status: 'ok', token, source: 'config' } : { status: 'none' };
}

/** The CLI ties a saved owner to its token by this digest, so a different
 * token in VIBERANK_TOKEN never borrows the config token's owner. */
function tokenFingerprint(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
}

/** The owner the CLI saved for `token` at login, or null. */
export function savedTokenOwner(token: string): string | null {
  const { tokenOwner } = readConfig();
  if (!tokenOwner || typeof tokenOwner.username !== 'string') return null;
  return tokenOwner.token === tokenFingerprint(token) ? tokenOwner.username : null;
}

/** The handle the CLI last submitted under on this machine, if it saved one. */
export function rememberedUsername(): string | null {
  const { username } = readConfig();
  return typeof username === 'string' && username ? username : null;
}

/**
 * Stable, anonymous per-machine id (a random UUID), created on first use
 * exactly as the CLI does. An upload without one lands in an unattributed
 * slice that the server compares against the per-machine sum, keeping the
 * larger. The MCP server used to only read this file, so on a machine where
 * the CLI never ran, its days were maxed against other machines' days instead
 * of added to them.
 */
export function getMachineId(): string {
  try {
    const existing = fs.readFileSync(MACHINE_ID_FILE, 'utf8').trim();
    if (existing) return existing;
  } catch {
    // Not created yet.
  }
  const id = crypto.randomUUID();
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(MACHINE_ID_FILE, id, { mode: 0o600 });
  } catch {
    // Read-only home: use an ephemeral id. At worst a later run gets a new id
    // and that day is summed once more, which never loses data.
  }
  return id;
}
