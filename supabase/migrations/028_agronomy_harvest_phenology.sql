-- Módulos agronomía: estimación de cosecha + estados fenológicos (por cliente)

-- ─── Estimaciones de cosecha ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.harvest_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_name text NOT NULL,
  crop text NOT NULL,
  variety text,
  season_label text NOT NULL DEFAULT '',
  hectares numeric(10, 2),
  estimated_kg numeric(14, 2) NOT NULL DEFAULT 0,
  harvested_kg numeric(14, 2) NOT NULL DEFAULT 0,
  expected_start date,
  expected_end date,
  status text NOT NULL DEFAULT 'planificado'
    CHECK (status IN ('planificado', 'en_curso', 'finalizado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS harvest_estimates_user_id_idx ON public.harvest_estimates(user_id);
CREATE INDEX IF NOT EXISTS harvest_estimates_season_idx ON public.harvest_estimates(season_label);

-- ─── Catálogo fenológico (personalizable por cliente) ────────────────────────

CREATE TABLE IF NOT EXISTS public.phenology_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop text NOT NULL,
  stage_name text NOT NULL,
  stage_code text,
  sort_order integer NOT NULL DEFAULT 0,
  typical_days integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phenology_stages_user_crop_idx
  ON public.phenology_stages(user_id, crop, sort_order);

-- ─── Observaciones fenológicas en campo ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phenology_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_name text NOT NULL,
  crop text NOT NULL,
  variety text,
  stage_id uuid REFERENCES public.phenology_stages(id) ON DELETE SET NULL,
  stage_name text NOT NULL,
  observed_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phenology_observations_user_id_idx
  ON public.phenology_observations(user_id);
CREATE INDEX IF NOT EXISTS phenology_observations_observed_at_idx
  ON public.phenology_observations(observed_at DESC);

-- ─── RLS (mismo dueño efectivo que inventario / bóveda) ───────────────────────

ALTER TABLE public.harvest_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phenology_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phenology_observations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['harvest_estimates', 'phenology_stages', 'phenology_observations']
  LOOP
    pol := tbl || '_select_effective';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT USING (
        user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    $p$, pol, tbl, tbl);

    pol := tbl || '_insert_effective';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    $p$, pol, tbl, tbl);

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
    $p$, pol, tbl, tbl);

    pol := tbl || '_delete_effective';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE USING (
        user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    $p$, pol, tbl, tbl);
  END LOOP;
END $$;

-- ─── Registrar módulos en sidebar ────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'estimacion-cosecha') THEN
    INSERT INTO public.modules (slug, name, icon, description, is_active, color, icon_shape, text_color)
    VALUES (
      'estimacion-cosecha',
      'Estimación de cosecha',
      'BarChart3',
      'Proyecciones de kilos por cuartel, cultivo y temporada — personalizado por cliente.',
      true,
      'emerald',
      'rounded',
      'emerald'
    );
  ELSE
    UPDATE public.modules SET
      name = 'Estimación de cosecha',
      icon = 'BarChart3',
      description = 'Proyecciones de kilos por cuartel, cultivo y temporada — personalizado por cliente.',
      is_active = true,
      color = 'emerald',
      icon_shape = 'rounded',
      text_color = 'emerald'
    WHERE slug = 'estimacion-cosecha';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'estados-fenologicos') THEN
    INSERT INTO public.modules (slug, name, icon, description, is_active, color, icon_shape, text_color)
    VALUES (
      'estados-fenologicos',
      'Estados fenológicos',
      'Sprout',
      'Catálogo y registro de estados fenológicos por cuartel y cultivo.',
      true,
      'lime',
      'rounded',
      'lime'
    );
  ELSE
    UPDATE public.modules SET
      name = 'Estados fenológicos',
      icon = 'Sprout',
      description = 'Catálogo y registro de estados fenológicos por cuartel y cultivo.',
      is_active = true,
      color = 'lime',
      icon_shape = 'rounded',
      text_color = 'lime'
    WHERE slug = 'estados-fenologicos';
  END IF;
END $$;

-- Habilitar para clientes principales existentes
INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT p.id, m.id, true
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.role = 'user'
  AND p.parent_user_id IS NULL
  AND m.slug IN ('estimacion-cosecha', 'estados-fenologicos')
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;
