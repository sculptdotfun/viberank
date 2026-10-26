import assert from "node:assert/strict";

const { CCUSAGE, BY_AGENT, ccusageArgs, rejectedFlag, generateReport, parseReport, noUsageHelp, isWsl } =
  await import("../packages/viberank-cli/lib/ccusage.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

type Failure = Error & { stderr?: string; exitCode?: number; timedOut?: boolean };
const fail = (stderr: string, extra: Partial<Failure> = {}): Failure =>
  Object.assign(new Error(stderr.trim().split("\n").pop() || "failed"), { stderr, exitCode: 2, ...extra });
const REPORT = JSON.stringify({ daily: [{ period: "2026-10-25" }], totals: { totalCost: 1, totalTokens: 10 } });

{
  assert.equal(CCUSAGE, "ccusage@20", "pinned to the tested major");
  assert.deepEqual(ccusageArgs([BY_AGENT]), ["-y", "ccusage@20", "daily", "--json", "--by-agent"]);
  check("ccusage is pinned in one place");
}

{
  // What ccusage 20.0.0 prints for a flag it predates, captured from a real run.
  const unknown = fail("Unknown option '--by-agent'\nRun 'ccusage --help' for usage.\n");
  assert.equal(rejectedFlag(unknown, BY_AGENT), true);
  assert.equal(rejectedFlag(fail("Unknown option '--bogus'\n"), BY_AGENT), false, "a different flag is not this one");
  assert.equal(rejectedFlag(fail("npm error code ENOTFOUND\nnpm error network request failed\n"), BY_AGENT), false);
  assert.equal(rejectedFlag(fail("Error: EACCES: permission denied, scandir '/home/me/.claude/projects'\n"), BY_AGENT), false);
  check("only an unknown --by-agent counts as the flag being refused");
}

{
  const calls: string[][] = [];
  const text = await generateReport({
    run: async (args: string[]) => {
      calls.push(args);
      if (args.includes(BY_AGENT)) throw fail("Unknown option '--by-agent'\n");
      return { stdout: REPORT };
    },
  });
  assert.equal(text, REPORT);
  assert.deepEqual(calls.map((c) => c.includes(BY_AGENT)), [true, false]);
  check("an old ccusage that rejects --by-agent is retried once without it");
}

{
  // THE regression: any failure used to trigger a second full run, and the
  // second error replaced the first.
  const calls: string[][] = [];
  const network = fail("npm error code ENOTFOUND\n");
  await assert.rejects(
    generateReport({ run: async (args: string[]) => { calls.push(args); throw network; } }),
    (error: Error) => error === network,
  );
  assert.equal(calls.length, 1, "no second 15-25 s run for a failure it cannot fix");
  check("any other failure is reported as-is, without a retry");
}

{
  await assert.rejects(
    generateReport({
      run: async (args: string[]) => {
        throw args.includes(BY_AGENT) ? fail("Unknown option '--by-agent'\n") : fail("Error: disk on fire\n");
      },
    }),
    (error: Error) => {
      assert.match(error.message, /^Unknown option '--by-agent'/, "the first error leads");
      assert.match(error.message, /Without --by-agent it failed too: Error: disk on fire/);
      return true;
    },
  );
  check("when the retry fails too, the first error is kept and the second added");
}

{
  await assert.rejects(
    generateReport({ timeoutMs: 180_000, run: async () => { throw fail("", { timedOut: true }); } }),
    /did not finish within 180 s/,
  );
  check("a timeout says so, with how long it waited");
}

{
  assert.deepEqual(parseReport(REPORT).daily.length, 1);
  assert.throws(() => parseReport("npm warn exec The following package was not found"), /did not print a JSON report. It printed: npm warn/);
  // THE regression for "Cannot read properties of undefined (reading 'totalCost')".
  assert.throws(() => parseReport(JSON.stringify({ daily: [] })), /not in the shape viberank reads \(no `totals`\)/);
  assert.throws(() => parseReport(JSON.stringify({ totals: { totalCost: 1, totalTokens: 2 } })), /no `daily` list/);
  assert.throws(() => parseReport(JSON.stringify({ daily: [], totals: { cost: 1 } })), /totalCost or totalTokens/);
  assert.throws(() => parseReport("[]"), /not an object/);
  assert.throws(() => parseReport("{}"), new RegExp(CCUSAGE));
  check("a report of the wrong shape gets a readable error");
}

{
  const home = "/home/me";
  const lines = noUsageHelp({ env: {}, home, wsl: false }).join("\n");
  assert.match(lines, /found no usage/);
  assert.match(lines, /~\/\.claude\/projects and ~\/\.config\/claude\/projects/);
  assert.match(lines, /~\/\.codex/);
  assert.match(lines, /different machine/);
  assert.match(lines, /WSL and Windows/);
  assert.match(lines, /CLAUDE_CONFIG_DIR/);

  const custom = noUsageHelp({ env: { CLAUDE_CONFIG_DIR: "/data/claude", CODEX_HOME: "/data/codex" }, home, wsl: true }).join("\n");
  assert.match(custom, /CLAUDE_CONFIG_DIR \(\/data\/claude\)/, "a set CLAUDE_CONFIG_DIR is shown, not the default");
  assert.match(custom, /CODEX_HOME \(\/data\/codex\)/);
  assert.match(custom, /This is WSL/);
  check("zero days of usage explains where ccusage looked and why it may be empty");
}

{
  assert.equal(isWsl({ platform: "linux", env: { WSL_DISTRO_NAME: "Ubuntu" } }), true);
  assert.equal(isWsl({ platform: "linux", env: {}, readFile: () => "Linux version 5.15.153.1-microsoft-standard-WSL2" }), true);
  assert.equal(isWsl({ platform: "linux", env: {}, readFile: () => "Linux version 6.8.0-45-generic" }), false);
  assert.equal(isWsl({ platform: "darwin", env: { WSL_DISTRO_NAME: "x" } }), false);
  check("WSL is recognised from its environment or kernel string");
}

console.log(`\n${passed} checks passed`);
