import assert from "node:assert/strict";

const { parseArgs, submitMode, helpText, blockedMessage, COMMANDS, OPTIONS } =
  await import("../packages/viberank-cli/lib/args.js");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

{
  // THE regression: every `--` argument used to be filtered out before the
  // command was read, so `npx viberank-cli --help` started a submission.
  for (const flag of ["--help", "-h"]) {
    const parsed = parseArgs([flag]);
    assert.equal(parsed.flags.help, true, flag);
    assert.equal(parsed.command, undefined);
  }
  for (const flag of ["--version", "-v"]) assert.equal(parseArgs([flag]).flags.version, true, flag);
  assert.equal(parseArgs(["status", "--help"]).flags.help, true, "after a command too");
  check("--help/-h and --version/-v are read, not dropped");
}

{
  const parsed = parseArgs(["submit", "--user", "@octocat", "--yes"]);
  assert.equal(parsed.command, "submit");
  assert.equal(parsed.flags.user, "octocat", "a leading @ is the display form, not the handle");
  assert.equal(parsed.flags.yes, true);
  assert.equal(parseArgs(["--user=octocat", "-y"]).flags.user, "octocat");
  assert.equal(parseArgs(["-y"]).flags.yes, true);
  check("--user <handle> and --yes parse in either spelling");
}

{
  const token = `vbr_${"a".repeat(43)}`;
  assert.equal(parseArgs(["login", "--token", token]).flags.token, token);
  assert.equal(parseArgs(["login", `--token=${token}`]).flags.token, token);
  assert.deepEqual(parseArgs(["login", "--token"]).missing, ["--token"]);
  assert.deepEqual(parseArgs(["--user", "--yes"]).missing, ["--user"], "a forgotten value is not a handle called --yes");
  assert.equal(parseArgs(["--user", "--yes"]).flags.yes, true);
  check("options that take a value report a missing one");
}

{
  assert.deepEqual(parseArgs(["--bogus", "submit"]).unknown, ["--bogus"]);
  assert.equal(parseArgs(["autosubmit", "off"]).arg, "off");
  assert.equal(parseArgs(["submit", "--quiet"]).flags.quiet, true, "the scheduled job's own argv");
  assert.equal(parseArgs(["--", "--help"]).flags.help, false, "-- ends the options");
  check("unknown options are reported; positional arguments survive");
}

{
  const base = { quiet: false, interactive: false, hasToken: false, user: null, yes: false };
  // THE regression for Claude Code's Bash tool, CI and pipes: no TTY used to
  // mean "scheduled", which demanded a token and pointed at autosubmit.
  assert.equal(submitMode({ ...base, quiet: true }), "scheduled", "only --quiet means scheduled");
  assert.equal(submitMode({ ...base, quiet: true, interactive: true }), "scheduled");
  assert.equal(submitMode({ ...base, interactive: true }), "interactive");
  assert.equal(submitMode({ ...base, interactive: true, user: "octocat" }), "interactive", "a person can still be asked");
  assert.equal(submitMode({ ...base, hasToken: true }), "unattended", "a token is enough without a terminal");
  assert.equal(submitMode({ ...base, user: "octocat", yes: true }), "unattended", "--user with --yes submits unverified");
  assert.equal(submitMode({ ...base, user: "octocat" }), "blocked", "--user alone is not consent to submit");
  assert.equal(submitMode({ ...base, yes: true }), "blocked", "--yes alone has no account to submit to");
  assert.equal(submitMode(base), "blocked");
  check("a run without a terminal is never treated as scheduled, and never prompts");
}

{
  const text = blockedMessage().join("\n");
  assert.match(text, /own terminal/);
  assert.match(text, /--user <github-handle> --yes/);
  assert.match(text, /login --token/);
  assert.match(text, /VIBERANK_TOKEN/);
  check("the blocked message names every way forward");
}

{
  const text = helpText();
  for (const [name] of COMMANDS) assert.ok(text.includes(`  ${name}`), `help lists ${name}`);
  for (const option of OPTIONS) {
    for (const name of option.names) assert.ok(text.includes(name), `help lists ${name}`);
  }
  // Every option the parser accepts is one help documents, and vice versa.
  for (const option of OPTIONS) {
    for (const name of option.names) {
      const parsed = parseArgs(option.value ? [name, "x"] : [name]);
      assert.deepEqual(parsed.unknown, [], `${name} parses`);
    }
  }
  check("help lists every command and every option the parser knows");
}

console.log(`\n${passed} checks passed`);
