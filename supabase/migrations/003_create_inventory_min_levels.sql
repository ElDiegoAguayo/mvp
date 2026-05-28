-- Inventory minimum stock levels per warehouse and material
create table if not exists public.inventory_min_levels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  warehouse_id uuid not null references public.inventory_warehouses(id) on delete cascade,
  material_id uuid not null references public.inventory_materials(id) on delete cascade,
  min_quantity numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_min_levels_unique_idx
  on public.inventory_min_levels(user_id, warehouse_id, material_id);

create index if not exists inventory_min_levels_user_id_idx on public.inventory_min_levels(user_id);

alter table public.inventory_min_levels enable row level security;

create policy "inventory_min_levels_select" on public.inventory_min_levels
  for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_min_levels_write" on public.inventory_min_levels
  for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_min_levels_update" on public.inventory_min_levels
  for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_min_levels_delete" on public.inventory_min_levels
  for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
