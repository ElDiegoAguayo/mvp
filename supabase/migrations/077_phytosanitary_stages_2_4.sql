-- Inventario fitosanitario etapas 2-4: facturas, programa aplicaciones, contenedores, analítica.

ALTER TABLE public.phyto_products
  ADD COLUMN IF NOT EXISTS product_type_label text NOT NULL DEFAULT '';

ALTER TABLE public.phyto_products
  DROP CONSTRAINT IF EXISTS phyto_products_category_check;

ALTER TABLE public.phyto_products
  ADD CONSTRAINT phyto_products_category_check CHECK (
    category IN (
      'herbicide', 'insecticide', 'fungicide', 'fertilizer', 'adjuvant',
      'biostimulant', 'seed', 'regulator', 'acaricide', 'other'
    )
  );

ALTER TABLE public.phyto_movements
  ADD COLUMN IF NOT EXISTS supplier_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS field_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit_price numeric(14, 2),
  ADD COLUMN IF NOT EXISTS total_clp numeric(14, 2),
  ADD COLUMN IF NOT EXISTS product_type_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS application_item_id uuid;

CREATE TABLE IF NOT EXISTS public.phyto_warehouse_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.phyto_warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.phyto_products(id) ON DELETE CASCADE,
  container_count numeric(14, 4) NOT NULL DEFAULT 0 CHECK (container_count >= 0),
  pack_size_label text NOT NULL DEFAULT '',
  open_count numeric(14, 4) NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phyto_warehouse_containers_wh_idx
  ON public.phyto_warehouse_containers(warehouse_id, product_id);

CREATE TABLE IF NOT EXISTS public.phyto_application_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  field_name text NOT NULL DEFAULT '',
  season_label text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phyto_application_programs_user_idx
  ON public.phyto_application_programs(user_id, field_name);

CREATE TABLE IF NOT EXISTS public.phyto_application_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.phyto_application_programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_label text NOT NULL DEFAULT '',
  stage_label text NOT NULL DEFAULT '',
  application_date date,
  field_name text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.phyto_products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  dose_label text NOT NULL DEFAULT '',
  spray_volume_l_ha numeric(14, 2),
  application_area_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'applied', 'cancelled')),
  surface_ha numeric(14, 4),
  total_required numeric(14, 4),
  total_applied numeric(14, 4),
  unit text NOT NULL DEFAULT 'L',
  target_label text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phyto_application_items_program_idx
  ON public.phyto_application_items(program_id, application_date, sort_order);

CREATE TABLE IF NOT EXISTS public.phyto_purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  field_name text NOT NULL DEFAULT '',
  warehouse_id uuid REFERENCES public.phyto_warehouses(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.phyto_products(id) ON DELETE SET NULL,
  issue_date date,
  month_label text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  quantity numeric(14, 4) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'L',
  unit_price numeric(14, 2),
  net_amount numeric(14, 2),
  tax_amount numeric(14, 2),
  total_clp numeric(14, 2),
  product_type_label text NOT NULL DEFAULT '',
  movement_id uuid REFERENCES public.phyto_movements(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phyto_purchase_invoices_user_idx
  ON public.phyto_purchase_invoices(user_id, issue_date DESC);

ALTER TABLE public.phyto_movements
  DROP CONSTRAINT IF EXISTS phyto_movements_application_item_id_fkey;

ALTER TABLE public.phyto_movements
  ADD CONSTRAINT phyto_movements_application_item_id_fkey
  FOREIGN KEY (application_item_id) REFERENCES public.phyto_application_items(id) ON DELETE SET NULL;

ALTER TABLE public.phyto_warehouse_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phyto_application_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phyto_application_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phyto_purchase_invoices ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'phyto_warehouse_containers',
    'phyto_application_programs',
    'phyto_application_items',
    'phyto_purchase_invoices'
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

DROP TRIGGER IF EXISTS trg_phyto_application_programs_updated_at ON public.phyto_application_programs;
CREATE TRIGGER trg_phyto_application_programs_updated_at
  BEFORE UPDATE ON public.phyto_application_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_phyto_application_items_updated_at ON public.phyto_application_items;
CREATE TRIGGER trg_phyto_application_items_updated_at
  BEFORE UPDATE ON public.phyto_application_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_phyto_warehouse_containers_updated_at ON public.phyto_warehouse_containers;
CREATE TRIGGER trg_phyto_warehouse_containers_updated_at
  BEFORE UPDATE ON public.phyto_warehouse_containers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE public.modules SET
  description = 'Bodegas por campo, stock, facturas, programa de aplicaciones y análisis de proveedores fitosanitarios.'
WHERE slug = 'inventario-fitosanitario';
