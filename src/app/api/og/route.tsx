import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get parameters
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
            backgroundColor: '#1a1918',
            backgroundImage: 'radial-gradient(circle at 25% 25%, #dc885020 0%, transparent 50%), radial-gradient(circle at 75% 75%, #dc885020 0%, transparent 50%)',
          }}
        >
          {/* Logo and Title */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <svg width="80" height="80" viewBox="0 0 32 32" fill="none" style={{ marginRight: 20 }}>
              <rect width="32" height="32" rx="6" fill="#1a1918"/>
              <path d="M6 16L6 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
              <path d="M12 11L12 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
              <path d="M18 6L18 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
              <path d="M24 18L24 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="6" cy="13" r="2.5" fill="#dc8850"/>
              <circle cx="12" cy="8" r="2.5" fill="#dc8850"/>
              <circle cx="18" cy="3" r="2.5" fill="#dc8850"/>
              <circle cx="24" cy="15" r="2.5" fill="#dc8850"/>
            </svg>
            <h1
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: '#f5f3f0',
                margin: 0,
              }}
            >
              {title}
            </h1>
          </div>
          
          {/* Description */}
          <p
            style={{
              fontSize: 36,
              color: '#a8a29e',
              margin: '0 40px',
              textAlign: 'center',
              maxWidth: 900,
            }}
          >
            {description}
          </p>
          
          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: 60,
              marginTop: 60,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: '#dc8850' }}>1000+</div>
              <div style={{ fontSize: 24, color: '#a8a29e' }}>Developers</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: '#dc8850' }}>$50K+</div>
              <div style={{ fontSize: 24, color: '#a8a29e' }}>Total Spent</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 'bold', color: '#dc8850' }}>100M+</div>
              <div style={{ fontSize: 24, color: '#a8a29e' }}>Tokens Used</div>
            </div>
          </div>
          
          {/* Command */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 60,
              padding: '20px 40px',
              backgroundColor: '#252321',
              borderRadius: 12,
              border: '1px solid #3a3734',
            }}
          >
            <span style={{ fontSize: 28, color: '#a8a29e' }}>$</span>
            <span style={{ fontSize: 28, color: '#dc8850', fontFamily: 'monospace' }}>npx viberank</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}