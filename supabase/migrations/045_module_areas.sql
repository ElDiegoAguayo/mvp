-- Áreas / categorías para agrupar módulos similares en admin y dashboard

CREATE TABLE IF NOT EXISTS public.module_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_areas_name_unique UNIQUE (name)
);

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.module_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS modules_area_id_idx ON public.modules(area_id);

-- Áreas base
INSERT INTO public.module_areas (name, display_order) VALUES
  ('Campo y cosecha', 0),
  ('Producción e inventario', 1),
  ('Comercio exterior', 2),
  ('Costos y finanzas', 3),
  ('Documentos', 4),
  ('General', 99)
ON CONFLICT (name) DO NOTHING;

-- Asignación por slug (solo módulos activos)
UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE a.name = 'Campo y cosecha'
  AND m.slug IN ('estimacion-cosecha', 'estados-fenologicos');

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE a.name = 'Producción e inventario'
  AND m.slug IN (
    'planificacion-de-produccion',
    'inventario',
    'producto-terminado',
    'centro-de-control'
  );

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE a.name = 'Comercio exterior'
  AND m.slug IN ('comercio-exterior', 'trazabilidad', 'productores', 'mercado');

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE a.name = 'Costos y finanzas'
  AND m.slug IN ('costos-y-gastos');

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE a.name = 'Documentos'
  AND m.slug IN ('boveda-documental', 'generacion-de-documentos');

UPDATE public.modules m
SET area_id = a.id
FROM public.module_areas a
WHERE a.name = 'General'
  AND m.area_id IS NULL
  AND m.is_active = true;

COMMENT ON TABLE public.module_areas IS 'Categorías de área para agrupar módulos en admin y sidebar del cliente.';
COMMENT ON COLUMN public.modules.area_id IS 'Área funcional del módulo (campo, comercio exterior, costos, etc.).';

-- RLS: lectura para usuarios autenticados; escritura solo admin
ALTER TABLE public.module_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module_areas_select_authenticated" ON public.module_areas;
CREATE POLICY "module_areas_select_authenticated"
  ON public.module_areas
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "module_areas_insert_admin" ON public.module_areas;
CREATE POLICY "module_areas_insert_admin"
  ON public.module_areas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "module_areas_update_admin" ON public.module_areas;
CREATE POLICY "module_areas_update_admin"
  ON public.module_areas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "module_areas_delete_admin" ON public.module_areas;
CREATE POLICY "module_areas_delete_admin"
  ON public.module_areas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
