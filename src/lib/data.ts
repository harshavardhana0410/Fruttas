import type {
  AuditPayload,
  DashboardMetrics,
  Draft,
  FormStatus,
  FormType,
  InspectionPoint,
  ItemsPayload,
  Kitchen,
  KitchenItem,
  KitchenDetail,
  Measuring,
  RecordFilters,
  Role,
  Submission,
  TodayStatus,
  User,
} from './types'
import { isoDate } from './format'
import { supabase } from './supabase'

/* ============================================================
   DATA LAYER

   Every component reads through this file and nothing else.
   The database is snake_case, the frontend types are camelCase;
   all of that mapping lives here so no component has to know.
   ============================================================ */

/** One-time cleanup of the pre-Supabase mock database. */
try {
  localStorage.removeItem('frutta.db.v1')
} catch {
  /* storage unavailable — nothing to clean */
}

const DRAFT_KEY = (t: FormType) => `frutta.draft.${t}.v1`

/** Supabase errors carry the useful text on `message`. Surface it as-is. */
function fail(context: string, error: { message: string } | null): never {
  throw new Error(error?.message ?? `${context} failed`)
}

/* ---------------------------------------------------------------
   ROW MAPPERS
   --------------------------------------------------------------- */

interface KitchenRow {
  id: string
  name: string
  client_id: string
  location: string
}

const toKitchen = (r: KitchenRow): Kitchen => ({
  id: r.id,
  name: r.name,
  clientId: r.client_id,
  location: r.location,
})

interface ProfileRow {
  id: string
  name: string
  staff_id: string
  role: Role
  kitchen_id: string | null
  last_active: string
  active: boolean
}

const toUser = (r: ProfileRow): User => ({
  id: r.id,
  name: r.name,
  staffId: r.staff_id,
  role: r.role,
  kitchenId: r.kitchen_id ?? '',
  lastActive: r.last_active,
  active: r.active,
})

interface PointRow {
  id: string
  serial: number
  section: string
  text: string
  critical: boolean
}

const toPoint = (r: PointRow): InspectionPoint => ({
  id: r.id,
  serial: r.serial,
  section: r.section,
  text: r.text,
  critical: r.critical,
})

interface SubmissionRow {
  id: string
  type: FormType
  kitchen_id: string
  client_id: string
  form_date: string
  submitted_by: string
  submitted_by_name: string
  submitted_at: string
  issues: number
  compliance: number
  kitchen?: { client_id: string } | null
  submitter?: { name: string } | null
  audit_answers?: {
    point_id: string | null
    point_serial: number
    point_text: string
    value: 'yes' | 'no'
    remarks: string
  }[]
  section_photos?: { section: string; storage_path: string }[]
  submission_items?: {
    id: string
    serial: number
    item_id: string | null
    name: string
    quantity: string | number
    unit: string
    measuring: Measuring
    result: 'yes' | 'no'
    remarks: string
  }[]
}

/**
 * List endpoints return submissions without children — the row components
 * never read them, and hydrating 16 answers per row would be wasteful.
 * Only getRecordById returns a fully populated submission.
 */
function toSubmission(r: SubmissionRow): Submission {
  const base = {
    id: r.id,
    kitchenId: r.kitchen_id,
    clientId: r.kitchen?.client_id ?? r.client_id,
    date: r.form_date,
    submittedById: r.submitted_by,
    submittedByName: r.submitter?.name ?? r.submitted_by_name,
    submittedAt: r.submitted_at,
    issues: r.issues,
    compliance: r.compliance,
  }

  if (r.type === 'audit') {
    return {
      ...base,
      type: 'audit',
      answers: (r.audit_answers ?? [])
        .sort((a, b) => a.point_serial - b.point_serial)
        .map((a) => ({
          pointId: a.point_id ?? `archived-${a.point_serial}`,
          value: a.value,
          remarks: a.remarks,
        })),
      sectionPhotos: Object.fromEntries(
        (r.section_photos ?? []).map((p) => [p.section, p.storage_path]),
      ),
    }
  }

  return {
    ...base,
    type: 'items',
    items: (r.submission_items ?? [])
      .sort((a, b) => a.serial - b.serial)
      .map((i) => ({
        id: i.item_id ?? i.id,
        name: i.name,
        quantity: String(i.quantity),
        unit: i.unit,
        measuring: i.measuring,
        value: i.result,
        remarks: i.remarks,
      })),
  }
}

// kitchen/submitter are embedded from the live tables so lists show the
// current client ID and name. The copies stored on the submission are the
// fallback when the viewer may not see that profile.
const SUBMISSION_COLUMNS =
  'id, type, kitchen_id, client_id, form_date, submitted_by, submitted_by_name, submitted_at, issues, compliance, ' +
  'kitchen:kitchens(client_id), submitter:profiles(name)'

/* ---------------------------------------------------------------
   SESSION
   --------------------------------------------------------------- */

export interface Session {
  userId: string
  role: Role
}

/**
 * Synchronous read of the cached session, for the initial render only.
 * Authoritative identity always comes from loadProfile().
 */
export function getSession(): Session | null {
  try {
    const raw = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!raw) return null
    const parsed = JSON.parse(localStorage.getItem(raw) ?? 'null')
    const id = parsed?.user?.id
    return id ? { userId: id, role: 'staff' } : null
  } catch {
    return null
  }
}

/** The signed-in user's profile, or null if there is no live session. */
export async function loadProfile(): Promise<User | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, staff_id, role, kitchen_id, last_active, active')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (error) fail('Loading your profile', error)
  if (!data) return null

  const user = toUser(data as ProfileRow)
  if (!user.active) {
    await supabase.auth.signOut()
    throw new Error('This account is deactivated. Contact your kitchen manager.')
  }
  return user
}

/**
 * The `role` argument is ignored on purpose.
 *
 * The sign-in screen used to let a user pick their own role, which was a mock
 * affordance. Role now comes from the profiles row and nowhere else — a user
 * who can choose to be an admin is not access control. The parameter stays
 * only so SignIn.tsx does not need editing.
 */
export async function signIn(email: string, password: string, _role: Role): Promise<User> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) fail('Sign in', error)

  const user = await loadProfile()
  if (!user) throw new Error('Signed in, but no profile exists for this account.')

  await supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', user.id)
  return user
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/* ---------------------------------------------------------------
   READS
   --------------------------------------------------------------- */

export async function getAuditTemplate(): Promise<InspectionPoint[]> {
  const { data, error } = await supabase
    .from('inspection_points')
    .select('id, serial, section, text, critical')
    .eq('archived', false)
    .order('serial')

  if (error) fail('Loading the checklist', error)
  return (data as PointRow[]).map(toPoint)
}

export async function getKitchenItems(kitchenId: string): Promise<KitchenItem[]> {
  if (!kitchenId) return []
  const { data, error } = await supabase
    .from('kitchen_items')
    .select('id, name, quantity, unit, measuring')
    .eq('kitchen_id', kitchenId)
    .order('sort_order')
    .order('created_at')

  if (error) fail('Loading the item list', error)
  return (data as (Omit<KitchenItem, 'quantity'> & { quantity: number | string })[]).map((r) => ({
    ...r,
    quantity: String(r.quantity),
  }))
}

/** True once today's item check is filed. The database then refuses list edits. */
export async function isItemListLocked(kitchenId: string): Promise<boolean> {
  if (!kitchenId) return false
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('kitchen_id', kitchenId)
    .eq('type', 'items')
    .eq('form_date', isoDate())

  if (error) fail("Checking today's item check", error)
  return (count ?? 0) > 0
}

export async function getKitchens(): Promise<Kitchen[]> {
  const { data, error } = await supabase
    .from('kitchens')
    .select('id, name, client_id, location')
    .order('name')

  if (error) fail('Loading kitchens', error)
  return (data as KitchenRow[]).map(toKitchen)
}

export async function getKitchenById(id: string): Promise<KitchenDetail | null> {
  const { data, error } = await supabase.rpc('kitchen_detail', { p_kitchen_id: id })
  if (error) fail('Loading the kitchen', error)
  return (data as KitchenDetail | null) ?? null
}

export async function getTeam(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, staff_id, role, kitchen_id, last_active, active')
    .order('name')

  if (error) fail('Loading the team', error)
  return (data as ProfileRow[]).map(toUser)
}

export async function getTodayStatus(kitchenId: string): Promise<TodayStatus> {
  const today = isoDate()

  // An unassigned account has an empty kitchen id. Sending it on would come
  // back as a raw 'invalid input syntax for type uuid' error.
  if (!kitchenId) {
    throw new Error('No kitchen is assigned to this account. Ask an admin to assign one.')
  }

  const [kitchenRes, todayRes, recentRes] = await Promise.all([
    supabase.from('kitchens').select('id, name, client_id, location').eq('id', kitchenId).maybeSingle(),
    supabase.from('submissions').select(SUBMISSION_COLUMNS).eq('kitchen_id', kitchenId).eq('form_date', today),
    supabase
      .from('submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('kitchen_id', kitchenId)
      .order('submitted_at', { ascending: false })
      .limit(3),
  ])

  if (kitchenRes.error) fail('Loading your kitchen', kitchenRes.error)
  if (todayRes.error) fail("Loading today's checklists", todayRes.error)
  if (recentRes.error) fail('Loading recent submissions', recentRes.error)

  if (!kitchenRes.data) {
    throw new Error('No kitchen is assigned to this account. Ask an admin to assign one.')
  }

  const todays = (todayRes.data as unknown as SubmissionRow[]) ?? []

  const state = (type: FormType): { status: FormStatus; submissionId?: string } => {
    const done = todays.find((s) => s.type === type)
    if (done) return { status: 'submitted', submissionId: done.id }
    return { status: readDraft(type) ? 'in-progress' : 'not-started' }
  }

  return {
    date: today,
    kitchen: toKitchen(kitchenRes.data as KitchenRow),
    audit: state('audit'),
    items: state('items'),
    recent: ((recentRes.data as unknown as SubmissionRow[]) ?? []).map(toSubmission),
  }
}

export async function getRecords(filters: RecordFilters = {}): Promise<Submission[]> {
  const { kitchenId, type = 'all', status = 'all', from, to, query, limit = 20 } = filters

  let q = supabase
    .from('submissions')
    .select(SUBMISSION_COLUMNS)
    .order('submitted_at', { ascending: false })
    .limit(limit)

  if (kitchenId) q = q.eq('kitchen_id', kitchenId)
  if (type !== 'all') q = q.eq('type', type)
  if (status === 'issues') q = q.gt('issues', 0)
  if (status === 'clear') q = q.eq('issues', 0)
  if (from) q = q.gte('form_date', from)
  if (to) q = q.lte('form_date', to)

  if (query) {
    // Kitchen name is not on this table, so search what is: the submitter
    // and the client ID. Kitchen is already filterable via the dropdown.
    const safe = query.replace(/[%,()]/g, ' ').trim()
    if (safe) q = q.or(`submitted_by_name.ilike.%${safe}%,client_id.ilike.%${safe}%`)
  }

  const { data, error } = await q
  if (error) fail('Loading records', error)
  return (data as unknown as SubmissionRow[]).map(toSubmission)
}

export async function getRecordById(id: string): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      `${SUBMISSION_COLUMNS},
       audit_answers ( point_id, point_serial, point_text, value, remarks ),
       section_photos ( section, storage_path ),
       submission_items ( id, serial, item_id, name, quantity, unit, measuring, result, remarks )`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) fail('Loading the record', error)
  if (!data) return null

  const submission = toSubmission(data as unknown as SubmissionRow)

  // Photos are private objects; the stored path is not directly loadable.
  if (submission.type === 'audit') {
    const sections = Object.keys(submission.sectionPhotos)
    const signed = await signPhotoUrls(sections.map((s) => submission.sectionPhotos[s]))
    submission.sectionPhotos = Object.fromEntries(
      sections.map((s, i) => [s, signed[i]]).filter(([, url]) => url),
    )
  }
  return submission
}

async function signPhotoUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return []
  const { data, error } = await supabase.storage
    .from('audit-photos')
    .createSignedUrls(paths, 60 * 10)
  if (error || !data) return []
  // Positional: the caller pairs each URL back up with its section.
  return data.map((d) => d.signedUrl ?? '')
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc('dashboard_metrics')
  if (error) fail('Loading the dashboard', error)
  return data as DashboardMetrics
}

/* ---------------------------------------------------------------
   DRAFTS

   Deliberately synchronous and device-local. Kitchens have unreliable
   Wi-Fi and a half-filled checklist must survive a refresh without a
   round trip. Do not move these to the server.
   --------------------------------------------------------------- */

export function readDraft<T>(type: FormType): Draft<T> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(type))
    return raw ? (JSON.parse(raw) as Draft<T>) : null
  } catch {
    return null
  }
}

export function saveDraft<T>(type: FormType, payload: T): void {
  try {
    localStorage.setItem(
      DRAFT_KEY(type),
      JSON.stringify({ payload, savedAt: new Date().toISOString() }),
    )
  } catch {
    /* quota or private mode — the form still works for this session */
  }
}

export function clearDraft(type: FormType): void {
  try {
    localStorage.removeItem(DRAFT_KEY(type))
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------
   WRITES

   The kitchen, date, submitter, issue count and compliance score are
   all decided by the database. Anything this client sends for those
   fields is ignored — a client that scores its own audit is not an audit.
   --------------------------------------------------------------- */

export async function submitAudit(payload: AuditPayload, _user: User): Promise<Submission> {
  const { data, error } = await supabase.rpc('submit_audit', {
    p_answers: payload.answers.map((a) => ({
      pointId: a.pointId,
      value: a.value,
      remarks: a.remarks,
    })),
  })
  if (error) fail('Submitting the audit', error)

  clearDraft('audit')
  const submission = toSubmission(data as unknown as SubmissionRow)
  await uploadAuditPhotos(submission.id, payload)
  return submission
}

/**
 * Photos upload after the audit is filed, so the rows can point at a real
 * submission. A photo that fails to upload must never lose the audit — the
 * record is the evidence that matters most.
 */
async function uploadAuditPhotos(submissionId: string, payload: AuditPayload): Promise<void> {
  const sections = Object.entries(payload.sectionPhotos)
  if (sections.length === 0) return

  try {
    for (const [section, objectUrl] of sections) {
      const blob = await fetch(objectUrl).then((r) => r.blob())
      const path = `${payload.kitchenId}/${submissionId}/${crypto.randomUUID()}.jpg`

      const { error } = await supabase.storage
        .from('audit-photos')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg' })

      if (!error) {
        await supabase.from('section_photos').insert({
          submission_id: submissionId,
          section,
          storage_path: path,
        })
      }
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    // Swallowed on purpose: the audit is already filed and is the record of
    // truth. A failed photo upload is a gap in evidence, not a lost audit.
  }
}

export async function submitItemList(payload: ItemsPayload, _user: User): Promise<Submission> {
  const { data, error } = await supabase.rpc('submit_item_list', {
    // Only the answers travel. The database fills in each item from the
    // chef's current list, so a stale or edited client copy cannot be filed.
    p_items: payload.items.map((i) => ({ itemId: i.id, value: i.value, remarks: i.remarks })),
  })
  if (error) fail('Submitting the item check list', error)

  clearDraft('items')
  return toSubmission(data as SubmissionRow)
}

export async function saveTemplate(points: InspectionPoint[]): Promise<InspectionPoint[]> {
  const existing = await getAuditTemplate()
  const keep = new Set(points.map((p) => p.id))

  // Archive rather than delete: filed audits soft-link to these rows.
  const removed = existing.filter((p) => !keep.has(p.id)).map((p) => p.id)
  if (removed.length > 0) {
    const { error } = await supabase
      .from('inspection_points')
      .update({ archived: true })
      .in('id', removed)
    if (error) fail('Archiving removed points', error)
  }

  const rows = points.map((p, i) => ({
    // Locally-created points carry a temporary id; let the database mint one.
    ...(p.id.startsWith('p-new-') ? {} : { id: p.id }),
    serial: i + 1,
    section: p.section,
    text: p.text,
    critical: p.critical,
    archived: false,
  }))

  const { error } = await supabase.from('inspection_points').upsert(rows)
  if (error) fail('Saving the checklist', error)

  return getAuditTemplate()
}

export async function saveKitchenItem(
  kitchenId: string,
  item: Omit<KitchenItem, 'id'> & { id?: string; sortOrder?: number },
): Promise<void> {
  const row = {
    name: item.name.trim(),
    quantity: Number(item.quantity),
    unit: item.unit,
    measuring: item.measuring,
  }
  const { error } = item.id
    ? await supabase.from('kitchen_items').update(row).eq('id', item.id)
    : await supabase
        .from('kitchen_items')
        .insert({ ...row, kitchen_id: kitchenId, sort_order: item.sortOrder ?? 0 })

  if (error) fail('Saving the item', error)
}

export async function deleteKitchenItem(id: string): Promise<void> {
  const { error } = await supabase.from('kitchen_items').delete().eq('id', id)
  if (error) fail('Removing the item', error)
}

export async function addKitchen(input: Omit<Kitchen, 'id'>): Promise<Kitchen> {
  const { data, error } = await supabase
    .from('kitchens')
    .insert({ name: input.name, client_id: input.clientId, location: input.location })
    .select('id, name, client_id, location')
    .single()

  if (error) fail('Adding the kitchen', error)
  return toKitchen(data as KitchenRow)
}

/**
 * The team Edge Function. Its errors carry the real reason in the response
 * body, so read that out instead of showing a generic "non-2xx" message.
 */
async function callTeamFunction<T>(body: Record<string, unknown>, context: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('create-team-member', { body })
  if (error) {
    const res = (error as { context?: Response }).context
    const detail = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null
    fail(context, { message: detail?.error ?? error.message })
  }
  return data as T
}

/**
 * Editing an existing member is a plain update. Creating one, and setting a
 * password, need the service_role key, so those go through the Edge Function.
 */
export async function upsertUser(
  input: Omit<User, 'id' | 'lastActive'> & { id?: string; email?: string; password?: string },
): Promise<User> {
  if (input.id) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: input.name,
        staff_id: input.staffId,
        role: input.role,
        kitchen_id: input.kitchenId || null,
        active: input.active,
      })
      .eq('id', input.id)
      .select('id, name, staff_id, role, kitchen_id, last_active, active')
      .single()

    if (error) fail('Saving the team member', error)

    if (input.password) {
      await callTeamFunction(
        { action: 'set-password', userId: input.id, password: input.password },
        'Setting the password',
      )
    }

    // Revoking access must also end the session, not just hide the row.
    if (!input.active) {
      await callTeamFunction({ action: 'deactivate', userId: input.id }, 'Deactivating the member')
    }
    return toUser(data as ProfileRow)
  }

  if (!input.email) throw new Error('An email address is required to create an account.')
  if (!input.password) throw new Error('A password is required to create an account.')

  const data = await callTeamFunction<{ profile: ProfileRow }>(
    {
      action: 'create',
      email: input.email,
      password: input.password,
      name: input.name,
      staffId: input.staffId,
      role: input.role,
      kitchenId: input.kitchenId || null,
    },
    'Creating the team member',
  )
  return toUser(data.profile)
}

/* ---------------------------------------------------------------
   EXPORT
   --------------------------------------------------------------- */

export function toCsv(rows: Submission[], kitchens: Kitchen[]): string {
  const head = [
    'Reference', 'Form', 'Kitchen', 'Client ID', 'Date',
    'Submitted by', 'Time', 'Issues', 'Compliance',
  ]
  const body = rows.map((s) => {
    const k = kitchens.find((x) => x.id === s.kitchenId)
    return [
      s.id,
      s.type === 'audit' ? 'Kitchen Audit' : 'Item Check List',
      k?.name ?? s.kitchenId,
      s.clientId,
      s.date,
      s.submittedByName,
      s.submittedAt.slice(11, 16),
      String(s.issues),
      `${s.compliance}%`,
    ]
  })
  return [head, ...body]
    .map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(','))
    .join('\n')
}
