-- Migration 018: Producción por Entidad
-- Almacena los datos de producción (kilos, ventas) por entidad (contenedor,
-- producto terminado, pallet). Se cruza con asignaciones_gastos para calcular
-- costo/kilo, margen real, etc.

CREATE TABLE IF NOT EXISTS public.produccion_datos (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Referencia a la entidad (mismo esquema que asignaciones_gastos)
  entidad_tipo   text        NOT NULL
                   CHECK (entidad_tipo IN ('contenedor', 'producto_terminado', 'pallet', 'general')),
  entidad_id     text        NOT NULL,  -- código del contenedor / pallet / etc.

  -- Datos de producción
  kilos          numeric     NOT NULL DEFAULT 0,   -- kilos producidos / procesados
  venta_total    numeric     NOT NULL DEFAULT 0,   -- ingresos por venta de este lote
  precio_por_kilo numeric,                          -- precio de venta por kilo (opcional)

  -- Período al que corresponde (libre: "Abril 2026", "Lote #45", etc.)
  periodo        text        NOT NULL DEFAULT '',

  -- Datos extra: variedad, mercado destino, certificaciones, etc.
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,

  notas          text        NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produccion_cliente_entidad
  ON public.produccion_datos(cliente_id, entidad_tipo, entidad_id);

CREATE TRIGGER trg_produccion_datos_updated_at
  BEFORE UPDATE ON public.produccion_datos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.produccion_datos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produccion_select" ON public.produccion_datos
  FOR SELECT USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "produccion_insert" ON public.produccion_datos
  FOR INSERT WITH CHECK (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "produccion_update" ON public.produccion_datos
  FOR UPDATE
  USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "produccion_delete" ON public.produccion_datos
  FOR DELETE USING (
    cliente_id = public.effective_user_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
