-- Plan de cosecha quedó integrado como pestaña en Estimación de cosecha.
-- Retira el módulo independiente del menú y permisos.

DO $$
DECLARE
  mod_rec record;
BEGIN
  FOR mod_rec IN
    SELECT id, slug
    FROM public.modules
    WHERE slug = 'plan-de-cosecha'
       OR (
         is_active = true
         AND slug <> 'estimacion-cosecha'
         AND (
           slug ILIKE '%plan-de-cosecha%'
           OR name ILIKE '%plan de cosecha%'
         )
       )
  LOOP
    DELETE FROM public.user_module_access WHERE module_id = mod_rec.id;

    UPDATE public.modules
    SET
      is_active = false,
      name = 'Plan de cosecha (retirado)',
      description = 'Integrado en Estimación de cosecha.',
      slug = mod_rec.slug || '-retired-' || substr(mod_rec.id::text, 1, 8)
    WHERE id = mod_rec.id;
  END LOOP;
END $$;

UPDATE public.modules
SET description = 'Conteos fenológicos, estimación de kg y plan de cosecha por cuartel.'
WHERE slug = 'estimacion-cosecha';
