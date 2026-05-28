-- Campos (fundos) por cliente para estimación de cosecha

CREATE TABLE IF NOT EXISTS public.harvest_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS harvest_fields_user_id_idx ON public.harvest_fields(user_id);

ALTER TABLE public.harvest_fields ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text := 'harvest_fields';
  pol text;
BEGIN
  pol := tbl || '_select_effective';
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
  EXECUTE format($p$
    CREATE POLICY %I ON public.%I FOR SELECT USING (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  $p$, pol, tbl);

  pol := tbl || '_insert_effective';
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
  EXECUTE format($p$
    CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  $p$, pol, tbl);

  pol := tbl || '_update_effective';
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
  EXECUTE format($p$
    CREATE POLICY %I ON public.%I FOR UPDATE USING (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    ) WITH CHECK (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  $p$, pol, tbl);

  pol := tbl || '_delete_effective';
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
  EXECUTE format($p$
    CREATE POLICY %I ON public.%I FOR DELETE USING (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  $p$, pol, tbl);
END $$;
