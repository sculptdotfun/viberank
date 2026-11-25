import assert from "node:assert/strict";

const { renderBadge, badgeCost, badgeTokens, isBadgeMetric, badgeLabelFor } =
  await import("../src/lib/badge.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

{
  const svg = renderBadge({ label: "viberank", value: "#42" });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="viberank: #42"/, "screen readers need the value");
  assert.ok(svg.length < 1500, `a badge should be small, got ${svg.length} bytes`);
  check("renders a small, self-contained, labelled SVG");
}

{
  // A badge is rendered from a URL path segment, so a username is untrusted
  // input that ends up inside markup.
  const svg = renderBadge({ label: 'a"><script>alert(1)</script>', value: "x" });
  assert.ok(!svg.includes("<script>"), "must not emit a raw script tag");
  assert.ok(!/(?<!&quot;)"><script/.test(svg), "must not break out of an attribute");
  assert.ok(svg.includes("&lt;script&gt;"), "angle brackets are escaped");
  assert.ok(svg.includes("&quot;"), "quotes are escaped");
  check("escapes markup so a crafted username cannot inject");
}

{
  const svg = renderBadge({ label: "&", value: "<>'\"" });
  assert.ok(svg.includes("&amp;"));
  assert.ok(svg.includes("&apos;"));
  assert.ok(!/[<>]/.test(svg.split("<title>")[1].split("</title>")[0].replace(/&[a-z]+;/g, "")),
    "title content carries no raw angle brackets");
  check("all five XML entities are escaped");
}

{
  // Wider text must produce a wider badge, or long values overflow the box.
  const narrow = renderBadge({ label: "a", value: "1" });
  const wide = renderBadge({ label: "viberank rank", value: "#1,234" });
  const widthOf = (s: string) => Number(/width="(\d+)"/.exec(s)![1]);
  assert.ok(widthOf(wide) > widthOf(narrow), "geometry tracks content length");
  assert.ok(widthOf(narrow) >= 30, "even a tiny badge keeps its padding");
  check("badge width grows with its content");
}

{
  assert.equal(badgeCost(0), "$0");
  assert.equal(badgeCost(950), "$950");
  assert.equal(badgeCost(1_500), "$2K");
  assert.equal(badgeCost(205_112), "$205K");
  assert.equal(badgeCost(8_500_000), "$8.5M");
  // Degenerate inputs must not reach a README as "$NaN".
  for (const bad of [NaN, Infinity, -5]) assert.equal(badgeCost(bad), "$0", `bad: ${bad}`);
  check("cost formatting is compact and never NaN");
}

{
  assert.equal(badgeTokens(0), "0");
  assert.equal(badgeTokens(940_000_000), "940M");
  assert.equal(badgeTokens(26_100_000_000), "26.1B");
  assert.equal(badgeTokens(9_200_000_000_000), "9.2T");
  for (const bad of [NaN, Infinity, -1]) assert.equal(badgeTokens(bad), "0", `bad: ${bad}`);
  check("token formatting is compact and never NaN");
}

{
  assert.equal(isBadgeMetric("rank"), true);
  assert.equal(isBadgeMetric("cost"), true);
  assert.equal(isBadgeMetric("tokens"), true);
  for (const bad of ["", "RANK", "spend", null]) {
    assert.equal(isBadgeMetric(bad as string), false, `must reject ${bad}`);
  }
  check("only known metrics are accepted");
}

{
  assert.equal(badgeLabelFor("rank"), "viberank");
  assert.equal(badgeLabelFor("cost"), "ai spend");
  assert.equal(badgeLabelFor("tokens"), "tokens");
  check("each metric has a label");
}

{
  // #198: rolling-window badges.
  const { isBadgeRange, badgeSortFrom, badgeRangeWindow, rankInWindow } = await import("../src/lib/badge.ts");
  for (const range of ["7d", "30d", "week"]) assert.equal(isBadgeRange(range), true, range);
  for (const bad of ["", "1y", "WEEK", null]) assert.equal(isBadgeRange(bad as string), false, `must reject ${bad}`);
  assert.equal(badgeSortFrom("tokens"), "tokens");
  for (const other of ["cost", "efficiency", "", null]) assert.equal(badgeSortFrom(other as string), "cost");
  check("only known ranges are accepted; unknown sorts fall back to cost");
}

{
  const { badgeRangeWindow } = await import("../src/lib/badge.ts");
  const wednesday = new Date("2026-11-25T23:30:00Z");
  assert.deepEqual(badgeRangeWindow("7d", wednesday), { from: "2026-11-19", to: "2026-11-25" });
  assert.deepEqual(badgeRangeWindow("30d", wednesday), { from: "2026-10-27", to: "2026-11-25" });
  assert.deepEqual(badgeRangeWindow("week", wednesday), { from: "2026-11-23", to: "2026-11-25" });
  // Monday's week is just Monday; Sunday's reaches back six days.
  assert.deepEqual(badgeRangeWindow("week", new Date("2026-11-23T00:00:00Z")), { from: "2026-11-23", to: "2026-11-23" });
  assert.deepEqual(badgeRangeWindow("week", new Date("2026-11-29T12:00:00Z")), { from: "2026-11-23", to: "2026-11-29" });
  check("ranges are inclusive UTC windows ending today");
}

{
  const { rankInWindow } = await import("../src/lib/badge.ts");
  const rows = [
    { userKey: "alice", username: "Alice", cost: 900, tokens: 1_000_000_000 },
    { userKey: "bob", username: "bob-gh", cost: 1_200, tokens: 400_000_000 },
    { userKey: "carol", username: "carol", cost: 300, tokens: 3_000_000_000 },
    { userKey: "idle", username: "idle", cost: 0, tokens: 0 },
  ];
  assert.deepEqual(rankInWindow(rows, "bob", "cost"), { rank: 1, of: 3, cost: 1_200, tokens: 400_000_000 });
  assert.equal(rankInWindow(rows, "carol", "tokens")?.rank, 1, "tokens sort ranks the heavy-cache user first");
  assert.equal(rankInWindow(rows, "carol", "cost")?.rank, 3);
  assert.equal(rankInWindow(rows, "ALICE", "cost")?.rank, 2, "handles match case-insensitively");
  assert.equal(rankInWindow(rows, "bob-gh", "cost")?.rank, 1, "the GitHub login matches too");
  assert.equal(rankInWindow(rows, "idle", "cost"), null, "no usage in the window is no rank");
  assert.equal(rankInWindow(rows, "nobody", "cost"), null);
  check("rank in a window follows the sort and skips empty rows");
}

{
  assert.equal(badgeLabelFor("rank", "30d"), "viberank 30d");
  assert.equal(badgeLabelFor("tokens", "week"), "tokens this week");
  assert.equal(badgeLabelFor("cost", "7d"), "ai spend 7d");
  check("range badges name their window");
}

{
  const { renderBadgeV2, badgeStyleFrom, V2_BADGE } = await import("../src/lib/badge.ts");
  assert.equal(badgeStyleFrom("v2"), "v2");
  for (const other of [null, "", "V2", "flat"]) assert.equal(badgeStyleFrom(other as string), "classic");
  const rank = renderBadgeV2({ label: "viberank this week", value: "#12", heat: true });
  assert.match(rank, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(rank.includes(`fill="${V2_BADGE.ground}"`), "warm near-black ground");
  assert.ok(rank.includes(`fill="${V2_BADGE.heat}"`), "the rank is in heat");
  assert.ok(rank.includes("Geist"), "Geist first in the font stack");
  assert.ok(!rank.includes("linearGradient"), "flat, no shields gradient");
  assert.match(rank, /aria-label="viberank this week: #12"/);
  const muted = renderBadgeV2({ label: "tokens", value: "940M" });
  assert.ok(!muted.includes(V2_BADGE.heat) && muted.includes(`fill="${V2_BADGE.ink}"`), "non-rank values use ink");
  assert.ok(!renderBadgeV2({ label: '"><script>', value: "x" }).includes("<script>"), "escapes markup");
  check("style=v2 renders the v2 look and the classic look stays the default");
}

console.log(`\n${passed} passed, 0 failed`);
