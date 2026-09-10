import { Minus, Plus, Trash } from '@phosphor-icons/react'
import type { ItemEntry, ItemPreset, Measuring, Taste } from '../../lib/types'
import { Segmented } from '../ui/Segmented'
import { Badge } from '../ui/Badge'
import { variance, pad2 } from '../../lib/format'
import { cx } from '../../lib/cx'

const UNITS = ['kg', 'L', 'pcs']

const TASTE_OPTIONS = [
  { value: 'ok' as Taste, label: 'Ok', tone: 'pass' as const },
  { value: 'notok' as Taste, label: 'Not Ok', tone: 'fail' as const },
]

const MEASURING_OPTIONS = [
  { value: 'tare' as Measuring, label: 'Tare', tone: 'neutral' as const },
  { value: 'non-tare' as Measuring, label: 'Non-Tare', tone: 'neutral' as const },
]

interface Props {
  item: ItemEntry
  index: number
  presets: ItemPreset[]
  onChange: (next: ItemEntry) => void
  onRemove: () => void
  listId: string
}

/** Shows how far actual drifted from planned — the thing paper cannot do. */
function VarianceBadge({ item }: { item: ItemEntry }) {
  const v = variance(item.plannedQty, item.actualQty)
  if (!v) return null
  return (
    <Badge plain tone={v.level === 'major' ? 'fail' : 'warn'} className="font-mono tabular">
      {v.label} {item.unit}
    </Badge>
  )
}

function applyName(item: ItemEntry, name: string, presets: ItemPreset[]): ItemEntry {
  const preset = presets.find((p) => p.name.toLowerCase() === name.toLowerCase())
  return { ...item, name, unit: preset?.unit ?? item.unit }
}

function step(value: string, by: number): string {
  const n = parseFloat(value)
  const next = Math.max(0, (isFinite(n) ? n : 0) + by)
  return String(Math.round(next * 100) / 100)
}

const QTY_INPUT =
  'w-full rounded-control border border-hairline bg-sunken px-2 text-right font-mono tabular ' +
  'outline-none transition-colors focus-visible:border-ink'

/* ---------------- Desktop table row ---------------- */

export function ItemRow({ item, index, presets, onChange, onRemove, listId }: Props) {
  return (
    <tr className="group border-b border-hairline">
      <td className="py-2 pr-2 align-middle font-mono tabular text-[13px] text-ink-soft">
        {pad2(index + 1)}
      </td>

      <td className="py-2 pr-3 align-middle">
        <input
          list={listId}
          value={item.name}
          aria-label={`Item ${index + 1} name`}
          placeholder="Item name"
          onChange={(e) => onChange(applyName(item, e.target.value, presets))}
          className="h-10 w-full rounded-control border border-hairline bg-sunken px-2.5 text-[14px] outline-none transition-colors focus-visible:border-ink"
        />
      </td>

      <td className="py-2 pr-3 align-middle">
        <div className="flex items-center gap-1.5">
          <input
            inputMode="decimal"
            value={item.plannedQty}
            aria-label={`Item ${index + 1} planned quantity`}
            onChange={(e) => onChange({ ...item, plannedQty: e.target.value })}
            className={cx(QTY_INPUT, 'h-10 text-[14px]')}
          />
          <UnitSelect item={item} onChange={onChange} />
        </div>
      </td>

      <td className="py-2 pr-3 align-middle">
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={item.actualQty}
            aria-label={`Item ${index + 1} actual quantity`}
            onChange={(e) => onChange({ ...item, actualQty: e.target.value })}
            className={cx(QTY_INPUT, 'h-10 w-20 text-[14px]')}
          />
          <VarianceBadge item={item} />
        </div>
      </td>

      <td className="py-2 pr-3 align-middle">
        <Segmented
          size="sm"
          label={`Item ${index + 1} taste`}
          value={item.taste}
          onChange={(v) => onChange({ ...item, taste: v })}
          options={TASTE_OPTIONS}
        />
      </td>

      <td className="py-2 pr-2 align-middle">
        <Segmented
          size="sm"
          label={`Item ${index + 1} measuring type`}
          value={item.measuring}
          onChange={(v) => onChange({ ...item, measuring: v })}
          options={MEASURING_OPTIONS}
        />
      </td>

      <td className="py-2 align-middle">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove item ${index + 1}`}
          className="flex h-9 w-9 items-center justify-center rounded-control text-ink-mute opacity-0 transition-opacity hover:bg-sunken hover:text-fail-fg focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash size={16} />
        </button>
      </td>
    </tr>
  )
}

/* ---------------- Mobile card ---------------- */

export function ItemCard({ item, index, presets, onChange, onRemove, listId }: Props) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono tabular text-[13px] text-ink-soft">{pad2(index + 1)}</span>
        <input
          list={listId}
          value={item.name}
          aria-label={`Item ${index + 1} name`}
          placeholder="Item name"
          onChange={(e) => onChange(applyName(item, e.target.value, presets))}
          className="min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-1 py-1 text-[15px] font-medium outline-none transition-colors focus-visible:border-hairline focus-visible:bg-sunken"
        />
        <VarianceBadge item={item} />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove item ${index + 1}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink-mute hover:bg-sunken hover:text-fail-fg"
        >
          <Trash size={16} />
        </button>
      </div>

      {/* Two steppers side by side leave ~25px for the number at 375px.
          Touch targets are non-negotiable, so stack instead of shrinking. */}
      <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Stepper
          label="Planned"
          value={item.plannedQty}
          unit={<UnitSelect item={item} onChange={onChange} />}
          onChange={(v) => onChange({ ...item, plannedQty: v })}
          ariaLabel={`Item ${index + 1} planned quantity`}
        />
        <Stepper
          label="Actual"
          value={item.actualQty}
          unit={<span className="text-[12px] text-ink-soft">{item.unit}</span>}
          onChange={(v) => onChange({ ...item, actualQty: v })}
          ariaLabel={`Item ${index + 1} actual quantity`}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div>
          <span className="label-section">Taste</span>
          <Segmented
            className="mt-1.5"
            label={`Item ${index + 1} taste`}
            value={item.taste}
            onChange={(v) => onChange({ ...item, taste: v })}
            options={TASTE_OPTIONS}
          />
        </div>
        <div>
          <span className="label-section">Measuring type</span>
          <Segmented
            className="mt-1.5"
            label={`Item ${index + 1} measuring type`}
            value={item.measuring}
            onChange={(v) => onChange({ ...item, measuring: v })}
            options={MEASURING_OPTIONS}
          />
        </div>
      </div>
    </div>
  )
}

function Stepper({
  label,
  value,
  unit,
  onChange,
  ariaLabel,
}: {
  label: string
  value: string
  unit: React.ReactNode
  onChange: (v: string) => void
  ariaLabel: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label-section">{label}</span>
        {unit}
      </div>
      <div className="mt-1.5 flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => onChange(step(value, -0.5))}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-hairline text-ink-soft transition-colors hover:bg-sunken active:scale-[0.98]"
        >
          <Minus size={15} />
        </button>
        <input
          inputMode="decimal"
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          className={cx(QTY_INPUT, 'h-11 min-w-0 flex-1 text-[16px]')}
        />
        <button
          type="button"
          onClick={() => onChange(step(value, 0.5))}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-hairline text-ink-soft transition-colors hover:bg-sunken active:scale-[0.98]"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

function UnitSelect({ item, onChange }: { item: ItemEntry; onChange: (n: ItemEntry) => void }) {
  return (
    <select
      value={item.unit}
      aria-label="Unit"
      onChange={(e) => onChange({ ...item, unit: e.target.value })}
      className="cursor-pointer appearance-none rounded-chip bg-transparent py-1 text-[12px] text-ink-soft outline-none hover:text-ink"
    >
      {UNITS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  )
}

export function ItemDatalist({ id, presets }: { id: string; presets: ItemPreset[] }) {
  return (
    <datalist id={id}>
      {presets.map((p) => (
        <option key={p.name} value={p.name} />
      ))}
    </datalist>
  )
}
