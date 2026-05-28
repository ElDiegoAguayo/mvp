-- Unificar módulos "Planificación de Producción" con Plan de cosecha

DO $$
DECLARE
  canonical_id uuid;
  legacy_id uuid;
BEGIN
  SELECT id INTO canonical_id FROM public.modules WHERE slug = 'plan-de-cosecha';

  IF canonical_id IS NULL THEN
    INSERT INTO public.modules (slug, name, icon, description, is_active, color, icon_shape, text_color)
    VALUES (
      'plan-de-cosecha',
      'Plan de cosecha',
      'CalendarRange',
      'Calendario de ventanas de cosecha por cuartel según estimación y fenología.',
      true,
      'amber',
      'rounded',
      'amber'
    )
    RETURNING id INTO canonical_id;
  END IF;

  SELECT id INTO legacy_id
  FROM public.modules
  WHERE id <> canonical_id
    AND is_active = true
    AND (
      slug ILIKE '%planificacion%'
      OR name ILIKE '%planificación de producción%'
      OR name ILIKE '%planificacion de produccion%'
      OR name ILIKE '%plan de cosecha%'
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF legacy_id IS NOT NULL THEN
    INSERT INTO public.user_module_access (user_id, module_id, enabled)
    SELECT uma.user_id, canonical_id, uma.enabled
    FROM public.user_module_access uma
    WHERE uma.module_id = legacy_id
    ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = EXCLUDED.enabled;

    UPDATE public.modules
    SET is_active = false,
        slug = slug || '-legacy-' || substr(legacy_id::text, 1, 8)
    WHERE id = legacy_id;
  END IF;
END $$;

INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT p.id, m.id, true
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.role = 'user'
  AND p.parent_user_id IS NULL
  AND m.slug = 'plan-de-cosecha'
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;

UPDATE public.modules SET
  name = 'Plan de cosecha',
  icon = 'CalendarRange',
  description = 'Calendario de ventanas de cosecha por cuartel según estimación y fenología.',
  is_active = true,
  color = 'amber',
  icon_shape = 'rounded',
  text_color = 'amber'
WHERE slug = 'plan-de-cosecha';
