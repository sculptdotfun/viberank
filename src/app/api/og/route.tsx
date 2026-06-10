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
async function profileCard(searchParams: URLSearchParams) {
  const username = searchParams.get('username') || 'developer';
  const avatar = searchParams.get('avatar');
  const cost = Number(searchParams.get('cost') || 0);
  const tokens = searchParams.get('tokens') || '';
  const rank = searchParams.get('rank');
  const tier = getTier(cost);
  const costLabel =
    cost >= 1000 ? `$${(cost / 1000).toFixed(cost >= 10000 ? 0 : 1)}K` : `$${Math.round(cost)}`;
  const fonts = await getFonts();

  const stat = (value: string, label: string, color: string) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 66, fontWeight: 700, color, fontFamily: 'Geist Mono' }}>{value}</span>
      <span
        style={{
          fontSize: 19,
          color: '#9a9aa5',
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
          backgroundColor: '#0a0a0c',
          backgroundImage: `radial-gradient(circle at 85% 8%, ${tier.soft.replace('0.1', '0.2')} 0%, rgba(10,10,12,0) 45%), radial-gradient(circle at 0% 100%, rgba(249,115,22,0.10) 0%, rgba(10,10,12,0) 40%)`,
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
          style={{ position: 'absolute', right: -60, bottom: -90, opacity: 0.07 }}
        >
          <rect x="3" y="14" width="5" height="7" rx="1" fill={tier.color} opacity="0.5" />
          <rect x="9.5" y="8" width="5" height="13" rx="1" fill={tier.color} opacity="0.75" />
          <rect x="16" y="3" width="5" height="18" rx="1" fill={tier.color} />
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
              <span style={{ fontSize: 34, fontWeight: 700, color: '#fafafa', fontFamily: 'Geist Mono' }}>
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
                  backgroundColor: 'rgba(249, 115, 22, 0.10)',
                  border: '1px solid rgba(249, 115, 22, 0.35)',
                  borderRadius: 14,
                }}
              >
                <span style={{ fontSize: 46, fontWeight: 700, color: '#f97316', fontFamily: 'Geist Mono' }}>
                  #{rank}
                </span>
                <span style={{ fontSize: 19, color: '#9a9aa5', fontFamily: 'Geist Mono', letterSpacing: 3 }}>
                  GLOBAL
                </span>
              </div>
            )}
          </div>

          {/* identity */}
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
                  border: `5px solid ${tier.color}`,
                  boxShadow: `0 0 60px ${tier.soft.replace('0.1', '0.5')}`,
                }}
              />
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontSize: 72, fontWeight: 700, color: '#fafafa', lineHeight: 1 }}>
                {username}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignSelf: 'flex-start',
                  padding: '8px 22px',
                  borderRadius: 10,
                  backgroundColor: tier.soft,
                  border: `1px solid ${tier.color}`,
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    color: tier.color,
                    fontWeight: 700,
                    letterSpacing: 6,
                    fontFamily: 'Geist Mono',
                  }}
                >
                  {tier.name.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* stats + CTA */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 80 }}>
              {stat(costLabel, 'AI CODING USAGE', '#f97316')}
              {tokens ? stat(tokens, 'TOKENS', '#fafafa') : null}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 24px',
                backgroundColor: '#16161a',
                border: '1px solid #26262d',
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 22, color: '#9a9aa5', fontFamily: 'Geist Mono' }}>$</span>
              <span style={{ fontSize: 22, color: '#f97316', fontFamily: 'Geist Mono', fontWeight: 700 }}>
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
            backgroundImage: `linear-gradient(90deg, #f97316 0%, ${tier.color} 100%)`,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630, fonts }
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('type') === 'profile') {
      return profileCard(searchParams);
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
      },
    );
  } catch (e: unknown) {
    console.log(`${(e as Error).message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
