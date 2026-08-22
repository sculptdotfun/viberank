import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const { SITE_URL, profileUrl, badgeUrl, badgeMarkdown } =
  await import("../src/lib/site.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

{
  assert.equal(SITE_URL, "https://www.viberank.app");
  assert.ok(!SITE_URL.endsWith("/"), "callers concatenate a leading-slash path");
  check("SITE_URL is the canonical host, no trailing slash");
}

{
  assert.equal(profileUrl("nikshepsvn"), "https://www.viberank.app/profile/nikshepsvn");
  assert.equal(badgeUrl("nikshepsvn"), "https://www.viberank.app/api/badge/nikshepsvn");
  check("profile and badge URLs are built from the canonical host");
}

{
  // A handle reaches these from a submission body, so it is untrusted input
  // that ends up inside markdown someone pastes into a README.
  const md = badgeMarkdown("a b/c?d#e");
  assert.ok(!/[ ?#]/.test(md.split("](")[0]), "the image URL is escaped");
  assert.equal(badgeUrl("a b"), "https://www.viberank.app/api/badge/a%20b");
  check("handles are percent-encoded before they land in markdown");
}

{
  const md = badgeMarkdown("nikshepsvn");
  assert.equal(md,
    "[![viberank](https://www.viberank.app/api/badge/nikshepsvn)]" +
    "(https://www.viberank.app/profile/nikshepsvn)");
  check("badge markdown links the image to the profile it describes");
}

{
  // The regression guard. The apex 307s to www, so an apex URL we hand to a
  // third party costs a redirect — and for /api/stats, a client that does not
  // follow redirects gets the body "Redirecting..." where JSON was promised.
  // site.ts is exempt: its comment quotes the broken call deliberately.
  const EXEMPT = new Set(["src/lib/site.ts"]);
  const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel"]);
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.(ts|tsx|mts|js|jsx|json|md|txt|xml)$/.test(entry)) continue;
      if (EXEMPT.has(path)) continue;
      readFileSync(path, "utf8").split("\n").forEach((line, i) => {
        if (/https:\/\/viberank\.app/.test(line)) offenders.push(`${path}:${i + 1}`);
      });
    }
  };
  for (const root of ["src", "packages", "public"]) walk(root);
  for (const f of ["README.md"]) {
    if (/https:\/\/viberank\.app/.test(readFileSync(f, "utf8"))) offenders.push(f);
  }

  assert.deepEqual(offenders, [],
    `apex URLs must use SITE_URL from src/lib/site.ts:\n  ${offenders.join("\n  ")}`);
  check("no apex viberank.app URL is emitted anywhere in the tree");
}

console.log(`\n${passed} checks passed`);
