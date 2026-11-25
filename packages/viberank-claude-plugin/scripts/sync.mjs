#!/usr/bin/env node
/**
 * The plugin's SessionStart / SessionEnd hook: start a quiet viberank sync in
 * the background, at most once every VIBERANK_SYNC_HOURS (default 1), and
 * return at once.
 *
 * Rules this script keeps, because it runs inside someone's session:
 *   - It prints nothing. SessionStart output becomes context for Claude.
 *   - It never waits. The sync (`npx -y viberank-cli@latest submit --quiet`)
 *     is spawned detached with no stdio and outlives the session; ccusage
 *     alone takes 15-25 s and SessionEnd hooks get about 1.5 s by default.
 *   - It never fails the hook. Any error exits 0; the CLI's own log
 *     (~/.viberank/autosubmit.log) records what the sync did.
 *   - No token, no sync. A scheduled-mode submit needs one, and without it
 *     every session would only add a failure line to the log.
 *
 * It also keeps ~/.viberank/statusline.mjs current, a copy of this plugin's
 * status-line script at a path that does not change when the plugin updates,
 * so settings.json can point at it.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HOME_DIR = path.join(os.homedir(), '.viberank');
const STAMP_FILE = path.join(HOME_DIR, 'plugin-sync.json');
const CONFIG_FILE = path.join(HOME_DIR, 'config.json');
export const STATUSLINE_TARGET = path.join(HOME_DIR, 'statusline.mjs');

const TOKEN = /^vbr_[A-Za-z0-9_-]{43}$/;

/** Hours between syncs: VIBERANK_SYNC_HOURS when it is a positive number, else 1. */
export function syncHours(env = process.env) {
  const hours = Number(env.VIBERANK_SYNC_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : 1;
}

/** Whether a sync is due: none attempted yet, or the last one is `hours` old. */
export function shouldSync({ lastAttempt, hours, now = Date.now() }) {
  const last = Date.parse(lastAttempt ?? '');
  return !Number.isFinite(last) || now - last >= hours * 3600 * 1000 || last > now;
}

/** A token the CLI can use: VIBERANK_TOKEN, or the one `login` saved. */
export function hasToken(config, env = process.env) {
  return TOKEN.test(env.VIBERANK_TOKEN ?? '') || TOKEN.test(config?.token ?? '');
}

/** The command and arguments for the background sync on this platform. */
export function syncCommand(hours, platform = process.platform) {
  const args = ['-y', 'viberank-cli@latest', 'submit', '--quiet', '--every', String(hours)];
  // npx is a .cmd shim on Windows, which Node only spawns through a shell.
  return platform === 'win32' ? { command: 'npx.cmd', args, shell: true } : { command: 'npx', args, shell: false };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Copy the status-line script to its stable path when it is missing or stale. */
export function installStatusline(source, target = STATUSLINE_TARGET) {
  const text = fs.readFileSync(source, 'utf8');
  let current = null;
  try {
    current = fs.readFileSync(target, 'utf8');
  } catch {
    // Not installed yet.
  }
  if (current === text) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, text, { mode: 0o644 });
  return true;
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  try {
    installStatusline(path.join(here, 'statusline.mjs'));
  } catch {
    // The status line is optional; the sync is not blocked by it.
  }

  if (/^(0|off|false|no)$/i.test(process.env.VIBERANK_SYNC ?? '')) return;
  if (!hasToken(readJson(CONFIG_FILE), process.env)) return;

  const hours = syncHours();
  if (!shouldSync({ lastAttempt: readJson(STAMP_FILE)?.lastAttempt, hours })) return;

  // Stamp before spawning, so sessions ending together start one sync, not several.
  fs.mkdirSync(HOME_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(STAMP_FILE, JSON.stringify({ lastAttempt: new Date().toISOString(), event: process.argv[2] ?? null }));

  const { command, args, shell } = syncCommand(hours);
  const child = spawn(command, args, { detached: true, stdio: 'ignore', shell, windowsHide: true, env: process.env });
  child.on('error', () => {});
  child.unref();
}

function isEntryPoint() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    main();
  } catch {
    // Never fail a session over a sync.
  }
  process.exit(0);
}
