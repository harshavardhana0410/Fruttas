import { useState } from 'react'
import { PencilSimple, Prohibit, ArrowCounterClockwise } from '@phosphor-icons/react'
import { getKitchens, getTeam, upsertUser } from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { useIsDesktop } from '../lib/useMediaQuery'
import { stamp } from '../lib/format'
import type { Role, User } from '../lib/types'
import { PageTitle } from '../components/ui/Card'
import { RoleBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { Sheet } from '../components/ui/Sheet'
import { SkeletonRows } from '../components/ui/Feedback'
import { cx } from '../lib/cx'

const ROLE_OPTIONS = [
  { value: 'staff' as Role, label: 'Staff' },
  { value: 'manager' as Role, label: 'Manager' },
  { value: 'admin' as Role, label: 'Admin' },
  { value: 'chef' as Role, label: 'Chef' },
]

export default function Team() {
  const desktop = useIsDesktop()
  const { data: team, loading, reload } = useAsync(() => getTeam(), [])
  const { data: kitchens } = useAsync(() => getKitchens(), [])

  const [editing, setEditing] = useState<User | 'new' | null>(null)

  const kitchenName = (id: string) => kitchens?.find((k) => k.id === id)?.name ?? '—'

  async function toggleActive(user: User) {
    await upsertUser({ ...user, active: !user.active })
    reload()
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageTitle sub="People who can submit or review checklists.">Team</PageTitle>
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
          Add member
        </Button>
      </div>

      {loading || !team ? (
        <SkeletonRows count={6} />
      ) : desktop ? (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-sunken">
              {['Name', 'Staff ID', 'Role', 'Assigned kitchen', 'Last active', ''].map((h) => (
                <th key={h} scope="col" className="label-section px-3 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id} className="group border-b border-hairline">
                <td className={cx('px-3 py-3 text-[14px]', !u.active && 'text-ink-mute')}>
                  {u.name}
                  {!u.active && <span className="ml-2 text-[12px]">(deactivated)</span>}
                </td>
                <td className="px-3 py-3 font-mono tabular text-[13px] text-ink-soft">{u.staffId}</td>
                <td className="px-3 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-3 py-3 text-[13px] text-ink-soft">{kitchenName(u.kitchenId)}</td>
                <td className="px-3 py-3 font-mono tabular text-[13px] text-ink-soft">
                  {stamp(u.lastActive)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <RowAction label={`Edit ${u.name}`} onClick={() => setEditing(u)}>
                      <PencilSimple size={15} />
                    </RowAction>
                    <RowAction
                      label={`${u.active ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                      onClick={() => toggleActive(u)}
                    >
                      {u.active ? <Prohibit size={15} /> : <ArrowCounterClockwise size={15} />}
                    </RowAction>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col gap-3">
          {team.map((u) => (
            <div key={u.id} className="rounded-card border border-hairline bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cx('truncate text-[15px] font-medium', !u.active && 'text-ink-mute')}>
                    {u.name}
                  </p>
                  <p className="font-mono tabular text-[12px] text-ink-soft">{u.staffId}</p>
                </div>
                <RoleBadge role={u.role} />
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-hairline pt-3 text-[13px]">
                <div className="flex gap-2">
                  <dt className="text-ink-soft">Kitchen</dt>
                  <dd>{kitchenName(u.kitchenId)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-soft">Last active</dt>
                  <dd className="font-mono tabular">{stamp(u.lastActive)}</dd>
                </div>
              </dl>

              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                  {u.active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MemberSheet
        target={editing}
        kitchens={kitchens ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
      />
    </>
  )
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
    >
      {children}
    </button>
  )
}

function MemberSheet({
  target,
  kitchens,
  onClose,
  onSaved,
}: {
  target: User | 'new' | null
  kitchens: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const editing = target && target !== 'new' ? target : null
  const [busy, setBusy] = useState(false)

  const [error, setError] = useState('')

  // Remount the fields whenever the target changes.
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    staffId: '',
    role: 'staff' as Role,
    kitchenId: '',
  })
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const key = editing?.id ?? (target === 'new' ? 'new' : null)

  if (key && key !== loadedFor) {
    setLoadedFor(key)
    setError('')
    setForm(
      editing
        ? {
            name: editing.name,
            email: '',
            password: '',
            staffId: editing.staffId,
            role: editing.role,
            kitchenId: editing.kitchenId,
          }
        : { name: '', email: '', password: '', staffId: '', role: 'staff', kitchenId: kitchens[0]?.id ?? '' },
    )
  }

  async function save() {
    if (!form.name.trim()) return setError('Name is required.')
    if (!editing && !form.email.trim()) return setError('Email is required for a new account.')
    if (!editing && !form.password) return setError('Set a password so they can sign in.')
    if (form.password && form.password.length < 8) return setError('Password must be at least 8 characters.')

    setBusy(true)
    setError('')
    try {
      await upsertUser({
        id: editing?.id,
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        password: form.password || undefined,
        staffId: form.staffId.trim(),
        role: form.role,
        kitchenId: form.kitchenId,
        active: editing?.active ?? true,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this member.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={editing ? 'Edit member' : 'Add member'}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>
            {busy ? 'Saving' : editing ? 'Save changes' : 'Add member'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Full name">
          {(id) => (
            <Input
              id={id}
              value={form.name}
              placeholder="Lakshmi Krishnan"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
        </Field>

        {!editing && (
          <Field
            label="Email"
            hint="They sign in with this email."
          >
            {(id) => (
              <Input
                id={id}
                type="email"
                autoCapitalize="none"
                spellCheck={false}
                value={form.email}
                placeholder="name@frutta.com"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
          </Field>
        )}

        <Field
          label={editing ? 'New password' : 'Password'}
          hint={
            editing
              ? 'Leave blank to keep their current password.'
              : 'At least 8 characters. Give it to them; they sign in with their email and this password.'
          }
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>

        <Field label="Staff ID" hint={editing ? undefined : 'Leave blank to assign one automatically.'}>
          {(id) => (
            <Input
              id={id}
              mono
              value={form.staffId}
              placeholder="FK-0002"
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-soft">Role</span>
          <Segmented
            label="Role"
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={ROLE_OPTIONS}
          />
        </div>

        <Field label="Assigned kitchen">
          {(id) => (
            <select
              id={id}
              value={form.kitchenId}
              onChange={(e) => setForm({ ...form, kitchenId: e.target.value })}
              className="h-11 w-full cursor-pointer rounded-control border border-hairline bg-sunken px-3 text-[15px] outline-none"
            >
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        {error && <p className="text-[12px] text-fail-fg">{error}</p>}
      </div>
    </Sheet>
  )
}
