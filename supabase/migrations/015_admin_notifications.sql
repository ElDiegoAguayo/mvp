-- Admin broadcast notifications visible in Centro de Notificaciones
CREATE TABLE IF NOT EXISTS admin_notifications (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'info'
                 CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  active_from  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  active_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_active
  ON admin_notifications(active_from, active_until);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins have full access
CREATE POLICY admin_notifications_admin_all ON admin_notifications
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- All authenticated users can read currently active notifications
CREATE POLICY admin_notifications_read_active ON admin_notifications
  FOR SELECT TO authenticated
  USING (NOW() BETWEEN active_from AND active_until);
