-- Migration 016: capture the email GitHub already hands us at sign-in.
--
-- The OAuth scope has always included `user:email` and the provider's profile
-- callback already maps `profile.email`, but nothing downstream kept it: the
-- jwt callback carries only `username`, sessions are stateless, and profiles
-- are created by /api/submit, not by signing in. So every sign-in since launch
-- has discarded a working address. 1,125 developers, 8 addresses on file (all
-- volunteered through /hire), and no way to tell the ~736 dormant profiles
-- that autosubmit finally works.
--
-- Addresses live in their own table rather than a column on `profiles`, for
-- the same reason invite codes do (see 015): `profiles` carries a
-- "Public read profiles" policy with USING (true), and the app reads it with
-- `select("*")` under the anon key in five places. An email column there would
-- be a published email column. RLS is row-level, not column-level, so the only
-- way to keep this non-public is to keep it off that row entirely.
--
-- No public policy on purpose — service role only, both read and write.

CREATE TABLE IF NOT EXISTS profile_emails (
  github_username text PRIMARY KEY,
  email           text NOT NULL,
  -- Which flow produced the address, so a later export can tell an
  -- OAuth-verified primary from anything else we might add.
  source          text NOT NULL DEFAULT 'github_oauth',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Handles are case-insensitive on GitHub; the rest of the schema matches them
-- with ilike. Store one row per handle regardless of the casing that arrives.
CREATE UNIQUE INDEX IF NOT EXISTS profile_emails_username_lower_idx
  ON profile_emails (lower(github_username));

ALTER TABLE profile_emails ENABLE ROW LEVEL SECURITY;

-- Deliberately no SELECT/INSERT/UPDATE policy: with RLS on and no policy,
-- the anon and authenticated roles can do nothing here. The service role
-- bypasses RLS, which is the only path the app uses to touch this table.

COMMENT ON TABLE profile_emails IS
  'Sign-in emails from GitHub OAuth. Service-role only; never exposed to the client or any public endpoint.';
