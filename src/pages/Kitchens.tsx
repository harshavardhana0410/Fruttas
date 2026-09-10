import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Storefront } from '@phosphor-icons/react'
import { addKitchen, getDashboardMetrics, getKitchens, getRecords } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { isoDate, pct } from '../lib/format'
import { PageTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Sheet } from '../components/ui/Sheet'
import { EmptyState, Skeleton } from '../components/ui/Feedback'

export default function Kitchens() {
  const user = useUser()
  const isAdmin = user.role === 'admin'

  const [open, setOpen] = useState(false)
  const { data: kitchens, loading, reload } = useAsync(() => getKitchens(), [])
  const { data: metrics } = useAsync(() => getDashboardMetrics(), [kitchens?.length])
  const { data: todayRows } = useAsync(() => getRecords({ from: isoDate(), limit: 100 }), [])

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageTitle sub="Compliance is the seven-day average across submitted audits.">
          Kitchens
        </PageTitle>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            Add kitchen
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
      ) : !kitchens?.length ? (
        <div className="rounded-card border border-dashed border-hairline">
          <EmptyState
            icon={<Storefront size={24} />}
            title="No kitchens added yet"
            body="Add a kitchen to start collecting daily checklists from it."
            action={isAdmin ? { label: 'Add kitchen', onClick: () => setOpen(true) } : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {kitchens.map((kitchen, i) => {
            const compliance =
              metrics?.byKitchen.find((b) => b.kitchen.id === kitchen.id)?.compliance ?? 0
            const today = todayRows?.filter((r) => r.kitchenId === kitchen.id) ?? []
            const issues = today.reduce((t, r) => t + r.issues, 0)

            return (
              <Link
                key={kitchen.id}
                to={`/kitchens/${kitchen.id}`}
                style={{ '--i': i } as React.CSSProperties}
                className="animate-enter rounded-card border border-hairline bg-surface p-6 transition-shadow duration-200 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-medium">{kitchen.name}</p>
                    <p className="mt-0.5 font-mono tabular text-[12px] text-ink-soft">
                      {kitchen.clientId}
                    </p>
                  </div>
                  {today.length > 0 ? (
                    <Badge tone="pass">Reported today</Badge>
                  ) : (
                    <Badge tone="warn">Not yet today</Badge>
                  )}
                </div>

                <p className="mt-2 truncate text-[13px] text-ink-soft">{kitchen.location}</p>

                <dl className="mt-4 flex gap-6 border-t border-hairline pt-3">
                  <div>
                    <dt className="label-section">Compliance</dt>
                    <dd className="mt-0.5 font-mono tabular text-[15px]">{pct(compliance)}</dd>
                  </div>
                  <div>
                    <dt className="label-section">Open issues</dt>
                    <dd className="mt-0.5 font-mono tabular text-[15px]">{issues}</dd>
                  </div>
                  <div>
                    <dt className="label-section">Today</dt>
                    <dd className="mt-0.5 font-mono tabular text-[15px]">
                      {today.length} of 2
                    </dd>
                  </div>
                </dl>
              </Link>
            )
          })}
        </div>
      )}

      <AddKitchenSheet open={open} onClose={() => setOpen(false)} onSaved={reload} />
    </>
  )
}

function AddKitchenSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim() || !clientId.trim()) return
    setBusy(true)
    await addKitchen({ name: name.trim(), clientId: clientId.trim(), location: location.trim() })
    setBusy(false)
    setName('')
    setClientId('')
    setLocation('')
    onSaved()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add kitchen"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={busy || !name || !clientId}>
            {busy ? 'Saving' : 'Add kitchen'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Kitchen name">
          {(id) => (
            <Input
              id={id}
              value={name}
              placeholder="Frutta Jayanagar"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Client ID">
          {(id) => (
            <Input
              id={id}
              mono
              value={clientId}
              placeholder="FRT-1005"
              onChange={(e) => setClientId(e.target.value)}
            />
          )}
        </Field>
        <Field label="Location">
          {(id) => (
            <Input
              id={id}
              value={location}
              placeholder="4th Block, Bengaluru"
              onChange={(e) => setLocation(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Sheet>
  )
}
