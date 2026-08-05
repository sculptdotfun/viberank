import assert from "node:assert/strict";

const {
  generateToken,
  hashToken,
  looksLikeToken,
  bearerFrom,
  hashesMatch,
  hintFor,
  TOKEN_PREFIX,
} = await import("../src/lib/tokens.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

{
  const t = generateToken();
  assert.ok(t.plaintext.startsWith(TOKEN_PREFIX));
  assert.equal(t.plaintext.length, TOKEN_PREFIX.length + 43, "32 bytes base64url unpadded");
  assert.match(t.plaintext.slice(TOKEN_PREFIX.length), /^[A-Za-z0-9_-]+$/, "shell-safe, no +/=");
  assert.equal(t.hash.length, 64, "sha256 hex");
  assert.ok(looksLikeToken(t.plaintext));
  check("a minted token has the documented shape");
}

{
  // The whole security model rests on these being unpredictable.
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(generateToken().plaintext);
  assert.equal(seen.size, 500, "no collisions across 500 tokens");
  check("tokens are unique across many mints");
}

{
  const t = generateToken();
  assert.equal(hashToken(t.plaintext), t.hash, "hash is reproducible");
  assert.notEqual(t.hash, t.plaintext, "the hash is not the token");
  assert.ok(!t.hash.includes(t.plaintext.slice(TOKEN_PREFIX.length)),
    "the plaintext must not be recoverable from the stored hash");
  check("hashing is deterministic and one-way");
}

{
  const t = generateToken();
  assert.ok(t.hint.startsWith(TOKEN_PREFIX));
  assert.ok(t.hint.length < 20, "a hint is a fragment, not the token");
  assert.ok(!looksLikeToken(t.hint), "a hint must never authenticate");
  assert.ok(t.plaintext.startsWith(t.hint.replace("…", "")), "hint is a real prefix");
  check("the display hint cannot be used as a credential");
}

{
  // Junk must be rejected on shape before it reaches a query.
  const bad = [
    "", "vbr_", "vbr_short", "nope_" + "a".repeat(43),
    TOKEN_PREFIX + "a".repeat(42), TOKEN_PREFIX + "a".repeat(44),
    TOKEN_PREFIX + "a".repeat(42) + "+", TOKEN_PREFIX + "a".repeat(42) + "=",
    null, undefined,
  ];
  for (const v of bad) {
    assert.equal(looksLikeToken(v as string), false, `must reject ${JSON.stringify(v)}`);
  }
  check("malformed tokens are rejected on shape");
}

{
  const t = generateToken();
  assert.equal(bearerFrom(`Bearer ${t.plaintext}`), t.plaintext);
  assert.equal(bearerFrom(`bearer ${t.plaintext}`), t.plaintext, "scheme is case-insensitive");
  assert.equal(bearerFrom(`Bearer   ${t.plaintext}`), t.plaintext, "tolerates extra spacing");

  for (const bad of [
    null, undefined, "", "Bearer", "Bearer ", t.plaintext,
    `Basic ${t.plaintext}`, `Bearer notatoken`, `Bearer ${t.plaintext} extra`,
  ]) {
    assert.equal(bearerFrom(bad as string), null, `must reject header ${JSON.stringify(bad)}`);
  }
  check("bearer parsing accepts only well-formed viberank tokens");
}

{
  const a = hashToken("one");
  const b = hashToken("two");
  assert.equal(hashesMatch(a, a), true);
  assert.equal(hashesMatch(a, b), false);
  assert.equal(hashesMatch(a, a.slice(0, 10)), false, "length mismatch must not throw");
  assert.equal(hashesMatch("", ""), true);
  check("hash comparison is safe against unequal lengths");
}

{
  // A token issued for one user must not hash to another's.
  const t1 = generateToken();
  const t2 = generateToken();
  assert.notEqual(t1.hash, t2.hash);
  assert.equal(hashesMatch(t1.hash, t2.hash), false);
  check("distinct tokens never share a hash");
}

{
  assert.equal(hintFor("vbr_abcdefgh_rest_of_token"), "vbr_abcdefgh…");
  check("hint shows a fixed-length prefix");
}

console.log(`\n${passed} passed, 0 failed`);
