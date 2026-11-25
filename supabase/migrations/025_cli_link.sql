-- Migration 025: one-step sign-in from the terminal (device link).
--
-- Getting a CLI user verified used to take five steps: open the site, sign in,
-- find /settings/tokens, create a token, paste it back. v2 ranks only verified
-- people, so that friction decides who is on the Ranked board. This is the
-- `gh auth login` flow instead:
--
--   1. The CLI calls POST /api/v2/link/start and gets a short user code
--      (HXKT-4Q2M) to show, and a long secret device code to keep.
--   2. The person opens /link?code=HXKT-4Q2M, signs in with GitHub and
--      approves. Approval records who approved and claims their earlier
--      unverified CLI rows.
--   3. The CLI polls POST /api/v2/link/poll with the device code. The first
--      poll after approval moves the row to 'consumed' and mints an API token
--      in that same request, so the plaintext token is never stored anywhere;
--      the row keeps only the token's id.
--
-- Only the SHA-256 of the device code is stored (it is 256 bits of random, so
-- a fast hash is enough, as for api_tokens). The user code is stored as is:
-- it is useless without a signed-in GitHub session to approve it, and the
-- person needs it shown back to them to compare with their terminal.

CREATE TABLE IF NOT EXISTS cli_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Canonical form XXXX-XXXX from an alphabet without 0/O/1/I/L.
  user_code TEXT NOT NULL UNIQUE,
  -- SHA-256 hex of the device code the CLI holds.
  device_code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'consumed', 'expired')),
  -- Set on approval, from the GitHub session.
  username TEXT,
  github_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  -- For slow_down: a CLI that polls faster than the interval is told to back off.
  last_polled_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  -- The token minted for this link. SET NULL so deleting a token never
  -- fails on an old link row.
  token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL
);

-- The UNIQUE constraints above already index both lookups (by device code
-- hash for polls, by user code for the page and approval). This one serves
-- the cleanup below.
CREATE INDEX IF NOT EXISTS idx_cli_link_codes_expires ON cli_link_codes (expires_at);

-- Expired rows are deleted whenever a new link starts, so the table holds
-- minutes of rows rather than every link ever made. A row is kept for an hour
-- past expiry so a late poll or a stale page still hears "expired" rather
-- than "unknown code".
CREATE OR REPLACE FUNCTION cleanup_expired_cli_link_codes()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cli_link_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_expired_cli_link_codes ON cli_link_codes;
CREATE TRIGGER trg_cleanup_expired_cli_link_codes
  AFTER INSERT ON cli_link_codes
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_cli_link_codes();

-- Service-role only. RLS on with no policies: the anon key can neither read
-- codes nor approve them; every path goes through the API routes.
ALTER TABLE cli_link_codes ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
