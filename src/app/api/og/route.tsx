import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get('title') || 'Viberank';
    const description = searchParams.get('description') || 'Claude Code Usage Leaderboard';

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
            <span style={{ fontSize: 24, color: '#f97316', fontFamily: 'monospace' }}>npx viberank</span>
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
