-- Módulo Asistencia técnica: servicios, asistencia de inspectores, proformas

-- ─── Catálogo de servicios / labores ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tech_assistance_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  billing_unit text NOT NULL DEFAULT 'hectare'
    CHECK (billing_unit IN ('hectare', 'day')),
  unit_price_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price_net >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tech_assistance_services_user_idx
  ON public.tech_assistance_services(user_id, is_active);

-- ─── Registro diario de asistencia ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tech_assistance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.tech_assistance_services(id) ON DELETE RESTRICT,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_name text NOT NULL DEFAULT '',
  started_at timestamptz,
  ended_at timestamptz,
  check_in_lat numeric(10, 7),
  check_in_lng numeric(10, 7),
  check_out_lat numeric(10, 7),
  check_out_lng numeric(10, 7),
  billing_unit text NOT NULL CHECK (billing_unit IN ('hectare', 'day')),
  quantity numeric(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price_net >= 0),
  amount_net numeric(14, 2) NOT NULL DEFAULT 0,
  amount_iva numeric(14, 2) NOT NULL DEFAULT 0,
  amount_total numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  proforma_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tech_assistance_entries_user_date_idx
  ON public.tech_assistance_entries(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS tech_assistance_entries_proforma_idx
  ON public.tech_assistance_entries(proforma_id)
  WHERE proforma_id IS NOT NULL;

-- ─── Proformas ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tech_assistance_proformas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proforma_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  subtotal_net numeric(14, 2) NOT NULL DEFAULT 0,
  iva_amount numeric(14, 2) NOT NULL DEFAULT 0,
  total_amount numeric(14, 2) NOT NULL DEFAULT 0,
  approved_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tech_proforma_period_valid CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS tech_assistance_proformas_number_user_idx
  ON public.tech_assistance_proformas(user_id, proforma_number);

CREATE INDEX IF NOT EXISTS tech_assistance_proformas_user_status_idx
  ON public.tech_assistance_proformas(user_id, status, created_at DESC);

ALTER TABLE public.tech_assistance_entries
  ADD CONSTRAINT tech_assistance_entries_proforma_fk
  FOREIGN KEY (proforma_id) REFERENCES public.tech_assistance_proformas(id) ON DELETE RESTRICT;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.tech_assistance_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_assistance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_assistance_proformas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tech_assistance_services',
    'tech_assistance_entries',
    'tech_assistance_proformas'
  ]
  LOOP
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
  END LOOP;
END $$;

DROP POLICY IF EXISTS tech_assistance_entries_delete_effective ON public.tech_assistance_entries;
CREATE POLICY tech_assistance_entries_delete_effective ON public.tech_assistance_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (user_id = public.effective_user_id() AND proforma_id IS NULL)
  );

DROP POLICY IF EXISTS tech_assistance_proformas_delete_effective ON public.tech_assistance_proformas;
CREATE POLICY tech_assistance_proformas_delete_effective ON public.tech_assistance_proformas
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (user_id = public.effective_user_id() AND status IN ('draft', 'rejected'))
  );

-- ─── Módulo en sidebar ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'asistencia-tecnica') THEN
    INSERT INTO public.modules (slug, name, icon, description, is_active, color, icon_shape, text_color)
    VALUES (
      'asistencia-tecnica',
      'Asistencia técnica',
      'HardHat',
      'Control de asistencia de inspectores, avance por hectárea o día, proformas y facturación.',
      true,
      'sky',
      'rounded',
      'sky'
    );
  ELSE
    UPDATE public.modules SET
      name = 'Asistencia técnica',
      icon = 'HardHat',
      description = 'Control de asistencia de inspectores, avance por hectárea o día, proformas y facturación.',
      is_active = true,
      color = 'sky',
      icon_shape = 'rounded',
      text_color = 'sky'
    WHERE slug = 'asistencia-tecnica';
  END IF;
END $$;

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE m.slug = 'asistencia-tecnica'
  AND a.name = 'Campo y cosecha';

INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT p.id, m.id, true
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.role = 'user'
  AND p.parent_user_id IS NULL
  AND m.slug = 'asistencia-tecnica'
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;
