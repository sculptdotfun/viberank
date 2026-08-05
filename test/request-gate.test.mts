import assert from "node:assert/strict";

const { createRequestGate } = await import("../src/lib/data/hooks/requestGate.ts");

let passed = 0;
const check = (label: string) => { passed++; console.log(`✓ ${label}`); };

{
  const gate = createRequestGate();
  const only = gate.begin();
  assert.equal(gate.isCurrent(only), true);
  check("a lone request is current");
}

{
  // The actual bug: page 2 starts, sort changes, page 0 starts, page 2 lands
  // last. Its result must be dropped.
  const gate = createRequestGate();
  const page2 = gate.begin();
  const page0 = gate.begin();

  assert.equal(gate.isCurrent(page0), true, "the newest request wins");
  assert.equal(gate.isCurrent(page2), false, "a superseded response is dropped");
  check("a slow earlier response cannot overwrite a newer one");
}

{
  // And it must stay dropped — a stale `finally` must not clear the newer
  // request's loading flag either.
  const gate = createRequestGate();
  const stale = gate.begin();
  gate.begin();
  for (let i = 0; i < 5; i++) assert.equal(gate.isCurrent(stale), false);
  check("a superseded request never becomes current again");
}

{
  const gate = createRequestGate();
  const inFlight = gate.begin();
  gate.abandon();
  assert.equal(gate.isCurrent(inFlight), false, "unmount must discard in-flight work");
  const next = gate.begin();
  assert.equal(gate.isCurrent(next), true, "the gate is reusable after abandoning");
  check("abandon() discards in-flight requests and stays usable");
}

{
  // Many rapid param changes — only the last may apply.
  const gate = createRequestGate();
  const tokens = Array.from({ length: 50 }, () => gate.begin());
  const current = tokens.filter((t) => gate.isCurrent(t));
  assert.equal(current.length, 1, "exactly one request may be current");
  assert.equal(current[0], tokens[tokens.length - 1]);
  check("under rapid changes exactly one request is current");
}

console.log(`\n${passed} passed, 0 failed`);
