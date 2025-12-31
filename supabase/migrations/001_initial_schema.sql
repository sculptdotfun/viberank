-- Supabase Migration: Initial Schema
-- Migrated from Convex schema

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id TEXT UNIQUE,  -- For migration mapping from Convex
  username TEXT UNIQUE NOT NULL,
  github_username TEXT UNIQUE,
  github_name TEXT,
  bio TEXT,
  avatar TEXT,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  best_submission_id UUID,  -- FK added after submissions table exists
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes matching Convex
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_github_username ON profiles(github_username);

-- ============================================================================
-- SUBMISSIONS TABLE
-- ============================================================================
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id TEXT UNIQUE,  -- For migration mapping from Convex
  username TEXT NOT NULL,
  github_username TEXT,
  github_name TEXT,
  github_avatar TEXT,
  total_tokens BIGINT NOT NULL,
  total_cost DECIMAL(12,4) NOT NULL,
  input_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  cache_creation_tokens BIGINT NOT NULL,
  cache_read_tokens BIGINT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  models_used TEXT[] NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT CHECK (source IN ('cli', 'oauth')),
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  flagged_for_review BOOLEAN DEFAULT FALSE,
  flag_reasons TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes matching Convex
CREATE INDEX idx_submissions_total_cost ON submissions(total_cost DESC);
CREATE INDEX idx_submissions_total_tokens ON submissions(total_tokens DESC);
CREATE INDEX idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX idx_submissions_username ON submissions(username);
CREATE INDEX idx_submissions_github_username ON submissions(github_username);
CREATE INDEX idx_submissions_flagged ON submissions(flagged_for_review, submitted_at DESC);

-- Add FK from profiles.best_submission_id to submissions
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_best_submission
  FOREIGN KEY (best_submission_id)
  REFERENCES submissions(id)
  ON DELETE SET NULL;

-- ============================================================================
-- DAILY BREAKDOWNS TABLE (normalized from Convex nested array)
-- ============================================================================
CREATE TABLE daily_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  input_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  cache_creation_tokens BIGINT NOT NULL,
  cache_read_tokens BIGINT NOT NULL,
  total_tokens BIGINT NOT NULL,
  total_cost DECIMAL(12,4) NOT NULL,
  models_used TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE(submission_id, date)
);

-- Indexes for efficient queries
CREATE INDEX idx_daily_breakdowns_submission_id ON daily_breakdowns(submission_id);
CREATE INDEX idx_daily_breakdowns_date ON daily_breakdowns(date);
CREATE INDEX idx_daily_breakdowns_submission_date ON daily_breakdowns(submission_id, date);

-- ============================================================================
-- RATE LIMITS TABLE (replaces @convex-dev/rate-limiter)
-- ============================================================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  limit_type TEXT NOT NULL,  -- 'submitData', 'apiGeneral', 'failedSubmissions', 'expensiveQuery'
  tokens INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_request TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(key, limit_type)
);

CREATE INDEX idx_rate_limits_key_type ON rate_limits(key, limit_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Public read access for leaderboard data
CREATE POLICY "Public read profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Public read submissions" ON submissions
  FOR SELECT USING (true);

CREATE POLICY "Public read daily_breakdowns" ON daily_breakdowns
  FOR SELECT USING (true);

-- Service role has full access (for backend operations)
CREATE POLICY "Service write profiles" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service write submissions" ON submissions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service write daily_breakdowns" ON daily_breakdowns
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service write rate_limits" ON rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
