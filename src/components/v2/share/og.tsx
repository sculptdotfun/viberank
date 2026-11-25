// Shared pieces for the v2 share images (next/og). Satori has no CSS
// variables and needs display:flex on any element with several children, so
// colours come from OG in format.ts and every container is a flex box.
import { OG } from "./format";

type Weight = 400 | 500;
export type OgFont = { name: string; data: ArrayBuffer; weight: Weight; style: "normal" };

// Google Fonts serves TTF (which Satori needs) when the User-Agent looks old.
async function loadFont(family: string, weight: Weight): Promise<ArrayBuffer> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" },
  }).then((r) => r.text());
  const url = css.match(/src: url\((.+?\.ttf)\)/)?.[1];
  if (!url) throw new Error(`No TTF for ${family} ${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

let fonts: Promise<OgFont[]> | null = null;
export function getOgFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all(
    ([
      ["Geist", 400],
      ["Geist", 500],
      ["Geist Mono", 400],
      ["Geist Mono", 500],
    ] as const).map(async ([name, weight]) => ({ name, weight, style: "normal" as const, data: await loadFont(name, weight) }))
  ).catch((e: unknown) => {
    fonts = null; // retry on the next request rather than caching a failure
    throw e;
  });
  return fonts;
}

/** Only GitHub-hosted avatars: Satori fetches the src, so anything else is an open proxy. */
export function safeAvatar(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const ok = u.protocol === "https:" && (u.hostname === "github.com" || u.hostname.endsWith(".githubusercontent.com"));
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

export function OgAvatar({ username, url, size }: { username: string; url?: string; size: number }) {
  const src = safeAvatar(url);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser.
    return <img src={src} alt="" width={size} height={size} style={{ borderRadius: size * 0.22 }} />;
  }
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size * 0.22,
        backgroundColor: OG.h[4],
        color: OG.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Geist Mono",
        fontWeight: 500,
        fontSize: size * 0.46,
      }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

/** The viberank mark: three rising bars in heat. */
export function OgMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="3" y="14" width="5" height="7" rx="1" fill={OG.heat} opacity="0.5" />
      <rect x="9.5" y="8" width="5" height="13" rx="1" fill={OG.heat} opacity="0.75" />
      <rect x="16" y="3" width="5" height="18" rx="1" fill={OG.heat} />
    </svg>
  );
}

/** Up/down triangle drawn as SVG: Geist has no ▲ glyph. */
export function OgArrow({ up, size, color }: { up: boolean; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ marginRight: size * 0.35 }}>
      <path d={up ? "M5 1 L9.5 9 L0.5 9 Z" : "M0.5 1 L9.5 1 L5 9 Z"} fill={color} />
    </svg>
  );
}

export function OgStats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${OG.line2}`, paddingTop: 26 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontFamily: "Geist Mono", fontWeight: 500, fontSize: 40, letterSpacing: -1.2, color: OG.ink }}>
            {it.value}
          </span>
          <span style={{ fontFamily: "Geist Mono", fontSize: 20, color: OG.ink3, marginTop: 6 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ogHeaders(): HeadersInit {
  return { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" };
}

export function ogError(e: unknown): Response {
  console.error("v2 share OG failed", e);
  return new Response("Failed to generate the image", { status: 500 });
}
