// Categorical palette for the dark surface (#0f0f12), validated with the
// dataviz six-check script (lightness band, chroma floor, CVD separation,
// normal-vision floor, contrast vs surface). Kept for series that have no
// vendor (tools that run any model, generic lists).
export const SERIES_COLORS = ["#d95926", "#3987e5", "#199e70", "#c98500", "#d55181", "#9085e9"];

/**
 * Neutral bucket for "everything else" — never a categorical hue. Darker
 * than the Moonshot slate so the two can't be read as one; it only ever
 * appears labeled "Other".
 */
export const OTHER_COLOR = "#63636d";

/** Color for the nth-ranked series in a list; overflow folds into gray. */
export function seriesColor(index: number): string {
  return index < SERIES_COLORS.length ? SERIES_COLORS[index] : OTHER_COLOR;
}

// ---------------------------------------------------------------------------
// Vendor colors
// ---------------------------------------------------------------------------
// Coloring by rank painted whatever came second blue, so a profile whose top
// two models were both Claude showed one of them in OpenAI's color. A model
// now takes its vendor's family, and models of the same vendor take that
// family's shades in list order: Claude in oranges and golds, OpenAI in
// blues, and so on. Checked against the chart surface with the dataviz
// validator: vendor base colors are at least ΔE 9.8 apart, shades within a
// family 11–14 (deliberately close — they read as one vendor — so every
// chart names its series in a legend), and every mark clears 3:1 contrast.
// xAI and Moonshot are brand-dark; on this near-black surface they are drawn
// as their light inverse (off-white, slate) or they would vanish.

export type Vendor =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek"
  | "moonshot"
  | "meta"
  | "mistral"
  | "qwen"
  | "zhipu";

export const VENDOR_SHADES: Record<Vendor, string[]> = {
  anthropic: ["#d95926", "#f5af20", "#965200", "#f7d7a8"],
  openai: ["#3987e5", "#8fc2fd", "#0360b2"],
  google: ["#199e70", "#7fd3a8"],
  xai: ["#e6e6ea", "#a9a9b6"],
  deepseek: ["#4f5dff", "#9aa3ff"],
  moonshot: ["#8b94a6"],
  meta: ["#a45ee5", "#dcb0ff", "#7a3fc4"],
  mistral: ["#d55181", "#f08fb0"],
  qwen: ["#1fa9b8", "#6fd6e0"],
  zhipu: ["#8fb339"],
};

/**
 * For series with no single vendor (harnesses that run any model) or a
 * vendor whose shades are used up: the hues farthest (ΔE) from every vendor
 * shade on this surface, so an unknown model never reads as a known vendor.
 */
const UNAFFILIATED = ["#c9ed44", "#7f6eaf", "#b12b50", "#9c3294", "#dc9e79"];

// Order matters: a routed name like "[openclaw] anthropic/claude-opus-4.6"
// is matched on its model, and "gpt" must not claim "chatgpt"-less strings
// like "[pi] …" — each rule is a word or a known prefix.
const VENDOR_RULES: [Vendor, RegExp][] = [
  ["anthropic", /\b(claude|anthropic|opus|sonnet|haiku|fable|mythos)\b|claude-/],
  ["openai", /\b(gpt|openai|chatgpt|codex)\b|gpt-|\bo[1345](-|$)/],
  ["google", /\b(gemini|gemma|google)\b|gemini-/],
  ["xai", /\b(grok|xai|x-ai)\b|grok-/],
  ["deepseek", /deepseek/],
  ["moonshot", /\b(kimi|moonshot|moonshotai)\b|kimi-/],
  ["meta", /\b(llama|meta|meta-llama|muse)\b|llama-/],
  ["mistral", /\b(mistral|codestral|devstral|magistral|ministral)\b/],
  ["qwen", /\b(qwen|alibaba)\b|qwen/],
  ["zhipu", /\b(glm|z-ai|zhipu|zai)\b|glm-/],
];

/** The vendor behind a model name, or null for unknown models. */
export function vendorOfModel(name: string): Vendor | null {
  const n = name.toLowerCase();
  return VENDOR_RULES.find(([, re]) => re.test(n))?.[0] ?? null;
}

/**
 * Tools that are one vendor's own client take that vendor's family; model
 * harnesses (OpenCode, OpenClaw, pi, Hermes, Amp, …) run anything, so they
 * get unaffiliated hues rather than borrowing a vendor's.
 */
const TOOL_VENDORS: Record<string, Vendor> = {
  claude: "anthropic",
  codex: "openai",
  gemini: "google",
  antigravity: "google",
  grok: "xai",
  kimi: "moonshot",
  qwen: "qwen",
  deepseek: "deepseek",
  zcode: "zhipu",
};

export function vendorOfTool(tool: string): Vendor | null {
  return TOOL_VENDORS[tool.toLowerCase()] ?? null;
}

/**
 * Colors for a ranked list of series, in the same order. Each series takes
 * the next unused shade of its vendor's family; unknown vendors and
 * exhausted families take the next unaffiliated hue, then gray. A name that
 * appears twice gets the same color both times.
 */
function assignColors(names: string[], vendorOf: (name: string) => Vendor | null): string[] {
  const used = new Map<Vendor, number>();
  const byName = new Map<string, string>();
  let spare = 0;
  const nextSpare = () => (spare < UNAFFILIATED.length ? UNAFFILIATED[spare++] : OTHER_COLOR);

  return names.map((name) => {
    const known = byName.get(name);
    if (known) return known;
    const vendor = vendorOf(name);
    let color: string;
    if (vendor) {
      const i = used.get(vendor) ?? 0;
      used.set(vendor, i + 1);
      color = i < VENDOR_SHADES[vendor].length ? VENDOR_SHADES[vendor][i] : nextSpare();
    } else {
      color = nextSpare();
    }
    byName.set(name, color);
    return color;
  });
}

export function modelColors(models: string[]): string[] {
  return assignColors(models, vendorOfModel);
}

export function toolColors(tools: string[]): string[] {
  return assignColors(tools, vendorOfTool);
}
