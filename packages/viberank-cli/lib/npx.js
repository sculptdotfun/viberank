import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * How to invoke npx without a shell and without PATH.
 *
 * Two constraints pull in the same direction. A scheduled job (launchd,
 * systemd, schtasks) starts with a minimal PATH that has no node on it, so
 * bare `npx` is not resolvable. And on Windows the only thing on disk named
 * npx is `npx.cmd` — a batch shim, which Node has refused to spawn without
 * `shell: true` since the CVE-2024-27980 fix (18.20.2 / 20.12.2 / 21.7.3).
 * Passing it to execFileSync throws `spawnSync ... npx.cmd EINVAL` (#137).
 *
 * npm ships npx as a plain .js file next to node, so run *that* through the
 * node binary already executing this process: absolute, shell-free, and the
 * same on every platform.
 *
 * @param {{execPath?: string, platform?: string, exists?: (p: string) => boolean,
 *   realpath?: (p: string) => string | null}} env
 * @returns {{argv: string[], shell: boolean}} argv[0] is the command, the
 *   rest are arguments to prepend to the npx arguments. `shell` is true only
 *   on the Windows shim fallback, where the caller must quote.
 */
export function resolveNpxArgv(env = {}) {
  const execPath = env.execPath ?? process.execPath;
  const platform = env.platform ?? process.platform;
  const exists = env.exists ?? fs.existsSync;
  const realpath = env.realpath ?? ((target) => {
    try { return fs.realpathSync(target); } catch { return null; }
  });
  // Pinned to the target platform's separator rules rather than the host's,
  // so the Windows branch is exercisable from a test on any machine.
  const p = platform === 'win32' ? path.win32 : path.posix;
  const dir = p.dirname(execPath);

  const shim = p.join(dir, platform === 'win32' ? 'npx.cmd' : 'npx');

  const cli = [
    // Windows: node.exe and node_modules/npm share the install directory.
    p.join(dir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    // POSIX: bin/node with lib/node_modules alongside it.
    p.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    // Homebrew and friends relocate npm out of the node keg and leave the
    // shim as a symlink to it. Executing that symlink works interactively but
    // relies on its `/usr/bin/env node` shebang, which is exactly what a
    // scheduled job with a minimal PATH cannot satisfy — so follow it.
    realpath(shim),
  ].find((candidate) => candidate?.endsWith('.js') && exists(candidate));
  if (cli) return { argv: [execPath, cli], shell: false };

  // No npm layout to be found — an unbundled node, or a distro that moved it.
  // Fall back to the shim, which at least works when PATH is populated.
  const runner = exists(shim) ? shim : 'npx';
  return { argv: [runner], shell: platform === 'win32' };
}

/** cmd.exe swallows bare spaces; the node install path has one in it. */
const quote = (arg) => (/[\s"^&|<>]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg);

/**
 * Run `npx <args>` synchronously, returning stdout.
 * @param {string[]} args
 * @param {import('child_process').ExecFileSyncOptions} options
 */
export function runNpx(args, options = {}) {
  const { argv, shell } = resolveNpxArgv();
  const [command, ...prefix] = argv;
  const full = [...prefix, ...args];
  if (!shell) return execFileSync(command, full, { windowsHide: true, ...options });
  return execFileSync(quote(command), full.map(quote), { windowsHide: true, ...options, shell: true });
}
