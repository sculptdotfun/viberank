/**
 * Admin allowlist. Single source of truth for both the /admin page (client
 * gate) and the /api/admin/* routes (server enforcement).
 */
export const ADMIN_USERS = ["nikshepsvn"];

export function isAdmin(username?: string | null): boolean {
  return !!username && ADMIN_USERS.includes(username);
}
