export type Role = 'staff' | 'manager' | 'admin' | 'chef'

export type FormType = 'audit' | 'items'

export type YesNo = 'yes' | 'no'
export type Measuring = 'tare' | 'non-tare'

export type FormStatus = 'not-started' | 'in-progress' | 'submitted'

export interface User {
  id: string
  name: string
  staffId: string
  role: Role
  kitchenId: string
  lastActive: string
  active: boolean
}

export interface Kitchen {
  id: string
  name: string
  clientId: string
  location: string
}

export interface InspectionPoint {
  id: string
  serial: number
  section: string
  text: string
  critical: boolean
}

export interface AuditAnswer {
  pointId: string
  value: YesNo | null
  remarks: string
}

/**
 * One photo per main heading, keyed by the heading's name — evidence is of the
 * station, not of each question asked about it. Object URLs while the form is
 * open, signed storage URLs once the record is read back.
 */
export type SectionPhotos = Record<string, string>

/** One line on a kitchen's standing item list. Only its chef or an admin edits it. */
export interface KitchenItem {
  id: string
  name: string
  quantity: string
  unit: string
  measuring: Measuring
}

/** A staff member's Yes/No check of one kitchen item. */
export interface ItemEntry extends KitchenItem {
  value: YesNo | null
  remarks: string
}

export interface AuditPayload {
  kitchenId: string
  clientId: string
  date: string
  answers: AuditAnswer[]
  sectionPhotos: SectionPhotos
}

export interface ItemsPayload {
  kitchenId: string
  clientId: string
  date: string
  items: ItemEntry[]
}

interface SubmissionBase {
  id: string
  kitchenId: string
  clientId: string
  date: string
  submittedById: string
  submittedByName: string
  submittedAt: string
  issues: number
  compliance: number
}

export interface AuditSubmission extends SubmissionBase {
  type: 'audit'
  answers: AuditAnswer[]
  sectionPhotos: SectionPhotos
}

export interface ItemsSubmission extends SubmissionBase {
  type: 'items'
  items: ItemEntry[]
}

export type Submission = AuditSubmission | ItemsSubmission

export interface RecordFilters {
  kitchenId?: string
  type?: FormType | 'all'
  status?: 'clear' | 'issues' | 'all'
  from?: string
  to?: string
  query?: string
  limit?: number
}

export interface TodayStatus {
  date: string
  kitchen: Kitchen
  audit: { status: FormStatus; submissionId?: string }
  items: { status: FormStatus; submissionId?: string }
  recent: Submission[]
}

export interface DashboardMetrics {
  auditsToday: number
  auditsTodayDelta: number
  complianceRate: number
  complianceDelta: number
  openIssues: number
  openIssuesDelta: number
  kitchensReporting: number
  kitchensTotal: number
  byKitchen: { kitchen: Kitchen; compliance: number }[]
  topFailures: { point: InspectionPoint; count: number }[]
  recent: Submission[]
}

export interface KitchenDetail {
  kitchen: Kitchen
  compliance: number
  auditsThisMonth: number
  openIssues: number
  lastSubmission: string | null
  strip: { date: string; result: 'pass' | 'fail' | 'none' }[]
  submissions: Submission[]
  staff: User[]
}

export interface Draft<T> {
  payload: T
  savedAt: string
}
