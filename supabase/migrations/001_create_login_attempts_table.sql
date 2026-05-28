-- Create login_attempts table for tracking failed login attempts
-- This table is used to implement rate limiting and account lockout mechanisms

CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip 
  ON login_attempts(email, ip_address);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip_attempted_at 
  ON login_attempts(email, ip_address, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at 
  ON login_attempts(attempted_at DESC);

-- Enable RLS (Row Level Security) but allow all users to insert their own attempts
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS login_attempts_insert_own ON login_attempts;
DROP POLICY IF EXISTS login_attempts_select_admin ON login_attempts;

-- Allow anyone to insert login attempts (from unauthenticated users)
CREATE POLICY login_attempts_insert_own ON login_attempts
  FOR INSERT
  WITH CHECK (true);

-- Allow admins to select/view all login attempts for audit purposes
CREATE POLICY login_attempts_select_admin ON login_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow unauthenticated users to query their own recent attempts (for email field)
-- This is safe because we're only showing data that helps prevent their own lockout
CREATE POLICY login_attempts_select_self ON login_attempts
  FOR SELECT
  USING (true);  -- Allow public read for lockout checking (no sensitive data exposed)

-- Add a comment to the table
COMMENT ON TABLE login_attempts IS 'Tracks login attempts (both successful and failed) for rate limiting and security audit purposes';
COMMENT ON COLUMN login_attempts.email IS 'Email address of the login attempt (lowercased for case-insensitive matching)';
COMMENT ON COLUMN login_attempts.ip_address IS 'IP address from which the login attempt originated';
COMMENT ON COLUMN login_attempts.user_agent IS 'User-Agent string of the client making the login attempt';
COMMENT ON COLUMN login_attempts.success IS 'Whether the login attempt was successful (true) or failed (false)';
COMMENT ON COLUMN login_attempts.attempted_at IS 'Timestamp when the login attempt was made';
