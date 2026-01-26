import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 180,
  height: 180,
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
          backgroundColor: '#121212',
          borderRadius: 36,
        }}
      >
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="14" width="5" height="7" rx="1" fill="#f97316" opacity="0.5"/>
          <rect x="9.5" y="8" width="5" height="13" rx="1" fill="#f97316" opacity="0.75"/>
          <rect x="16" y="3" width="5" height="18" rx="1" fill="#f97316"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
