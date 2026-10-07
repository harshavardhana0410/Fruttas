-- ============================================================================
-- PHOTOS ON BOTH LEVELS
--
-- A main heading carries one photo of the station. A point marked No carries
-- one photo of what was wrong. Same table: a row is a heading's photo when it
-- names a section, or a point's photo when it names a point, never both.
--
-- "nulls not distinct" is what makes the unique key actually bite — without
-- it, Postgres would treat every heading row's null point_id as distinct and
-- a heading could collect any number of photos.
--
-- point_id is a plain uuid, not a foreign key: like audit_answers.point_id it
-- is a snapshot pointer, and archiving a point must never reach into evidence
-- that has already been filed.
--
-- No update or delete policy, deliberately. Filed evidence is immutable.
-- ============================================================================

drop table if exists public.section_photos;

create table public.audit_photos (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  section       text,
  point_id      uuid,
  storage_path  text not null,
  created_at    timestamptz not null default now(),
  constraint heading_or_point check ((section is null) <> (point_id is null)),
  constraint one_photo_per_slot unique nulls not distinct (submission_id, section, point_id)
);

create index audit_photos_submission_idx on public.audit_photos (submission_id);

alter table public.audit_photos enable row level security;

create policy "audit photos read via submission" on public.audit_photos
  for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = audit_photos.submission_id
      and ((select public.is_staff_plus())
           or s.kitchen_id = (select public.current_kitchen()))
  ));

create policy "audit photos insert own submission" on public.audit_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.submissions s
    where s.id = audit_photos.submission_id
      and s.submitted_by = (select auth.uid())
  ));
