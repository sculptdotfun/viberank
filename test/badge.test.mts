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

console.log(`\n${passed} passed, 0 failed`);
