-- ============================================================================
-- FRUTTA KITCHEN OPS — INITIAL SCHEMA
--
-- A food-safety compliance system. Two rules drive every decision here:
--   1. A filed submission is immutable.
--   2. Compliance scores are computed by the database, never by the client.
--      A client that scores its own audit is not an audit.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- Values match the strings the frontend already sends, literally, including
-- the hyphen in 'non-tare'.
-- ----------------------------------------------------------------------------

create type public.user_role      as enum ('staff', 'manager', 'admin');
create type public.form_type      as enum ('audit', 'items');
create type public.yes_no         as enum ('yes', 'no');
create type public.taste_result   as enum ('ok', 'notok');
create type public.measuring_type as enum ('tare', 'non-tare');

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

create table public.kitchens (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  client_id  text not null unique,
  location   text not null default '',
  -- The operating day is decided in the kitchen's own timezone, not UTC.
  -- An audit filed at 02:00 IST must not be filed against yesterday.
  timezone   text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  staff_id    text not null unique,
  role        public.user_role not null default 'staff',
  kitchen_id  uuid references public.kitchens (id) on delete set null,
  active      boolean not null default true,
  last_active timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table public.inspection_points (
  id                    uuid primary key default gen_random_uuid(),
  serial                int  not null,
  section               text not null,
  text                  text not null,
  critical              boolean not null default false,
  require_photo_on_fail boolean not null default false,
  archived              boolean not null default false,
  created_at            timestamptz not null default now()
);

create table public.item_presets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  unit       text not null default 'kg',
  sort_order int  not null default 0
);

create table public.submissions (
  id                uuid primary key default gen_random_uuid(),
  type              public.form_type not null,
  kitchen_id        uuid not null references public.kitchens (id) on delete restrict,
  client_id         text not null,
  form_date         date not null,
  submitted_by      uuid not null references public.profiles (id) on delete restrict,
  submitted_by_name text not null,
  submitted_at      timestamptz not null default now(),
  issues            int not null default 0,
  compliance        int not null default 0,
  constraint one_submission_per_form_per_day
    unique (kitchen_id, form_date, type)
);

-- point_serial / point_section / point_text are snapshotted deliberately.
-- See the note at the end of this file before "normalising" them away.
create table public.audit_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  point_id      uuid references public.inspection_points (id) on delete set null,
  point_serial  int  not null,
  point_section text not null,
  point_text    text not null,
  value         public.yes_no not null,
  remarks       text not null default ''
);

create table public.answer_photos (
  id           uuid primary key default gen_random_uuid(),
  answer_id    uuid not null references public.audit_answers (id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create table public.submission_items (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  serial        int  not null,
  name          text not null,
  planned_qty   numeric(12, 3) not null,
  actual_qty    numeric(12, 3) not null,
  unit          text not null,
  taste         public.taste_result not null,
  measuring     public.measuring_type not null
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

create index profiles_kitchen_idx        on public.profiles (kitchen_id);
create index submissions_kitchen_day_idx on public.submissions (kitchen_id, form_date desc);
create index submissions_recent_idx      on public.submissions (submitted_at desc);
create index submissions_author_idx      on public.submissions (submitted_by);
create index answers_submission_idx      on public.audit_answers (submission_id);
create index items_submission_idx        on public.submission_items (submission_id);
create index photos_answer_idx           on public.answer_photos (answer_id);

-- The dashboard's "most failed checks" panel only ever reads failures.
create index answers_failed_idx on public.audit_answers (point_id) where value = 'no';

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS
--
-- security definer is required: these read profiles, and profiles' own RLS
-- depends on them. Without it, policy evaluation recurses infinitely.
--
-- Read from the table rather than JWT claims. Claims are stale until the
-- token refreshes, so demoting an admin would not take effect until their
-- next refresh. When access is revoked, it is revoked for a reason.
--
-- NOTE: current_role is a reserved word in Postgres. Hence current_app_role.
-- ----------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid()) and active
$$;

create or replace function public.current_kitchen()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select kitchen_id from public.profiles
  where id = (select auth.uid()) and active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.current_app_role() = 'admin', false) $$;

-- Manager or admin: the roles that see across every kitchen.
create or replace function public.is_staff_plus()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.current_app_role() in ('manager', 'admin'), false) $$;

-- Today, in the kitchen's own timezone.
create or replace function public.kitchen_today(p_kitchen_id uuid)
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select timezone from public.kitchens where id = p_kitchen_id),
    'Asia/Kolkata'
  ))::date
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- public is exposed through the Data API, so a table without RLS is a public
-- table. Every policy below:
--   - targets TO authenticated (never the deprecated auth.role() check, which
--     silently passes for anonymous sign-ins)
--   - pairs that with a real predicate, because TO authenticated alone is
--     authentication, not authorization
--   - wraps auth.uid() in a subquery so Postgres caches it as an InitPlan
--   - supplies both USING and WITH CHECK on anything that writes
-- ----------------------------------------------------------------------------

alter table public.kitchens          enable row level security;
alter table public.profiles          enable row level security;
alter table public.inspection_points enable row level security;
alter table public.item_presets      enable row level security;
alter table public.submissions       enable row level security;
alter table public.audit_answers     enable row level security;
alter table public.answer_photos     enable row level security;
alter table public.submission_items  enable row level security;

-- KITCHENS -------------------------------------------------------------------
create policy "kitchens readable" on public.kitchens
  for select to authenticated
  using (true);

create policy "kitchens admin insert" on public.kitchens
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "kitchens admin update" on public.kitchens
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "kitchens admin delete" on public.kitchens
  for delete to authenticated
  using ((select public.is_admin()));

-- PROFILES -------------------------------------------------------------------
create policy "profiles read own or managed" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff_plus()));

create policy "profiles admin insert" on public.profiles
  for insert to authenticated
  with check ((select public.is_admin()));

-- Admins only. A user must never be able to promote themselves, so there is
-- deliberately no self-update policy — even for harmless-looking fields.
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- TEMPLATES ------------------------------------------------------------------
create policy "points readable" on public.inspection_points
  for select to authenticated
  using (true);

create policy "points admin insert" on public.inspection_points
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "points admin update" on public.inspection_points
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "points admin delete" on public.inspection_points
  for delete to authenticated
  using ((select public.is_admin()));

create policy "presets readable" on public.item_presets
  for select to authenticated
  using (true);

create policy "presets admin insert" on public.item_presets
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "presets admin update" on public.item_presets
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "presets admin delete" on public.item_presets
  for delete to authenticated
  using ((select public.is_admin()));

-- SUBMISSIONS ----------------------------------------------------------------
-- Read only. There is deliberately no insert, update or delete policy:
-- writes go exclusively through the security definer RPCs below, which
-- compute the score themselves, and a filed record is immutable.
create policy "submissions read scoped" on public.submissions
  for select to authenticated
  using (
    (select public.is_staff_plus())
    or kitchen_id = (select public.current_kitchen())
  );

create policy "answers read via parent" on public.audit_answers
  for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = audit_answers.submission_id
      and ((select public.is_staff_plus())
           or s.kitchen_id = (select public.current_kitchen()))
  ));

create policy "items read via parent" on public.submission_items
  for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = submission_items.submission_id
      and ((select public.is_staff_plus())
           or s.kitchen_id = (select public.current_kitchen()))
  ));

create policy "photos read via answer" on public.answer_photos
  for select to authenticated
  using (exists (
    select 1
    from public.audit_answers a
    join public.submissions s on s.id = a.submission_id
    where a.id = answer_photos.answer_id
      and ((select public.is_staff_plus())
           or s.kitchen_id = (select public.current_kitchen()))
  ));

-- Photo rows are written by the uploader, against their own kitchen's audit.
create policy "photos insert own kitchen" on public.answer_photos
  for insert to authenticated
  with check (exists (
    select 1
    from public.audit_answers a
    join public.submissions s on s.id = a.submission_id
    where a.id = answer_photos.answer_id
      and s.submitted_by = (select auth.uid())
  ));

-- ============================================================================
-- WRITE PATH — RPCs
--
-- Both functions ignore any kitchen, date, score or submitter the client
-- sends. Those come from the caller's own profile and the server clock.
-- ============================================================================

create or replace function public.submit_audit(p_answers jsonb)
returns public.submissions
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_kitchen public.kitchens;
  v_sub     public.submissions;
  v_total   int;
  v_issues  int;
  v_matched int;
begin
  select * into v_profile from public.profiles where id = (select auth.uid());
  if v_profile is null or not v_profile.active then
    raise exception 'No active profile for this user'
      using errcode = 'P0001';
  end if;

  select * into v_kitchen from public.kitchens where id = v_profile.kitchen_id;
  if v_kitchen is null then
    raise exception 'No kitchen is assigned to this account. Ask an admin to assign one.'
      using errcode = 'P0001';
  end if;

  v_total := coalesce(jsonb_array_length(p_answers), 0);
  if v_total = 0 then
    raise exception 'An audit must contain at least one answer'
      using errcode = 'P0001';
  end if;

  -- Every answer must reference a real inspection point. Silently dropping
  -- unmatched rows would file an audit that scores better than it should.
  select count(*) into v_matched
  from jsonb_array_elements(p_answers) a
  join public.inspection_points p on p.id = (a ->> 'pointId')::uuid;

  if v_matched <> v_total then
    raise exception 'Some answers reference inspection points that no longer exist. Reload the checklist.'
      using errcode = 'P0001';
  end if;

  -- Remarks are mandatory on a failure. The UI enforces this too; this is the
  -- layer that counts.
  if exists (
    select 1 from jsonb_array_elements(p_answers) a
    where a ->> 'value' = 'no' and btrim(coalesce(a ->> 'remarks', '')) = ''
  ) then
    raise exception 'Remarks are required for every point marked No'
      using errcode = 'P0001';
  end if;

  select count(*) into v_issues
  from jsonb_array_elements(p_answers) a
  where a ->> 'value' = 'no';

  insert into public.submissions (
    type, kitchen_id, client_id, form_date,
    submitted_by, submitted_by_name, issues, compliance
  )
  values (
    'audit',
    v_kitchen.id,
    v_kitchen.client_id,
    public.kitchen_today(v_kitchen.id),
    v_profile.id,
    v_profile.name,
    v_issues,
    round(((v_total - v_issues)::numeric / v_total) * 100)
  )
  returning * into v_sub;

  insert into public.audit_answers (
    submission_id, point_id, point_serial, point_section, point_text,
    value, remarks
  )
  select
    v_sub.id,
    p.id,
    p.serial,
    p.section,
    p.text,
    (a ->> 'value')::public.yes_no,
    coalesce(a ->> 'remarks', '')
  from jsonb_array_elements(p_answers) a
  join public.inspection_points p on p.id = (a ->> 'pointId')::uuid;

  update public.profiles set last_active = now() where id = v_profile.id;

  return v_sub;
end
$$;

create or replace function public.submit_item_list(p_items jsonb)
returns public.submissions
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_kitchen public.kitchens;
  v_sub     public.submissions;
  v_total   int;
  v_issues  int;
begin
  select * into v_profile from public.profiles where id = (select auth.uid());
  if v_profile is null or not v_profile.active then
    raise exception 'No active profile for this user'
      using errcode = 'P0001';
  end if;

  select * into v_kitchen from public.kitchens where id = v_profile.kitchen_id;
  if v_kitchen is null then
    raise exception 'No kitchen is assigned to this account. Ask an admin to assign one.'
      using errcode = 'P0001';
  end if;

  v_total := coalesce(jsonb_array_length(p_items), 0);
  if v_total = 0 then
    raise exception 'An item check list must contain at least one item'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where btrim(coalesce(i ->> 'name', '')) = ''
       or coalesce(i ->> 'taste', '') not in ('ok', 'notok')
       or coalesce(i ->> 'measuring', '') not in ('tare', 'non-tare')
       or (i ->> 'plannedQty') is null
       or (i ->> 'actualQty') is null
  ) then
    raise exception 'Every item needs a name, both quantities, a taste result and a measuring type'
      using errcode = 'P0001';
  end if;

  select count(*) into v_issues
  from jsonb_array_elements(p_items) i
  where i ->> 'taste' = 'notok';

  insert into public.submissions (
    type, kitchen_id, client_id, form_date,
    submitted_by, submitted_by_name, issues, compliance
  )
  values (
    'items',
    v_kitchen.id,
    v_kitchen.client_id,
    public.kitchen_today(v_kitchen.id),
    v_profile.id,
    v_profile.name,
    v_issues,
    round(((v_total - v_issues)::numeric / v_total) * 100)
  )
  returning * into v_sub;

  -- WITH ORDINALITY, not row_number() over (): an empty window has no
  -- defined ordering, so serial numbers could come back shuffled and the
  -- filed list would not match the order the person entered it in.
  insert into public.submission_items (
    submission_id, serial, name, planned_qty, actual_qty, unit, taste, measuring
  )
  select
    v_sub.id,
    ord::int,
    i ->> 'name',
    (i ->> 'plannedQty')::numeric,
    (i ->> 'actualQty')::numeric,
    coalesce(nullif(i ->> 'unit', ''), 'kg'),
    (i ->> 'taste')::public.taste_result,
    (i ->> 'measuring')::public.measuring_type
  from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  update public.profiles set last_active = now() where id = v_profile.id;

  return v_sub;
end
$$;

-- ============================================================================
-- READ RPCs — aggregation belongs in the database
-- ============================================================================

-- Shapes its payload to the frontend's DashboardMetrics interface exactly.
-- Scopes itself to the caller: staff see only their kitchen.
create or replace function public.dashboard_metrics()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_all      boolean := (select public.is_staff_plus());
  v_kitchen  uuid    := (select public.current_kitchen());
  v_today    date    := (now() at time zone 'Asia/Kolkata')::date;
  v_result   jsonb;
begin
  if not v_all and v_kitchen is null then
    raise exception 'No kitchen is assigned to this account'
      using errcode = 'P0001';
  end if;

  with scoped as (
    select s.* from public.submissions s
    where v_all or s.kitchen_id = v_kitchen
  ),
  audits as (select * from scoped where type = 'audit'),
  week   as (select * from audits where form_date > v_today - 7),
  prior  as (select * from audits where form_date > v_today - 14 and form_date <= v_today - 7),
  issues_week  as (select coalesce(sum(issues), 0) n from scoped where form_date > v_today - 7),
  issues_prior as (select coalesce(sum(issues), 0) n from scoped where form_date > v_today - 14 and form_date <= v_today - 7)
  select jsonb_build_object(
    'auditsToday',
      (select count(*) from audits where form_date = v_today),
    'auditsTodayDelta',
      (select count(*) from audits where form_date = v_today)
      - (select count(*) from audits where form_date = v_today - 1),
    'complianceRate',
      coalesce((select round(avg(compliance)) from week), 0),
    'complianceDelta',
      coalesce((select round(avg(compliance)) from week), 0)
      - coalesce((select round(avg(compliance)) from prior), 0),
    'openIssues',
      (select n from issues_week),
    'openIssuesDelta',
      (select n from issues_week) - (select n from issues_prior),
    'kitchensReporting',
      (select count(distinct kitchen_id) from scoped where form_date = v_today),
    'kitchensTotal',
      case when v_all then (select count(*) from public.kitchens) else 1 end,
    'byKitchen', coalesce((
      select jsonb_agg(entry)
      from (
        select jsonb_build_object(
          'kitchen', jsonb_build_object(
            'id', k.id,
            'name', k.name,
            'clientId', k.client_id,
            'location', k.location
          ),
          'compliance', coalesce((
            select round(avg(w.compliance)) from week w where w.kitchen_id = k.id
          ), 0)
        ) as entry
        from public.kitchens k
        where v_all or k.id = v_kitchen
        order by k.name
      ) t
    ), '[]'::jsonb),
    'topFailures', coalesce((
      select jsonb_agg(entry)
      from (
        select jsonb_build_object(
          'point', jsonb_build_object(
            'id', coalesce(a.point_id::text, 'archived-' || a.point_serial),
            'serial', a.point_serial,
            'section', a.point_section,
            'text', a.point_text,
            'critical', coalesce(p.critical, false),
            'requirePhotoOnFail', coalesce(p.require_photo_on_fail, false)
          ),
          'count', count(*)
        ) as entry
        from public.audit_answers a
        join week w on w.id = a.submission_id
        left join public.inspection_points p on p.id = a.point_id
        where a.value = 'no'
        group by a.point_id, a.point_serial, a.point_section, a.point_text,
                 p.critical, p.require_photo_on_fail
        order by count(*) desc, a.point_serial
        limit 6
      ) t
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(entry)
      from (
        select jsonb_build_object(
          'id', s.id,
          'type', s.type,
          'kitchenId', s.kitchen_id,
          'clientId', s.client_id,
          'date', s.form_date,
          'submittedById', s.submitted_by,
          'submittedByName', s.submitted_by_name,
          'submittedAt', s.submitted_at,
          'issues', s.issues,
          'compliance', s.compliance,
          -- List payloads carry no children. Only getRecordById hydrates them.
          'answers', '[]'::jsonb,
          'items', '[]'::jsonb
        ) as entry
        from scoped s
        order by s.submitted_at desc
        limit 10
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

-- Shapes its payload to the frontend's KitchenDetail interface exactly.
create or replace function public.kitchen_detail(p_kitchen_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_all     boolean := (select public.is_staff_plus());
  v_kitchen uuid    := (select public.current_kitchen());
  v_k       public.kitchens;
  v_today   date;
  v_result  jsonb;
begin
  if not v_all and p_kitchen_id is distinct from v_kitchen then
    raise exception 'Not permitted to view this kitchen'
      using errcode = '42501';
  end if;

  select * into v_k from public.kitchens where id = p_kitchen_id;
  if v_k is null then
    return null;
  end if;

  v_today := public.kitchen_today(p_kitchen_id);

  with subs as (
    select * from public.submissions where kitchen_id = p_kitchen_id
  ),
  audits as (select * from subs where type = 'audit')
  select jsonb_build_object(
    'kitchen', jsonb_build_object(
      'id', v_k.id,
      'name', v_k.name,
      'clientId', v_k.client_id,
      'location', v_k.location
    ),
    'compliance',      coalesce((select round(avg(compliance)) from audits), 0),
    'auditsThisMonth', (select count(*) from audits where form_date > v_today - 30),
    'openIssues',      coalesce((select sum(issues) from subs), 0),
    'lastSubmission',  (select max(submitted_at) from subs),
    -- Generated server-side. Built client-side, days with no submission
    -- would simply vanish instead of showing as a gap.
    'strip', (
      select jsonb_agg(jsonb_build_object(
        'date', d::date,
        'result', case
          when a.id is null then 'none'
          when a.issues > 0 then 'fail'
          else 'pass'
        end
      ) order by d)
      -- Cast to timestamp explicitly: generate_series has no (date, date,
      -- interval) signature, and relying on implicit casting is ambiguous.
      from generate_series(
        (v_today - 29)::timestamp, v_today::timestamp, interval '1 day'
      ) d
      left join audits a on a.form_date = d::date
    ),
    'submissions', coalesce((
      select jsonb_agg(entry)
      from (
        select jsonb_build_object(
          'id', s.id,
          'type', s.type,
          'kitchenId', s.kitchen_id,
          'clientId', s.client_id,
          'date', s.form_date,
          'submittedById', s.submitted_by,
          'submittedByName', s.submitted_by_name,
          'submittedAt', s.submitted_at,
          'issues', s.issues,
          'compliance', s.compliance,
          'answers', '[]'::jsonb,
          'items', '[]'::jsonb
        ) as entry
        from subs s order by s.submitted_at desc limit 20
      ) t
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'name', pr.name,
        'staffId', pr.staff_id,
        'role', pr.role,
        'kitchenId', pr.kitchen_id,
        'lastActive', pr.last_active,
        'active', pr.active
      ) order by pr.name)
      from public.profiles pr where pr.kitchen_id = p_kitchen_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

-- ----------------------------------------------------------------------------
-- GRANTS — RPCs are the only write path, and only for signed-in users.
-- ----------------------------------------------------------------------------

revoke all on function public.submit_audit(jsonb)      from public, anon;
revoke all on function public.submit_item_list(jsonb)  from public, anon;
revoke all on function public.dashboard_metrics()      from public, anon;
revoke all on function public.kitchen_detail(uuid)     from public, anon;

grant execute on function public.submit_audit(jsonb)     to authenticated;
grant execute on function public.submit_item_list(jsonb) to authenticated;
grant execute on function public.dashboard_metrics()     to authenticated;
grant execute on function public.kitchen_detail(uuid)    to authenticated;

-- ----------------------------------------------------------------------------
-- REALTIME
--
-- Only these two. A single audit writes 16 answer rows; broadcasting those
-- would fire 16 events for one thing the client already knows how to refetch.
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.inspection_points;

-- ----------------------------------------------------------------------------
-- STORAGE — inspection photos
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('audit-photos', 'audit-photos', false)
on conflict (id) do nothing;

-- Path convention: {kitchen_id}/{submission_id}/{answer_id}/{uuid}.jpg
create policy "photo upload own kitchen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'audit-photos'
    and (storage.foldername(name))[1] = (select public.current_kitchen())::text
  );

create policy "photo read scoped" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'audit-photos'
    and (
      (select public.is_staff_plus())
      or (storage.foldername(name))[1] = (select public.current_kitchen())::text
    )
  );

-- ============================================================================
-- WHY audit_answers DUPLICATES THE POINT TEXT
--
-- point_serial, point_section and point_text are copied onto every answer row
-- at submit time. This is not a normalisation mistake.
--
-- The Templates screen lets an admin reword or reorder inspection points. If
-- answers only held point_id, editing the template would retroactively rewrite
-- what every historical audit claims to have checked — a record filed in March
-- would start displaying April's wording. In a compliance system that is
-- falsifying records.
--
-- point_id survives only as a soft link for failure aggregation, and is
-- nullable so archiving a point cannot cascade into filed evidence. The same
-- reasoning drives submitted_by_name on submissions, and the on delete
-- restrict on kitchen_id and submitted_by.
-- ============================================================================
