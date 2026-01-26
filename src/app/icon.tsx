import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1918',
          borderRadius: 8,
        }}
      >
        {/* Modern leaderboard/ranking icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {/* Rising bars representing rankings */}
          <rect x="3" y="14" width="5" height="7" rx="1" fill="#dc8850" opacity="0.6"/>
          <rect x="9.5" y="8" width="5" height="13" rx="1" fill="#dc8850" opacity="0.8"/>
          <rect x="16" y="3" width="5" height="18" rx="1" fill="#dc8850"/>
          {/* Trophy crown accent on tallest bar */}
          <path d="M16 3 L18.5 0 L21 3" stroke="#f5f3f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
