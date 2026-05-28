-- Estimación de cosecha: columnas alineadas al Dashboard Agrícola Bellavista (xlsx)

ALTER TABLE public.harvest_estimates
  ADD COLUMN IF NOT EXISTS field_name text,
  ADD COLUMN IF NOT EXISTS plants_per_ha numeric(10, 2),
  ADD COLUMN IF NOT EXISTS dardos_per_plant numeric(10, 2),
  ADD COLUMN IF NOT EXISTS dardos_per_branch numeric(10, 2),
  ADD COLUMN IF NOT EXISTS primordia_per_dardo numeric(10, 4),
  ADD COLUMN IF NOT EXISTS primordia_per_branch numeric(10, 4),
  ADD COLUMN IF NOT EXISTS fruit_set_pct numeric(6, 4),
  ADD COLUMN IF NOT EXISTS fruits_set numeric(14, 4),
  ADD COLUMN IF NOT EXISTS fruit_weight_kg numeric(8, 4),
  ADD COLUMN IF NOT EXISTS kg_per_plant numeric(12, 6),
  ADD COLUMN IF NOT EXISTS kg_per_ha numeric(14, 2),
  ADD COLUMN IF NOT EXISTS count_state text DEFAULT 'Pre-poda'
    CHECK (count_state IS NULL OR count_state IN ('Pre-poda', 'Post-poda'));

CREATE INDEX IF NOT EXISTS harvest_estimates_field_idx
  ON public.harvest_estimates(user_id, field_name);
