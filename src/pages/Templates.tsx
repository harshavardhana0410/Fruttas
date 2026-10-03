import { useEffect, useState } from 'react'
import { CaretRight, DotsSixVertical, Plus, Trash, ArrowLeft } from '@phosphor-icons/react'
import {
  getAuditTemplate,
  saveTemplate,
} from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { pad2 } from '../lib/format'
import type { InspectionPoint } from '../lib/types'
import { PageTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Feedback'
import { cx } from '../lib/cx'

type View = 'index' | 'audit'

export default function Templates() {
  const [view, setView] = useState<View>('index')

  if (view === 'audit') return <AuditTemplate onBack={() => setView('index')} />

  return (
    <>
      <PageTitle sub="Change what the checklists ask without waiting on a developer.">
        Templates
      </PageTitle>

      <div className="grid gap-3 lg:grid-cols-2">
        <TemplateCard
          title="Kitchen Audit"
          detail="16 inspection points across 6 sections"
          onOpen={() => setView('audit')}
          index={0}
        />
      </div>
    </>
  )
}

function TemplateCard({
  title,
  detail,
  onOpen,
  index,
}: {
  title: string
  detail: string
  onOpen: () => void
  index: number
}) {
  return (
    <button
      onClick={onOpen}
      style={{ '--i': index } as React.CSSProperties}
      className="animate-enter flex items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-6 text-left transition-shadow duration-200 hover:shadow-lift"
    >
      <div>
        <p className="text-[17px] font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] text-ink-soft">{detail}</p>
      </div>
      <CaretRight size={16} className="shrink-0 text-ink-mute" />
    </button>
  )
}

function BackLink({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      onClick={onBack}
      className="-ml-1 mb-2 flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink"
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  )
}

function UnsavedBar({
  count,
  onDiscard,
  onSave,
  busy,
}: {
  count: number
  onDiscard: () => void
  onSave: () => void
  busy: boolean
}) {
  if (count === 0) return null
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface lg:pl-60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 lg:px-8">
        <span className="font-mono tabular text-[12px] text-ink-soft">
          {count} unsaved {count === 1 ? 'change' : 'changes'}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={busy}>
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={busy}>
            {busy ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Audit template editor ---------------- */

function AuditTemplate({ onBack }: { onBack: () => void }) {
  const { data, reload } = useAsync(() => getAuditTemplate(), [])
  const [points, setPoints] = useState<InspectionPoint[] | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setPoints(data)
  }, [data])

  if (!points || !data) {
    return (
      <>
        <BackLink onBack={onBack} label="Templates" />
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </>
    )
  }

  const changes = countChanges(data, points)
  // Keyed by the first point's id, never by the name. A name key changes on
  // every keystroke, so React discarded the heading input mid-typing and
  // focus was lost after each letter.
  const sections = points.reduce<{ name: string; key: string }[]>((acc, p) => {
    if (!acc.some((s) => s.name === p.section)) acc.push({ name: p.section, key: p.id })
    return acc
  }, [])

  function move(from: number, to: number) {
    if (to < 0 || to >= points!.length) return
    const copy = [...points!]
    const [item] = copy.splice(from, 1)
    // Adopt the section of wherever it landed.
    const neighbour = copy[Math.min(to, copy.length - 1)]
    copy.splice(to, 0, { ...item, section: neighbour?.section ?? item.section })
    setPoints(copy.map((p, i) => ({ ...p, serial: i + 1 })))
  }

  function patch(id: string, next: Partial<InspectionPoint>) {
    setPoints(points!.map((p) => (p.id === id ? { ...p, ...next } : p)))
  }

  function addPoint(section: string) {
    const at = points!.map((p) => p.section).lastIndexOf(section) + 1
    const copy = [...points!]
    copy.splice(at, 0, {
      id: `p-new-${Date.now()}`,
      serial: 0,
      section,
      text: '',
      critical: false,
      requirePhotoOnFail: false,
    })
    setPoints(copy.map((p, i) => ({ ...p, serial: i + 1 })))
  }

  function renameSection(from: string, to: string) {
    setPoints(points!.map((p) => (p.section === from ? { ...p, section: to } : p)))
  }

  async function save() {
    setBusy(true)
    await saveTemplate(points!)
    setBusy(false)
    reload()
  }

  return (
    <>
      <BackLink onBack={onBack} label="Templates" />
      <PageTitle sub="Drag the handle to reorder, or focus it and use the arrow keys.">
        Kitchen Audit
      </PageTitle>

      <div className={cx(changes > 0 && 'pb-20')}>
        {sections.map(({ name, key }) => (
          <section key={key} className="mb-6">
            <input
              value={name}
              aria-label={`Section name: ${name}`}
              onChange={(e) => renameSection(name, e.target.value)}
              className="label-section w-full rounded-control border border-transparent bg-transparent py-2 outline-none transition-colors hover:border-hairline hover:bg-sunken focus-visible:border-hairline focus-visible:bg-sunken"
            />

            <div className="border-t border-hairline">
              {points
                .map((p, i) => ({ p, i }))
                .filter(({ p }) => p.section === name)
                .map(({ p, i }) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragging(i)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragging !== null && dragging !== i) {
                        move(dragging, i)
                        setDragging(i)
                      }
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cx(
                      'flex items-start gap-2 border-b border-hairline py-2.5',
                      dragging === i && 'opacity-50',
                    )}
                  >
                    <button
                      aria-label={`Reorder point ${p.serial}. Use arrow keys to move.`}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          move(i, i - 1)
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          move(i, i + 1)
                        }
                      }}
                      className="mt-1.5 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center text-ink-mute hover:text-ink active:cursor-grabbing"
                    >
                      <DotsSixVertical size={15} />
                    </button>

                    <span className="mt-2 w-6 shrink-0 font-mono tabular text-[12px] text-ink-soft">
                      {pad2(p.serial)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <textarea
                        value={p.text}
                        rows={1}
                        placeholder="Describe what must be checked"
                        aria-label={`Inspection text for point ${p.serial}`}
                        onChange={(e) => patch(p.id, { text: e.target.value })}
                        onInput={(e) => {
                          const el = e.currentTarget
                          el.style.height = 'auto'
                          el.style.height = `${el.scrollHeight}px`
                        }}
                        className="w-full resize-none rounded-control border border-transparent bg-transparent px-2 py-1.5 text-[14px] leading-[1.5] outline-none transition-colors hover:border-hairline hover:bg-sunken focus-visible:border-hairline focus-visible:bg-sunken"
                      />

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-2">
                        <Toggle
                          checked={p.critical}
                          onChange={(v) => patch(p.id, { critical: v })}
                          label="Critical"
                        />
                        <Toggle
                          checked={p.requirePhotoOnFail}
                          onChange={(v) => patch(p.id, { requirePhotoOnFail: v })}
                          label="Photo required on No"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setPoints(
                          points
                            .filter((x) => x.id !== p.id)
                            .map((x, idx) => ({ ...x, serial: idx + 1 })),
                        )
                      }
                      aria-label={`Delete point ${p.serial}`}
                      className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-mute transition-colors hover:bg-sunken hover:text-fail-fg"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                ))}
            </div>

            <Button variant="ghost" size="sm" className="mt-2" onClick={() => addPoint(name)}>
              <Plus size={14} />
              Add inspection point
            </Button>
          </section>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const name = `New section ${sections.length + 1}`
            setPoints([
              ...points,
              {
                id: `p-new-${Date.now()}`,
                serial: points.length + 1,
                section: name,
                text: '',
                critical: false,
                requirePhotoOnFail: false,
              },
            ])
          }}
        >
          <Plus size={14} />
          Add section
        </Button>
      </div>

      <UnsavedBar
        count={changes}
        busy={busy}
        onDiscard={() => setPoints(data)}
        onSave={save}
      />
    </>
  )
}

function countChanges(before: InspectionPoint[], after: InspectionPoint[]): number {
  let n = Math.abs(before.length - after.length)
  for (const p of after) {
    const was = before.find((b) => b.id === p.id)
    if (!was) continue
    if (
      was.text !== p.text ||
      was.section !== p.section ||
      was.serial !== p.serial ||
      was.critical !== p.critical ||
      was.requirePhotoOnFail !== p.requirePhotoOnFail
    ) {
      n++
    }
  }
  return n
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 cursor-pointer accent-[#111111]"
      />
      {label}
    </label>
  )
}

/* ---------------- Item preset editor ---------------- */
