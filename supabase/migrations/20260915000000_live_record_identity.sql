-- ============================================================================
-- LIVE RECORD IDENTITY
--
-- Record lists show the kitchen's CURRENT client ID and the submitter's
-- CURRENT name. The copies stored on submissions remain as a fallback for
-- people the viewer is not allowed to see. What was checked (answers, items)
-- stays exactly as filed.
-- ============================================================================

do $mig$
declare
  d text;
  before text;
begin
  d := pg_get_functiondef('public.dashboard_metrics()'::regprocedure);
  before := d;
  d := replace(d, $x$'clientId', s.client_id,$x$, $x$'clientId', coalesce(k.client_id, s.client_id),$x$);
  d := replace(d, $x$'submittedByName', s.submitted_by_name,$x$, $x$'submittedByName', coalesce(pr.name, s.submitted_by_name),$x$);
  d := replace(d, $x$from scoped s order by s.submitted_at desc limit 10$x$,
    $x$from scoped s
        left join public.kitchens k on k.id = s.kitchen_id
        left join public.profiles pr on pr.id = s.submitted_by
        order by s.submitted_at desc limit 10$x$);
  if d = before or position('coalesce(pr.name' in d) = 0 or position('left join public.profiles pr' in d) = 0 then
    raise exception 'dashboard_metrics did not match the expected definition';
  end if;
  execute d;

  d := pg_get_functiondef('public.kitchen_detail(uuid)'::regprocedure);
  before := d;
  d := replace(d, $x$'clientId', s.client_id,$x$, $x$'clientId', v_k.client_id,$x$);
  d := replace(d, $x$'submittedByName', s.submitted_by_name,$x$, $x$'submittedByName', coalesce(pr.name, s.submitted_by_name),$x$);
  d := replace(d, $x$from subs s order by s.submitted_at desc limit 20$x$,
    $x$from subs s
        left join public.profiles pr on pr.id = s.submitted_by
        order by s.submitted_at desc limit 20$x$);
  if d = before or position('v_k.client_id,' in d) = 0 or position('left join public.profiles pr' in d) = 0 then
    raise exception 'kitchen_detail did not match the expected definition';
  end if;
  execute d;
end
$mig$;

-- Renaming a kitchen, changing its client ID, or editing a member now
-- reaches every open screen. Realtime still applies RLS per viewer.
alter publication supabase_realtime add table public.kitchens;
alter publication supabase_realtime add table public.profiles;
