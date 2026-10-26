// Sponsor slot configuration. All values come from env vars so a sponsor can
// be turned on/off with a redeploy and no code change. When NAME or URL is
// unset, every sponsor surface renders nothing.
//
// NEXT_PUBLIC_* vars are inlined at build time and drive the site UI;
// SPONSOR_CLI_NOTICE is server-only and is returned to the CLI after a
// successful submission.

export interface Sponsor {
  name: string;
  url: string;
  tagline: string | null;
}

export function getSponsor(): Sponsor | null {
  const name = process.env.NEXT_PUBLIC_SPONSOR_NAME;
  const url = process.env.NEXT_PUBLIC_SPONSOR_URL;
  if (!name || !url) return null;
  return {
    name,
    url,
    tagline: process.env.NEXT_PUBLIC_SPONSOR_TAGLINE || null,
  };
}

// Tako is the maker's own open-source terminal for running many coding agents,
// so it fills the house slots, labelled as ours rather than as a sponsor.
export const TAKO_URL = "https://github.com/nikshepsvn/tako";
export const TAKO_CLI_NOTICE = `Running several agents at once? Tako, from the maker of viberank, keeps track of them all: ${TAKO_URL}`;

// Server-only: a paid sponsor's line for the CLI to print after a successful
// submission, e.g. "viberank is sponsored by Acme — https://acme.dev/viberank",
// or null when the slot is unsold.
export function getPaidCliNotice(): string | null {
  return process.env.SPONSOR_CLI_NOTICE || null;
}

// Server-only: the line the CLI prints after a successful submission. A paid
// sponsor's line wins; otherwise the CLI shows the house line.
export function getCliNotice(): string {
  return getPaidCliNotice() || TAKO_CLI_NOTICE;
}
