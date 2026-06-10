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

// Share card for profile pages: avatar, rank, tier, cost, tokens.
function profileCard(searchParams: URLSearchParams) {
  const username = searchParams.get('username') || 'developer';
  const avatar = searchParams.get('avatar');
  const cost = Number(searchParams.get('cost') || 0);
  const tokens = searchParams.get('tokens') || '';
  const rank = searchParams.get('rank');
  const tier = getTier(cost);
  const costLabel =
    cost >= 1000 ? `$${(cost / 1000).toFixed(cost >= 10000 ? 0 : 1)}k` : `$${Math.round(cost)}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#121212',
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Logo size={44} />
            <span style={{ fontSize: 36, fontWeight: 'bold', color: '#fafafa' }}>viberank</span>
          </div>
          {rank && (
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                fontWeight: 'bold',
                color: '#f97316',
                padding: '8px 28px',
                backgroundColor: 'rgba(249, 115, 22, 0.12)',
                borderRadius: 16,
              }}
            >
              #{rank} global
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={160}
              height={160}
              style={{ borderRadius: 80, border: '4px solid #2e2e2e' }}
            />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 64, fontWeight: 'bold', color: '#fafafa' }}>{username}</span>
            {/* No tier glyph here — the OG renderer's font lacks those code
                points and draws tofu boxes. */}
            <span style={{ fontSize: 32, color: tier.color, marginTop: 8, fontWeight: 'bold', letterSpacing: 4 }}>
              {tier.name.toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 64 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 60, fontWeight: 'bold', color: '#f97316' }}>{costLabel}</span>
              <span style={{ fontSize: 24, color: '#a1a1aa' }}>AI coding usage</span>
            </div>
            {tokens && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 60, fontWeight: 'bold', color: '#fafafa' }}>{tokens}</span>
                <span style={{ fontSize: 24, color: '#a1a1aa' }}>tokens</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: 24, color: '#a1a1aa', fontFamily: 'monospace' }}>
            npx viberank-cli
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
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
