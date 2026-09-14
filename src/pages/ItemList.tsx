import { useState } from 'react'
import { CookingPot, Lock, PencilSimple, Plus } from '@phosphor-icons/react'
import {
  deleteKitchenItem,
  getKitchenItems,
  getKitchens,
  isItemListLocked,
  saveKitchenItem,
} from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { useSubmissionStream, useTableStream } from '../lib/useRealtime'
import { measuringLabel, pad2 } from '../lib/format'
import type { KitchenItem, Measuring } from '../lib/types'
import { PageTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { Sheet } from '../components/ui/Sheet'
import { EmptyState, Notice, SkeletonRows } from '../components/ui/Feedback'

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs']

const SELECT =
  'h-11 rounded-control border border-hairline bg-sunken px-3 text-[15px] outline-none cursor-pointer'

/**
 * The kitchen's standing item list. Only its chef (or an admin) edits it;
 * staff check exactly these items every day. Edits reach every open screen live.
 */
export default function ItemList() {
  const user = useUser()
  const isAdmin = user.role === 'admin'

  const { data: kitchens } = useAsync(() => getKitchens(), [])
  const [picked, setPicked] = useState('')
  // A chef works on their own kitchen. An admin isn't tied to one, so picks.
  const kitchenId = isAdmin ? picked || kitchens?.[0]?.id || '' : user.kitchenId
  const kitchen = kitchens?.find((k) => k.id === kitchenId)

  const { data: items, loading, reload } = useAsync(() => getKitchenItems(kitchenId), [kitchenId])
  const { data: locked, reload: reloadLock } = useAsync(() => isItemListLocked(kitchenId), [kitchenId])
  useTableStream('kitchen_items', reload)
  useSubmissionStream(reloadLock)

  const [editing, setEditing] = useState<KitchenItem | 'new' | null>(null)

  if (!kitchenId && kitchens) {
    return (
      <>
        <PageTitle>Item List</PageTitle>
        <div className="rounded-card border border-dashed border-hairline">
          <EmptyState
            icon={<CookingPot size={24} />}
            title={isAdmin ? 'No kitchens yet' : 'No kitchen assigned yet'}
            body={
              isAdmin
                ? 'Add a kitchen first, then build its item list here.'
                : 'Ask your admin to add you to a kitchen. Its item list will appear here.'
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageTitle sub={`What staff check${kitchen ? ` in ${kitchen.name}` : ''}. Changes reach everyone straight away.`}>
          Item List
        </PageTitle>
        <Button variant="primary" size="sm" onClick={() => setEditing('new')} disabled={Boolean(locked)}>
          <Plus size={14} />
          Add item
        </Button>
      </div>

      {isAdmin && kitchens && kitchens.length > 1 && (
        <select
          aria-label="Kitchen"
          className={`${SELECT} mb-4`}
          value={kitchenId}
          onChange={(e) => setPicked(e.target.value)}
        >
          {kitchens.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      )}

      {locked && (
        <div className="mb-4">
          <Notice tone="warn" title="Today's check is submitted">
            The list is locked until tomorrow, so the filed record matches what staff checked.
          </Notice>
        </div>
      )}

      {loading && !items ? (
        <SkeletonRows count={4} />
      ) : !items || items.length === 0 ? (
        <div className="rounded-card border border-dashed border-hairline">
          <EmptyState
            icon={<CookingPot size={24} />}
            title="No items yet"
            body="Add each item staff should check, with its quantity and unit."
            action={locked ? undefined : { label: 'Add item', onClick: () => setEditing('new') }}
          />
        </div>
      ) : (
        <ul className="border-t border-hairline">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-3 border-b border-hairline py-3">
              <span className="w-6 shrink-0 font-mono tabular text-[12px] text-ink-soft">{pad2(i + 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{item.name}</p>
                <p className="font-mono tabular text-[13px] text-ink-soft">
                  {item.quantity} {item.unit} · {measuringLabel(item.measuring)}
                </p>
              </div>
              {locked ? (
                <Lock size={16} className="shrink-0 text-ink-mute" aria-label="Locked" />
              ) : (
                <button
                  onClick={() => setEditing(item)}
                  aria-label={`Edit ${item.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                >
                  <PencilSimple size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ItemSheet
        target={editing}
        kitchenId={kitchenId}
        nextSort={items?.length ?? 0}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
      />
    </>
  )
}

function ItemSheet({
  target,
  kitchenId,
  nextSort,
  onClose,
  onSaved,
}: {
  target: KitchenItem | 'new' | null
  kitchenId: string
  nextSort: number
  onClose: () => void
  onSaved: () => void
}) {
  const editing = target && target !== 'new' ? target : null
  const blank = { name: '', quantity: '', unit: 'kg', measuring: 'tare' as Measuring }

  const [form, setForm] = useState(blank)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const key = editing?.id ?? (target === 'new' ? 'new' : null)
  if (key && key !== loadedFor) {
    setLoadedFor(key)
    setError('')
    setForm(
      editing
        ? { name: editing.name, quantity: editing.quantity, unit: editing.unit, measuring: editing.measuring }
        : blank,
    )
  }
  if (!key && loadedFor) setLoadedFor(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this item.')
    } finally {
      setBusy(false)
    }
  }

  function save() {
    const qty = Number(form.quantity)
    if (!form.name.trim()) return setError('Item name is required.')
    if (form.quantity.trim() === '' || !Number.isFinite(qty) || qty < 0) {
      return setError('Enter a quantity of 0 or more.')
    }
    void run(() => saveKitchenItem(kitchenId, { ...form, id: editing?.id, sortOrder: nextSort }))
  }

  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={editing ? 'Edit item' : 'Add item'}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              size="sm"
              className="mr-auto"
              disabled={busy}
              onClick={() => void run(() => deleteKitchenItem(editing.id))}
            >
              Remove
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>
            {busy ? 'Saving' : editing ? 'Save changes' : 'Add item'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Item name">
          {(id) => (
            <Input
              id={id}
              value={form.name}
              placeholder="Paneer"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
        </Field>

        <div className="flex gap-3">
          <Field label="Quantity" className="flex-1">
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                mono
                value={form.quantity}
                placeholder="10"
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            )}
          </Field>
          <Field label="Unit" className="w-28">
            {(id) => (
              <select
                id={id}
                className={SELECT}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-soft">Measuring type</span>
          <Segmented
            label="Measuring type"
            value={form.measuring}
            onChange={(measuring) => setForm({ ...form, measuring })}
            options={[
              { value: 'tare', label: 'Tare' },
              { value: 'non-tare', label: 'Non-Tare' },
            ]}
          />
        </div>

        {error && <p className="text-[12px] text-fail-fg">{error}</p>}
      </div>
    </Sheet>
  )
}
