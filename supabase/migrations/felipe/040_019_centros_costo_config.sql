-- Migration 019: Configuración de Centros de Costo
-- Permite al admin habilitar tablas dinámicas de los módulos del cliente
-- como centros de costo seleccionables en la asignación de gastos.

CREATE TABLE IF NOT EXISTS public.centros_costo_config (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tabla dinámica del módulo a usar como lookup
  tabla_id    uuid        NOT NULL REFERENCES public.dynamic_tables(id) ON DELETE CASCADE,

  -- Etiqueta que verá el cliente (ej: "Contenedores", "Pallets")
  label       text        NOT NULL DEFAULT '',

  -- Columna del JSONB data que se usa como código identificador
  col_codigo  text        NOT NULL DEFAULT '',

  -- Columna del JSONB data que se usa como nombre/descripción
  col_nombre  text        NOT NULL DEFAULT '',

  activo      boolean     NOT NULL DEFAULT true,
  orden       int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (cliente_id, tabla_id)
);

CREATE INDEX IF NOT EXISTS idx_centros_costo_cliente
  ON public.centros_costo_config(cliente_id, activo);

-- Ampliar el CHECK de entidad_tipo para admitir valores libres
-- (o simplemente eliminar la restricción para máxima flexibilidad)
ALTER TABLE public.asignaciones_gastos
  DROP CONSTRAINT IF EXISTS asignaciones_gastos_entidad_tipo_check;

ALTER TABLE public.asignaciones_gastos
  ADD CONSTRAINT asignaciones_gastos_entidad_tipo_check
  CHECK (entidad_tipo IN ('contenedor','producto_terminado','pallet','general','dinamico'));

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.centros_costo_config ENABLE ROW LEVEL SECURITY;

-- Solo admin puede gestionar la config
CREATE POLICY "centros_admin_all" ON public.centros_costo_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- El cliente solo puede leer su propia config (para el panel de asignación)
CREATE POLICY "centros_client_select" ON public.centros_costo_config
  FOR SELECT USING (
    cliente_id = public.effective_user_id()
  );
