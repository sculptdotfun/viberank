-- Migration 005: optional contact email for explicit open-to-work listings.
--
-- The email is only meaningful when open_to_work is true. Application code
-- clears it when a user opts out, so old rows keep working and no email is
-- displayed unless the profile owner saves one.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS open_to_work_email TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_open_to_work_email_format'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_open_to_work_email_format
      CHECK (
        open_to_work_email IS NULL
        OR (
          open_to_work
          AND length(open_to_work_email) <= 254
          AND open_to_work_email !~ ('[?&%#:' || chr(13) || chr(10) || ']')
          AND open_to_work_email ~* '^[A-Za-z0-9.!#$''*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$'
        )
      );
  END IF;
END $$;
