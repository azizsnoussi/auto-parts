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
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, FilterX, Loader2, RefreshCw, Search, ToggleLeft, ToggleRight, X } from 'lucide-react'
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
