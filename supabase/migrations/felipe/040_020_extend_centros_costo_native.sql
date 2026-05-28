-- Migration 020: Extender centros_costo_config para tablas nativas
-- Permite conectar módulos con tablas Supabase reales (inventory_materials, etc.)
-- además de las dynamic_table_rows existentes.

-- 1. Hacer tabla_id nullable (las tablas nativas no tienen entrada en dynamic_tables)
ALTER TABLE public.centros_costo_config
  ALTER COLUMN tabla_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS centros_costo_config_tabla_id_fkey;

-- Re-add FK as optional
ALTER TABLE public.centros_costo_config
  ADD CONSTRAINT centros_costo_config_tabla_id_fkey
    FOREIGN KEY (tabla_id)
    REFERENCES public.dynamic_tables(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- 2. Agregar campos para tablas nativas
ALTER TABLE public.centros_costo_config
  ADD COLUMN IF NOT EXISTS tipo_tabla      text NOT NULL DEFAULT 'dynamic'
    CHECK (tipo_tabla IN ('dynamic', 'native')),
  ADD COLUMN IF NOT EXISTS tabla_nombre_real text;  -- nombre de tabla real: 'inventory_materials'

-- 3. Columnas extra para mostrar en la tabla del picker (comma-separated)
ALTER TABLE public.centros_costo_config
  ADD COLUMN IF NOT EXISTS cols_extra text NOT NULL DEFAULT '';

-- 4. Reemplazar UNIQUE constraint para soportar ambos tipos
ALTER TABLE public.centros_costo_config
  DROP CONSTRAINT IF EXISTS centros_costo_config_cliente_id_tabla_id_key;

-- Unique index para tablas dinámicas (tabla_id NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_centros_unique_dynamic
  ON public.centros_costo_config(cliente_id, tabla_id)
  WHERE tabla_id IS NOT NULL;

-- Unique index para tablas nativas (tabla_nombre_real NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_centros_unique_native
  ON public.centros_costo_config(cliente_id, tabla_nombre_real)
  WHERE tabla_nombre_real IS NOT NULL;

-- 5. Check: al menos uno de tabla_id o tabla_nombre_real debe estar presente
ALTER TABLE public.centros_costo_config
  ADD CONSTRAINT centros_costo_check_tabla
    CHECK (tabla_id IS NOT NULL OR tabla_nombre_real IS NOT NULL);
