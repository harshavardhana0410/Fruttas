import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getKitchens, getRecords, toCsv } from '../lib/data'
import { useMotionPreference, useSession, useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { PageTitle, SectionLabel } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'

const THEME_KEY = 'frutta.theme.v1'

export default function Settings() {
  const user = useUser()
  const { signOut } = useSession()
  const nav = useNavigate()

  const [reduced, setReduced] = useMotionPreference()
  const [theme, setTheme] = useState<'light' | 'system'>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as 'light' | 'system') ?? 'system'
    } catch {
      return 'system'
    }
  })

  const { data: kitchens } = useAsync(() => getKitchens(), [])
  const kitchen = kitchens?.find((k) => k.id === user.kitchenId)

  async function exportMine() {
    const rows = await getRecords({ kitchenId: user.kitchenId, limit: 500 })
    const mine = rows.filter((r) => r.submittedById === user.id)
    const blob = new Blob([toCsv(mine.length ? mine : rows, kitchens ?? [])], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `frutta-${user.staffId}-submissions.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <PageTitle sub={user.role === 'staff' ? 'Your account' : 'Account and preferences'}>
        {user.role === 'staff' ? 'Profile' : 'Settings'}
      </PageTitle>

      <Section title="Account">
        <Row label="Name" description="Shown on every checklist you submit.">
          <span className="text-[14px]">{user.name}</span>
        </Row>
        <Row label="Staff ID" description="Issued by your kitchen manager.">
          <span className="font-mono tabular text-[14px] text-ink-soft">{user.staffId}</span>
        </Row>
        <Row label="Role" description="Determines what you can see and change.">
          <Badge tone={user.role === 'admin' ? 'fail' : user.role === 'manager' ? 'warn' : 'info'}>
            {user.role}
          </Badge>
        </Row>
        <Row label="Assigned kitchen" description="Checklists are filed against this kitchen.">
          <span className="text-[14px]">{kitchen?.name ?? '—'}</span>
        </Row>
      </Section>

      <Section title="Preferences">
        <Row label="Theme" description="Dark mode arrives in a later phase.">
          <Segmented
            size="sm"
            className="w-[180px]"
            label="Theme"
            value={theme}
            onChange={(v) => {
              setTheme(v)
              try {
                localStorage.setItem(THEME_KEY, v)
              } catch {
                /* ignore */
              }
            }}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Row>
        <Row
          label="Reduced motion"
          description="Turns off entry and stagger animation across the app."
        >
          <Segmented
            size="sm"
            className="w-[140px]"
            label="Reduced motion"
            value={reduced ? 'on' : 'off'}
            onChange={(v) => setReduced(v === 'on')}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Data">
        <Row label="Export submissions" description="Downloads a CSV of your filed checklists.">
          <Button variant="ghost" size="sm" onClick={exportMine}>
            Export my submissions
          </Button>
        </Row>
      </Section>

      <Section title="Session">
        <Row label="Sign out" description="You will need your Staff ID and PIN to return.">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              signOut()
              nav('/signin', { replace: true })
            }}
          >
            Sign out
          </Button>
        </Row>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <SectionLabel className="border-b border-hairline pb-2">{title}</SectionLabel>
      {children}
    </section>
  )
}

function Row({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-6 border-b border-hairline py-3">
      <div className="min-w-0">
        <p className="text-[14px]">{label}</p>
        <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
