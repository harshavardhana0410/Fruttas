-- ============================================================================
-- EVIDENCE MOVES FROM THE POINT TO THE HEADING
--
-- A staff member photographs the station, not each of the twenty-five
-- questions asked about it. One photo per main heading, so an audit with six
-- headings carries at most six photos however many points sit under them.
--
-- The heading is stored as text, the same snapshot convention as
-- audit_answers.point_section: a filed record keeps the words it was filed
-- under. The unique key is what enforces "one photo per heading".
--
-- No update or delete policy, deliberately. Filed evidence is immutable.
-- ============================================================================

create table public.section_photos (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  section       text not null,
  storage_path  text not null,
  created_at    timestamptz not null default now(),
  constraint one_photo_per_section unique (submission_id, section)
);

create index section_photos_submission_idx on public.section_photos (submission_id);

alter table public.section_photos enable row level security;

create policy "section photos read via submission" on public.section_photos
  for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = section_photos.submission_id
      and ((select public.is_staff_plus())
           or s.kitchen_id = (select public.current_kitchen()))
  ));

create policy "section photos insert own submission" on public.section_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.submissions s
    where s.id = section_photos.submission_id
      and s.submitted_by = (select auth.uid())
  ));

-- Per-answer photos no longer exist anywhere in the product. The table is
-- empty (checked before writing this), so it goes rather than lingering as a
-- second, dead evidence path.
drop table if exists public.answer_photos;
