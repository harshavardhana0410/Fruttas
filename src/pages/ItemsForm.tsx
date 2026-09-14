import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardText } from '@phosphor-icons/react'
import { clearDraft, getKitchenItems, getKitchens, readDraft, saveDraft } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { useTableStream } from '../lib/useRealtime'
import { isoDate, longDate, stamp } from '../lib/format'
import type { ItemEntry, ItemsPayload, KitchenItem } from '../lib/types'
import { FormShell } from '../components/layout/FormShell'
import { ItemCheckRow } from '../components/forms/ItemFields'
import { Button } from '../components/ui/Button'
import { EmptyState, Notice, Skeleton } from '../components/ui/Feedback'

type Answers = Record<string, { value: ItemEntry['value']; remarks: string }>

export default function ItemsForm() {
  const user = useUser()
  const nav = useNavigate()

  const { data: list, reload } = useAsync(() => getKitchenItems(user.kitchenId), [user.kitchenId])
  const { data: kitchens, reload: reloadKitchens } = useAsync(() => getKitchens(), [])
  // The chef's edits reach this screen live. Answers are keyed by item, so
  // anything already checked survives a refresh of the list.
  useTableStream('kitchen_items', reload)
  useTableStream('kitchens', reloadKitchens)

  const [answers, setAnswers] = useState<Answers | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [recovered, setRecovered] = useState<string | null>(null)

  const kitchen = kitchens?.find((k) => k.id === user.kitchenId)

  useEffect(() => {
    if (answers) return
    const draft = readDraft<ItemsPayload>('items')
    const restored: Answers = {}
    for (const i of draft?.payload.items ?? []) {
      if (i.value) restored[i.id] = { value: i.value, remarks: i.remarks }
    }
    if (Object.keys(restored).length > 0 && draft) setRecovered(draft.savedAt)
    setAnswers(restored)
  }, [answers])

  if (!list || !answers) {
    return (
      <FormShell title="Item Check List" wide actions={<span />}>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </FormShell>
    )
  }

  const entries = (items: KitchenItem[], a: Answers): ItemEntry[] =>
    items.map((i) => ({ ...i, value: a[i.id]?.value ?? null, remarks: a[i.id]?.remarks ?? '' }))

  const rows = entries(list, answers)
  const done = rows.filter((r) => r.value !== null).length

  function commit(next: Answers) {
    setAnswers(next)
    saveDraft<ItemsPayload>('items', {
      kitchenId: user.kitchenId,
      clientId: kitchen?.clientId ?? '',
      date: isoDate(),
      items: entries(list!, next),
    })
  }

  function review() {
    const missing = rows.find((r) => r.value === null)
    if (missing) {
      setShowErrors(true)
      document.getElementById(`item-${missing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    commit(answers!) // write the draft against the list as it is right now
    nav('/items/review')
  }

  return (
    <FormShell
      title="Item Check List"
      wide
      progress={rows.length ? { done, total: rows.length } : undefined}
      actions={
        <>
          <span className="font-mono tabular text-[12px] text-ink-soft">
            {rows.filter((r) => r.value === 'no').length} marked No
          </span>
          <Button variant="primary" onClick={review} disabled={rows.length === 0}>
            Review
          </Button>
        </>
      }
    >
      {recovered && (
        <div className="mb-6">
          <Notice
            tone="warn"
            title={`You have an unfinished check from ${stamp(recovered).split(', ')[1]}.`}
            action={
              <>
                <Button size="sm" variant="outline" onClick={() => setRecovered(null)}>
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearDraft('items')
                    setAnswers({})
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

      <p className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-ink-soft">
        <span className="text-ink">{kitchen?.name ?? '—'}</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular">{kitchen?.clientId ?? '—'}</span>
        <span aria-hidden>·</span>
        <span>{longDate(isoDate())}</span>
      </p>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-hairline">
          <EmptyState
            icon={<ClipboardText size={24} />}
            title="No items to check yet"
            body="The chef hasn't added items for this kitchen. They'll appear here as soon as the chef adds them."
          />
        </div>
      ) : (
        <div className="border-t border-hairline">
          {rows.map((row, i) => (
            <ItemCheckRow
              key={row.id}
              item={row}
              index={i}
              showErrors={showErrors}
              onChange={(next) =>
                commit({ ...answers, [next.id]: { value: next.value, remarks: next.remarks } })
              }
            />
          ))}
        </div>
      )}
    </FormShell>
  )
}
