/**
 * Vendor colors: a model takes its vendor's family, never a color by rank —
 * rank-coloring painted whichever model came second in OpenAI blue.
 */
import assert from "node:assert/strict";

const { modelColors, toolColors, vendorOfModel, vendorOfTool, VENDOR_SHADES, OTHER_COLOR } = await import(
  "../src/lib/chartColors.ts"
);

let passed = 0;
const check = (label: string) => {
  passed++;
  console.log(`✓ ${label}`);
};

{
  const cases: [string, string | null][] = [
    ["claude-opus-5-5", "anthropic"],
    ["claude-fable-5-1", "anthropic"],
    ["[openclaw] anthropic/claude-opus-4.6", "anthropic"],
    ["gpt-6-astra", "openai"],
    ["gpt-5.6-sol", "openai"],
    ["o3-mini", "openai"],
    ["gpt-5-codex", "openai"],
    ["gemini-3-pro-preview", "google"],
    ["[openclaw] google/gemini-3-flash-preview", "google"],
    ["grok-4-fast", "xai"],
    ["x-ai/grok-code-fast-1", "xai"],
    ["deepseek-v4", "deepseek"],
    ["kimi-k2-thinking", "moonshot"],
    ["moonshotai/kimi-k2", "moonshot"],
    ["meta-llama/llama-4-maverick", "meta"],
    ["muse-1", "meta"],
    ["devstral-medium", "mistral"],
    ["qwen3-coder", "qwen"],
    ["[openclaw] z-ai/glm-5", "zhipu"],
    ["arcee-ai/trinity-large-preview", null],
  ];
  for (const [model, vendor] of cases) assert.equal(vendorOfModel(model), vendor, model);
  check("model names resolve to their vendor, including routed names");
}

{
  // The reported case: several Claude models and one GPT. Claude stays in its
  // family, GPT takes blue, whatever the order.
  const colors = modelColors(["claude-opus-5", "gpt-6-astra", "claude-fable-5-1", "claude-opus-5-5"]);
  assert.deepEqual(colors, [
    VENDOR_SHADES.anthropic[0],
    VENDOR_SHADES.openai[0],
    VENDOR_SHADES.anthropic[1],
    VENDOR_SHADES.anthropic[2],
  ]);
  assert.equal(new Set(colors).size, colors.length, "no two series share a color");
  check("Claude models take Anthropic shades in list order; GPT stays blue");
}

{
  const five = modelColors(["claude-a", "claude-b", "claude-c", "claude-d", "claude-e", "claude-f"]);
  assert.equal(new Set(five).size, 6, "an exhausted family falls back to unaffiliated hues, not repeats");
  assert.ok(!five.slice(4).some((c) => Object.values(VENDOR_SHADES).flat().includes(c)), "never borrows another vendor's color");
  const unknown = modelColors(Array.from({ length: 9 }, (_, i) => `mystery-${i}`));
  assert.equal(unknown[8], OTHER_COLOR, "past the unaffiliated hues, gray");
  assert.deepEqual(modelColors(["gpt-5", "gpt-5"]), [VENDOR_SHADES.openai[0], VENDOR_SHADES.openai[0]]);
  check("overflow is unaffiliated then gray; a repeated name keeps its color");
}

{
  assert.equal(vendorOfTool("claude"), "anthropic");
  assert.equal(vendorOfTool("Codex"), "openai");
  assert.equal(vendorOfTool("antigravity"), "google");
  assert.equal(vendorOfTool("grok"), "xai");
  assert.equal(vendorOfTool("opencode"), null, "harnesses run any model");
  const colors = toolColors(["claude", "opencode", "codex", "openclaw"]);
  assert.equal(colors[0], VENDOR_SHADES.anthropic[0]);
  assert.equal(colors[2], VENDOR_SHADES.openai[0]);
  assert.ok(!Object.values(VENDOR_SHADES).flat().includes(colors[1]), "a harness never wears a vendor's color");
  check("vendor clients take their vendor's color; harnesses get their own");
}

console.log(`\n${passed} passed, 0 failed`);
