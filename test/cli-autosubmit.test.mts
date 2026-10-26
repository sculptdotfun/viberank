import assert from "node:assert/strict";

const {
  stableNodePath, schedulePath, scheduleMinute, invocation, plist, systemdUnits, systemdQuote,
  windowsScript, windowsQuote, isOutdatedJob, parseLaunchctlPrint, parseSystemdShow, parseSchtasksQuery,
  FALLBACK_PATH,
} = await import("../packages/viberank-cli/lib/autosubmit.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

// Every scheduler text below is checked as a string. Nothing here loads a job.

const brewKeg = "/opt/homebrew/Cellar/node/24.7.0/bin/node";
const links: Record<string, string> = {
  "/opt/homebrew/bin/node": brewKeg,
  "/opt/homebrew/opt/node/bin/node": brewKeg,
  [brewKeg]: brewKeg,
};
const realpath = (p: string) => links[p] ?? null;
const files = (...present: string[]) => (p: string) => present.includes(p);

{
  // THE regression for the Homebrew half of exit 127: process.execPath is the
  // versioned keg, which `brew upgrade` deletes. The same binary is on PATH
  // under a name that survives upgrades.
  const node = stableNodePath({
    execPath: brewKeg,
    pathEnv: "/Users/me/.local/bin:/opt/homebrew/bin:/usr/bin:/bin",
    platform: "darwin",
    isFile: files("/opt/homebrew/bin/node", brewKeg),
    realpath,
  });
  assert.equal(node, "/opt/homebrew/bin/node");
  check("a Homebrew node is scheduled by its PATH name, not the versioned keg");
}

{
  // A keg directory on PATH itself is skipped: it is the thing that disappears.
  const node = stableNodePath({
    execPath: brewKeg,
    pathEnv: "/opt/homebrew/Cellar/node/24.7.0/bin:/opt/homebrew/bin",
    platform: "darwin",
    isFile: files("/opt/homebrew/bin/node", brewKeg),
    realpath,
  });
  assert.equal(node, "/opt/homebrew/bin/node");
  check("a /Cellar/ entry on PATH is never chosen");
}

{
  // A version-manager shim earlier on PATH runs some other node; only a name
  // for this very binary will do.
  const node = stableNodePath({
    execPath: brewKeg,
    pathEnv: "/Users/me/.volta/bin:/opt/homebrew/bin",
    platform: "darwin",
    isFile: files("/Users/me/.volta/bin/node", "/opt/homebrew/bin/node", brewKeg),
    realpath: (p: string) => (p === "/Users/me/.volta/bin/node" ? "/Users/me/.volta/bin/volta-shim" : realpath(p)),
  });
  assert.equal(node, "/opt/homebrew/bin/node");
  check("a shim for a different node is passed over");
}

{
  // Nothing useful on PATH (an IDE's stripped environment): Homebrew's own
  // stable link for the formula still names this binary.
  const node = stableNodePath({
    execPath: brewKeg,
    pathEnv: "/usr/bin:/bin",
    platform: "darwin",
    isFile: files("/opt/homebrew/opt/node/bin/node", brewKeg),
    realpath,
  });
  assert.equal(node, "/opt/homebrew/opt/node/bin/node");
  check("falls back to <prefix>/opt/<formula> when PATH has no stable name");
}

{
  const nvm = "/Users/me/.nvm/versions/node/v22.11.0/bin/node";
  assert.equal(stableNodePath({
    execPath: nvm, pathEnv: "/usr/bin:/bin", platform: "darwin", isFile: () => false, realpath: () => null,
  }), nvm);
  assert.equal(stableNodePath({
    execPath: nvm,
    pathEnv: "relative/bin:/proj/node_modules/.bin:/Users/me/.nvm/versions/node/v22.11.0/bin",
    platform: "linux",
    isFile: files("/proj/node_modules/.bin/node", nvm),
    realpath: (p: string) => p,
  }), nvm, "relative and node_modules entries are ignored");
  check("otherwise the running node is kept, as before");
}

{
  const win = "C:\\Program Files\\nodejs\\node.exe";
  assert.equal(stableNodePath({
    execPath: win,
    pathEnv: "C:\\Windows\\system32;C:\\Program Files\\nodejs\\",
    platform: "win32",
    isFile: files(win),
    realpath: (p: string) => p,
  }), win);
  check("windows finds node.exe on a ;-separated PATH");
}

{
  assert.equal(schedulePath("/opt/homebrew/bin/node"), "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin");
  assert.equal(schedulePath("/Users/me/.nvm/versions/node/v22.11.0/bin/node"),
    ["/Users/me/.nvm/versions/node/v22.11.0/bin", ...FALLBACK_PATH].join(":"));
  check("schedule PATH puts node's directory first, then the usual places, without repeats");
}

{
  const minutes = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const minute = scheduleMinute(`machine-${i}`);
    assert.ok(Number.isInteger(minute) && minute >= 0 && minute <= 59);
    minutes.add(minute);
  }
  assert.equal(scheduleMinute("5f2b0c4e-1111-4a5a-9e0f-1234567890ab"), scheduleMinute("5f2b0c4e-1111-4a5a-9e0f-1234567890ab"));
  assert.ok(minutes.size > 45, `machines spread across the hour (${minutes.size} distinct minutes)`);
  check("the schedule minute is fixed per machine and spread across the hour");
}

{
  const npxCli = "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js";
  const ephemeral = invocation({
    node: "/opt/homebrew/bin/node",
    cli: "/Users/me/.npm/_npx/abc123/node_modules/viberank-cli/cli.js",
    resolveNpx: ({ execPath }: { execPath?: string } = {}) => ({ argv: [execPath, npxCli], shell: false }),
  });
  assert.deepEqual(ephemeral.argv, ["/opt/homebrew/bin/node", npxCli, "-y", "viberank-cli@latest"]);
  assert.equal(ephemeral.durable, false);

  const durable = invocation({ node: "/usr/local/bin/node", cli: "/usr/local/lib/node_modules/viberank-cli/cli.js" });
  assert.deepEqual(durable.argv, ["/usr/local/bin/node", "/usr/local/lib/node_modules/viberank-cli/cli.js"]);
  assert.equal(durable.durable, true);
  check("the job runs the stable node, via npx only when this copy is in npm's cache");
}

const argv = ["/opt/homebrew/bin/node", "/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js", "-y", "viberank-cli@latest", "submit", "--quiet"];

{
  // THE regression for exit 127 under launchd: no PATH at all, so the
  // `#!/usr/bin/env node` bins npx starts could not find node.
  const text = plist({ hour: 9, minute: 37, argv, pathValue: schedulePath(argv[0]), logFile: "/Users/me/.viberank/autosubmit.log" });
  assert.match(text, /<key>EnvironmentVariables<\/key>\s*<dict><key>PATH<\/key><string>\/opt\/homebrew\/bin:\/usr\/local\/bin:\/usr\/bin:\/bin<\/string><\/dict>/);
  assert.match(text, /<key>Hour<\/key><integer>9<\/integer><key>Minute<\/key><integer>37<\/integer>/);
  for (const a of argv) assert.ok(text.includes(`<string>${a}</string>`), `argv word ${a}`);
  assert.ok(!text.includes("/Cellar/"), "no versioned keg path");
  for (const [, body] of text.matchAll(/<!--([\s\S]*?)-->/g)) {
    assert.ok(!body.includes("--"), "an XML comment may not contain a double hyphen");
  }
  assert.equal(isOutdatedJob("launchd", text), false);
  check("plist carries an explicit PATH and the per-machine minute");
}

{
  const text = plist({ hour: 7, minute: 5, argv: ["/Users/A&B <x>/node", "cli.js"], pathValue: "/Users/A&B <x>:/bin" });
  assert.ok(text.includes("<string>/Users/A&amp;B &lt;x&gt;/node</string>"));
  assert.ok(text.includes("<string>/Users/A&amp;B &lt;x&gt;:/bin</string>"));
  check("plist escapes XML in paths");
}

{
  const old = `<plist><dict><key>Label</key><string>app.viberank.autosubmit</string>
<key>ProgramArguments</key><array><string>/opt/homebrew/Cellar/node/24.7.0/bin/node</string></array></dict></plist>`;
  assert.equal(isOutdatedJob("launchd", old), true);
  assert.equal(isOutdatedJob("systemd", "[Service]\nExecStart=/usr/bin/node cli.js submit --quiet\n"), true);
  assert.equal(isOutdatedJob("schtasks", null), true, "no script means the old inline /TR");
  check("a job written before 1.13 is recognised as unable to start");
}

{
  const units = systemdUnits({
    hour: 9,
    minute: 4,
    argv: ["/home/me/My Node/bin/node", "/home/me/.npm/_npx/x/cli.js", "-y", "100%$HOME\"q\\", "submit", "--quiet"],
    pathValue: "/home/me/My Node/bin:/usr/local/bin:/usr/bin:/bin",
  });
  assert.ok(units.service.includes('Environment="PATH=/home/me/My Node/bin:/usr/local/bin:/usr/bin:/bin"\n'));
  assert.ok(units.service.includes(
    'ExecStart="/home/me/My Node/bin/node" /home/me/.npm/_npx/x/cli.js -y "100%%$$HOME\\"q\\\\" submit --quiet\n'
  ));
  assert.ok(units.timer.includes("OnCalendar=*-*-* 09:04:00\n"));
  assert.ok(units.timer.includes("Persistent=true"));
  assert.equal(isOutdatedJob("systemd", units.service), false);
  check("systemd units quote args, escape % and $, set PATH, and use the minute");
}

{
  assert.equal(systemdQuote("/usr/bin/node"), "/usr/bin/node");
  assert.equal(systemdQuote("a b"), '"a b"');
  assert.equal(systemdQuote("50%"), "50%%");
  assert.equal(systemdQuote("$X"), '"$$X"');
  assert.equal(systemdQuote(";"), '";"', "a lone semicolon is not a command separator");
  check("systemdQuote leaves plain words alone and quotes the rest");
}

{
  const node = "C:\\Program Files\\nodejs\\node.exe";
  const npxCli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js";
  const text = windowsScript({ argv: [node, npxCli, "-y", "viberank-cli@latest", "submit", "--quiet"], nodePath: node });
  const lines = text.split("\r\n");
  assert.equal(lines[0], "@echo off");
  assert.ok(lines.includes('set "PATH=C:\\Program Files\\nodejs;%PATH%"'), "node's directory first on the child's PATH");
  assert.ok(lines.includes(`"${node}" "${npxCli}" -y viberank-cli@latest submit --quiet`), "full node path, quoted");
  assert.ok(lines.includes("exit /b %ERRORLEVEL%"));
  assert.ok(text.includes("\r\n") && !/[^\r]\n/.test(text), "CRLF line endings throughout");

  const shim = windowsScript({ argv: ["C:\\nodejs\\npx.cmd", "-y", "viberank-cli@latest"], nodePath: "C:\\nodejs\\node.exe" });
  assert.ok(shim.includes("call C:\\nodejs\\npx.cmd -y"), "a .cmd is called, so the script carries on to exit /b");

  assert.equal(windowsQuote("C:\\Users\\a%b\\x"), "C:\\Users\\a%%b\\x");
  assert.equal(windowsQuote("C:\\Users\\Jo Smith\\node.exe"), '"C:\\Users\\Jo Smith\\node.exe"');
  check("the Task Scheduler script sets PATH and runs the full node path");
}

{
  assert.deepEqual(parseLaunchctlPrint("\truns = 3\n\tlast exit code = 127\n"), { ran: true, exitCode: 127 });
  assert.deepEqual(parseLaunchctlPrint("\truns = 0\n\tlast exit code = (never exited)\n"), { ran: false, exitCode: null });
  assert.equal(parseLaunchctlPrint("state = running"), null);

  assert.deepEqual(parseSystemdShow("ExecMainStatus=1\nExecMainExitTimestamp=Mon 2026-10-26 09:04:12 UTC\n"),
    { ran: true, exitCode: 1, at: "Mon 2026-10-26 09:04:12 UTC" });
  assert.deepEqual(parseSystemdShow("ExecMainStatus=0\nExecMainExitTimestamp=\n"), { ran: false, exitCode: null });
  assert.equal(parseSystemdShow(""), null);

  assert.deepEqual(parseSchtasksQuery("TaskName: \\viberank-autosubmit\r\nLast Result:   0\r\n"), { ran: true, exitCode: 0 });
  assert.deepEqual(parseSchtasksQuery("Last Result: 267011\r\n"), { ran: false, exitCode: null });
  assert.equal(parseSchtasksQuery("Letztes Ergebnis: 0"), null, "a localized Windows just shows nothing");
  check("each scheduler's last exit code is read, or reported as unknown");
}

console.log(`\n${passed} checks passed`);
