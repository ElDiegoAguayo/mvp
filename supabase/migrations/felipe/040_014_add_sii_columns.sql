-- Migration 014: Add all SII Libro de Compras columns to registro_compras_sii
-- These columns correspond to the full column set exported by the SII portal.

ALTER TABLE public.registro_compras_sii
  -- Fecha de devengo (separate date field; mes_devengo kept for backwards compat)
  ADD COLUMN IF NOT EXISTS fecha_devengo          date,
  -- Fecha de vencimiento del documento
  ADD COLUMN IF NOT EXISTS fecha_vencimiento      date,
  -- Tipo de obligación (e.g. "Del Giro", "Activo Fijo", etc.)
  ADD COLUMN IF NOT EXISTS tipo_obligacion        text,
  -- Monto exento (operaciones exentas de IVA)
  ADD COLUMN IF NOT EXISTS monto_exento           numeric NOT NULL DEFAULT 0,
  -- IVA no recuperable (crédito IVA que no puede recuperarse)
  ADD COLUMN IF NOT EXISTS iva_no_recuperable     numeric NOT NULL DEFAULT 0,
  -- Otros impuestos (impuestos adicionales distintos del IVA)
  ADD COLUMN IF NOT EXISTS otros_impuestos        numeric NOT NULL DEFAULT 0,
  -- Retención de honorarios
  ADD COLUMN IF NOT EXISTS retencion_honorarios   numeric NOT NULL DEFAULT 0,
  -- Monto base para el cálculo del impuesto
  ADD COLUMN IF NOT EXISTS monto_base             numeric NOT NULL DEFAULT 0,
  -- Monto calculado (resultado del cálculo de impuesto)
  ADD COLUMN IF NOT EXISTS monto_calculado        numeric NOT NULL DEFAULT 0,
  -- Porcentaje aplicado (e.g. tasa IVA u otro)
  ADD COLUMN IF NOT EXISTS porcentaje             numeric,
  -- Folio del documento que este documento anula o modifica
  ADD COLUMN IF NOT EXISTS anula_o_modifica       text;

-- Indexes for common filter patterns
CREATE INDEX IF NOT EXISTS idx_compras_sii_fecha_devengo
  ON public.registro_compras_sii(fecha_devengo) WHERE fecha_devengo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compras_sii_tipo_obligacion
  ON public.registro_compras_sii(tipo_obligacion) WHERE tipo_obligacion IS NOT NULL;
