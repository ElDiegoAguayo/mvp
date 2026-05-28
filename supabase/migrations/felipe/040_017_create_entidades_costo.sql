-- Migration 017: Entidades de Costo
-- Tabla de búsqueda para contenedores, productos terminados y pallets.
-- Se usa en el módulo de Asignación de Gastos.

CREATE TABLE IF NOT EXISTS public.entidades_costo (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo       text        NOT NULL
               CHECK (tipo IN ('contenedor', 'producto_terminado', 'pallet')),
  codigo     text        NOT NULL,   -- identificador visible: CTR-001, PT-045, PAL-12
  nombre     text        NOT NULL DEFAULT '',
  metadata   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, tipo, codigo)
);

CREATE INDEX IF NOT EXISTS idx_entidades_costo_cliente_tipo
  ON public.entidades_costo(cliente_id, tipo);

CREATE INDEX IF NOT EXISTS idx_entidades_costo_busqueda
  ON public.entidades_costo USING gin (
    to_tsvector('simple', codigo || ' ' || nombre)
  );

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.entidades_costo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entidades_select" ON public.entidades_costo
  FOR SELECT USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "entidades_insert" ON public.entidades_costo
  FOR INSERT WITH CHECK (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "entidades_update" ON public.entidades_costo
  FOR UPDATE
  USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "entidades_delete" ON public.entidades_costo
  FOR DELETE USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
