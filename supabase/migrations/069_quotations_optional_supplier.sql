-- Cotizaciones pueden subirse sin empresa; se asigna después (incluso en lote).
ALTER TABLE public.supplier_quotations
  ALTER COLUMN supplier_id DROP NOT NULL;
