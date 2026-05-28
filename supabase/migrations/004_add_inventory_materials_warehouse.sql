-- Associate inventory materials to a single warehouse
alter table public.inventory_materials
  add column if not exists warehouse_id uuid;

update public.inventory_materials
set warehouse_id = (
  select id
  from public.inventory_warehouses
  where user_id = public.inventory_materials.user_id
  order by created_at
  limit 1
)
where warehouse_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_materials_warehouse_id_fkey'
  ) then
    alter table public.inventory_materials
      add constraint inventory_materials_warehouse_id_fkey
      foreign key (warehouse_id)
      references public.inventory_warehouses(id)
      on delete cascade;
  end if;
end $$;

create index if not exists inventory_materials_warehouse_id_idx
  on public.inventory_materials(warehouse_id);

alter table public.inventory_materials
  alter column warehouse_id set not null;
