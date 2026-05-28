-- Migration 015: Dynamic classification taxonomy per client
-- Re-designed for a flat, per-level options model.
-- Each client has:
--   clasificacion_config  -- one row: defines the dynamic levels (JSON array)
--   clasificacion_opciones -- one row per selectable option, tagged by level number

-- Drop old tables if they exist from a previous attempt
DROP TABLE IF EXISTS public.clasificacion_taxonomy  CASCADE;
DROP TABLE IF EXISTS public.clasificacion_config    CASCADE;

-- ── Config: one row per client ─────────────────────────────────────────────
-- niveles is a JSON array of objects: [{"numero":1,"label":"Cuenta Madre"}, ...]
CREATE TABLE public.clasificacion_config (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  niveles    jsonb       NOT NULL DEFAULT '[{"numero":1,"label":"Cuenta Madre"},{"numero":2,"label":"Sub-Cuenta"},{"numero":3,"label":"Detalle"}]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Options: individual selectable tags per level ─────────────────────────
CREATE TABLE public.clasificacion_opciones (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nivel_numero  int         NOT NULL,  -- matches niveles[].numero from config
  opcion_texto  text        NOT NULL,
  activo        boolean     NOT NULL DEFAULT true,
  orden         int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, nivel_numero, opcion_texto)
);

CREATE INDEX IF NOT EXISTS idx_clasificacion_opciones_cliente_nivel
  ON public.clasificacion_opciones(cliente_id, nivel_numero);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.clasificacion_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clasificacion_opciones ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admin_all_config" ON public.clasificacion_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_all_opciones" ON public.clasificacion_opciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Clients: read their own data
CREATE POLICY "client_read_config" ON public.clasificacion_config
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "client_read_opciones" ON public.clasificacion_opciones
  FOR SELECT USING (cliente_id = auth.uid());
