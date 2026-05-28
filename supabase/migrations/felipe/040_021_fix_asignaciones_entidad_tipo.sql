-- Migration 021: Ensure 'dinamico' is allowed in asignaciones_gastos.entidad_tipo
-- The original table (016) only allowed contenedor/producto_terminado/pallet/general.
-- Migration 019 added 'dinamico' but may not have been applied.
-- This migration is idempotent: safe to run multiple times.

-- Drop ALL variants of the check constraint (different names used across migrations)
ALTER TABLE public.asignaciones_gastos
  DROP CONSTRAINT IF EXISTS asignaciones_gastos_entidad_tipo_check;

ALTER TABLE public.asignaciones_gastos
  DROP CONSTRAINT IF EXISTS asignaciones_gastos_entidad_tipo_check1;

-- Re-add with full set of allowed values including 'dinamico'
ALTER TABLE public.asignaciones_gastos
  ADD CONSTRAINT asignaciones_gastos_entidad_tipo_check
  CHECK (entidad_tipo IN ('contenedor', 'producto_terminado', 'pallet', 'general', 'dinamico'));
