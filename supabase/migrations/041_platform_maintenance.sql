-- Modo mantenimiento: bloquea login de clientes y subusuarios (role = user)

CREATE TABLE IF NOT EXISTS public.platform_maintenance (
  id          int PRIMARY KEY DEFAULT 1,
  enabled     boolean NOT NULL DEFAULT false,
  message     text NOT NULL DEFAULT 'La plataforma está en mantenimiento. Vuelve a intentar más tarde.',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT platform_maintenance_singleton CHECK (id = 1)
);

INSERT INTO public.platform_maintenance (id, enabled, message)
VALUES (
  1,
  false,
  'La plataforma está en mantenimiento programado. Estaremos de vuelta pronto. Gracias por tu paciencia.'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_platform_maintenance" ON public.platform_maintenance;
CREATE POLICY "authenticated_read_platform_maintenance"
  ON public.platform_maintenance FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admins_manage_platform_maintenance" ON public.platform_maintenance;
CREATE POLICY "admins_manage_platform_maintenance"
  ON public.platform_maintenance FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Audit action types
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_type_check
  CHECK (action_type IN (
    'CREATE_USER', 'UPDATE_USER', 'BLOCK_USER', 'UNBLOCK_USER', 'UPDATE_PERMISSION',
    'CREATE_MODULE', 'UPDATE_MODULE', 'DELETE_MODULE',
    'CREATE_DYNAMIC_TABLE', 'UPDATE_DYNAMIC_TABLE', 'DELETE_DYNAMIC_TABLE', 'UPDATE_TABLE_COLUMNS',
    'CREATE_CHART', 'UPDATE_CHART', 'DELETE_CHART',
    'IMPORT_EXCEL', 'UPDATE_PASSWORD', 'UPDATE_DATA_ACCESS',
    'RESTORE', 'SYSTEM',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED_BY_RATE_LIMIT', 'LOGIN_BLOCKED_IP',
    'LOGIN_BLOCKED_MAINTENANCE', 'UPDATE_MAINTENANCE_MODE',
    'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FILE_MOVE', 'FILE_SHARE', 'BULK_FILE_MOVE',
    'FOLDER_CREATE', 'FOLDER_DELETE',
    'IMPERSONATION_START', 'IMPERSONATION_END',
    'MODULE_VIEW', 'DOCUMENT_GENERATE'
  ));

COMMENT ON TABLE public.platform_maintenance IS
  'Singleton: cuando enabled=true, usuarios con role=user no pueden iniciar sesión.';
