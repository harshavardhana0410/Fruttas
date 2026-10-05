import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuditTemplate, getKitchens, readDraft, saveDraft, clearDraft } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useTableStream } from '../lib/useRealtime'
import { isoDate, longDate, stamp } from '../lib/format'
import type { AuditAnswer, AuditPayload, InspectionPoint, SectionPhotos } from '../lib/types'
import { FormShell } from '../components/layout/FormShell'
import { InspectionRow } from '../components/forms/InspectionRow'
import { SectionPhoto } from '../components/forms/SectionPhoto'
import { Button } from '../components/ui/Button'
import { Notice, Skeleton } from '../components/ui/Feedback'
import { cx } from '../lib/cx'

function blank(points: InspectionPoint[]): AuditAnswer[] {
  return points.map((p) => ({ pointId: p.id, value: null, remarks: '' }))
}

const anchor = (section: string) => section.replace(/\s+/g, '-')

export default function AuditForm() {
  const user = useUser()
  const nav = useNavigate()
  const desktop = useIsDesktop()

  const { data: points } = useAsync(() => getAuditTemplate(), [])
  const { data: kitchens, reload: reloadKitchens } = useAsync(() => getKitchens(), [])
  useTableStream('kitchens', reloadKitchens)

  const [answers, setAnswers] = useState<AuditAnswer[] | null>(null)
  const [photos, setPhotos] = useState<SectionPhotos>({})
  const [showErrors, setShowErrors] = useState(false)
  const [step, setStep] = useState(0)
  const [recovered, setRecovered] = useState<string | null>(null)

  const kitchen = kitchens?.find((k) => k.id === user.kitchenId)

  // Restore an unfinished checklist, or start a clean one.
  useEffect(() => {
    if (!points || answers) return
    const draft = readDraft<AuditPayload>('audit')
    if (draft && draft.payload.answers.length === points.length) {
      setAnswers(draft.payload.answers)
      // Object URLs die with the page, so a recovered draft starts photoless.
      setRecovered(draft.savedAt)
    } else {
      setAnswers(blank(points))
    }
  }, [points, answers])

  const sections = useMemo(() => {
    if (!points) return []
    const map = new Map<string, InspectionPoint[]>()
    for (const p of points) {
      const list = map.get(p.section) ?? []
      list.push(p)
      map.set(p.section, list)
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }))
  }, [points])

  function save(nextAnswers: AuditAnswer[], nextPhotos: SectionPhotos) {
    saveDraft<AuditPayload>('audit', {
      kitchenId: user.kitchenId,
      clientId: kitchen?.clientId ?? '',
      date: isoDate(),
      answers: nextAnswers,
      sectionPhotos: nextPhotos,
    })
  }

  function update(next: AuditAnswer, index: number) {
    setAnswers((prev) => {
      if (!prev) return prev
      const copy = [...prev]
      copy[index] = next
      save(copy, photos)
      return copy
    })
  }

  function setPhoto(section: string, url: string | null) {
    setPhotos((prev) => {
      const next = { ...prev }
      if (prev[section]) URL.revokeObjectURL(prev[section])
      if (url) next[section] = url
      else delete next[section]
      if (answers) save(answers, next)
      return next
    })
  }

  if (!points || !answers) {
    return (
      <FormShell title="Kitchen Audit" wide actions={<span />}>
        <Skeleton className="h-24" />
        <div className="mt-6 flex flex-col gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-[52px]" />
            </div>
          ))}
        </div>
      </FormShell>
    )
  }

  const answered = answers.filter((a) => a.value !== null).length
  const indexOf = (id: string) => points.findIndex((p) => p.id === id)

  const sectionFailed = (name: string) =>
    sections
      .find((s) => s.name === name)!
      .items.some((p) => answers![indexOf(p.id)].value === 'no')

  /** The first thing standing between this checklist and the review screen. */
  function firstProblem(): { elId: string; section: string } | null {
    for (const p of points!) {
      const a = answers![indexOf(p.id)]
      if (a.value === null || (a.value === 'no' && a.remarks.trim() === ''))
        return { elId: `point-${p.id}`, section: p.section }
    }
    // A No anywhere under a heading has to be photographed once, at the heading.
    for (const s of sections) {
      if (sectionFailed(s.name) && !photos[s.name])
        return { elId: `section-photo-${anchor(s.name)}`, section: s.name }
    }
    return null
  }

  function review() {
    const bad = firstProblem()
    if (bad) {
      setShowErrors(true)
      // On mobile, move to the section holding the problem before scrolling.
      if (!desktop) {
        const s = sections.findIndex((sec) => sec.name === bad.section)
        if (s !== -1 && s !== step) setStep(s)
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(bad.elId)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const focusable = el?.querySelector<HTMLElement>('button[role="radio"]')
        ;(focusable ?? el)?.focus()
      })
      return
    }
    nav('/audit/review')
  }

  const visible = desktop ? sections : sections.slice(step, step + 1)

  return (
    <FormShell
      title="Kitchen Audit"
      wide
      progress={{ done: answered, total: points.length }}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearDraft('audit')
              nav('/')
            }}
          >
            Save draft
          </Button>

          {desktop || step === sections.length - 1 ? (
            <Button variant="primary" onClick={review}>
              Review
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      }
    >
      {recovered && (
        <div className="mb-6">
          <Notice
            tone="warn"
            title={`You have an unfinished checklist from ${stamp(recovered).split(', ')[1]}.`}
            action={
              <>
                <Button size="sm" variant="outline" onClick={() => setRecovered(null)}>
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearDraft('audit')
                    setAnswers(blank(points))
                    setRecovered(null)
                  }}
                >
                  Discard
                </Button>
              </>
            }
          />
        </div>
      )}

      {/* One line, not a three-row card: the questions are the point. */}
      <p className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-ink-soft">
        <span className="text-ink">{kitchen?.name ?? '—'}</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular">{kitchen?.clientId ?? '—'}</span>
        <span aria-hidden>·</span>
        <span>{longDate(isoDate())}</span>
      </p>

      <div className="lg:flex lg:gap-10">
        {desktop && (
          <nav className="sticky top-24 hidden h-fit w-48 shrink-0 lg:block" aria-label="Sections">
            <ul className="flex flex-col gap-0.5">
              {sections.map((s) => {
                const done = s.items.every((p) => answers[indexOf(p.id)].value !== null)
                return (
                  <li key={s.name}>
                    <a
                      href={`#section-${anchor(s.name)}`}
                      className="flex items-center justify-between gap-2 rounded-control px-2 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                    >
                      <span className="truncate">{s.name}</span>
                      <span
                        className={cx('h-1.5 w-1.5 shrink-0 rounded-full', done ? 'bg-pass-fg' : 'bg-hairline')}
                        aria-hidden
                      />
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}

        <div className="min-w-0 flex-1">
          {!desktop && (
            <p className="mb-4 font-mono tabular text-[12px] text-ink-soft">
              Section {step + 1} of {sections.length}
            </p>
          )}

          {visible.map((section) => (
            <section key={section.name} id={`section-${anchor(section.name)}`}>
              <h2 className="label-section sticky top-14 z-20 border-b border-hairline bg-canvas py-2.5">
                {section.name}
              </h2>

              <SectionPhoto
                section={section.name}
                url={photos[section.name]}
                required={sectionFailed(section.name)}
                invalid={showErrors && sectionFailed(section.name) && !photos[section.name]}
                onChange={(url) => setPhoto(section.name, url)}
              />
              {section.items.map((point) => {
                const i = indexOf(point.id)
                return (
                  <InspectionRow
                    key={point.id}
                    point={point}
                    answer={answers[i]}
                    showErrors={showErrors}
                    onChange={(next) => update(next, i)}
                  />
                )
              })}
            </section>
          ))}
        </div>
      </div>
    </FormShell>
  )
}
