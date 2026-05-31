-- Inspectores Up Crop: no ligados a un cliente fijo; el admin asigna clientes y el inspector elige al marcar asistencia.

CREATE TABLE IF NOT EXISTS public.tech_assistance_inspector_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tech_inspector_clients_unique UNIQUE (inspector_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS tech_inspector_clients_inspector_idx
  ON public.tech_assistance_inspector_clients(inspector_id);

CREATE INDEX IF NOT EXISTS tech_inspector_clients_client_idx
  ON public.tech_assistance_inspector_clients(client_user_id);

-- Migrar inspectores que eran subusuarios de un cliente
INSERT INTO public.tech_assistance_inspector_clients (inspector_id, client_user_id)
SELECT p.id, p.parent_user_id
FROM public.profiles p
WHERE p.is_tech_inspector = true
  AND p.parent_user_id IS NOT NULL
ON CONFLICT (inspector_id, client_user_id) DO NOTHING;

UPDATE public.profiles
SET parent_user_id = NULL, updated_at = now()
WHERE is_tech_inspector = true
  AND parent_user_id IS NOT NULL;

-- ─── Helpers RLS ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.inspector_has_client_assignments()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tech_assistance_inspector_clients tic
    WHERE tic.inspector_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.inspector_can_access_client(client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_tech_inspector() THEN false
    WHEN public.inspector_has_client_assignments() THEN EXISTS (
      SELECT 1
      FROM public.tech_assistance_inspector_clients tic
      WHERE tic.inspector_id = auth.uid()
        AND tic.client_user_id = client_id
    )
    ELSE EXISTS (
      SELECT 1
      FROM public.profiles p
      INNER JOIN public.user_module_access uma ON uma.user_id = p.id AND uma.enabled = true
      INNER JOIN public.modules m ON m.id = uma.module_id AND m.slug = 'asistencia-tecnica'
      WHERE p.id = client_id
        AND p.role = 'user'
        AND p.parent_user_id IS NULL
    )
  END
$$;

-- ─── RLS tabla asignaciones ──────────────────────────────────────────────────

ALTER TABLE public.tech_assistance_inspector_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tech_inspector_clients_select ON public.tech_assistance_inspector_clients;
CREATE POLICY tech_inspector_clients_select ON public.tech_assistance_inspector_clients
  FOR SELECT USING (
    inspector_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS tech_inspector_clients_admin_all ON public.tech_assistance_inspector_clients;
CREATE POLICY tech_inspector_clients_admin_all ON public.tech_assistance_inspector_clients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ─── Servicios: inspector lee servicios de clientes asignados ────────────────

DROP POLICY IF EXISTS tech_assistance_services_select_effective ON public.tech_assistance_services;
CREATE POLICY tech_assistance_services_select_effective ON public.tech_assistance_services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND NOT public.is_tech_inspector()
    )
    OR (
      public.is_tech_inspector()
      AND public.inspector_can_access_client(user_id)
    )
  );

-- ─── Entradas: inspector registra en cliente elegido ─────────────────────────

DROP POLICY IF EXISTS tech_assistance_entries_insert_effective ON public.tech_assistance_entries;
CREATE POLICY tech_assistance_entries_insert_effective ON public.tech_assistance_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      NOT public.is_tech_inspector()
      AND user_id = public.effective_user_id()
    )
    OR (
      public.is_tech_inspector()
      AND created_by = auth.uid()
      AND public.inspector_can_access_client(user_id)
    )
  );

DROP POLICY IF EXISTS tech_assistance_entries_select_effective ON public.tech_assistance_entries;
CREATE POLICY tech_assistance_entries_select_effective ON public.tech_assistance_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND NOT public.is_tech_inspector()
    )
    OR (
      public.is_tech_inspector()
      AND created_by = auth.uid()
    )
  );
