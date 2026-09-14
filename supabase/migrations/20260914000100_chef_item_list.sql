-- ============================================================================
-- CHEF ITEM LIST
--
-- Each kitchen has one standing item list. Its chef (or an admin) adds each
-- item with a quantity, unit and measuring type. Staff check exactly those
-- items with Yes or No. Once today's check is filed the list locks until
-- tomorrow, so the record always matches the list that was checked.
-- ============================================================================

create table public.kitchen_items (
  id         uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens (id) on delete cascade,
  name       text not null check (btrim(name) <> ''),
  quantity   numeric(12, 3) not null check (quantity >= 0),
  unit       text not null default 'kg' check (unit in ('kg', 'g', 'L', 'ml', 'pcs')),
  measuring  public.measuring_type not null default 'tare',
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kitchen_items_kitchen_idx on public.kitchen_items (kitchen_id, sort_order);

-- Admin anywhere, or the chef of that kitchen.
create or replace function public.can_edit_items(p_kitchen_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    public.current_app_role() = 'admin'
    or (public.current_app_role() = 'chef' and public.current_kitchen() = p_kitchen_id),
    false)
$$;
revoke all on function public.can_edit_items(uuid) from public, anon;
grant execute on function public.can_edit_items(uuid) to authenticated;

alter table public.kitchen_items enable row level security;

create policy "items readable in scope" on public.kitchen_items
  for select to authenticated
  using ((select public.is_staff_plus()) or kitchen_id = (select public.current_kitchen()));
create policy "items chef insert" on public.kitchen_items
  for insert to authenticated with check (public.can_edit_items(kitchen_id));
create policy "items chef update" on public.kitchen_items
  for update to authenticated
  using (public.can_edit_items(kitchen_id)) with check (public.can_edit_items(kitchen_id));
create policy "items chef delete" on public.kitchen_items
  for delete to authenticated using (public.can_edit_items(kitchen_id));

-- A trigger rather than RLS so the chef gets a readable reason instead of a
-- silent "0 rows".
create or replace function public.guard_kitchen_items()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_kitchen uuid := case when tg_op = 'DELETE' then old.kitchen_id else new.kitchen_id end;
begin
  if tg_op = 'UPDATE' and new.kitchen_id <> old.kitchen_id then
    raise exception 'An item cannot be moved to another kitchen.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.submissions s
    where s.kitchen_id = v_kitchen and s.type = 'items'
      and s.form_date = public.kitchen_today(v_kitchen)
  ) then
    raise exception 'Today''s item check is already submitted, so the list is locked until tomorrow.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end
$$;
revoke all on function public.guard_kitchen_items() from public, anon, authenticated;

create trigger guard_kitchen_items
  before insert or update or delete on public.kitchen_items
  for each row execute function public.guard_kitchen_items();

-- Chef edits reach every open screen live.
alter publication supabase_realtime add table public.kitchen_items;

-- Filed checks snapshot the chef's item plus the staff member's Yes/No.
-- Applied while submission_items was empty.
alter table public.submission_items
  drop column actual_qty,
  drop column taste,
  add column item_id uuid references public.kitchen_items (id) on delete set null,
  add column result  public.yes_no not null,
  add column remarks text not null default '';
alter table public.submission_items rename column planned_qty to quantity;
create index items_item_idx on public.submission_items (item_id);

-- The admin-wide preset list is replaced by per-kitchen chef lists.
drop type public.taste_result;
drop table public.item_presets;

create or replace function public.submit_item_list(p_items jsonb)
returns public.submissions
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_kitchen public.kitchens;
  v_sub     public.submissions;
  v_total   int;
  v_matched int;
  v_issues  int;
begin
  select * into v_profile from public.profiles where id = (select auth.uid());
  if v_profile is null or not v_profile.active then
    raise exception 'No active profile for this user' using errcode = 'P0001';
  end if;

  select * into v_kitchen from public.kitchens where id = v_profile.kitchen_id;
  if v_kitchen is null then
    raise exception 'No kitchen is assigned to this account. Ask an admin to assign one.' using errcode = 'P0001';
  end if;

  select count(*) into v_total from public.kitchen_items where kitchen_id = v_kitchen.id;
  if v_total = 0 then
    raise exception 'The chef has not added any items for this kitchen yet.' using errcode = 'P0001';
  end if;

  -- Exactly the chef's current list, each item once. Anything else means the
  -- list changed while this person was checking.
  select count(distinct k.id) into v_matched
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) a
  join public.kitchen_items k on k.id::text = a ->> 'itemId' and k.kitchen_id = v_kitchen.id;

  if v_matched <> v_total or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) <> v_total then
    raise exception 'The chef changed the item list. Go back and check the updated items.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) a
    where coalesce(a ->> 'value', '') not in ('yes', 'no')
  ) then
    raise exception 'Every item needs Yes or No.' using errcode = 'P0001';
  end if;

  select count(*) into v_issues from jsonb_array_elements(p_items) a where a ->> 'value' = 'no';

  insert into public.submissions (
    type, kitchen_id, client_id, form_date, submitted_by, submitted_by_name, issues, compliance
  )
  values (
    'items', v_kitchen.id, v_kitchen.client_id, public.kitchen_today(v_kitchen.id),
    v_profile.id, v_profile.name, v_issues,
    round(((v_total - v_issues)::numeric / v_total) * 100)
  )
  returning * into v_sub;

  insert into public.submission_items (
    submission_id, serial, item_id, name, quantity, unit, measuring, result, remarks
  )
  select
    v_sub.id,
    (row_number() over (order by k.sort_order, k.created_at, k.id))::int,
    k.id, k.name, k.quantity, k.unit, k.measuring,
    (a ->> 'value')::public.yes_no,
    coalesce(a ->> 'remarks', '')
  from jsonb_array_elements(p_items) a
  join public.kitchen_items k on k.id::text = a ->> 'itemId' and k.kitchen_id = v_kitchen.id;

  update public.profiles set last_active = now() where id = v_profile.id;
  return v_sub;
end
$$;

revoke all on function public.submit_item_list(jsonb) from public, anon;
grant execute on function public.submit_item_list(jsonb) to authenticated;
