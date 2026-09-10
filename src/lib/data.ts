import type {
  AuditPayload,
  DashboardMetrics,
  Draft,
  FormStatus,
  FormType,
  InspectionPoint,
  ItemPreset,
  ItemsPayload,
  Kitchen,
  KitchenDetail,
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
  require_photo_on_fail: boolean
}

const toPoint = (r: PointRow): InspectionPoint => ({
  id: r.id,
  serial: r.serial,
  section: r.section,
  text: r.text,
  critical: r.critical,
  requirePhotoOnFail: r.require_photo_on_fail,
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
  audit_answers?: {
    point_id: string | null
    point_serial: number
    point_text: string
    value: 'yes' | 'no'
    remarks: string
    answer_photos?: { storage_path: string }[]
  }[]
  submission_items?: {
    id: string
    serial: number
    name: string
    planned_qty: string | number
    actual_qty: string | number
    unit: string
    taste: 'ok' | 'notok'
    measuring: 'tare' | 'non-tare'
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
    clientId: r.client_id,
    date: r.form_date,
    submittedById: r.submitted_by,
    submittedByName: r.submitted_by_name,
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
          photos: (a.answer_photos ?? []).map((p) => p.storage_path),
        })),
    }
  }

  return {
    ...base,
    type: 'items',
    items: (r.submission_items ?? [])
      .sort((a, b) => a.serial - b.serial)
      .map((i) => ({
        id: i.id,
        name: i.name,
        plannedQty: String(i.planned_qty),
        actualQty: String(i.actual_qty),
        unit: i.unit,
        taste: i.taste,
        measuring: i.measuring,
      })),
  }
}

const SUBMISSION_COLUMNS =
  'id, type, kitchen_id, client_id, form_date, submitted_by, submitted_by_name, submitted_at, issues, compliance'

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
    .select('id, serial, section, text, critical, require_photo_on_fail')
    .eq('archived', false)
    .order('serial')

  if (error) fail('Loading the checklist', error)
  return (data as PointRow[]).map(toPoint)
}

export async function getItemPresets(): Promise<ItemPreset[]> {
  const { data, error } = await supabase
    .from('item_presets')
    .select('name, unit')
    .order('sort_order')

  if (error) fail('Loading item presets', error)
  return data as ItemPreset[]
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

  const todays = (todayRes.data as SubmissionRow[]) ?? []

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
    recent: ((recentRes.data as SubmissionRow[]) ?? []).map(toSubmission),
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
  return (data as SubmissionRow[]).map(toSubmission)
}

export async function getRecordById(id: string): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      `${SUBMISSION_COLUMNS},
       audit_answers ( point_id, point_serial, point_text, value, remarks,
                       answer_photos ( storage_path ) ),
       submission_items ( id, serial, name, planned_qty, actual_qty, unit, taste, measuring )`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) fail('Loading the record', error)
  if (!data) return null

  const submission = toSubmission(data as SubmissionRow)

  // Photos are private objects; the stored path is not directly loadable.
  if (submission.type === 'audit') {
    for (const answer of submission.answers) {
      answer.photos = await signPhotoUrls(answer.photos)
    }
  }
  return submission
}

async function signPhotoUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return []
  const { data, error } = await supabase.storage
    .from('audit-photos')
    .createSignedUrls(paths, 60 * 10)
  if (error || !data) return []
  // Signing is per-path: one missing object must not drop the rest.
  return data
    .map((d) => d.signedUrl)
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
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
  const submission = toSubmission(data as SubmissionRow)
  await uploadAuditPhotos(submission.id, payload)
  return submission
}

/**
 * Photos upload after the audit is filed, so they can be keyed to real
 * answer rows. A photo that fails to upload must never lose the audit —
 * the record is the evidence that matters most.
 */
async function uploadAuditPhotos(submissionId: string, payload: AuditPayload): Promise<void> {
  const withPhotos = payload.answers.filter((a) => a.photos.length > 0)
  if (withPhotos.length === 0) return

  try {
    const { data: answers } = await supabase
      .from('audit_answers')
      .select('id, point_id')
      .eq('submission_id', submissionId)

    const byPoint = new Map((answers ?? []).map((a) => [a.point_id as string, a.id as string]))

    for (const answer of withPhotos) {
      const answerId = byPoint.get(answer.pointId)
      if (!answerId) continue

      for (const objectUrl of answer.photos) {
        const blob = await fetch(objectUrl).then((r) => r.blob())
        const path = `${payload.kitchenId}/${submissionId}/${answerId}/${crypto.randomUUID()}.jpg`

        const { error } = await supabase.storage
          .from('audit-photos')
          .upload(path, blob, { contentType: blob.type || 'image/jpeg' })

        if (!error) {
          await supabase.from('answer_photos').insert({ answer_id: answerId, storage_path: path })
        }
        URL.revokeObjectURL(objectUrl)
      }
    }
  } catch {
    // Swallowed on purpose: the audit is already filed and is the record of
    // truth. A failed photo upload is a gap in evidence, not a lost audit.
  }
}

export async function submitItemList(payload: ItemsPayload, _user: User): Promise<Submission> {
  const { data, error } = await supabase.rpc('submit_item_list', {
    p_items: payload.items.map((i) => ({
      name: i.name,
      plannedQty: i.plannedQty,
      actualQty: i.actualQty,
      unit: i.unit,
      taste: i.taste,
      measuring: i.measuring,
    })),
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
    require_photo_on_fail: p.requirePhotoOnFail,
    archived: false,
  }))

  const { error } = await supabase.from('inspection_points').upsert(rows)
  if (error) fail('Saving the checklist', error)

  return getAuditTemplate()
}

export async function saveItemPresets(presets: ItemPreset[]): Promise<ItemPreset[]> {
  const { error: wipe } = await supabase
    .from('item_presets')
    .delete()
    .gte('sort_order', 0)
  if (wipe) fail('Updating item presets', wipe)

  if (presets.length > 0) {
    const { error } = await supabase
      .from('item_presets')
      .insert(presets.map((p, i) => ({ name: p.name, unit: p.unit, sort_order: i })))
    if (error) fail('Saving item presets', error)
  }
  return getItemPresets()
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
 * Editing an existing member is a plain update. CREATING one needs an
 * auth.users row, which requires the service_role key — so that path goes
 * through the create-team-member Edge Function instead.
 */
export async function upsertUser(
  input: Omit<User, 'id' | 'lastActive'> & { id?: string; email?: string },
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

    // Revoking access must also end the session, not just hide the row.
    if (!input.active) {
      await supabase.functions.invoke('create-team-member', {
        body: { action: 'deactivate', userId: input.id },
      })
    }
    return toUser(data as ProfileRow)
  }

  if (!input.email) {
    throw new Error('An email address is required to create an account.')
  }

  const { data, error } = await supabase.functions.invoke('create-team-member', {
    body: {
      action: 'create',
      email: input.email,
      name: input.name,
      staffId: input.staffId,
      role: input.role,
      kitchenId: input.kitchenId || null,
    },
  })
  if (error) fail('Creating the team member', error as { message: string })
  return toUser((data as { profile: ProfileRow }).profile)
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
