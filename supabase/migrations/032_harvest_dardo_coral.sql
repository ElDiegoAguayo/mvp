-- Conteo fenológico: Dardo Coral y cantidad de muestras promediadas

ALTER TABLE public.harvest_estimates
  ADD COLUMN IF NOT EXISTS dardo_coral numeric(10, 2),
  ADD COLUMN IF NOT EXISTS count_sample_count integer;

COMMENT ON COLUMN public.harvest_estimates.dardo_coral IS 'Promedio Dardo Coral por cuartel/variedad (conteo)';
COMMENT ON COLUMN public.harvest_estimates.count_sample_count IS 'N° de árboles/muestras usadas en el promedio de conteo';
