-- Módulo Proveedores: empresas, cotizaciones y facturas de compra

-- ─── Empresas proveedoras ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  tax_id text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_companies_user_idx
  ON public.supplier_companies(user_id, is_active, company_name);

-- ─── Cotizaciones ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.supplier_companies(id) ON DELETE RESTRICT,
  reference text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'accepted', 'rejected', 'expired')),
  currency text NOT NULL DEFAULT 'CLP',
  subtotal_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal_net >= 0),
  tax_rate numeric(5, 2) NOT NULL DEFAULT 19 CHECK (tax_rate >= 0),
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text NOT NULL DEFAULT '',
  file_storage_path text,
  file_name text,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_quotations_user_idx
  ON public.supplier_quotations(user_id, status, quote_date DESC);
CREATE INDEX IF NOT EXISTS supplier_quotations_supplier_idx
  ON public.supplier_quotations(supplier_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.supplier_quotation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.supplier_quotations(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric(14, 4) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'unit',
  unit_price_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price_net >= 0),
  line_total_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (line_total_net >= 0),
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS supplier_quotation_lines_quotation_idx
  ON public.supplier_quotation_lines(quotation_id, sort_order);

-- ─── Facturas de compra ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.supplier_companies(id) ON DELETE RESTRICT,
  quotation_id uuid REFERENCES public.supplier_quotations(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  currency text NOT NULL DEFAULT 'CLP',
  subtotal_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal_net >= 0),
  tax_rate numeric(5, 2) NOT NULL DEFAULT 19 CHECK (tax_rate >= 0),
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text NOT NULL DEFAULT '',
  file_storage_path text,
  file_name text,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text,
  registro_compras_sii_id uuid REFERENCES public.registro_compras_sii(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_invoice_due_after_issue CHECK (due_date IS NULL OR due_date >= issue_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_purchase_invoices_number_user_idx
  ON public.supplier_purchase_invoices(user_id, invoice_number);
CREATE INDEX IF NOT EXISTS supplier_purchase_invoices_user_status_idx
  ON public.supplier_purchase_invoices(user_id, status, issue_date DESC);
CREATE INDEX IF NOT EXISTS supplier_purchase_invoices_quotation_idx
  ON public.supplier_purchase_invoices(quotation_id)
  WHERE quotation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.supplier_purchase_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.supplier_purchase_invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric(14, 4) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'unit',
  unit_price_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price_net >= 0),
  line_total_net numeric(14, 2) NOT NULL DEFAULT 0 CHECK (line_total_net >= 0),
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS supplier_purchase_invoice_lines_invoice_idx
  ON public.supplier_purchase_invoice_lines(invoice_id, sort_order);

-- ─── updated_at triggers ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_supplier_companies_updated_at ON public.supplier_companies;
CREATE TRIGGER trg_supplier_companies_updated_at
  BEFORE UPDATE ON public.supplier_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_quotations_updated_at ON public.supplier_quotations;
CREATE TRIGGER trg_supplier_quotations_updated_at
  BEFORE UPDATE ON public.supplier_quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_purchase_invoices_updated_at ON public.supplier_purchase_invoices;
CREATE TRIGGER trg_supplier_purchase_invoices_updated_at
  BEFORE UPDATE ON public.supplier_purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.supplier_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchase_invoice_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'supplier_companies',
    'supplier_quotations',
    'supplier_purchase_invoices'
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

-- Line items: access via parent quotation/invoice ownership
DROP POLICY IF EXISTS supplier_quotation_lines_select ON public.supplier_quotation_lines;
CREATE POLICY supplier_quotation_lines_select ON public.supplier_quotation_lines FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.supplier_quotations q
    WHERE q.id = quotation_id
      AND (
        q.user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS supplier_quotation_lines_write ON public.supplier_quotation_lines;
CREATE POLICY supplier_quotation_lines_write ON public.supplier_quotation_lines FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.supplier_quotations q
    WHERE q.id = quotation_id
      AND (
        q.user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_quotations q
    WHERE q.id = quotation_id
      AND (
        q.user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS supplier_purchase_invoice_lines_select ON public.supplier_purchase_invoice_lines;
CREATE POLICY supplier_purchase_invoice_lines_select ON public.supplier_purchase_invoice_lines FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.supplier_purchase_invoices i
    WHERE i.id = invoice_id
      AND (
        i.user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS supplier_purchase_invoice_lines_write ON public.supplier_purchase_invoice_lines;
CREATE POLICY supplier_purchase_invoice_lines_write ON public.supplier_purchase_invoice_lines FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.supplier_purchase_invoices i
    WHERE i.id = invoice_id
      AND (
        i.user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_purchase_invoices i
    WHERE i.id = invoice_id
      AND (
        i.user_id = public.effective_user_id()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS supplier_purchase_invoices_delete_draft ON public.supplier_purchase_invoices;
CREATE POLICY supplier_purchase_invoices_delete_draft ON public.supplier_purchase_invoices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (user_id = public.effective_user_id() AND status = 'draft')
  );

DROP POLICY IF EXISTS supplier_quotations_delete_open ON public.supplier_quotations;
CREATE POLICY supplier_quotations_delete_open ON public.supplier_quotations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND status IN ('draft', 'pending', 'rejected')
      AND NOT EXISTS (
        SELECT 1 FROM public.supplier_purchase_invoices i WHERE i.quotation_id = supplier_quotations.id
      )
    )
  );

-- ─── Módulo en sidebar ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'proveedores') THEN
    INSERT INTO public.modules (slug, name, icon, description, is_active, color, icon_shape, text_color)
    VALUES (
      'proveedores',
      'Proveedores',
      'Store',
      'Empresas proveedoras, cotizaciones y facturas de compra desde cotizaciones aceptadas.',
      true,
      'violet',
      'rounded',
      'violet'
    );
  ELSE
    UPDATE public.modules SET
      name = 'Proveedores',
      icon = 'Store',
      description = 'Empresas proveedoras, cotizaciones y facturas de compra desde cotizaciones aceptadas.',
      is_active = true,
      color = 'violet',
      icon_shape = 'rounded',
      text_color = 'violet'
    WHERE slug = 'proveedores';
  END IF;
END $$;

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE m.slug = 'proveedores'
  AND a.name = 'Costos y finanzas';

INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT p.id, m.id, true
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.role = 'user'
  AND p.parent_user_id IS NULL
  AND COALESCE(p.is_tech_inspector, false) = false
  AND m.slug = 'proveedores'
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;
