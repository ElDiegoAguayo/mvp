-- Ya no se guardan cuarteles "ocultos": el borrado es real en phenology_observations.
-- Limpia filas viejas (> 1 mes) por si quedaron de la versión anterior y elimina la tabla.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'phenology_hidden_blocks'
  ) THEN
    DELETE FROM public.phenology_hidden_blocks
    WHERE created_at < now() - interval '1 month';

    DROP TABLE public.phenology_hidden_blocks;
  END IF;
END $$;
