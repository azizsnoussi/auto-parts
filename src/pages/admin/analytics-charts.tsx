/**
 * Chart + drill-down primitives shared by `AdminDashboard` and `AdminReports`.
 *
 * Everything here renders from `GET /api/analytics/*` payloads. Two rules worth
 * knowing before editing:
 *
 * - **Nothing is hardcoded.** The Y-axis labels, the legend years and the bar
 *   heights are all derived from `RevenueSeries.maxRevenue` / `currentYear`.
 *   The previous version of these charts shipped fixed `70k/50k/30k/10k`
 *   gridlines and a fixed `2025 / 2024` legend, which silently lied as soon as
 *   the data moved.
 * - **Every bar and every row is a control.** Clicking a month opens
 *   `/analytics/revenue/{year}/{month}`; clicking a category opens
 *   `/analytics/categories/{id}`. Both are keyboard reachable.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownRight, ArrowUpRight, ArrowRight, BarChart3, Boxes,
  Package, ShoppingCart,
} from 'lucide-react'
import { analyticsApi } from '../../lib/api'
import { EmptyState, Modal, StatusPill, TH_ROW, TABLE_MIN } from './_ui'
import {
  type CategoryDetail, type CategoryShare, type DayPoint, type MonthDetail,
  type MonthPoint, type OrderBrief, type Pct, type RevenueSeries,
  type TopProduct,
  STATUS_FR,
  deltaTone, fmtCompact, fmtDate, fmtInt, fmtMoney, fmtMonth, fmtPct, fmtShare,
} from './analytics-types'

// ── small shared bits ──────────────────────────────────────────────────────

/**
 * A percentage delta. Renders `—` for null, because "no comparison base" is not
 * the same as "no growth" and a fabricated `+100%` is worse than an em dash.
 */
export function Delta({ value, invert = false, suffix }: { value: Pct; invert?: boolean; suffix?: string }) {
  const tone = deltaTone(value, invert)
  const Icon = value == null || value === 0 ? null : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`ba-nums inline-flex items-center gap-0.5 text-xs font-bold ${tone}`}>
      {Icon && <Icon size={13} />}
      {fmtPct(value)}
      {suffix && value != null && <span className="ml-1 font-semibold text-ink-400">{suffix}</span>}
    </span>
  )
}

/** Compact metric tile used inside the drill-down modals. */
export function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-gray-50 p-3">
      <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{label}</span>
      <p className="ba-nums mt-1 text-lg font-black leading-tight text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] font-semibold text-ink-400">{hint}</p>}
    </div>
  )
}

/** Backend `OrderStatus` → `StatusPill` tone. */
export function statusTone(status: string | null): 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'gray' {
  switch (status) {
    case 'PENDING': return 'amber'
    case 'CONFIRMED':
    case 'DELIVERED': return 'green'
    case 'PROCESSING': return 'gold'
    case 'SHIPPED': return 'blue'
    case 'CANCELLED':
    case 'REFUNDED': return 'red'
    default: return 'gray'
  }
}

/**
 * Rounds an axis maximum up to a readable step (1 / 2 / 2.5 / 5 / 10 × 10ⁿ) so
 * the gridline labels are round numbers instead of `47 318,64`.
 */
export function niceMax(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 100
  const exp = Math.floor(Math.log10(raw))
  const pow = Math.pow(10, exp)
  const norm = raw / pow
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return step * pow
}

// ── revenue bar chart ──────────────────────────────────────────────────────

const W = 600
const H = 260
const PAD_L = 54
const PAD_R = 12
const PAD_T = 16
const PAD_B = 34
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B
const SLOT = PLOT_W / 12
const BAR_W = 13
const GRID_STEPS = 4

/**
 * Year-over-year monthly revenue. Each month is a focusable control that opens
 * the month drill-down.
 */
export function RevenueBarChart({
  series, loading, onSelectMonth,
}: {
  series?: RevenueSeries
  loading?: boolean
  onSelectMonth: (year: number, month: number) => void
}) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)

  const axisMax = niceMax(series?.maxRevenue ?? 0)
  const gridlines = useMemo(
    () => Array.from({ length: GRID_STEPS + 1 }, (_, i) => (axisMax / GRID_STEPS) * i),
    [axisMax],
  )

  if (loading) return <div className="ba-skeleton h-64 w-full rounded-xl" />

  if (!series) {
    return (
      <EmptyState
        Icon={BarChart3}
        title={t('analytics.empty.unavailable')}
        hint={t('analytics.empty.revenueUnavailable')}
      />
    )
  }

  const noData = series.maxRevenue <= 0
  const y = (v: number) => PAD_T + PLOT_H - (v / axisMax) * PLOT_H
  const barH = (v: number) => (v <= 0 ? 0 : Math.max(2, (v / axisMax) * PLOT_H))

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-64 w-full" role="img"
        aria-label={t('analytics.a11y.monthlyRevenue', { current: series.currentYear, previous: series.previousYear })}>
        {/* Gridlines + axis labels, both derived from the data. */}
        {gridlines.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)}
              stroke={i === 0 ? '#e2e8f0' : '#f1f5f9'} strokeWidth={i === 0 ? 1.5 : 1}
            />
            <text x={PAD_L - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="700">
              {fmtCompact(v)}
            </text>
          </g>
        ))}

        {series.current.map((point, i) => {
          const prev = series.previous[i]
          const xSlot = PAD_L + i * SLOT
          const xPrev = xSlot + SLOT / 2 - BAR_W - 1.5
          const xCurr = xSlot + SLOT / 2 + 1.5
          const monthLabel = fmtMonth(series.currentYear, point.month)
          const label = t('analytics.a11y.monthSummary', { month: monthLabel, year: series.currentYear, revenue: fmtMoney(point.revenue), orders: point.orders })
          return (
            <g
              key={point.month}
              role="button"
              tabIndex={0}
              aria-label={`${label}. ${t('analytics.openDetails')}`}
              className="cursor-pointer outline-none"
              onClick={() => onSelectMonth(series.currentYear, point.month)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectMonth(series.currentYear, point.month)
                }
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <title>{label}</title>
              {/* Full-height hit area: a 2px-tall bar still has to be clickable. */}
              <rect
                x={xSlot} y={PAD_T} width={SLOT} height={PLOT_H} rx={6}
                fill={hover === i ? '#c8a415' : 'transparent'}
                fillOpacity={hover === i ? 0.08 : 0}
              />
              {prev && prev.revenue > 0 && (
                <rect x={xPrev} y={y(prev.revenue)} width={BAR_W} height={barH(prev.revenue)} rx={3} fill="#e2e8f0">
                  <animate attributeName="height" from="0" to={barH(prev.revenue)} dur="0.7s" begin={`${i * 0.04}s`} fill="freeze" />
                  <animate attributeName="y" from={PAD_T + PLOT_H} to={y(prev.revenue)} dur="0.7s" begin={`${i * 0.04}s`} fill="freeze" />
                </rect>
              )}
              {point.revenue > 0 && (
                <rect x={xCurr} y={y(point.revenue)} width={BAR_W} height={barH(point.revenue)} rx={3} fill="#c8a415">
                  <animate attributeName="height" from="0" to={barH(point.revenue)} dur="0.7s" begin={`${0.06 + i * 0.04}s`} fill="freeze" />
                  <animate attributeName="y" from={PAD_T + PLOT_H} to={y(point.revenue)} dur="0.7s" begin={`${0.06 + i * 0.04}s`} fill="freeze" />
                </rect>
              )}
              <text
                x={xSlot + SLOT / 2} y={H - 12} textAnchor="middle" fontSize="10" fontWeight="700"
                fill={hover === i ? '#8a7010' : '#94a3b8'}
              >
                {monthLabel}
              </text>
            </g>
          )
        })}
      </svg>

      {noData && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-xl bg-white/85 px-4 py-2 text-sm font-bold text-ink-400 backdrop-blur-sm">
            {t('analytics.empty.noSalesYears', { previous: series.previousYear, current: series.currentYear })}
          </p>
        </div>
      )}
    </div>
  )
}

/** Legend for {@link RevenueBarChart}. Years come from the payload, never hardcoded. */
export function RevenueLegend({ series }: { series?: RevenueSeries }) {
  return (
    <div className="flex items-center gap-4 text-xs font-bold">
      <span className="flex items-center gap-1.5 text-gold-600">
        <span className="h-2 w-2 rounded-full bg-gold-500" /> {series?.currentYear ?? '—'}
      </span>
      <span className="flex items-center gap-1.5 text-ink-400">
        <span className="h-2 w-2 rounded-full bg-gray-300" /> {series?.previousYear ?? '—'}
      </span>
    </div>
  )
}

// ── daily strip ────────────────────────────────────────────────────────────

/** Day-by-day revenue for a bounded window (the backend caps it at 120 days). */
export function DayStrip({ days }: { days: DayPoint[] }) {
  const { t } = useTranslation()
  if (days.length === 0) {
    return <p className="text-xs font-semibold text-ink-400">{t('analytics.empty.dailyTooLong')}</p>
  }

  const max = niceMax(Math.max(...days.map((d) => d.revenue), 0))
  const width = 600
  const height = 90
  const slot = width / days.length
  const barW = Math.max(2, Math.min(14, slot - 2))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label={t('analytics.a11y.dailyRevenue')}>
      <line x1={0} x2={width} y1={height - 14} y2={height - 14} stroke="#e2e8f0" strokeWidth={1} />
      {days.map((d, i) => {
        const h = d.revenue <= 0 ? 0 : Math.max(2, (d.revenue / max) * (height - 20))
        const x = i * slot + (slot - barW) / 2
        return (
          <g key={d.date}>
            <title>{t('analytics.a11y.daySummary', { date: fmtDate(d.date), revenue: fmtMoney(d.revenue), orders: d.orders })}</title>
            {h > 0 && <rect x={x} y={height - 14 - h} width={barW} height={h} rx={2} fill="#c8a415" />}
            {/* Label every 5th day plus the last, otherwise the axis is unreadable. */}
            {(i % 5 === 0 || i === days.length - 1) && (
              <text x={x + barW / 2} y={height - 3} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700">
                {d.day}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── progress ring ──────────────────────────────────────────────────────────

const RING_R = 40
const RING_C = 2 * Math.PI * RING_R // ≈ 251.3

/**
 * Real 0-100 ring: the dash offset is computed from `pct`, unlike the previous
 * hardcoded `strokeDashoffset="110"` which always drew the same 56%.
 */
export function ProgressRing({
  pct, headline, caption,
}: {
  pct: Pct
  headline: string
  caption: string
}) {
  const { t } = useTranslation()
  const clamped = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const offset = RING_C - (clamped / 100) * RING_C
  return (
    <div className="relative flex items-center justify-center py-6">
      <svg viewBox="0 0 100 100" className="h-40 w-40" role="img"
        aria-label={`${caption} : ${pct == null ? t('analytics.unavailable') : `${clamped.toFixed(1)} %`}`}>
        <circle cx="50" cy="50" r={RING_R} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={RING_R} fill="none" stroke="#c8a415" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={RING_C} strokeDashoffset={offset} transform="rotate(-90 50 50)"
        >
          <animate
            attributeName="stroke-dashoffset" from={RING_C} to={offset} dur="1.1s" begin="0.15s"
            calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1" fill="freeze"
          />
        </circle>
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="ba-nums text-3xl font-black text-ink-900">{headline}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{caption}</span>
      </div>
    </div>
  )
}

// ── category distribution ──────────────────────────────────────────────────

/** Palette cycled across the distribution rows. */
const BARS = ['bg-gold-500', 'bg-blue-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500']

/** Clickable revenue-share rows. Each row opens the category drill-down. */
export function CategoryDistribution({
  categories, onSelect,
}: {
  categories: CategoryShare[]
  onSelect: (categoryId: number) => void
}) {
  const { t } = useTranslation()
  if (categories.length === 0) {
    return <EmptyState Icon={Boxes} title={t('analytics.empty.noSales')} hint={t('analytics.empty.noCategories')} />
  }
  return (
    <div className="space-y-3">
      {categories.map((c, i) => (
        <button
          key={c.categoryId}
          onClick={() => onSelect(c.categoryId)}
          className="ba-press group block w-full rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-gold-50/60"
          aria-label={t('analytics.a11y.categoryShare', { label: c.label, share: fmtShare(c.pct) })}
        >
          <div className="flex items-baseline justify-between gap-3 text-xs font-bold">
            <span className="truncate text-ink-600 group-hover:text-gold-700">{c.label}</span>
            <span className="ba-nums shrink-0 text-ink-500">
              {fmtMoney(c.revenue)} · <span className="text-ink-900">{fmtShare(c.pct)}</span>
            </span>
          </div>
          <div
            className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-ink-50"
            role="progressbar"
            aria-label={c.label}
            aria-valuenow={Math.round(c.pct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full transition-[width] duration-700 ease-out-expo ${BARS[i % BARS.length]}`}
              style={{ width: `${Math.max(c.pct, 1.5)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-ink-400">
            <span className="ba-nums">{t('analytics.unitsOrders', { units: fmtInt(c.units), orders: fmtInt(c.orders) })}</span>
            <span className="opacity-0 transition-opacity group-hover:opacity-100">{t('adminShared.details')} →</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── shared tables ──────────────────────────────────────────────────────────

export function TopProductsTable({ products }: { products: TopProduct[] }) {
  const { t } = useTranslation()
  if (products.length === 0) {
    return <EmptyState Icon={Package} title={t('analytics.empty.noProducts')} hint={t('analytics.empty.noOrderLines')} />
  }
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-left text-sm ${TABLE_MIN}`}>
        <thead>
          <tr className={TH_ROW}>
            <th className="px-4 py-3">{t('analytics.columns.product')}</th>
            <th className="px-4 py-3">{t('analytics.columns.category')}</th>
            <th className="px-4 py-3 text-right">{t('analytics.columns.units')}</th>
            <th className="px-4 py-3 text-right">{t('analytics.columns.stock')}</th>
            <th className="px-4 py-3 text-right">{t('analytics.columns.revenue')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 font-semibold">
          {products.map((p) => (
            <tr key={p.productId} className="transition-colors hover:bg-gold-50/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-ink-100 object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-ink-300">
                      <Package size={15} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink-900">{p.name ?? '—'}</p>
                    <p className="ba-nums truncate text-[11px] font-medium text-ink-400">
                      {p.sku ?? '—'}{p.brand ? ` · ${p.brand}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-xs font-semibold text-ink-500">{p.categoryLabel ?? '—'}</td>
              <td className="ba-nums px-4 py-3 text-right text-ink-900">{fmtInt(p.units)}</td>
              <td className="px-4 py-3 text-right">
                {p.stockQuantity <= 0
                  ? <StatusPill tone="red">{t('analytics.outOfStock')}</StatusPill>
                  : <span className="ba-nums font-bold text-ink-600">{fmtInt(p.stockQuantity)}</span>}
              </td>
              <td className="ba-nums px-4 py-3 text-right font-black text-ink-900">{fmtMoney(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OrdersTable({ orders }: { orders: OrderBrief[] }) {
  const { t } = useTranslation()
  if (orders.length === 0) {
    return <EmptyState Icon={ShoppingCart} title={t('analytics.empty.noOrders')} hint={t('analytics.empty.noOrdersPeriod')} />
  }
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-left text-sm ${TABLE_MIN}`}>
        <thead>
          <tr className={TH_ROW}>
            <th className="px-4 py-3">{t('adminOrders.columns.number')}</th>
            <th className="px-4 py-3">{t('adminOrders.columns.customer')}</th>
            <th className="px-4 py-3">{t('adminOrders.columns.date')}</th>
            <th className="px-4 py-3">{t('adminOrders.columns.status')}</th>
            <th className="px-4 py-3 text-right">{t('adminOrders.columns.total')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 font-semibold">
          {orders.map((o) => (
            <tr key={o.id} className="transition-colors hover:bg-gold-50/40">
              <td className="ba-nums px-4 py-3 font-mono text-xs font-extrabold text-ink-900">{o.orderNumber}</td>
              <td className="px-4 py-3">
                <p className="font-bold text-ink-900">{o.customerName ?? '—'}</p>
                <p className="truncate text-[11px] font-medium text-ink-400">{o.customerEmail ?? ''}</p>
              </td>
              <td className="ba-nums px-4 py-3 text-xs font-medium text-ink-500">{fmtDate(o.createdAt)}</td>
              <td className="px-4 py-3">
                <StatusPill tone={statusTone(o.status)}>{STATUS_FR[o.status ?? ''] ?? o.status ?? '—'}</StatusPill>
              </td>
              <td className="ba-nums px-4 py-3 text-right font-black text-ink-900">{fmtMoney(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Status / payment breakdown as a list of pills with share bars. */
export function SliceList({
  slices, labels, tone,
}: {
  slices: { status?: string; method?: string; orders: number; revenue: number; pct: number }[]
  labels: Record<string, string>
  tone: (key: string) => 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'gray'
}) {
  const { t } = useTranslation()
  if (slices.length === 0) {
    return <p className="text-xs font-semibold text-ink-400">{t('analytics.empty.noData')}</p>
  }
  return (
    <ul className="space-y-2.5">
      {slices.map((s) => {
        const key = s.status ?? s.method ?? ''
        return (
          <li key={key} className="flex items-center gap-3">
            <span className="w-36 shrink-0">
              <StatusPill tone={tone(key)}>{labels[key] ?? key}</StatusPill>
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-50">
              <span className="block h-full bg-ink-300" style={{ width: `${Math.max(s.pct, 1.5)}%` }} />
            </span>
            <span className="ba-nums w-28 shrink-0 text-right text-xs font-bold text-ink-600">
              {fmtInt(s.orders)} · {fmtShare(s.pct)}
            </span>
            <span className="ba-nums hidden w-32 shrink-0 text-right text-xs font-black text-ink-900 sm:block">
              {fmtMoney(s.revenue)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Compact monthly list used in the category drill-down. */
function MonthlyList({ months }: { months: MonthPoint[] }) {
  const { t } = useTranslation()
  if (months.length === 0) return <p className="text-xs font-semibold text-ink-400">{t('analytics.empty.noSalesMonths')}</p>
  const max = Math.max(...months.map((m) => m.revenue), 1)
  return (
    <ul className="space-y-2">
      {months.map((m) => (
        <li key={`${m.year}-${m.month}`} className="flex items-center gap-3 text-xs font-bold">
          <span className="ba-nums w-16 shrink-0 text-ink-500">{fmtMonth(m.year, m.month)} {m.year}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-50">
            <span className="block h-full bg-gold-500" style={{ width: `${Math.max((m.revenue / max) * 100, 1.5)}%` }} />
          </span>
          <span className="ba-nums w-32 shrink-0 text-right text-ink-900">{fmtMoney(m.revenue)}</span>
        </li>
      ))}
    </ul>
  )
}

function ModalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-400">{title}</h3>
      {children}
    </section>
  )
}

function ModalLoading() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="ba-skeleton h-20 rounded-xl" />)}
      </div>
      <div className="ba-skeleton h-24 rounded-xl" />
      <div className="ba-skeleton h-40 rounded-xl" />
    </div>
  )
}

/** Footer shared by both drill-downs: close + jump to the orders screen. */
function DrillFooter({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={onClose} className="ba-press flex-1 rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-bold text-ink-600 shadow-elev-1 transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-gold-400 hover:text-gold-700">
        {t('adminShared.close')}
      </button>
      <button
        type="button"
        onClick={() => { onClose(); navigate('/admin/orders') }}
        className="ba-press ba-shine inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 bg-[length:200%_100%] px-5 py-2.5 text-sm font-bold text-ink-900 shadow-gold-md transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-[position:100%_0] hover:shadow-gold-lg"
      >
        {t('analytics.allOrders')} <ArrowRight size={15} />
      </button>
    </>
  )
}

// ── drill-down modals ──────────────────────────────────────────────────────

/** `GET /analytics/revenue/{year}/{month}` behind one bar of the chart. */
export function MonthDetailModal({
  year, month, onClose, onSelectCategory,
}: {
  year: number
  month: number
  onClose: () => void
  onSelectCategory?: (categoryId: number) => void
}) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'month', year, month],
    queryFn: () => analyticsApi.month(year, month),
  })
  const d: MonthDetail | undefined = data?.data?.data

  return (
    <Modal
      open
      onClose={onClose}
      title={d ? `${fmtMonth(d.year, d.month)} ${d.year}` : t('analytics.drill.monthTitle')}
      subtitle={d ? t('analytics.drill.revenueOrders', { revenue: fmtMoney(d.revenue), orders: fmtInt(d.orders) }) : t('common.loading')}
      maxWidth="max-w-3xl"
      footer={<DrillFooter onClose={onClose} />}
    >
      {isLoading ? <ModalLoading /> : isError || !d ? (
        <EmptyState Icon={BarChart3} title={t('analytics.drill.unavailable')} hint={t('analytics.drill.failed')} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label={t('analytics.metrics.revenue')} value={fmtMoney(d.revenue)} />
            <MiniStat label={t('analytics.metrics.orders')} value={fmtInt(d.orders)} />
            <MiniStat label={t('analytics.metrics.units')} value={fmtInt(d.units)} />
            <MiniStat label={t('analytics.metrics.averageBasket')} value={fmtMoney(d.averageBasket)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-ink-100 p-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">{t('analytics.drill.vsPreviousMonth')}</span>
              <p className="mt-1 flex items-baseline gap-2">
                <Delta value={d.momDeltaPct} />
                <span className="ba-nums text-xs font-semibold text-ink-400">{fmtMoney(d.previousMonthRevenue)}</span>
              </p>
            </div>
            <div className="rounded-xl border border-ink-100 p-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">{t('analytics.drill.vsSameMonth', { year: d.year - 1 })}</span>
              <p className="mt-1 flex items-baseline gap-2">
                <Delta value={d.yoyDeltaPct} />
                <span className="ba-nums text-xs font-semibold text-ink-400">{fmtMoney(d.previousYearRevenue)}</span>
              </p>
            </div>
            <div className="rounded-xl border border-ink-100 p-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">{t('analytics.metrics.activeCustomers')}</span>
              <p className="ba-nums mt-1 text-lg font-black text-ink-900">{fmtInt(d.activeCustomers)}</p>
            </div>
          </div>

          <ModalSection title={t('analytics.sections.dailyRevenue')}>
            <DayStrip days={d.daily} />
          </ModalSection>

          <ModalSection title={t('analytics.sections.topSales')}>
            <TopProductsTable products={d.topProducts} />
          </ModalSection>

          <ModalSection title={t('analytics.sections.categoryBreakdown')}>
            <CategoryDistribution
              categories={d.categories}
              onSelect={(id) => { if (onSelectCategory) { onClose(); onSelectCategory(id) } }}
            />
          </ModalSection>

          <ModalSection title={t('analytics.sections.orderStatuses')}>
            <SliceList slices={d.statuses} labels={STATUS_FR} tone={statusTone} />
          </ModalSection>

          <ModalSection title={t('analytics.sections.latestOrders')}>
            <OrdersTable orders={d.recentOrders} />
          </ModalSection>
        </div>
      )}
    </Modal>
  )
}

/** `GET /analytics/categories/{id}` behind one row of the distribution. */
export function CategoryDetailModal({
  categoryId, from, to, onClose,
}: {
  categoryId: number
  from: string
  to: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'category', categoryId, from, to],
    queryFn: () => analyticsApi.category(categoryId, { from, to }),
  })
  const d: CategoryDetail | undefined = data?.data?.data

  return (
    <Modal
      open
      onClose={onClose}
      title={d?.label ?? t('analytics.drill.categoryTitle')}
      subtitle={d ? t('analytics.drill.revenueShare', { revenue: fmtMoney(d.revenue), share: fmtShare(d.pct) }) : t('common.loading')}
      maxWidth="max-w-3xl"
      footer={<DrillFooter onClose={onClose} />}
    >
      {isLoading ? <ModalLoading /> : isError || !d ? (
        <EmptyState Icon={Boxes} title={t('analytics.drill.unavailable')} hint={t('analytics.drill.failed')} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MiniStat label={t('analytics.metrics.revenue')} value={fmtMoney(d.revenue)} />
            <MiniStat label={t('analytics.metrics.share')} value={fmtShare(d.pct)} />
            <MiniStat label={t('analytics.metrics.units')} value={fmtInt(d.units)} />
            <MiniStat label={t('analytics.metrics.orders')} value={fmtInt(d.orders)} />
            <MiniStat label={t('analytics.metrics.averagePrice')} value={fmtMoney(d.averageUnitPrice)} hint={t('analytics.metrics.perUnit')} />
            <MiniStat label={t('analytics.metrics.references')} value={fmtInt(d.productCount)} hint={t('analytics.metrics.inCatalog')} />
          </div>

          <ModalSection title={t('analytics.sections.monthlyTrend')}>
            <MonthlyList months={d.monthly} />
          </ModalSection>

          <ModalSection title={t('analytics.sections.categoryTopSales')}>
            <TopProductsTable products={d.topProducts} />
          </ModalSection>

          <ModalSection title={t('analytics.sections.categoryOrders')}>
            <OrdersTable orders={d.recentOrders} />
          </ModalSection>
        </div>
      )}
    </Modal>
  )
}

/**
 * Both drill-downs plus their `AnimatePresence` wrapper (`Modal` returns null
 * when closed, so it needs one). Keeps the wiring identical on every page that
 * hosts a revenue chart.
 */
export function AnalyticsDrilldowns({
  month, category, from, to, onCloseMonth, onCloseCategory, onSelectCategory,
}: {
  month: { year: number; month: number } | null
  category: number | null
  from: string
  to: string
  onCloseMonth: () => void
  onCloseCategory: () => void
  onSelectCategory?: (categoryId: number) => void
}) {
  return (
    <>
      <AnimatePresence>
        {month && (
          <MonthDetailModal
            year={month.year}
            month={month.month}
            onClose={onCloseMonth}
            onSelectCategory={onSelectCategory}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {category != null && (
          <CategoryDetailModal categoryId={category} from={from} to={to} onClose={onCloseCategory} />
        )}
      </AnimatePresence>
    </>
  )
}
