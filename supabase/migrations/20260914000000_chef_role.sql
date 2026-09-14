-- ============================================================================
-- CHEF ROLE
--
-- A chef owns their kitchen's item list and nothing else.
-- Kept in its own migration: Postgres cannot use a new enum value inside the
-- transaction that adds it, and the next migration's functions reference it.
-- ============================================================================

alter type public.user_role add value if not exists 'chef';
