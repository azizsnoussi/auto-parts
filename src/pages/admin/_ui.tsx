/**
 * Shared admin UI primitives.
 *
 * Before this file every admin page hand-rolled its own input/button/chip
 * classes, which is why three pages shipped a byte-identical `INPUT` constant
 * and seven shipped the same gold gradient button. Import from here instead so
 * a design tweak lands everywhere at once.
 *
 * All tokens come from the site design system (`gold-*` / `ink-*` in
 * `tailwind.config.ts`, `ba-*` animation classes in `src/styles.css`).
 */
import type { ComponentType, FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, CalendarDays, FilterX, Loader2, Plus, RefreshCw, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useReveal, useCountUp } from '../../hooks/useAnimations'

// ── class constants ────────────────────────────────────────────────────────

/** Standard text/number/select input. */
export const INPUT =
  'w-full rounded-xl border border-ink-100 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-ink-900 ' +
  'placeholder-ink-300 transition-all duration-300 ease-out-expo ' +
  'focus:border-gold-500 focus:bg-white focus:outline-none focus:shadow-gold-sm'

/** Primary call to action — gold, lifts and sheens on hover. */
export const BTN_PRIMARY =
  'ba-press ba-shine inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 ' +
  'bg-[length:200%_100%] px-5 py-2.5 text-sm font-bold text-ink-900 shadow-gold-md ' +
  'transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-[position:100%_0] hover:shadow-gold-lg ' +
  'disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none'

/** Secondary / outline action. */
export const BTN_GHOST =
  'ba-press inline-flex items-center justify-center gap-2 rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-bold text-ink-600 ' +
  'shadow-elev-1 transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-gold-400 hover:text-gold-700 hover:shadow-gold-sm ' +
  'disabled:translate-y-0 disabled:opacity-50'

/** Destructive action. */
export const BTN_DANGER =
  'ba-press inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 ' +
  'transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-red-100 disabled:translate-y-0 disabled:opacity-50'

// ── per-row table actions ────────────────────────────────────────────────────
//
// Before this block each admin table hand-rolled its own action cell: some used
// `p-2` icon buttons, some `h-8 w-8`, wrappers alternated between `flex` and
// `inline-flex` with `gap-1`, and column alignment drifted. The result was
// visibly uneven spacing from one page to the next. These tokens make every
// action cell identical: a right-aligned cell, a fixed-gap wrapper and buttons
// that all occupy the same 32px square (icon) or 32px-tall pill (labelled).

/** `<td>` wrapper for the trailing action column. Right-aligned, no wrap. */
export const ROW_ACTIONS_CELL = 'whitespace-nowrap px-4 py-3 text-right'

/** Flex wrapper that keeps every button the same distance apart, right-aligned. */
export const ROW_ACTIONS = 'inline-flex items-center justify-end gap-1'

/**
 * Square (32×32) icon-only row button. Pass a tone for the hover colour so a
 * destructive action still reads as destructive without breaking the grid.
 */
export function rowActionBtn(
  tone: 'neutral' | 'gold' | 'blue' | 'emerald' | 'red' = 'neutral',
): string {
  const tones: Record<string, string> = {
    neutral: 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
    gold:    'text-ink-500 hover:bg-gold-50 hover:text-gold-700',
    blue:    'text-ink-500 hover:bg-blue-50 hover:text-blue-700',
    emerald: 'text-ink-500 hover:bg-emerald-50 hover:text-emerald-700',
    red:     'text-ink-500 hover:bg-red-50 hover:text-red-600',
  }
  return `ba-press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${tones[tone]}`
}

/**
 * 32px-tall labelled row button (icon + short label). Same height as
 * {@link rowActionBtn} so a mixed row stays aligned.
 */
export function rowActionLabelBtn(
  tone: 'gold' | 'blue' | 'emerald' | 'red' = 'gold',
): string {
  const tones: Record<string, string> = {
    gold:    'bg-gold-500/10 text-gold-700 hover:bg-gold-500/20',
    blue:    'bg-blue-50 text-blue-700 hover:bg-blue-100',
    emerald: 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20',
    red:     'bg-red-50 text-red-600 hover:bg-red-100',
  }
  return `ba-press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${tones[tone]}`
}

/** Panel / card surface. */
export const CARD =
  'rounded-2xl border border-ink-100 bg-white shadow-elev-1'

/** Table header row. */
export const TH_ROW =
  'border-b border-ink-100 bg-gray-50 text-[11px] font-black uppercase tracking-wider text-ink-400'

/**
 * Minimum width for a data table inside a horizontally scrolling wrapper.
 *
 * `overflow-x-auto` alone does nothing for a `w-full` table: with no intrinsic
 * width the table simply shrinks to the viewport and the cells wrap into
 * unreadable slivers on a phone. Forcing a floor makes the wrapper actually
 * scroll, which is what keeps a 7-8 column admin table legible on mobile.
 */
export const TABLE_MIN = 'min-w-[820px]'

/**
 * Wider floor for the 8-column tables (clients, commandes). Their `px-6` cells
 * alone eat ~380px, so {@link TABLE_MIN} would still squeeze the content
 * columns down to a few characters each.
 */
export const TABLE_MIN_WIDE = 'min-w-[1040px]'

/** Section label above a field. */
export const LABEL =
  'mb-1.5 block text-[11px] font-black uppercase tracking-wider text-ink-400'

// ── components ─────────────────────────────────────────────────────────────

/** Filter / segment chip. Gold when selected. */
export function FilterChip({
  active, onClick, children, count,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`ba-press inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all duration-300 ease-out-expo ${
        active
          ? 'border-gold-500 bg-gold-500 text-ink-900 shadow-gold-sm'
          : 'border-ink-100 bg-white text-ink-500 hover:-translate-y-0.5 hover:border-gold-400 hover:text-gold-700'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`ba-nums rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-ink-900/15' : 'bg-gray-100'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * The one and only refresh control for admin pages.
 *
 * Pass TanStack Query's `isFetching`, **never** `isLoading`. In Query v5
 * `isLoading === isPending && isFetching`, so it is true only during the very
 * first fetch with an empty cache. On a manual `refetch()` with data already
 * cached it stays `false`, which is why several pages shipped a refresh button
 * that never spun and never disabled — it fired the request but looked dead.
 */
export function RefreshButton({
  onClick, busy, label, className = '',
}: {
  onClick: () => void
  busy?: boolean
  label?: string
  className?: string
}) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('adminShared.refresh')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      aria-label={resolvedLabel}
      title={resolvedLabel}
      className={`${BTN_GHOST} ${className}`}
    >
      <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
      {resolvedLabel}
    </button>
  )
}

/** Animated KPI tile: reveals on scroll, counts its number up. */
export function StatCard({
  label, value, Icon, color = 'bg-gold-500', suffix, delay = 0, loading,
}: {
  label: string
  value: number
  Icon: ComponentType<{ size?: number | string }>
  color?: string
  suffix?: string
  delay?: number
  loading?: boolean
}) {
  const { i18n } = useTranslation()
  const ref     = useReveal<HTMLDivElement>({ delay })
  const counted = useCountUp(value, 900)
  return (
    <div
      ref={ref}
      className="ba-reveal ba-lift group flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-elev-1 transition-colors hover:border-gold-300 sm:gap-4 sm:p-5"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-elev-1 transition-transform duration-300 ease-out-back group-hover:scale-110 group-hover:-rotate-6 sm:h-12 sm:w-12 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <span className="block truncate text-[10px] font-black uppercase tracking-wider text-ink-400 sm:text-[11px]">{label}</span>
        {loading ? (
          <div className="ba-skeleton mt-1.5 h-6 w-16 rounded" />
        ) : (
          <span className="ba-nums block text-xl font-black leading-tight text-ink-900 sm:text-2xl">
            <span ref={counted.ref}>{counted.value.toLocaleString(i18n.language.startsWith('en') ? 'en-TN' : 'fr-TN')}</span>
            {suffix ? <span className="ml-1 text-sm font-bold text-ink-400">{suffix}</span> : null}
          </span>
        )}
      </div>
    </div>
  )
}

/** Shimmering placeholder rows for a loading table. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={cols} className="px-6 py-3.5">
            <div className="ba-skeleton h-5 rounded-lg" />
          </td>
        </tr>
      ))}
    </>
  )
}

/** Shimmering placeholder cards for a loading grid. */
export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-elev-1">
          <div className="ba-skeleton mb-4 h-10 w-10 rounded-xl" />
          <div className="ba-skeleton mb-2 h-4 w-3/4 rounded" />
          <div className="ba-skeleton mb-2 h-3 w-1/2 rounded" />
          <div className="ba-skeleton h-9 w-full rounded-xl" />
        </div>
      ))}
    </>
  )
}

/** Friendly empty state with a bobbing icon. */
export function EmptyState({
  Icon, title, hint, action,
}: {
  Icon: ComponentType<{ size?: number | string; className?: string }>
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon size={46} className="mb-4 animate-bob text-ink-200" />
      <p className="text-base font-black text-ink-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm font-medium text-ink-400">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Page heading with the gold rule used across the storefront. */
export function PageHeader({
  title, subtitle, children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
        {subtitle && <p className="mt-2 text-sm font-medium text-ink-400">{subtitle}</p>}
      </div>
      {/* Actions wrap and stay reachable on a phone instead of overflowing the
          header row. */}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Coloured status pill. */
export function StatusPill({ tone, children }: { tone: 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'gray'; children: ReactNode }) {
  const tones: Record<string, string> = {
    gold:  'border-gold-300 bg-gold-50 text-gold-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    red:   'border-red-200 bg-red-50 text-red-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-600',
    blue:  'border-blue-200 bg-blue-50 text-blue-600',
    gray:  'border-ink-100 bg-gray-100 text-ink-500',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}

/**
 * Labelled form field. Four admin pages shipped a near-identical local `Field`;
 * this one is the superset (adds `hint`).
 */
export function Field({
  label, children, required = false, hint,
}: {
  label: string
  children: ReactNode
  required?: boolean
  hint?: string
}) {
  return (
    <div>
      <label className={LABEL}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] font-medium text-ink-400">{hint}</p>}
    </div>
  )
}

/** Standalone search box with a clear button. */
export function SearchBar({
  value, onChange, placeholder, className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('adminShared.search')
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-elev-1 transition-all duration-300 ease-out-expo focus-within:border-gold-400 focus-within:shadow-gold-sm ${className}`}>
      <Search size={16} className="shrink-0 text-ink-300" />
      <input
        type="text"
        value={value}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm font-semibold text-ink-900 placeholder-ink-300 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label={t('adminShared.clearSearch')}
          className="ba-press text-ink-300 transition-colors hover:text-ink-500"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ── date filtering ─────────────────────────────────────────────────────────

/**
 * An inclusive `yyyy-MM-dd` window. An empty string means "open on that side",
 * so `{ from: '2026-01-01', to: '' }` reads as "since January".
 *
 * Plain `yyyy-MM-dd` strings rather than `Date` objects on purpose: that is what
 * `<input type="date">` speaks, what the backend accepts as a query param, and
 * what compares correctly with a simple `<=` — see {@link inDateRange}.
 */
export type DateRange = { from: string; to: string }

export const EMPTY_RANGE: DateRange = { from: '', to: '' }

/** `Date` → `yyyy-MM-dd` in the *local* calendar. */
function toISODate(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export type DatePresetKey = 'today' | 'week' | 'month' | 'monthToDate' | 'year'

export const DATE_PRESETS: { key: DatePresetKey; labelKey: string }[] = [
  { key: 'today',       labelKey: 'adminShared.date.today' },
  { key: 'week',        labelKey: 'adminShared.date.week' },
  { key: 'month',       labelKey: 'adminShared.date.month' },
  { key: 'monthToDate', labelKey: 'adminShared.date.monthToDate' },
  { key: 'year',        labelKey: 'adminShared.date.year' },
]

/** Builds the window a preset stands for, always ending today. */
export function dateRangePreset(key: DatePresetKey): DateRange {
  const today = new Date()
  const to = toISODate(today)
  const back = (days: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - days)
    return toISODate(d)
  }
  switch (key) {
    case 'today':       return { from: to, to }
    // 7 and 30 days *including* today, which is what a shop owner means by
    // "les 7 derniers jours" — hence 6 and 29.
    case 'week':        return { from: back(6), to }
    case 'month':       return { from: back(29), to }
    case 'monthToDate': return { from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), to }
    case 'year':        return { from: `${today.getFullYear()}-01-01`, to }
  }
}

export const isDateRangeActive = (r: DateRange) => Boolean(r.from || r.to)

export const sameDateRange = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to

/**
 * Is an ISO timestamp inside the window?
 *
 * The first ten characters are compared as text instead of going through
 * `new Date(...)`: the backend sends a `LocalDateTime` with no zone, so parsing
 * it would attach the browser's offset and quietly push a 01:00 order into the
 * previous day for anyone east of UTC. `yyyy-MM-dd` sorts lexicographically, so
 * string comparison is both correct and cheaper.
 *
 * A row with no timestamp is only excluded once a window is actually set.
 */
export function inDateRange(iso: string | null | undefined, r: DateRange): boolean {
  if (!isDateRangeActive(r)) return true
  if (!iso || iso.length < 10) return false
  const day = iso.slice(0, 10)
  if (r.from && day < r.from) return false
  if (r.to && day > r.to) return false
  return true
}

/**
 * Date window picker: two native date inputs plus the presets an admin actually
 * reaches for. Native `<input type="date">` is deliberate — it brings the OS
 * calendar, the locale format and keyboard support for free, which a hand-rolled
 * popover would have to re-earn.
 */
export function DateRangeFilter({
  value, onChange, presets = true, className = '',
}: {
  value: DateRange
  onChange: (next: DateRange) => void
  presets?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const active = isDateRangeActive(value)
  const dateInput =
    'ba-nums w-[7.5rem] bg-transparent text-xs font-bold text-ink-900 focus:outline-none'

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-white px-3 py-2.5 shadow-elev-1 transition-all duration-300 ease-out-expo focus-within:border-gold-400 focus-within:shadow-gold-sm">
        <CalendarDays size={15} className="shrink-0 text-ink-300" />
        <input
          type="date"
          value={value.from}
          // Bounding each input by the other makes an inverted window
          // unselectable instead of silently returning nothing.
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          aria-label={t('adminShared.date.start')}
          className={dateInput}
        />
        <span aria-hidden className="text-xs font-black text-ink-300">→</span>
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          aria-label={t('adminShared.date.end')}
          className={dateInput}
        />
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_RANGE)}
            aria-label={t('adminShared.date.clear')}
            title={t('adminShared.date.clear')}
            className="ba-press text-ink-300 transition-colors hover:text-ink-500"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {presets && (
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map((p) => (
            <FilterChip
              key={p.key}
              active={sameDateRange(value, dateRangePreset(p.key))}
              onClick={() => {
                const next = dateRangePreset(p.key)
                // Clicking the active preset again clears it, like the status chips.
                onChange(sameDateRange(value, next) ? EMPTY_RANGE : next)
              }}
            >
              {t(p.labelKey)}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Filter strip for a card header: wraps the controls, counts what is active and
 * offers the one reset button every page was otherwise re-inventing.
 */
export function FilterBar({
  children, activeCount = 0, onReset, right,
}: {
  children: ReactNode
  activeCount?: number
  onReset?: () => void
  right?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3 border-b border-ink-100 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        {(right || (onReset && activeCount > 0)) && (
          <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            {right}
            {onReset && activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="ba-press inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs font-bold text-ink-500 transition-colors hover:border-red-200 hover:text-red-600"
              >
                <FilterX size={13} />
                {t('adminShared.reset')}
                <span className="ba-nums rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px]">{activeCount}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Boolean toggle rendered as an icon + label row. */
export function ToggleField({
  checked, onChange, label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="ba-press flex items-center gap-2 text-sm font-bold text-ink-700"
    >
      {checked
        ? <ToggleRight size={22} className="text-emerald-500" />
        : <ToggleLeft  size={22} className="text-ink-200" />}
      {label}
    </button>
  )
}

/** Boolean rendered as a native checkbox + label. */
export function CheckboxField({
  checked, onChange, label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-ink-200 accent-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
      />
      <span className="text-xs font-bold text-ink-600">{label}</span>
    </label>
  )
}

/**
 * Scrollable form modal: sticky header, scrolling body, sticky footer.
 * Wrap the call site in `<AnimatePresence>` — this renders null when closed.
 */
export function Modal({
  open, onClose, title, subtitle, children, footer, maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl bg-white shadow-elev-4 sm:max-h-[90vh] sm:rounded-3xl`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-ink-900 sm:text-lg">{title}</h2>
            {subtitle && <p className="ba-nums truncate text-xs font-medium text-ink-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label={t('adminShared.close')}
            className="ba-press shrink-0 rounded-xl p-2 text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 gap-3 border-t border-ink-100 bg-gray-50 px-4 py-4 sm:px-6">{footer}</div>
        )}
      </motion.div>
    </div>
  )
}

/** Cancel / confirm buttons for a `Modal` footer. */
export function ModalFooterButtons({
  onCancel, onConfirm, pending, cancelLabel, confirmLabel, ConfirmIcon,
}: {
  onCancel: () => void
  onConfirm: (e: FormEvent) => void
  pending?: boolean
  cancelLabel?: string
  confirmLabel?: string
  ConfirmIcon?: ComponentType<{ size?: number | string }>
}) {
  const { t } = useTranslation()
  return (
    <>
      <button type="button" onClick={onCancel} className={`flex-1 ${BTN_GHOST}`}>
        {cancelLabel ?? t('adminShared.cancel')}
      </button>
      <button
        type="submit"
        onClick={onConfirm}
        disabled={pending}
        className={`flex-1 ${BTN_PRIMARY}`}
      >
        {pending
          ? <Loader2 size={15} className="animate-spin" />
          : ConfirmIcon ? <ConfirmIcon size={15} /> : null}
        {confirmLabel ?? t('adminShared.save')}
      </button>
    </>
  )
}

/**
 * Destructive confirmation dialog. Renders its own `AnimatePresence` so callers
 * only need `<ConfirmDialog open={…} />`.
 */
export function ConfirmDialog({
  open, onCancel, onConfirm, title, message, detail, pending,
  Icon, confirmLabel, cancelLabel,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  message: string
  detail?: string
  pending?: boolean
  Icon: ComponentType<{ size?: number | string; className?: string }>
  confirmLabel?: string
  cancelLabel?: string
}) {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/55 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-elev-4"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-ink-900">{title}</h3>
                {detail && <p className="truncate text-xs font-medium text-ink-400">{detail}</p>}
              </div>
            </div>
            <p className="mb-5 text-sm text-ink-500">{message}</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className={`flex-1 ${BTN_GHOST}`}>
                {cancelLabel ?? t('adminShared.cancel')}
              </button>
              <button
                onClick={onConfirm}
                disabled={pending}
                className="ba-press flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : null}
                {confirmLabel ?? t('adminShared.delete')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── strict searchable pickers ────────────────────────────────────────────────
//
// The ERP create modals used to accept a free-typed client / supplier name via
// a `<datalist>` (suggestions but no enforcement) or a plain `<input>`. The
// business rule is now "choose an existing party, never type one by hand", so
// these components render a strict dropdown: the value is always one of the
// supplied options, type-to-filter narrows the list, and there is no way to
// commit arbitrary text. `value` is the selected option id (or null).

export type PickerOption = { id: number; label: string; sub?: string }

/**
 * Strict, searchable single-select. No free text is ever accepted — the caller
 * receives one of the supplied option ids or `null`. Type to filter; click (or
 * Enter) to select. Closes on outside click / Escape.
 */
export function EntityPicker({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  disabled = false,
  loading = false,
  autoFocus = false,
}: {
  options: PickerOption[]
  value: number | null
  onChange: (id: number | null, option: PickerOption | null) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  loading?: boolean
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.sub ? o.sub.toLowerCase().includes(term) : false),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (open) {
      setActive(0)
      // Focus the search field when the menu opens.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (autoFocus && !disabled) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = (opt: PickerOption) => {
    onChange(opt.id, opt)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(filtered.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[active]
      if (opt) commit(opt)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-all duration-300 ease-out-expo
          ${open ? 'border-gold-500 bg-white shadow-gold-sm' : 'border-ink-100 bg-gray-50'}
          ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-gold-400'}`}
      >
        <span className={selected ? 'truncate text-ink-900' : 'truncate text-ink-300'}>
          {selected
            ? selected.label
            : placeholder ?? t('adminShared.picker.placeholder', 'Sélectionner…')}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-100 bg-white shadow-elev-3"
          >
            <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
              <Search size={14} className="shrink-0 text-ink-300" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={t('adminShared.picker.search', 'Rechercher…')}
                className="flex-1 bg-transparent text-sm font-semibold text-ink-900 placeholder-ink-300 focus:outline-none"
              />
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
              {loading ? (
                <li className="flex items-center gap-2 px-3 py-2 text-sm text-ink-400">
                  <Loader2 size={14} className="animate-spin" />
                  {t('adminShared.loading', 'Chargement…')}
                </li>
              ) : filtered.length === 0 ? (
                <li className="px-3 py-3 text-center text-sm text-ink-400">
                  {emptyLabel ?? t('adminShared.picker.empty', 'Aucun résultat')}
                </li>
              ) : (
                filtered.map((o, i) => {
                  const isSel = o.id === value
                  const isActive = i === active
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => commit(o)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition
                          ${isActive ? 'bg-gold-50' : ''}
                          ${isSel ? 'font-bold text-gold-700' : 'font-medium text-ink-800'}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{o.label}</span>
                          {o.sub && <span className="block truncate text-xs text-ink-400">{o.sub}</span>}
                        </span>
                        {isSel && <Check size={15} className="shrink-0 text-gold-600" />}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── ERP line items editor ────────────────────────────────────────────────────
//
// Shared line-item builder for delivery notes / purchase orders. Each line can
// be sourced from the product catalogue (via the picker) or typed as a free
// label, then given a quantity and unit price. The parent owns the array; this
// component only renders + mutates it through `onChange`.

export type LineItem = {
  /** Product id when the line was picked from the product catalogue; null otherwise. */
  productId: number | null
  /** Service id when the line was picked from the service catalogue; null otherwise. */
  serviceId?: number | null
  /** What the line represents. Defaults to 'product' for older callers. */
  kind?: 'product' | 'service'
  label: string
  qty: number
  unitPrice: number
}

export const EMPTY_LINE: LineItem = { productId: null, serviceId: null, kind: 'product', label: '', qty: 1, unitPrice: 0 }

/** A catalogue entry offered to the line-item picker (carries a unit price). */
export type ProductPickOption = { id: number; label: string; price: number; sub?: string }

/**
 * Editable list of {@link LineItem}s with an "add line" button.
 *
 * `productOptions` enables the product-catalogue picker; `serviceOptions`
 * enables the service-catalogue picker. When BOTH are supplied each row shows a
 * small Produit / Service toggle so a single document (facture, devis,
 * commande, bon de livraison) can mix goods and services. Picking a catalogue
 * entry fills the label and unit price; a row can still hold a free label when
 * nothing is chosen. `money` formats the per-line total.
 */
export function LineItemsEditor({
  lines,
  onChange,
  productOptions = [],
  serviceOptions = [],
  productsLoading = false,
  money,
}: {
  lines: LineItem[]
  onChange: (lines: LineItem[]) => void
  productOptions?: ProductPickOption[]
  serviceOptions?: ProductPickOption[]
  productsLoading?: boolean
  money: (n: number) => string
}) {
  const { t } = useTranslation()

  const patch = (i: number, next: Partial<LineItem>) =>
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...next } : l)))

  const removeLine = (i: number) => onChange(lines.filter((_, idx) => idx !== i))

  const addLine = () => onChange([...lines, { ...EMPTY_LINE }])

  const hasProducts = productOptions.length > 0
  const hasServices = serviceOptions.length > 0
  const showToggle = hasProducts && hasServices

  const productById = useMemo(() => {
    const m = new Map<number, ProductPickOption>()
    for (const o of productOptions) m.set(o.id, o)
    return m
  }, [productOptions])

  const serviceById = useMemo(() => {
    const m = new Map<number, ProductPickOption>()
    for (const o of serviceOptions) m.set(o.id, o)
    return m
  }, [serviceOptions])

  const productPickerOptions = useMemo<PickerOption[]>(
    () => productOptions.map((o) => ({ id: o.id, label: o.label, sub: o.sub })),
    [productOptions],
  )
  const servicePickerOptions = useMemo<PickerOption[]>(
    () => serviceOptions.map((o) => ({ id: o.id, label: o.label, sub: o.sub })),
    [serviceOptions],
  )

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const lineTotal = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0)
        const rowKind: 'product' | 'service' = line.kind ?? 'product'
        return (
          <div key={i} className="rounded-xl border border-ink-100 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-ink-400">
                {t('adminShared.lineItems.line', 'Ligne {{n}}', { n: i + 1 })}
              </span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="ba-press rounded-lg p-1 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                  title={t('adminShared.lineItems.remove', 'Retirer la ligne')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {showToggle && (
              <div className="mb-2 inline-flex rounded-lg bg-ink-100/70 p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    patch(i, { kind: 'product', serviceId: null, productId: null, label: '', unitPrice: 0 })
                  }
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    rowKind === 'product' ? 'bg-white text-ink-900 shadow-elev-1' : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {t('adminShared.lineItems.product', 'Produit')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patch(i, { kind: 'service', productId: null, serviceId: null, label: '', unitPrice: 0 })
                  }
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    rowKind === 'service' ? 'bg-white text-ink-900 shadow-elev-1' : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {t('adminShared.lineItems.service', 'Service')}
                </button>
              </div>
            )}

            {rowKind === 'service' && hasServices ? (
              <div className="mb-2">
                <EntityPicker
                  options={servicePickerOptions}
                  value={line.serviceId ?? null}
                  loading={productsLoading}
                  placeholder={t('adminShared.lineItems.pickService', 'Choisir un service du catalogue…')}
                  onChange={(id) => {
                    const svc = id != null ? serviceById.get(id) : undefined
                    patch(i, {
                      kind: 'service',
                      serviceId: id,
                      productId: null,
                      label: svc ? svc.label : line.label,
                      unitPrice: svc ? svc.price : line.unitPrice,
                    })
                  }}
                />
              </div>
            ) : (
              hasProducts && (
                <div className="mb-2">
                  <EntityPicker
                    options={productPickerOptions}
                    value={line.productId}
                    loading={productsLoading}
                    placeholder={t('adminShared.lineItems.pickProduct', 'Choisir un produit du catalogue…')}
                    onChange={(id) => {
                      const prod = id != null ? productById.get(id) : undefined
                      patch(i, {
                        kind: 'product',
                        productId: id,
                        serviceId: null,
                        label: prod ? prod.label : line.label,
                        unitPrice: prod ? prod.price : line.unitPrice,
                      })
                    }}
                  />
                </div>
              )
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                className={INPUT}
                value={line.label}
                onChange={(e) => patch(i, { label: e.target.value })}
                placeholder={t('adminShared.lineItems.label', 'Désignation')}
              />
              <input
                type="number"
                min="0"
                step="1"
                className={`${INPUT} sm:w-24`}
                value={line.qty}
                onChange={(e) => patch(i, { qty: Number(e.target.value) || 0 })}
                placeholder={t('adminShared.lineItems.qty', 'Qté')}
              />
              <input
                type="number"
                min="0"
                step="0.001"
                className={`${INPUT} sm:w-32`}
                value={line.unitPrice}
                onChange={(e) => patch(i, { unitPrice: Number(e.target.value) || 0 })}
                placeholder={t('adminShared.lineItems.unitPrice', 'P.U. HT')}
              />
            </div>

            <div className="mt-2 text-right text-xs font-semibold text-ink-500">
              {t('adminShared.lineItems.lineTotal', 'Total ligne')}: <span className="ba-nums text-ink-800">{money(lineTotal)}</span>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addLine}
        className={`w-full justify-center ${BTN_GHOST}`}
      >
        <Plus size={15} />
        {t('adminShared.lineItems.add', 'Ajouter une ligne')}
      </button>
    </div>
  )
}
