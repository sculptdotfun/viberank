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
          borderRadius: 6,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16L6 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
          <path d="M12 11L12 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
          <path d="M18 6L18 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
          <path d="M24 18L24 26" stroke="#dc8850" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="6" cy="13" r="2.5" fill="#dc8850"/>
          <circle cx="12" cy="8" r="2.5" fill="#dc8850"/>
          <circle cx="18" cy="3" r="2.5" fill="#dc8850"/>
          <circle cx="24" cy="15" r="2.5" fill="#dc8850"/>
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}