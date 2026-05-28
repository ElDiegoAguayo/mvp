-- Módulo Plan de cosecha (calendario / ventanas por cuartel)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'plan-de-cosecha') THEN
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
    );
  ELSE
    UPDATE public.modules SET
      name = 'Plan de cosecha',
      icon = 'CalendarRange',
      description = 'Calendario de ventanas de cosecha por cuartel según estimación y fenología.',
      is_active = true,
      color = 'amber',
      icon_shape = 'rounded',
      text_color = 'amber'
    WHERE slug = 'plan-de-cosecha';
  END IF;
END $$;

INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT p.id, m.id, true
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.role = 'user'
  AND p.parent_user_id IS NULL
  AND m.slug IN ('plan-de-cosecha', 'estimacion-cosecha', 'estados-fenologicos')
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;
