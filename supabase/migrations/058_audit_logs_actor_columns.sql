-- audit_logs: actor_role + actor_kind (from 017; safe if already applied)
-- Fixes PostgREST PGRST204 when logAudit inserts actor_kind

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_kind TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.audit_logs'::regclass
      AND conname = 'audit_logs_actor_kind_check'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_actor_kind_check
      CHECK (actor_kind IS NULL OR actor_kind IN (
        'admin', 'principal', 'sub', 'system', 'anonymous'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_kind ON public.audit_logs (actor_kind);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON public.audit_logs (actor_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'authenticated_insert_own_audit'
  ) THEN
    CREATE POLICY authenticated_insert_own_audit ON public.audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (actor_id = auth.uid());
  END IF;
END $$;
