-- Inspectores de campo: solo marcan asistencia (entrada/salida GPS), sin ver proformas ni administrar servicios.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_tech_inspector boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_tech_inspector IS
  'Inspector de asistencia técnica: solo puede registrar su asistencia en campo.';

CREATE OR REPLACE FUNCTION public.is_tech_inspector()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_tech_inspector FROM public.profiles p WHERE p.id = auth.uid()),
    false
  )
$$;

-- Servicios: inspector puede leer (para elegir labor), no crear/editar/eliminar
DROP POLICY IF EXISTS tech_assistance_services_insert_effective ON public.tech_assistance_services;
CREATE POLICY tech_assistance_services_insert_effective ON public.tech_assistance_services
  FOR INSERT WITH CHECK (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS tech_assistance_services_update_effective ON public.tech_assistance_services;
CREATE POLICY tech_assistance_services_update_effective ON public.tech_assistance_services
  FOR UPDATE USING (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS tech_assistance_services_delete_effective ON public.tech_assistance_services;
CREATE POLICY tech_assistance_services_delete_effective ON public.tech_assistance_services
  FOR DELETE USING (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Entradas: inspector solo ve y edita las suyas
DROP POLICY IF EXISTS tech_assistance_entries_select_effective ON public.tech_assistance_entries;
CREATE POLICY tech_assistance_entries_select_effective ON public.tech_assistance_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND (NOT public.is_tech_inspector() OR created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS tech_assistance_entries_update_effective ON public.tech_assistance_entries;
CREATE POLICY tech_assistance_entries_update_effective ON public.tech_assistance_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND proforma_id IS NULL
      AND (NOT public.is_tech_inspector() OR created_by = auth.uid())
    )
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND proforma_id IS NULL
      AND (NOT public.is_tech_inspector() OR created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS tech_assistance_entries_delete_effective ON public.tech_assistance_entries;
CREATE POLICY tech_assistance_entries_delete_effective ON public.tech_assistance_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND proforma_id IS NULL
      AND (NOT public.is_tech_inspector() OR created_by = auth.uid())
    )
  );

-- Proformas: invisible para inspectores
DROP POLICY IF EXISTS tech_assistance_proformas_select_effective ON public.tech_assistance_proformas;
CREATE POLICY tech_assistance_proformas_select_effective ON public.tech_assistance_proformas
  FOR SELECT USING (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS tech_assistance_proformas_insert_effective ON public.tech_assistance_proformas;
CREATE POLICY tech_assistance_proformas_insert_effective ON public.tech_assistance_proformas
  FOR INSERT WITH CHECK (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS tech_assistance_proformas_update_effective ON public.tech_assistance_proformas;
CREATE POLICY tech_assistance_proformas_update_effective ON public.tech_assistance_proformas
  FOR UPDATE USING (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS tech_assistance_proformas_delete_effective ON public.tech_assistance_proformas;
CREATE POLICY tech_assistance_proformas_delete_effective ON public.tech_assistance_proformas
  FOR DELETE USING (
    (user_id = public.effective_user_id() AND NOT public.is_tech_inspector())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
