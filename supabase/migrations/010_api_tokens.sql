-- Migration 010: API tokens for non-interactive submission.
--
-- A scheduled run cannot open a browser, so `viberank-cli autosubmit` needs a
-- credential it can carry. Today submissions identify themselves with an
-- `X-GitHub-User` header that anyone can set, which is why only ~30% of
-- submissions are verified and why an ownership claim (#99) cannot be checked
-- at all. A token fixes all three: it authenticates a cron, it marks the
-- submission verified, and it proves the submitter controls the account.
--
-- Only the SHA-256 of the token is stored. The plaintext is shown once at
-- issue time and is unrecoverable afterwards — a database leak yields hashes
-- of 256-bit random values, which are not worth attacking.

CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Denormalised rather than an FK to profiles: a token must keep working if
  -- the profile row is rebuilt, and submissions are keyed by username anyway.
  username TEXT NOT NULL,
  github_username TEXT NOT NULL,
  -- SHA-256 hex of the plaintext token. Unique so a lookup is a single
  -- indexed probe rather than a scan over every user's tokens.
  token_hash TEXT NOT NULL UNIQUE,
  -- Shown in the UI so a user can tell two tokens apart before revoking one.
  label TEXT NOT NULL DEFAULT 'CLI',
  -- First 8 chars of the plaintext, for display only ("vbr_a1b2…").
  hint TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  -- Soft revoke: keeps the row so `last_used_at` stays auditable after a
  -- suspected leak, rather than deleting the evidence.
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_username ON api_tokens(lower(username));

-- Service-role only. RLS on with no policies means the anon browser key can
-- neither read hashes nor mint tokens; every path goes through the API routes,
-- which check the session first.
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
