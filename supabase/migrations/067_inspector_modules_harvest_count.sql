-- Inspectores: Asistencia técnica + Estimación de cosecha (conteo en campo)

CREATE OR REPLACE FUNCTION public.enforce_inspector_module_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_insp boolean;
  allowed_count int;
BEGIN
  SELECT p.is_tech_inspector INTO is_insp
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF NOT COALESCE(is_insp, false) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO allowed_count
  FROM public.modules m
  WHERE m.slug IN ('asistencia-tecnica', 'estimacion-cosecha')
    AND m.id = NEW.module_id;

  IF allowed_count = 0 THEN
    RAISE EXCEPTION 'Los inspectores de campo solo pueden tener Asistencia técnica y Estimación de cosecha (conteo)';
  END IF;

  IF NEW.enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se puede desactivar un módulo obligatorio para un inspector';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_inspector_access_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (NEW.is_tech_inspector = true AND (TG_OP = 'INSERT' OR OLD.is_tech_inspector IS DISTINCT FROM true)) THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.user_table_access WHERE user_id = NEW.id;
  DELETE FROM public.user_chart_access WHERE user_id = NEW.id;

  DELETE FROM public.user_module_access uma
  WHERE uma.user_id = NEW.id
    AND uma.module_id NOT IN (
      SELECT m.id FROM public.modules m
      WHERE m.slug IN ('asistencia-tecnica', 'estimacion-cosecha')
    );

  INSERT INTO public.user_module_access (user_id, module_id, enabled, display_order)
  SELECT NEW.id, m.id, true, CASE m.slug WHEN 'asistencia-tecnica' THEN 0 ELSE 1 END
  FROM public.modules m
  WHERE m.slug IN ('asistencia-tecnica', 'estimacion-cosecha')
  ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;

  RETURN NEW;
END;
$$;

-- Sincronizar inspectores existentes: quitar otros módulos y asegurar los dos permitidos
DELETE FROM public.user_module_access uma
USING public.profiles p, public.modules m
WHERE uma.user_id = p.id
  AND p.is_tech_inspector = true
  AND uma.module_id = m.id
  AND m.slug NOT IN ('asistencia-tecnica', 'estimacion-cosecha');

INSERT INTO public.user_module_access (user_id, module_id, enabled, display_order)
SELECT p.id, m.id, true, CASE m.slug WHEN 'asistencia-tecnica' THEN 0 ELSE 1 END
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.is_tech_inspector = true
  AND m.slug IN ('asistencia-tecnica', 'estimacion-cosecha')
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true, display_order = EXCLUDED.display_order;
