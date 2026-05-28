-- Cuarteles por cliente + fecha de registro en estimaciones

CREATE TABLE IF NOT EXISTS public.harvest_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  block_name text NOT NULL,
  crop text NOT NULL DEFAULT 'Cerezo',
  variety text,
  hectares numeric(10, 2),
  plants_per_ha numeric(10, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_name, block_name)
);

CREATE INDEX IF NOT EXISTS harvest_blocks_user_id_idx ON public.harvest_blocks(user_id);

ALTER TABLE public.harvest_estimates
  ADD COLUMN IF NOT EXISTS record_date date NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.harvest_blocks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text := 'harvest_blocks';
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
