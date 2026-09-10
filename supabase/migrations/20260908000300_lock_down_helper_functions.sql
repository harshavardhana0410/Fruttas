-- ============================================================================
-- Closes every anon-facing finding from the Supabase security advisor.
-- ============================================================================

-- A trigger function. Nothing should ever reach it over REST.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- These only answer questions about the caller's own account, but an
-- anonymous visitor has no business reaching them. Every RLS policy that
-- uses them is `to authenticated`, so anon never evaluates one.
revoke all on function public.current_app_role()  from public, anon;
revoke all on function public.current_kitchen()   from public, anon;
revoke all on function public.is_admin()          from public, anon;
revoke all on function public.is_staff_plus()     from public, anon;
revoke all on function public.kitchen_today(uuid) from public, anon;

-- EXECUTE stays with authenticated on purpose. RLS policy expressions are
-- evaluated with the querying role's privileges, so revoking it here would
-- make every policy fail with "permission denied" rather than make anything
-- safer. The advisor still flags these; that is the accepted, deliberate
-- residue.
grant execute on function public.current_app_role()  to authenticated;
grant execute on function public.current_kitchen()   to authenticated;
grant execute on function public.is_admin()          to authenticated;
grant execute on function public.is_staff_plus()     to authenticated;
grant execute on function public.kitchen_today(uuid) to authenticated;
