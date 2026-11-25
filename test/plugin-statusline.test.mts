import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(root, "packages/viberank-claude-plugin");
const { syncHours, shouldSync, hasToken, syncCommand, installStatusline } = await import("../packages/viberank-claude-plugin/scripts/sync.mjs");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

{
  const cliCopy = fs.readFileSync(path.join(root, "packages/viberank-cli/lib/statusline.js"), "utf8");
  const pluginCopy = fs.readFileSync(path.join(plugin, "scripts/statusline.mjs"), "utf8");
  assert.equal(pluginCopy, cliCopy, "copy packages/viberank-cli/lib/statusline.js over scripts/statusline.mjs");
  check("the plugin's status line is the CLI's, byte for byte");
}

{
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, ".claude-plugin/plugin.json"), "utf8"));
  const market = JSON.parse(fs.readFileSync(path.join(plugin, ".claude-plugin/marketplace.json"), "utf8"));
  const hooks = JSON.parse(fs.readFileSync(path.join(plugin, "hooks/hooks.json"), "utf8"));
  assert.equal(manifest.name, "viberank");
  assert.equal(market.plugins[0].name, manifest.name, "the marketplace entry names the plugin");
  assert.equal(market.plugins[0].source.path, "packages/viberank-claude-plugin");
  for (const event of ["SessionStart", "SessionEnd"]) {
    const [hook] = hooks.hooks[event][0].hooks;
    assert.equal(hook.type, "command");
    assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/sync\.mjs/);
    assert.ok(hook.timeout <= 60, "SessionEnd allows at most 60 s");
  }
  assert.ok(fs.existsSync(path.join(plugin, "commands/viberank.md")));
  check("manifest, marketplace and hooks agree and point at real files");
}

{
  assert.equal(syncHours({}), 1);
  assert.equal(syncHours({ VIBERANK_SYNC_HOURS: "6" }), 6);
  assert.equal(syncHours({ VIBERANK_SYNC_HOURS: "0" }), 1);
  assert.equal(syncHours({ VIBERANK_SYNC_HOURS: "often" }), 1);

  const now = Date.parse("2026-11-25T15:00:00Z");
  assert.equal(shouldSync({ lastAttempt: undefined, hours: 1, now }), true, "never synced");
  assert.equal(shouldSync({ lastAttempt: "2026-11-25T14:30:00Z", hours: 1, now }), false, "within the hour");
  assert.equal(shouldSync({ lastAttempt: "2026-11-25T14:00:00Z", hours: 1, now }), true, "an hour on");
  assert.equal(shouldSync({ lastAttempt: "2026-11-25T10:00:00Z", hours: 6, now }), false);
  assert.equal(shouldSync({ lastAttempt: "2026-11-26T15:00:00Z", hours: 1, now }), true, "a stamp from the future is a broken clock, not a wait");
  assert.equal(shouldSync({ lastAttempt: "garbage", hours: 1, now }), true);
  check("syncs at most once per VIBERANK_SYNC_HOURS (default 1)");
}

{
  const token = `vbr_${"a".repeat(43)}`;
  assert.equal(hasToken({ token }, {}), true);
  assert.equal(hasToken({}, { VIBERANK_TOKEN: token }), true);
  assert.equal(hasToken({ token: "vbr_short" }, {}), false);
  assert.equal(hasToken(null, {}), false);
  check("no token, no sync");
}

{
  assert.deepEqual(syncCommand(1, "darwin"), {
    command: "npx", args: ["-y", "viberank-cli@latest", "submit", "--quiet", "--every", "1"], shell: false,
  });
  assert.equal(syncCommand(2, "win32").command, "npx.cmd");
  assert.equal(syncCommand(2, "win32").shell, true);
  check("the background sync is the CLI's quiet mode with the plugin's interval");
}

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viberank-plugin-"));
  const target = path.join(dir, "home", "statusline.mjs");
  const source = path.join(plugin, "scripts/statusline.mjs");
  try {
    assert.equal(installStatusline(source, target), true, "first install");
    assert.equal(installStatusline(source, target), false, "unchanged: no write");
    fs.writeFileSync(target, "// old");
    assert.equal(installStatusline(source, target), true, "stale: replaced");
    assert.equal(fs.readFileSync(target, "utf8"), fs.readFileSync(source, "utf8"));

    // Run the installed copy the way settings.json does, with HOME pointed at
    // a temp dir: no standing yet, then one.
    const env = { ...process.env, HOME: dir, USERPROFILE: dir, NO_COLOR: "1" };
    const run = (...args: string[]) => spawnSync(process.execPath, [target, ...args], { env, encoding: "utf8", input: "{}" });
    assert.equal(run().stdout, "vr · run npx viberank-cli\n");
    fs.mkdirSync(path.join(dir, ".viberank"));
    fs.writeFileSync(path.join(dir, ".viberank", "standing.json"), JSON.stringify({
      version: 1, username: "you", weekId: "2026-W48", weekDay: 3, weekClosesAt: "2999-01-01T00:00:00Z",
      cls: "ranked", heldReason: null, rank: 41, of: 126, movement: 6, cost: 835, tokens: 1e9, planEq: 0.6,
      gap: 27, above: "palewave", streakWeeks: 4, updatedAt: "2026-11-25T14:00:00Z",
    }));
    assert.equal(run().stdout, "vr #41/126 ▲6 · $27 to @palewave\n");
    assert.equal(run("--format", "compact").stdout, "#41 ▲6\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  check("the status line installs to a stable path and prints from the standing file");
}

console.log(`\n${passed} checks passed`);
