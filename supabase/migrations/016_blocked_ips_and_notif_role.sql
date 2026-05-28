-- ─── Blocked IPs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_ips (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason     TEXT,
  blocked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked IPs
CREATE POLICY "admins_manage_blocked_ips" ON blocked_ips
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Notifications: target_role ──────────────────────────────────────────────
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'all'
  CHECK (target_role IN ('all', 'admin', 'user'));
