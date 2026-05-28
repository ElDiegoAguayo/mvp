-- Expand audit action types for user activity (files, auth, etc.)
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
    'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FILE_MOVE', 'FILE_SHARE', 'BULK_FILE_MOVE',
    'FOLDER_CREATE', 'FOLDER_DELETE'
  ));

-- Actor classification for filtering
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS actor_kind TEXT CHECK (actor_kind IS NULL OR actor_kind IN (
    'admin', 'principal', 'sub', 'system', 'anonymous'
  ));

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_kind ON public.audit_logs (actor_kind);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- Allow authenticated users to log their own activity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'authenticated_insert_own_audit'
  ) THEN
    CREATE POLICY authenticated_insert_own_audit ON public.audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (actor_id = auth.uid());
  END IF;
END $$;
