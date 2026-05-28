-- Add lote_id to registro_compras_sii so each import batch is uniquely identified.
-- This allows the "Historial de Cargas" UI to show exactly which rows belong to
-- each import event, enabling per-batch verification of Neto/IVA/Total values.

ALTER TABLE public.registro_compras_sii
  ADD COLUMN IF NOT EXISTS lote_id uuid;

-- Index for fast per-lote lookups (used by obtenerRegistrosPorLote RPC)
CREATE INDEX IF NOT EXISTS idx_compras_sii_lote_id
  ON public.registro_compras_sii(lote_id)
  WHERE lote_id IS NOT NULL;
