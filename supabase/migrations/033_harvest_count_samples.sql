-- Muestras de conteo por árbol (Hilera / Arbol)

ALTER TABLE public.harvest_estimates
  ADD COLUMN IF NOT EXISTS hilera integer,
  ADD COLUMN IF NOT EXISTS arbol integer,
  ADD COLUMN IF NOT EXISTS is_count_summary boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS harvest_estimates_count_sample_idx
  ON public.harvest_estimates(user_id, field_name, block_name, season_label, count_state, hilera, arbol)
  WHERE is_count_summary = false;

CREATE INDEX IF NOT EXISTS harvest_estimates_count_summary_idx
  ON public.harvest_estimates(user_id, field_name, block_name, variety, season_label, count_state)
  WHERE is_count_summary = true;

COMMENT ON COLUMN public.harvest_estimates.hilera IS 'Hilera de la muestra (conteo por árbol)';
COMMENT ON COLUMN public.harvest_estimates.arbol IS 'Árbol de la muestra (conteo por árbol)';
COMMENT ON COLUMN public.harvest_estimates.is_count_summary IS 'true = fila resumen con promedios por cuartel/variedad';
