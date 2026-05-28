alter table public.user_module_access
  add column if not exists display_order integer not null default 0;

create index if not exists user_module_access_user_order_idx
  on public.user_module_access(user_id, display_order);

with ranked as (
  select
    uma.user_id,
    uma.module_id,
    row_number() over (
      partition by uma.user_id
      order by m.created_at
    ) - 1 as rn
  from public.user_module_access uma
  join public.modules m on m.id = uma.module_id
)
update public.user_module_access uma
set display_order = ranked.rn
from ranked
where uma.user_id = ranked.user_id
  and uma.module_id = ranked.module_id
  and (uma.display_order is null or uma.display_order = 0);
