-- ─────────────────────────────────────────────────────────────────────────────
-- 022 — Módulo Planificación de Producción
-- Tables: inventario_materiales, recetas_embalaje, receta_detalles
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. inventario_materiales
-- Stocks of packaging materials per client. Separate from inventory_materials
-- (which tracks warehouse movements). This is a flat snapshot used for
-- production capacity calculations.
create table if not exists public.inventario_materiales (
  id               uuid    primary key default gen_random_uuid(),
  cliente_id       uuid    not null references auth.users(id) on delete cascade,
  codigo_material  text    not null,
  descripcion      text    not null,
  stock_actual     numeric not null default 0,
  unidad_medida    text    not null default 'unidades',
  es_por_pallet    boolean not null default false,
  updated_at       timestamptz not null default now(),
  unique(cliente_id, codigo_material)
);

-- 2. recetas_embalaje
-- Each row is one packing code (ZFR1, ZFA1, …) with metadata.
create table if not exists public.recetas_embalaje (
  id              uuid    primary key default gen_random_uuid(),
  cliente_id      uuid    not null references auth.users(id) on delete cascade,
  codigo_receta   text    not null,
  descripcion     text,
  variedad        text,
  cajas_por_pallet integer,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique(cliente_id, codigo_receta)
);

-- 3. receta_detalles
-- BOM lines: how much of each material each recipe code requires per box.
create table if not exists public.receta_detalles (
  id                  uuid    primary key default gen_random_uuid(),
  receta_id           uuid    not null references public.recetas_embalaje(id) on delete cascade,
  material_id         uuid    not null references public.inventario_materiales(id) on delete cascade,
  cantidad_requerida  numeric not null check (cantidad_requerida > 0),
  unique(receta_id, material_id)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
create index if not exists idx_inv_materiales_cliente  on public.inventario_materiales(cliente_id);
create index if not exists idx_recetas_cliente         on public.recetas_embalaje(cliente_id);
create index if not exists idx_receta_detalles_receta  on public.receta_detalles(receta_id);
create index if not exists idx_receta_detalles_mat     on public.receta_detalles(material_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.inventario_materiales enable row level security;
alter table public.recetas_embalaje      enable row level security;
alter table public.receta_detalles       enable row level security;

-- inventario_materiales: admin full access, client reads/writes their own data
create policy "admin_all_inv_materiales" on public.inventario_materiales
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "client_own_inv_materiales" on public.inventario_materiales
  for all using (cliente_id = public.effective_user_id())
  with check (cliente_id = public.effective_user_id());

-- recetas_embalaje: admin full access, client reads their own
create policy "admin_all_recetas" on public.recetas_embalaje
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "client_own_recetas" on public.recetas_embalaje
  for select using (cliente_id = public.effective_user_id());

-- receta_detalles: access via parent receta
create policy "admin_all_receta_detalles" on public.receta_detalles
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "client_own_receta_detalles" on public.receta_detalles
  for select using (
    exists (
      select 1 from public.recetas_embalaje r
      where r.id = receta_id
        and r.cliente_id = public.effective_user_id()
    )
  );
