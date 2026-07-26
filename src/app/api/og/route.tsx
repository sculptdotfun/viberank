import { ImageResponse } from 'next/og';
import { getTier } from '@/lib/tiers';

export const runtime = 'edge';

const Logo = ({ size = 72 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="14" width="5" height="7" rx="1" fill="#f97316" opacity="0.5" />
    <rect x="9.5" y="8" width="5" height="13" rx="1" fill="#f97316" opacity="0.75" />
    <rect x="16" y="3" width="5" height="18" rx="1" fill="#f97316" />
  </svg>
);

// Satori needs raw TTF data; Google Fonts serves TTF urls when the UA looks
// old. Resolved once per edge isolate and cached.
async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' } }
  ).then((r) => r.text());
  const url = css.match(/src: url\((.+?\.ttf)\)/)?.[1];
  if (!url) throw new Error(`No TTF for ${family} ${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700 }[]> | null = null;
function getFonts() {
  fontsPromise ??= Promise.all([
    loadFont('Geist', 400).then((data) => ({ name: 'Geist', data, weight: 400 as const })),
    loadFont('Geist', 700).then((data) => ({ name: 'Geist', data, weight: 700 as const })),
    loadFont('Geist Mono', 700).then((data) => ({ name: 'Geist Mono', data, weight: 700 as const })),
  ]);
  return fontsPromise;
}

// Share card for profile pages: avatar, rank, tier, cost, tokens — in the
// site's visual language (Geist, dark surface, tier-colored glow).
async function profileCard(searchParams: URLSearchParams, headers: HeadersInit) {
  const username = searchParams.get('username') || 'developer';
  // This endpoint is an unauthenticated GET and Satori fetches the <img> src,
  // so only allow GitHub-hosted avatars — anything else would let callers turn
  // the edge function into an open image proxy.
  const avatar = (() => {
    try {
      const u = new URL(searchParams.get('avatar') ?? '');
      const ok =
        u.protocol === 'https:' &&
        (u.hostname === 'github.com' || u.hostname.endsWith('.githubusercontent.com'));
      return ok ? u.toString() : null;
    } catch {
      return null;
    }
  })();
  const cost = Number(searchParams.get('cost') || 0);
  const tokens = searchParams.get('tokens') || '';
  const rank = searchParams.get('rank');
  const days = searchParams.get('days');
  const streak = searchParams.get('streak');
  const tools = (searchParams.get('tools') || '').split(',').filter(Boolean);
  // Mini contribution grid: one level digit (0–4) per day, oldest first,
  // rendered column-per-week like the profile heatmap.
  const hm = (searchParams.get('hm') || '').replace(/[^0-4]/g, '').slice(0, 112);
  const tier = getTier(cost);
  // Dark stays the default — the card is mostly seen as a social preview, and
  // that is what every existing share URL renders. `theme=light` exists so the
  // same card can sit in a light-mode README without punching an opaque black
  // rectangle into the page.
  const light = searchParams.get('theme') === 'light';
  const c = {
    bg: light ? '#ffffff' : '#0a0a0c',
    // Gradient stops fade to the page colour, not to transparent black.
    bgFade: light ? 'rgba(255,255,255,0)' : 'rgba(10,10,12,0)',
    fg: light ? '#09090b' : '#fafafa',
    muted: light ? '#52525b' : '#9a9aa5',
    badgeLabel: light ? '#3f3f46' : '#c4c4cf',
    surface: light ? '#f4f4f5' : '#16161a',
    border: light ? '#e4e4e7' : '#26262d',
    heatEmpty: light ? '#ebedf0' : '#1e1e23',
    // orange-500 is only ~3:1 on white, so light mode drops to orange-600.
    accent: light ? '#ea580c' : '#f97316',
    accentSoft: light ? 'rgba(234, 88, 12, 0.10)' : 'rgba(249, 115, 22, 0.10)',
    accentBorder: light ? 'rgba(234, 88, 12, 0.35)' : 'rgba(249, 115, 22, 0.35)',
    tier: light ? tier.colorOnLight : tier.color,
    watermark: light ? 0.06 : 0.05,
  };
  const costLabel =
    cost >= 1000 ? `$${(cost / 1000).toFixed(cost >= 10000 ? 0 : 1)}K` : `$${Math.round(cost)}`;
  const fonts = await getFonts();

  const stat = (value: string, label: string, color: string) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 66, fontWeight: 700, color, fontFamily: 'Geist Mono' }}>{value}</span>
      <span
        style={{
          fontSize: 19,
          color: c.muted,
          fontFamily: 'Geist Mono',
          letterSpacing: 3,
          marginTop: 4,
        }}
      >
        {label}
      </span>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: c.bg,
          backgroundImage: `radial-gradient(circle at 85% 8%, ${tier.soft.replace('0.1', '0.2')} 0%, ${c.bgFade} 45%), radial-gradient(circle at 0% 100%, rgba(249,115,22,0.10) 0%, ${c.bgFade} 40%)`,
          fontFamily: 'Geist',
          position: 'relative',
        }}
      >
        {/* oversized bar-glyph watermark */}
        <svg
          width="460"
          height="460"
          viewBox="0 0 24 24"
          fill="none"
          style={{ position: 'absolute', right: -170, bottom: -200, opacity: c.watermark }}
        >
          <rect x="3" y="14" width="5" height="7" rx="1" fill={c.tier} opacity="0.5" />
          <rect x="9.5" y="8" width="5" height="13" rx="1" fill={c.tier} opacity="0.75" />
          <rect x="16" y="3" width="5" height="18" rx="1" fill={c.tier} />
        </svg>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            padding: '56px 72px 48px',
          }}
        >
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Logo size={40} />
              <span style={{ fontSize: 34, fontWeight: 700, color: c.fg, fontFamily: 'Geist Mono' }}>
                viberank
              </span>
            </div>
            {rank && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '10px 30px',
                  backgroundColor: c.accentSoft,
                  border: `1px solid ${c.accentBorder}`,
                  borderRadius: 14,
                }}
              >
                <span style={{ fontSize: 40, fontWeight: 700, color: c.accent, fontFamily: 'Geist Mono' }}>
                  #{rank}
                </span>
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    color: c.badgeLabel,
                    fontFamily: 'Geist Mono',
                    letterSpacing: 1,
                  }}
                >
                  GLOBAL RANK
                </span>
              </div>
            )}
          </div>

          {/* identity + mini heatmap */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                width={172}
                height={172}
                style={{
                  borderRadius: 86,
                  border: `5px solid ${c.tier}`,
                  boxShadow: `0 0 60px ${tier.soft.replace('0.1', '0.5')}`,
                }}
              />
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontSize: 72, fontWeight: 700, color: c.fg, lineHeight: 1 }}>
                {username}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    padding: '8px 22px',
                    borderRadius: 10,
                    backgroundColor: tier.soft,
                    border: `1px solid ${c.tier}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 24,
                      color: c.tier,
                      fontWeight: 700,
                      letterSpacing: 6,
                      fontFamily: 'Geist Mono',
                    }}
                  >
                    {tier.name.toUpperCase()}
                  </span>
                </div>
                {tools.map((t) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      padding: '8px 18px',
                      borderRadius: 10,
                      backgroundColor: c.surface,
                      border: `1px solid ${c.border}`,
                    }}
                  >
                    <span style={{ fontSize: 20, color: c.muted, fontFamily: 'Geist Mono' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {hm.length >= 14 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: Math.ceil(hm.length / 7) }, (_, w) => (
                  <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Array.from({ length: 7 }, (_, d) => {
                      const level = Number(hm[w * 7 + d] ?? 0);
                      const fill = [
                        c.heatEmpty,
                        'rgba(249,115,22,0.25)',
                        'rgba(249,115,22,0.45)',
                        'rgba(249,115,22,0.7)',
                        c.accent,
                      ][level];
                      return (
                        <div
                          key={d}
                          style={{ display: 'flex', width: 13, height: 13, borderRadius: 3, backgroundColor: fill }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 15, color: c.muted, fontFamily: 'Geist Mono', letterSpacing: 2 }}>
                LAST 16 WEEKS
              </span>
            </div>
          ) : null}
          </div>

          {/* stats + CTA */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: streak ? 56 : 72 }}>
              {stat(costLabel, 'AI CODING USAGE', c.accent)}
              {tokens ? stat(tokens, 'TOKENS', c.fg) : null}
              {days ? stat(days, 'ACTIVE DAYS', c.fg) : null}
              {streak ? stat(`${streak}d`, 'STREAK', c.tier) : null}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 24px',
                backgroundColor: c.surface,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 22, color: c.muted, fontFamily: 'Geist Mono' }}>$</span>
              <span style={{ fontSize: 22, color: c.accent, fontFamily: 'Geist Mono', fontWeight: 700 }}>
                npx viberank-cli
              </span>
            </div>
          </div>
        </div>

        {/* tier-colored baseline */}
        <div
          style={{
            display: 'flex',
            height: 8,
            width: '100%',
            backgroundImage: `linear-gradient(90deg, ${c.accent} 0%, ${c.tier} 100%)`,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630, fonts, headers }
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Versioned URLs carry a content fingerprint (`v`) that changes whenever
    // the stats do, so the response itself can be cached as immutable — the
    // CDN serves repeat crawler hits without re-rendering.
    const cacheHeaders: HeadersInit = {
      'Cache-Control': searchParams.has('v')
        ? 'public, immutable, no-transform, max-age=31536000'
        : 'public, max-age=3600, s-maxage=86400',
    };

    if (searchParams.get('type') === 'profile') {
      return profileCard(searchParams, cacheHeaders);
    }

    const title = searchParams.get('title') || 'Viberank';
    const description = searchParams.get('description') || 'Claude Code, Codex & AI Coding Leaderboard';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#121212',
          }}
        >
          {/* Logo and Title */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" style={{ marginRight: 20 }}>
              <rect x="3" y="14" width="5" height="7" rx="1" fill="#f97316" opacity="0.5"/>
              <rect x="9.5" y="8" width="5" height="13" rx="1" fill="#f97316" opacity="0.75"/>
              <rect x="16" y="3" width="5" height="18" rx="1" fill="#f97316"/>
            </svg>
            <h1
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: '#fafafa',
                margin: 0,
              }}
            >
              {title}
            </h1>
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: 32,
              color: '#a1a1aa',
              margin: '0 40px',
              textAlign: 'center',
              maxWidth: 800,
            }}
          >
            {description}
          </p>

          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: 48,
              marginTop: 48,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 40, fontWeight: 'bold', color: '#f97316' }}>1000+</div>
              <div style={{ fontSize: 20, color: '#a1a1aa' }}>Developers</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 40, fontWeight: 'bold', color: '#f97316' }}>$50K+</div>
              <div style={{ fontSize: 20, color: '#a1a1aa' }}>Total Spent</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 40, fontWeight: 'bold', color: '#f97316' }}>100M+</div>
              <div style={{ fontSize: 20, color: '#a1a1aa' }}>Tokens Used</div>
            </div>
          </div>

          {/* Command */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 48,
              padding: '16px 32px',
              backgroundColor: '#1e1e1e',
              borderRadius: 12,
              border: '1px solid #2e2e2e',
            }}
          >
            <span style={{ fontSize: 24, color: '#a1a1aa' }}>$</span>
            <span style={{ fontSize: 24, color: '#f97316', fontFamily: 'monospace' }}>npx viberank-cli</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: cacheHeaders,
      },
    );
  } catch (e: unknown) {
    console.log(`${(e as Error).message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
