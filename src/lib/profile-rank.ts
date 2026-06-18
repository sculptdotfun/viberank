export interface ProfileRankDisplay {
  label: string;
  value: string;
  isRanked: boolean;
}

export function getProfileRankDisplay(rank: number | null): ProfileRankDisplay {
  return {
    label: "Viberank position",
    value: rank ? `#${rank}` : "—",
    isRanked: Boolean(rank),
  };
}
