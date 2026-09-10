import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { clearDraft, getItemPresets, getKitchens, readDraft, saveDraft } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { useIsDesktop } from '../lib/useMediaQuery'
import { isoDate, longDate, stamp, variance } from '../lib/format'
import type { ItemEntry, ItemsPayload } from '../lib/types'
import { FormShell } from '../components/layout/FormShell'
import { ItemCard, ItemDatalist, ItemRow } from '../components/forms/ItemFields'
import { Button } from '../components/ui/Button'
import { Notice, Skeleton } from '../components/ui/Feedback'
import { DefRow } from '../components/ui/Field'

let seq = 0
function newItem(): ItemEntry {
  return {
    id: `new-${Date.now()}-${seq++}`,
    name: '',
    plannedQty: '',
    actualQty: '',
    unit: 'kg',
    taste: null,
    measuring: null,
  }
}

export default function ItemsForm() {
  const user = useUser()
  const nav = useNavigate()
  const desktop = useIsDesktop()
  const listId = useId()

  const { data: presets } = useAsync(() => getItemPresets(), [])
  const { data: kitchens } = useAsync(() => getKitchens(), [])

  const [items, setItems] = useState<ItemEntry[] | null>(null)
  const [error, setError] = useState('')
  const [recovered, setRecovered] = useState<string | null>(null)

  const kitchen = kitchens?.find((k) => k.id === user.kitchenId)

  useEffect(() => {
    if (items) return
    const draft = readDraft<ItemsPayload>('items')
    if (draft?.payload.items.length) {
      setItems(draft.payload.items)
      setRecovered(draft.savedAt)
    } else {
      setItems([newItem(), newItem(), newItem()])
    }
  }, [items])

  function commit(next: ItemEntry[]) {
    setItems(next)
    saveDraft<ItemsPayload>('items', {
      kitchenId: user.kitchenId,
      clientId: kitchen?.clientId ?? '',
      date: isoDate(),
      items: next,
    })
  }

  if (!items || !presets) {
    return (
      <FormShell title="Item Check List" wide actions={<span />}>
        <Skeleton className="h-24" />
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </FormShell>
    )
  }

  const filled = items.filter((i) => i.name.trim() !== '')
  const withVariance = filled.filter((i) => variance(i.plannedQty, i.actualQty) !== null).length
  const notOk = filled.filter((i) => i.taste === 'notok').length

  function addItem() {
    commit([...items!, newItem()])
  }

  function review() {
    if (filled.length === 0) {
      setError('Add at least one item before reviewing.')
      return
    }
    const incomplete = filled.find(
      (i) => !i.plannedQty.trim() || !i.actualQty.trim() || !i.taste || !i.measuring,
    )
    if (incomplete) {
      setError(
        `"${incomplete.name || 'Unnamed item'}" is missing a quantity, taste result or measuring type.`,
      )
      return
    }
    setError('')
    // Drop empty rows before review — they are scaffolding, not data.
    commit(filled)
    nav('/items/review')
  }

  const rowProps = (item: ItemEntry, index: number) => ({
    item,
    index,
    presets: presets!,
    listId,
    onChange: (next: ItemEntry) => commit(items!.map((x) => (x.id === item.id ? next : x))),
    onRemove: () => commit(items!.filter((x) => x.id !== item.id)),
  })

  return (
    <FormShell
      title="Item Check List"
      wide
      actions={
        <>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus size={15} />
            Add item
          </Button>
          <Button variant="primary" onClick={review}>
            Review
          </Button>
        </>
      }
    >
      <ItemDatalist id={listId} presets={presets} />

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
                    clearDraft('items')
                    setItems([newItem(), newItem(), newItem()])
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

      <dl className="mb-6 rounded-card border border-hairline bg-surface px-4 py-1">
        <DefRow term="Client ID">
          <span className="font-mono tabular">{kitchen?.clientId ?? '—'}</span>
        </DefRow>
        <DefRow term="Kitchen">{kitchen?.name ?? '—'}</DefRow>
        <DefRow term="Date">{longDate(isoDate())}</DefRow>
      </dl>

      {desktop ? (
        <div className="overflow-x-auto">
          {/* The one place horizontal scroll is allowed: a real desktop table
              that must not crush the Taste and Measuring controls. */}
          <table className="w-full min-w-[900px] border-collapse text-left">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-[150px]" />
              <col className="w-[190px]" />
              <col className="w-[150px]" />
              <col className="w-[170px]" />
              <col className="w-11" />
            </colgroup>
            <thead>
              <tr className="border-b border-hairline bg-sunken">
                {['Serial No', 'Item Name', 'Planned Qty', 'Actual Qty', 'Taste', 'Measuring Type', ''].map(
                  (h) => (
                    <th key={h} scope="col" className="label-section px-2 py-2.5 first:pl-2">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <ItemRow key={item.id} {...rowProps(item, i)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <ItemCard key={item.id} {...rowProps(item, i)} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addItem}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-hairline text-[13px] text-ink-soft transition-colors hover:border-ink-mute hover:text-ink"
      >
        <Plus size={15} />
        Add item
      </button>

      {error && <p className="mt-3 text-[12px] text-fail-fg">{error}</p>}

      {/* Summary strip, pinned directly above the action bar. */}
      <div
        className="fixed inset-x-0 z-20 border-t border-hairline bg-canvas/95 backdrop-blur-sm no-print"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-[1280px] gap-5 px-5 py-2 font-mono tabular text-[12px] text-ink-soft lg:px-8">
          <span>
            {filled.length} {filled.length === 1 ? 'item' : 'items'}
          </span>
          <span>{withVariance} with variance</span>
          <span>{notOk} not ok</span>
        </div>
      </div>
    </FormShell>
  )
}
