import assert from "node:assert/strict";
import path from "node:path";

const { resolveNpxArgv } = await import("../packages/viberank-cli/lib/npx.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

const winNode = "C:\\Program Files\\nodejs\\node.exe";
const posixNode = "/usr/local/bin/node";
const only = (...present: string[]) => (p: string) => present.includes(p);
const noSymlinks = () => null;

{
  // THE regression test for #137. Windows ships npx only as `npx.cmd`, and
  // Node refuses to spawn a batch shim without a shell (CVE-2024-27980), so
  // handing it to execFileSync throws EINVAL mid-submission. npm's own
  // npx-cli.js sits next to node.exe and runs through the node binary.
  const winNpxCli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js";
  const { argv, shell } = resolveNpxArgv({
    execPath: winNode,
    platform: "win32",
    exists: only(winNpxCli, "C:\\Program Files\\nodejs\\npx.cmd"),
    realpath: noSymlinks,
  });
  assert.deepEqual(argv, [winNode, winNpxCli]);
  assert.equal(shell, false);
  assert.ok(!argv.some((a) => a.endsWith(".cmd")), "never hands a .cmd to execFileSync");
  check("windows resolves npx-cli.js next to node.exe, not the .cmd shim");
}

{
  // POSIX layout: bin/node with lib/node_modules as a sibling.
  const posixNpxCli = path.posix.join("/usr/local/bin", "..", "lib", "node_modules", "npm", "bin", "npx-cli.js");
  const { argv, shell } = resolveNpxArgv({
    execPath: posixNode,
    platform: "darwin",
    exists: only(posixNpxCli),
    realpath: noSymlinks,
  });
  assert.deepEqual(argv, [posixNode, posixNpxCli]);
  assert.equal(shell, false);
  check("posix resolves npx-cli.js under lib/node_modules");
}

{
  // Homebrew keeps node in a keg and npm outside it, linking the two with a
  // symlinked shim. Executing that shim leans on its `/usr/bin/env node`
  // shebang — no good under launchd, which is where autosubmit runs.
  const brewNode = "/opt/homebrew/Cellar/node/24.7.0/bin/node";
  const brewNpxCli = "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js";
  const { argv, shell } = resolveNpxArgv({
    execPath: brewNode,
    platform: "darwin",
    exists: only("/opt/homebrew/Cellar/node/24.7.0/bin/npx", brewNpxCli),
    realpath: (target) =>
      target === "/opt/homebrew/Cellar/node/24.7.0/bin/npx" ? brewNpxCli : null,
  });
  assert.deepEqual(argv, [brewNode, brewNpxCli]);
  assert.equal(shell, false);
  check("follows a relocated npm's symlinked shim to the real npx-cli.js");
}

{
  // No npm layout at all — an unbundled node. The shim is the only option
  // left, and on Windows it needs a shell (and therefore quoting).
  const shim = "C:\\Program Files\\nodejs\\npx.cmd";
  const win = resolveNpxArgv({
    execPath: winNode, platform: "win32", exists: only(shim), realpath: noSymlinks,
  });
  assert.deepEqual(win.argv, [shim]);
  assert.equal(win.shell, true, "the shim fallback must go through cmd.exe");

  const posix = resolveNpxArgv({
    execPath: posixNode, platform: "linux", exists: () => false, realpath: noSymlinks,
  });
  assert.deepEqual(posix.argv, ["npx"]);
  assert.equal(posix.shell, false);
  check("falls back to the shim, then to bare npx on PATH");
}

console.log(`\n${passed} checks passed`);
