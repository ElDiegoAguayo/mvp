-- Inventario fitosanitario (Etapa 1): bodegas por campo, productos y movimientos.

CREATE TABLE IF NOT EXISTS public.phyto_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.harvest_fields(id) ON DELETE SET NULL,
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phyto_warehouses_user_idx
  ON public.phyto_warehouses(user_id, is_active, name);

CREATE TABLE IF NOT EXISTS public.phyto_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('herbicide', 'insecticide', 'fungicide', 'fertilizer', 'adjuvant', 'other')),
  target_label text NOT NULL DEFAULT '',
  active_ingredient text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'L',
  min_stock numeric(14, 4) CHECK (min_stock IS NULL OR min_stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phyto_products_user_idx
  ON public.phyto_products(user_id, is_active, category, name);

CREATE TABLE IF NOT EXISTS public.phyto_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.phyto_warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.phyto_products(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
  quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'L',
  lot_number text NOT NULL DEFAULT '',
  expiry_date date,
  reference text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phyto_movements_user_date_idx
  ON public.phyto_movements(user_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS phyto_movements_wh_prod_idx
  ON public.phyto_movements(warehouse_id, product_id, movement_date DESC);

ALTER TABLE public.phyto_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phyto_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phyto_movements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['phyto_warehouses', 'phyto_products', 'phyto_movements']
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

DROP TRIGGER IF EXISTS trg_phyto_warehouses_updated_at ON public.phyto_warehouses;
CREATE TRIGGER trg_phyto_warehouses_updated_at
  BEFORE UPDATE ON public.phyto_warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_phyto_products_updated_at ON public.phyto_products;
CREATE TRIGGER trg_phyto_products_updated_at
  BEFORE UPDATE ON public.phyto_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'inventario-fitosanitario') THEN
    INSERT INTO public.modules (slug, name, icon, description, is_active, color, icon_shape, text_color)
    VALUES (
      'inventario-fitosanitario',
      'Inventario fitosanitario',
      'FlaskConical',
      'Bodegas por campo, stock de fitosanitarios y fertilizantes, entradas y salidas.',
      true,
      'lime',
      'rounded',
      'lime'
    );
  ELSE
    UPDATE public.modules SET
      name = 'Inventario fitosanitario',
      icon = 'FlaskConical',
      description = 'Bodegas por campo, stock de fitosanitarios y fertilizantes, entradas y salidas.',
      is_active = true,
      color = 'lime',
      icon_shape = 'rounded',
      text_color = 'lime'
    WHERE slug = 'inventario-fitosanitario';
  END IF;
END $$;

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE m.slug = 'inventario-fitosanitario'
  AND a.name = 'Campo y cosecha';

INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT p.id, m.id, true
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.role = 'user'
  AND p.parent_user_id IS NULL
  AND COALESCE(p.is_tech_inspector, false) = false
  AND m.slug = 'inventario-fitosanitario'
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;
