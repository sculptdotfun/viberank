import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Viberank - Claude Code Usage Leaderboard';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
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
            Viberank
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
          Claude Code Usage Leaderboard
        </p>
        
        {/* Tagline */}
        <p
          style={{
            fontSize: 24,
            color: '#78716c',
            margin: '20px 40px 0',
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          Track and compare your AI development stats with developers worldwide
        </p>
        
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
      ...size,
    },
  );
}