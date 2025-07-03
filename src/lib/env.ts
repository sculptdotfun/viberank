// Client-side environment variables
export const clientEnv = {
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL!,
} as const;

// Server-side environment variables (only available in server components/API routes)
export const serverEnv = {
  GITHUB_ID: process.env.GITHUB_ID!,
  GITHUB_SECRET: process.env.GITHUB_SECRET!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
} as const;

// Environment variable validation for server-side
export function validateServerEnv() {
  const requiredEnvVars = [
    'GITHUB_ID',
    'GITHUB_SECRET',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ];

  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env.local file.'
    );
  }
}