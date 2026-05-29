-- El dashboard principal vive en /dashboard (enlace fijo del sidebar).
-- Retira el módulo duplicado "inicio" que abría /dashboard/inicio vacío.

DO $$
DECLARE
  mod_rec record;
BEGIN
  FOR mod_rec IN
    SELECT id, slug
    FROM public.modules
    WHERE slug = 'inicio'
       OR (
         is_active = true
         AND slug <> 'inicio'
         AND name ILIKE 'inicio'
         AND description ILIKE '%Dashboard principal con widgets%'
       )
  LOOP
    DELETE FROM public.user_module_access WHERE module_id = mod_rec.id;

    UPDATE public.modules
    SET
      is_active = false,
      name = 'Inicio (retirado)',
      description = 'El inicio de la plataforma es /dashboard.',
      slug = mod_rec.slug || '-retired-' || substr(mod_rec.id::text, 1, 8)
    WHERE id = mod_rec.id;
  END LOOP;
END $$;
