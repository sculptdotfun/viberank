// Small presentational pieces of a board row. No hooks, so the landing's
// server-rendered first page and the client board share them.
import { sizedAvatarUrl } from "@/lib/utils";
import type { TrustMark as Trust } from "@/lib/v2/contract";
import { avatarTint, toolAbbr, toolColor, toolName } from "../format";

export function Movement({ value }: { value: number | null }) {
  if (value === null) return <span className="vr-dl s">new</span>;
  if (value > 0) return <span className="vr-dl u" aria-label={`up ${value}`}>▲ {value}</span>;
  if (value < 0) return <span className="vr-dl d" aria-label={`down ${-value}`}>▼ {-value}</span>;
  return <span className="vr-dl s" aria-label="no change">–</span>;
}

export function HandleAvatar({ handle, src, size = 24 }: { handle: string; src?: string; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- GitHub avatars, already sized by URL
    return <img className="vr-av" style={style} src={sizedAvatarUrl(src, size * 2)} alt="" loading="lazy" decoding="async" />;
  }
  return (
    <span className="vr-av" style={{ ...style, background: avatarTint(handle) }} aria-hidden>
      {handle.charAt(0).toUpperCase()}
    </span>
  );
}

const TRUST_TITLE: Record<Trust, string> = {
  verified: "GitHub-verified",
  claimed: "Claimed with GitHub, not yet verified by token",
  unverified: "Unverified CLI submission",
};

export function TrustTick({ trust }: { trust: Trust }) {
  if (trust === "unverified") return null;
  return (
    <svg className={`vr-tick${trust === "claimed" ? " claimed" : ""}`} viewBox="0 0 16 16" role="img" aria-label={TRUST_TITLE[trust]}>
      <title>{TRUST_TITLE[trust]}</title>
      <path fill="currentColor" d="M8 1.2l1.7 1.3 2.1-.1.6 2 1.7 1.2-.7 2 .7 2-1.7 1.2-.6 2-2.1-.1L8 14.8l-1.7-1.3-2.1.1-.6-2-1.7-1.2.7-2-.7-2 1.7-1.2.6-2 2.1.1z" />
      <path fill="none" stroke="var(--panel)" strokeWidth="1.5" d="M5.4 8.2l1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function ToolChips({ tools, max = 2 }: { tools: string[]; max?: number }) {
  const shown = tools.slice(0, max);
  const more = tools.length - shown.length;
  return (
    <span className="vr-tools">
      {shown.map((t) => (
        <span key={t} className="vr-tool" title={toolName(t)}>
          <i style={{ background: toolColor(t) }} />
          {toolAbbr(t)}
        </span>
      ))}
      {more > 0 && <span className="vr-tool more" title={tools.slice(max).map(toolName).join(", ")}>+{more}</span>}
    </span>
  );
}

/**
 * Monday-to-Sunday bars. Days after `today` are still to come and draw flat,
 * so an open week reads as open rather than as a quiet weekend.
 */
export function DayBars({ days, today }: { days: number[]; today: number }) {
  const max = Math.max(...days, 0);
  return (
    <span className="vr-days" aria-label="Spend by day, Monday to Sunday">
      {Array.from({ length: 7 }, (_, i) => {
        const v = days[i] ?? 0;
        if (i >= today || v <= 0 || max <= 0) return <i key={i} className="f" />;
        return <i key={i} style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%` }} />;
      })}
    </span>
  );
}

export function DayBarsCard({ days, today, height = 84 }: { days: number[]; today: number; height?: number }) {
  const max = Math.max(...days, 0);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="vr-wk" style={{ gridTemplateRows: `${height}px auto` }} aria-label="Usage by day, Monday to Sunday">
      {labels.map((_, i) => {
        const v = days[i] ?? 0;
        const on = i < today && v > 0 && max > 0;
        return <i key={`b${i}`} className={on ? "" : "z"} style={{ height: on ? `${Math.max(8, Math.round((v / max) * 100))}%` : "4%" }} />;
      })}
      {labels.map((l, i) => (
        <span key={`l${i}`}>{l}</span>
      ))}
    </div>
  );
}

export function LiveDot() {
  return <i className="vr-dot" aria-hidden />;
}
