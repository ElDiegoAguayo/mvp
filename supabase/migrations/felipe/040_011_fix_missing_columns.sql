-- Add attempted_at column to login_attempts if it was never created
-- (migration 001 may not have been applied to the remote database)
ALTER TABLE login_attempts
  ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Recreate indexes that depend on attempted_at (safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip_attempted_at
  ON login_attempts(email, ip_address, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at
  ON login_attempts(attempted_at DESC);

-- Add is_core column to modules table
-- Used by user-permissions-table to mark built-in, non-removable modules
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false;
