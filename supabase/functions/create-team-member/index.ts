// ============================================================================
// create-team-member
//
// The one operation that cannot happen from the browser: creating an
// auth.users row needs the service_role key, which must never ship to a
// client. Also handles deactivation, because revoking access means ending
// the session, not just flipping a boolean.
//
// Every request is authorised twice:
//   1. the caller's JWT must be valid
//   2. their profiles row must say 'admin'
//
// The second check is the one that counts. A JWT proves who someone is; only
// the table proves what they are allowed to do, and it is current rather than
// as-of-last-token-refresh.
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Not signed in' }, 401)

  // Caller's identity, resolved with their own token — never the service key.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: auth } = await asCaller.auth.getUser()
  if (!auth?.user) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: caller } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (!caller?.active || caller.role !== 'admin') {
    return json({ error: 'Admins only' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Malformed request body' }, 400)
  }

  // --------------------------------------------------------------------
  // DEACTIVATE — end the session, do not merely hide the row.
  // --------------------------------------------------------------------
  if (body.action === 'deactivate') {
    const userId = String(body.userId ?? '')
    if (!userId) return json({ error: 'userId is required' }, 400)
    if (userId === auth.user.id) {
      return json({ error: 'You cannot deactivate your own account' }, 400)
    }

    await admin.from('profiles').update({ active: false }).eq('id', userId)
    // Revokes refresh tokens. The current access token lives until expiry,
    // which is why jwt_expiry is kept at 3600s.
    await admin.auth.admin.signOut(userId, 'global')
    return json({ ok: true })
  }

  // --------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------
  if (body.action !== 'create') return json({ error: 'Unknown action' }, 400)

  const email = String(body.email ?? '').trim()
  const name = String(body.name ?? '').trim()
  const role = String(body.role ?? 'staff')
  const staffId = String(body.staffId ?? '').trim()
  const kitchenId = body.kitchenId ? String(body.kitchenId) : null

  if (!email || !name) return json({ error: 'Email and name are required' }, 400)
  if (!['staff', 'manager', 'admin', 'chef'].includes(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  // A password nobody knows, including us. The member sets their own via the
  // recovery link below, so a credential is never transmitted or logged.
  const tempPassword = crypto.randomUUID() + crypto.randomUUID()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name },
  })

  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Could not create the account' }, 400)
  }

  // The on_auth_user_created trigger has already written a staff profile.
  // Role and kitchen are applied here, by an admin, through the service key —
  // never read from the new user's own metadata.
  const patch: Record<string, unknown> = { name, role, kitchen_id: kitchenId }
  if (staffId) patch.staff_id = staffId

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', created.user.id)
    .select('id, name, staff_id, role, kitchen_id, last_active, active')
    .single()

  if (profileError) {
    // Do not leave an auth user with no usable profile behind.
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: profileError.message }, 400)
  }

  await admin.auth.admin.generateLink({ type: 'recovery', email })

  return json({ profile })
})
