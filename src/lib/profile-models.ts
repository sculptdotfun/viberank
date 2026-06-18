export type ProfileModelEntry = readonly [string, number];

export interface ProfileModelRows {
  visible: ProfileModelEntry[];
  hidden: ProfileModelEntry[];
  hiddenTotal: number;
  canExpand: boolean;
}

export function splitProfileModelRows(
  entries: ProfileModelEntry[],
  options: { limit: number; expanded: boolean }
): ProfileModelRows {
  const limit = Math.max(0, Math.floor(options.limit));
  const canExpand = entries.length > limit;
  const visible = options.expanded || !canExpand ? entries : entries.slice(0, limit);
  const hidden = options.expanded || !canExpand ? [] : entries.slice(limit);

  return {
    visible,
    hidden,
    hiddenTotal: hidden.reduce((sum, [, value]) => sum + value, 0),
    canExpand,
  };
}
