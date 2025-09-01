// Client-side environment variables
export const clientEnv = {
  // No client-side env vars needed for PostgreSQL setup
} as const;

// Server-side environment variables (only available in server components/API routes)  
export const serverEnv = {
  DATABASE_URL: process.env.DATABASE_URL || '',
} as const;

// Environment variable validation for server-side
export function validateServerEnv() {
  const requiredEnvVars = [
    'DATABASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.warn(
      `Missing environment variables: ${missingVars.join(', ')}\n` +
      'Database connection will not function without these variables.'
    );
    // Don't throw during build - just warn
  }
}