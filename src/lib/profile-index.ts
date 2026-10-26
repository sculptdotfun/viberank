/**
 * Which profile pages belong in search: one rule for the sitemap and the
 * page's own robots tag.
 *
 * The two used to disagree. The sitemap listed every profile whose stored
 * `total_submissions` was above zero, while the page marked itself noindex
 * unless it could load a real submission. That counter goes stale when a
 * submission is deleted or merged away, so the sitemap kept advertising pages
 * that told crawlers not to index them (/profile/torvalds: $0, "1 submission").
 */

/**
 * GitHub's rule for a login: letters, digits and single hyphens, not starting
 * or ending with a hyphen, at most 39 characters.
 */
const GITHUB_HANDLE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/**
 * Whether `handle` could be a GitHub login. Before the submit route checked
 * this, the X-GitHub-User header defaulted upstream to `git config user.name`,
 * so profiles exist under names like "Kevin Foster" whose GitHub link 404s.
 */
export function isGithubHandle(handle: string | null | undefined): boolean {
  return typeof handle === "string" && GITHUB_HANDLE.test(handle);
}

/** The handle a profile is shown and linked under. */
export function profileHandle(profile: { githubUsername?: string | null; username: string }): string {
  return profile.githubUsername || profile.username;
}

/** A profile is worth indexing once it has real submissions under a real GitHub handle. */
export function isIndexableProfile(profile: { handle: string; submissionCount: number }): boolean {
  return profile.submissionCount > 0 && isGithubHandle(profile.handle);
}

export interface ProfileRow {
  username: string;
  githubUsername: string | null;
  updatedAt: string | null;
}

/**
 * The sitemap's profile list: the rows isIndexableProfile accepts, counting
 * submissions the way the page finds them (by username, case aside), one
 * entry per handle whatever its casing. Order is kept, so pass rows newest
 * first and the newest casing wins.
 */
export function indexableProfiles(
  profiles: ProfileRow[],
  submissionUsernames: string[]
): { handle: string; updatedAt: string | null }[] {
  const submissionCounts = new Map<string, number>();
  for (const name of submissionUsernames) {
    const key = name.toLowerCase();
    submissionCounts.set(key, (submissionCounts.get(key) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const out: { handle: string; updatedAt: string | null }[] = [];
  for (const row of profiles) {
    const handle = profileHandle(row);
    const submissionCount = submissionCounts.get(row.username.toLowerCase()) ?? 0;
    if (!isIndexableProfile({ handle, submissionCount })) continue;
    if (seen.has(handle.toLowerCase())) continue;
    seen.add(handle.toLowerCase());
    out.push({ handle, updatedAt: row.updatedAt });
  }
  return out;
}
