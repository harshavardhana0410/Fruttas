-- ============================================================================
-- AUTH BOOTSTRAP
--
-- Every auth user gets exactly one profile, created by a trigger so a user
-- can never exist without one.
--
-- The role assigned here is ALWAYS 'staff', with one exception: the very
-- first account created on an empty database becomes the admin. That solves
-- the bootstrap problem (nothing can grant admin until an admin exists)
-- without ever reading a role out of user-supplied metadata.
--
-- raw_user_meta_data is editable by the user it belongs to. It is never
-- consulted for the role. Promotions happen only through an admin acting via
-- the Edge Function, which uses the service_role key from a trusted context.
-- ============================================================================

create sequence if not exists public.staff_id_seq start with 1;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_is_first boolean;
  v_name     text;
begin
  -- Lock so two simultaneous first sign-ups cannot both become admin.
  -- Literal key rather than hashtext(), which is an undocumented internal.
  perform pg_advisory_xact_lock(918273645);

  select not exists (select 1 from public.profiles) into v_is_first;

  -- Display name only. Carries no authority.
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, name, staff_id, role, kitchen_id, active)
  values (
    new.id,
    v_name,
    'FK-' || lpad(nextval('public.staff_id_seq')::text, 4, '0'),
    case when v_is_first then 'admin'::public.user_role
         else 'staff'::public.user_role end,
    null,
    true
  );

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- ON DEACTIVATION
--
-- Setting active = false immediately closes every RLS path, because
-- current_app_role() and current_kitchen() both filter on `active` and start
-- returning null. That is the real protection and it takes effect at once.
--
-- Ending the session itself is handled by the create-team-member Edge
-- Function, which calls auth.admin.signOut() through the service_role key.
-- There is deliberately no trigger here reaching into auth.refresh_tokens:
-- that is undocumented internal schema, it would duplicate what the Edge
-- Function already does properly, and it would break the day Supabase
-- changes the table.
-- ----------------------------------------------------------------------------
