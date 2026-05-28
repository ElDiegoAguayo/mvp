-- Migration 016: Asignaciones de Gastos por Centro de Costo
-- Permite dividir una factura (registro_compras_sii) en múltiples
-- centros de costo: contenedor, producto terminado, pallet, etc.

CREATE TABLE IF NOT EXISTS public.asignaciones_gastos (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Factura origen
  factura_id      uuid        NOT NULL
                    REFERENCES public.registro_compras_sii(id) ON DELETE CASCADE,

  -- cliente_id desnormalizado para que RLS sea simple y eficiente
  cliente_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Centro de costo al que se asigna la porción
  entidad_tipo    text        NOT NULL
                    CHECK (entidad_tipo IN ('contenedor', 'producto_terminado', 'pallet', 'general')),
  entidad_id      text        NOT NULL DEFAULT '',   -- nro. de contenedor, pallet, etc.

  -- División del monto
  monto_asignado  numeric     NOT NULL DEFAULT 0,
  porcentaje      numeric,                           -- NULL = división equitativa implícita

  -- Datos extra: peso, kilos, descripción, etc.
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asignaciones_factura_id
  ON public.asignaciones_gastos(factura_id);

CREATE INDEX IF NOT EXISTS idx_asignaciones_cliente_id
  ON public.asignaciones_gastos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_asignaciones_entidad
  ON public.asignaciones_gastos(cliente_id, entidad_tipo, entidad_id);

-- ── updated_at automático ──────────────────────────────────────────────────
CREATE TRIGGER trg_asignaciones_gastos_updated_at
  BEFORE UPDATE ON public.asignaciones_gastos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.asignaciones_gastos ENABLE ROW LEVEL SECURITY;

-- Clientes: acceso a sus propias asignaciones (incluyendo sub-usuarios)
CREATE POLICY "asignaciones_select" ON public.asignaciones_gastos
  FOR SELECT USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "asignaciones_insert" ON public.asignaciones_gastos
  FOR INSERT WITH CHECK (
    cliente_id = public.effective_user_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "asignaciones_update" ON public.asignaciones_gastos
  FOR UPDATE
  USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    cliente_id = public.effective_user_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "asignaciones_delete" ON public.asignaciones_gastos
  FOR DELETE USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
