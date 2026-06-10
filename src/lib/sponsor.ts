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

// Server-only: line printed by the CLI after a successful submission,
// e.g. "viberank is sponsored by Acme — https://acme.dev/viberank".
export function getCliNotice(): string | null {
  return process.env.SPONSOR_CLI_NOTICE || null;
}
