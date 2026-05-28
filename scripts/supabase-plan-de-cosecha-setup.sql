-- Plan de cosecha — ejecutar en Supabase SQL Editor
-- Si falla, ejecuta cada PASO por separado (selecciona solo ese bloque y Run).

-- ─── PASO 1: Crear el módulo (si no existe) ─────────────────────────────────
INSERT INTO public.modules (slug, name, icon, description, is_active, color, icon_shape, text_color)
SELECT
  'plan-de-cosecha',
  'Plan de cosecha',
  'CalendarRange',
  'Calendario de ventanas de cosecha por cuartel según estimación y fenología.',
  true,
  'amber',
  'rounded',
  'amber'
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'plan-de-cosecha'
);

-- ─── PASO 1b: Actualizar datos del módulo ───────────────────────────────────
UPDATE public.modules SET
  name = 'Plan de cosecha',
  icon = 'CalendarRange',
  description = 'Calendario de ventanas de cosecha por cuartel según estimación y fenología.',
  is_active = true,
  color = 'amber',
  icon_shape = 'rounded',
  text_color = 'amber'
WHERE slug = 'plan-de-cosecha';

-- ─── PASO 2: Habilitar para clientes principales ────────────────────────────
INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT p.id, m.id, true
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.role = 'user'
  AND p.parent_user_id IS NULL
  AND m.slug = 'plan-de-cosecha'
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;

-- ─── PASO 3: Copiar acceso desde Planificación de Producción ────────────────
INSERT INTO public.user_module_access (user_id, module_id, enabled)
SELECT uma.user_id, canonical.id, uma.enabled
FROM public.user_module_access uma
JOIN public.modules legacy ON legacy.id = uma.module_id
CROSS JOIN public.modules canonical
WHERE canonical.slug = 'plan-de-cosecha'
  AND legacy.slug <> 'plan-de-cosecha'
  AND legacy.is_active = true
  AND (
    legacy.slug ILIKE '%planificacion%'
    OR legacy.name ILIKE '%planificación de producción%'
    OR legacy.name ILIKE '%planificacion de produccion%'
  )
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = EXCLUDED.enabled;

-- ─── PASO 4: Desactivar módulo duplicado antiguo ────────────────────────────
UPDATE public.modules
SET is_active = false
WHERE slug <> 'plan-de-cosecha'
  AND is_active = true
  AND (
    slug ILIKE '%planificacion%'
    OR name ILIKE '%planificación de producción%'
    OR name ILIKE '%planificacion de produccion%'
  );
