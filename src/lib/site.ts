/**
 * The one place that knows what host viberank lives on.
 *
 * The site is www-canonical — `metadataBase`, every canonical tag, the sitemap
 * and robots.txt all say `www.viberank.app`, and the apex 307s across to it at
 * the edge. Links we emit for *ourselves* were fine either way, so the apex
 * form spread by copy-paste through READMEs, share links and the badge.
 *
 * It stopped being cosmetic once those URLs became things other people paste
 * into their own systems. `curl https://viberank.app/api/stats` answers with
 * the string "Redirecting..." rather than JSON, because curl does not follow
 * redirects unless asked — so a citation of the apex endpoint hands the reader
 * something that fails to parse. Badges and share links survive the hop, but
 * pay for it on every cold fetch.
 *
 * Anything we hand to a third party goes through here.
 */

export const SITE_URL = "https://www.viberank.app";

/** Public profile page for a GitHub handle. */
export function profileUrl(username: string): string {
  return `${SITE_URL}/profile/${encodeURIComponent(username)}`;
}

/** SVG badge endpoint for a GitHub handle. */
export function badgeUrl(username: string): string {
  return `${SITE_URL}/api/badge/${encodeURIComponent(username)}`;
}

/** Paste-ready README badge — image linked to the profile it describes. */
export function badgeMarkdown(username: string): string {
  return `[![viberank](${badgeUrl(username)})](${profileUrl(username)})`;
}
