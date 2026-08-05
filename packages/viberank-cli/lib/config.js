import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * On-disk state for the CLI: the API token and the machine id.
 *
 * Kept in one place so `login`, `submit` and `autosubmit` agree on where the
 * token lives, and so the file permissions are set in exactly one spot.
 */

export const CONFIG_DIR = path.join(os.homedir(), '.viberank');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const MACHINE_ID_FILE = path.join(CONFIG_DIR, 'machine-id');

export const TOKEN_PREFIX = 'vbr_';

/** Shape check so an obviously-wrong paste is caught before a network call. */
export function looksLikeToken(value) {
  if (typeof value !== 'string' || !value.startsWith(TOKEN_PREFIX)) return false;
  const body = value.slice(TOKEN_PREFIX.length);
  return body.length === 43 && /^[A-Za-z0-9_-]+$/.test(body);
}

export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  // 0600: the token is a password equivalent, so it must not be group- or
  // world-readable on a shared machine.
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // Windows and some filesystems don't implement chmod; the write above is
    // still the best available.
  }
  return next;
}

/**
 * The token, preferring the environment so CI and containers never need a
 * config file on disk.
 */
export function getToken() {
  const fromEnv = process.env.VIBERANK_TOKEN;
  if (looksLikeToken(fromEnv)) return fromEnv;
  const { token } = readConfig();
  return looksLikeToken(token) ? token : null;
}

export function clearToken() {
  const config = readConfig();
  delete config.token;
  delete config.username;
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Stable, anonymous per-machine id so the server can sum usage from multiple
 * machines under one account instead of overwriting it (#43). A random UUID —
 * no hardware or identifying information.
 */
export function getMachineId() {
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
    // Read-only home: fall back to an ephemeral id. Worst case a future run
    // gets a new id and that day sums once — never data loss.
  }
  return id;
}
