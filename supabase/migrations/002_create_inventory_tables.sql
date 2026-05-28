-- Inventory tables for warehouses, materials, and movements
create extension if not exists pgcrypto;

create table if not exists public.inventory_warehouses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  unit text not null,
  sku text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  warehouse_id uuid not null references public.inventory_warehouses(id) on delete cascade,
  material_id uuid not null references public.inventory_materials(id) on delete cascade,
  type text not null check (type in ('entrada', 'salida', 'ajuste')),
  quantity numeric not null,
  unit text not null,
  cost numeric,
  responsible text,
  observation text,
  movement_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists inventory_warehouses_user_id_idx on public.inventory_warehouses(user_id);
create index if not exists inventory_materials_user_id_idx on public.inventory_materials(user_id);
create index if not exists inventory_movements_user_id_idx on public.inventory_movements(user_id);
create index if not exists inventory_movements_warehouse_id_idx on public.inventory_movements(warehouse_id);
create index if not exists inventory_movements_material_id_idx on public.inventory_movements(material_id);

alter table public.inventory_warehouses enable row level security;
alter table public.inventory_materials enable row level security;
alter table public.inventory_movements enable row level security;

create policy "inventory_warehouses_select" on public.inventory_warehouses
  for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_warehouses_write" on public.inventory_warehouses
  for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_warehouses_update" on public.inventory_warehouses
  for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_warehouses_delete" on public.inventory_warehouses
  for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_select" on public.inventory_materials
  for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_write" on public.inventory_materials
  for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_update" on public.inventory_materials
  for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_delete" on public.inventory_materials
  for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_select" on public.inventory_movements
  for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_write" on public.inventory_movements
  for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_update" on public.inventory_movements
  for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_delete" on public.inventory_movements
  for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
