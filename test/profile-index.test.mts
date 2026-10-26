/**
 * Which profiles belong in search. The sitemap and the page's robots tag
 * share one rule; they used to disagree, and the sitemap listed noindex pages.
 */
import assert from "node:assert/strict";

const { isGithubHandle, isIndexableProfile, indexableProfiles } = await import("../src/lib/profile-index.ts");

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

{
  for (const ok of ["torvalds", "a", "nikshepsvn", "sculpt-dot-fun", "A1b2", "x".repeat(39)]) {
    assert.ok(isGithubHandle(ok), ok);
  }
  for (const bad of [
    "Kevin Foster", // git config user.name, the source of most legacy handles
    "kevin.foster",
    "-leading",
    "trailing-",
    "double--hyphen",
    "under_score",
    "x".repeat(40),
    "",
    "$(whoami)",
  ]) {
    assert.ok(!isGithubHandle(bad), bad);
  }
  assert.ok(!isGithubHandle(null));
  assert.ok(!isGithubHandle(undefined));
  check("GitHub handles: letters, digits, single inner hyphens, at most 39");
}

{
  assert.ok(isIndexableProfile({ handle: "torvalds", submissionCount: 1 }));
  assert.ok(!isIndexableProfile({ handle: "torvalds", submissionCount: 0 }), "no real submissions, no listing");
  assert.ok(!isIndexableProfile({ handle: "Kevin Foster", submissionCount: 3 }), "not a GitHub handle, no listing");
  check("indexable means real submissions under a real handle");
}

{
  const listed = indexableProfiles(
    [
      { username: "torvalds", githubUsername: "torvalds", updatedAt: "2026-10-01" }, // stale counter, no rows
      { username: "Kevin Foster", githubUsername: "Kevin Foster", updatedAt: "2026-10-02" },
      { username: "Alice", githubUsername: "Alice", updatedAt: "2026-10-03" },
      { username: "alice", githubUsername: "alice", updatedAt: "2026-09-01" }, // second casing
      { username: "bob", githubUsername: null, updatedAt: null },
    ],
    ["ALICE", "Kevin Foster", "bob", "bob"]
  );
  assert.deepEqual(listed, [
    { handle: "Alice", updatedAt: "2026-10-03" },
    { handle: "bob", updatedAt: null },
  ]);
  check("the sitemap counts real submission rows, case aside, one entry per handle");
}

console.log(`\n${passed} passed`);
