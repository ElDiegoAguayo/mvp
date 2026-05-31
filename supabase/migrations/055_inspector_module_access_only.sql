-- Inspectores: solo módulo asistencia-tecnica (UI + DB)

DELETE FROM public.user_table_access uta
USING public.profiles p
WHERE uta.user_id = p.id AND p.is_tech_inspector = true;

DELETE FROM public.user_chart_access uca
USING public.profiles p
WHERE uca.user_id = p.id AND p.is_tech_inspector = true;

DELETE FROM public.user_module_access uma
USING public.profiles p, public.modules m
WHERE uma.user_id = p.id
  AND p.is_tech_inspector = true
  AND m.slug = 'asistencia-tecnica'
  AND uma.module_id <> m.id;

INSERT INTO public.user_module_access (user_id, module_id, enabled, display_order)
SELECT p.id, m.id, true, 0
FROM public.profiles p
CROSS JOIN public.modules m
WHERE p.is_tech_inspector = true
  AND m.slug = 'asistencia-tecnica'
ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;

CREATE OR REPLACE FUNCTION public.enforce_inspector_module_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tech_module_id uuid;
  is_insp boolean;
BEGIN
  SELECT p.is_tech_inspector INTO is_insp
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF NOT COALESCE(is_insp, false) THEN
    RETURN NEW;
  END IF;

  SELECT m.id INTO tech_module_id
  FROM public.modules m
  WHERE m.slug = 'asistencia-tecnica'
  LIMIT 1;

  IF tech_module_id IS NULL THEN
    RAISE EXCEPTION 'Módulo asistencia-tecnica no configurado';
  END IF;

  IF NEW.module_id IS DISTINCT FROM tech_module_id THEN
    RAISE EXCEPTION 'Los inspectores de campo solo pueden tener el módulo Asistencia técnica';
  END IF;

  IF NEW.enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se puede desactivar Asistencia técnica para un inspector';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_module_access_inspector_enforce ON public.user_module_access;
CREATE TRIGGER user_module_access_inspector_enforce
  BEFORE INSERT OR UPDATE ON public.user_module_access
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_inspector_module_access();

CREATE OR REPLACE FUNCTION public.cleanup_inspector_access_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tech_module_id uuid;
BEGIN
  IF NOT (NEW.is_tech_inspector = true AND (TG_OP = 'INSERT' OR OLD.is_tech_inspector IS DISTINCT FROM true)) THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.user_table_access WHERE user_id = NEW.id;
  DELETE FROM public.user_chart_access WHERE user_id = NEW.id;

  SELECT m.id INTO tech_module_id FROM public.modules m WHERE m.slug = 'asistencia-tecnica' LIMIT 1;

  IF tech_module_id IS NOT NULL THEN
    DELETE FROM public.user_module_access
    WHERE user_id = NEW.id AND module_id <> tech_module_id;

    INSERT INTO public.user_module_access (user_id, module_id, enabled, display_order)
    VALUES (NEW.id, tech_module_id, true, 0)
    ON CONFLICT (user_id, module_id) DO UPDATE SET enabled = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_inspector_access_cleanup ON public.profiles;
CREATE TRIGGER profiles_inspector_access_cleanup
  AFTER INSERT OR UPDATE OF is_tech_inspector ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_inspector_access_on_profile();
