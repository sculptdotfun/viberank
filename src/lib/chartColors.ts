// Categorical palette for the dark surface (#0f0f12), validated with the
// dataviz six-check script (lightness band, chroma floor, CVD separation,
// normal-vision floor, contrast vs surface). Used everywhere a series needs
// identity — the stacked usage chart, model bar lists, tool bar lists — so a
// model keeps one color across the whole site. Assign by list rank, never
// cycled past OTHER.
export const SERIES_COLORS = ["#d95926", "#3987e5", "#199e70", "#c98500", "#d55181", "#9085e9"];

/** Neutral bucket for "everything else" — never a categorical hue. */
export const OTHER_COLOR = "#6e6e78";

/** Color for the nth-ranked series in a list; overflow folds into gray. */
export function seriesColor(index: number): string {
  return index < SERIES_COLORS.length ? SERIES_COLORS[index] : OTHER_COLOR;
}
