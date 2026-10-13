// Automatic "under review" mark (#183). The entry still counts and keeps its
// rank: the badge only tells readers a maintainer hasn't checked it yet.
export default function ReviewBadge({ reasons, size = "sm" }: { reasons?: string[]; size?: "sm" | "md" }) {
  if (!reasons?.length) return null;
  const shown = reasons.slice(0, 5);
  const more = reasons.length - shown.length;
  const title = `Under review: unusually large usage, waiting for a maintainer to check. It still counts.\n\n${shown.join("\n")}${more > 0 ? `\n…and ${more} more` : ""}`;
  const sizing = size === "md" ? "text-xs px-2 py-1" : "text-[9px] px-1 py-px";
  return (
    <span
      title={title}
      className={`${sizing} font-mono uppercase tracking-wider rounded bg-amber-500/15 text-amber-500 flex-shrink-0 leading-none`}
    >
      under review
    </span>
  );
}
