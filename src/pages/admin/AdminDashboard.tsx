/**
 * Admin dashboard.
 *
 * The KPI row and the recent-order feed come from `GET /api/analytics/kpis` and
 * `GET /api/analytics/orders`; the chart comes from `GET /api/analytics/revenue`.
 *
 * What used to be fake and is now real:
 * - the "Prévisions de revenus" chart (10 inline months, fixed `70k/50k/30k/10k`
 *   gridlines and a hardcoded `2025 / 2024` legend) is 12 real months with the
 *   axis and legend derived from the payload, and every bar opens the month
 *   drill-down;
 * - the performance ring's constant `strokeDashoffset="110"` is the real
 *   fulfilment rate;
 * - the `+5.1%` / `+12%` deltas are `revenueDeltaPct` / `activeCustomersDeltaPct`
 *   and render `—` when there is no comparison base;
 * - "Voir tout →" navigates to `/admin/orders` instead of re-running the fetch.
 *
 * It no longer calls `getAdminStats()`, which fabricated totals by reducing only
 * the first 200 orders client-side.
 */
import { useState, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, Package, RotateCcw, ShoppingCart,
  TrendingDown, TrendingUp, Users, Wallet,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useReveal } from '../../hooks/useAnimations'
import { analyticsApi, erpAnalyticsApi } from '../../lib/api'
import {
  CARD, RefreshButton, StatusPill, TABLE_MIN,
  DateRangeFilter, isDateRangeActive, type DateRange,
} from './_ui'
import {
  AnalyticsDrilldowns, Delta, ProgressRing, RevenueBarChart, RevenueLegend,
  statusTone,
} from './analytics-charts'
import { ErpKpiStrip } from './erp-analytics'
import {
  type ErpOverview,
  type KpiSummary, type OrderBrief, type Pct, type RevenueSeries,
  STATUS_FR, fmtDate, fmtInt, fmtMoney, fmtPct, toIsoDate, trailingRange,
} from './analytics-types'

/** Trailing 30 days, matching the backend's own default window. */
const WINDOW_DAYS = 30

/**
 * One KPI tile. Module scope because `useReveal` is a hook and cannot be called
 * from inside the `.map` that renders the grid.
 */
function KpiCard({
  title, value, delta, deltaInvert, Icon, color, delay, loading,
}: {
  title: string
  value: string
  delta?: Pct
  deltaInvert?: boolean
  Icon: ComponentType<{ size?: number | string }>
  color: string
  delay: number
  loading?: boolean
}) {
  const ref = useReveal<HTMLDivElement>({ delay })
  return (
    <div
      ref={ref}
      className="ba-reveal ba-lift group flex flex-col justify-between rounded-2xl border border-ink-100 bg-white p-5 shadow-elev-1 transition-colors hover:border-gold-300"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase leading-tight tracking-wider text-ink-400">
          {title}
        </span>
        <div className={`rounded-xl p-2 text-white shadow-elev-1 transition-transform duration-300 ease-out-back group-hover:scale-110 group-hover:-rotate-6 ${color}`}>
          <Icon size={17} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        {loading ? (
          <div className="ba-skeleton h-7 w-20 rounded" />
        ) : (
          <span className="ba-nums truncate text-2xl font-black text-ink-900">{value}</span>
        )}
        {!loading && delta !== undefined && <Delta value={delta} invert={deltaInvert} />}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  /**
   * Analytics window. Starts on the trailing 30 days and follows the picker;
   * clearing the dates returns to that default rather than leaving the KPIs
   * without a window.
   */
  const [range, setRange] = useState<DateRange>(() => trailingRange(WINDOW_DAYS))
  const from = range.from || `${currentYear}-01-01`
  const to = range.to || toIsoDate(new Date())
  const dayCount = Math.max(
    1,
    Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1,
  )

  const [monthPick, setMonthPick] = useState<{ year: number; month: number } | null>(null)
  const [categoryPick, setCategoryPick] = useState<number | null>(null)

  const kpiQuery = useQuery({
    queryKey: ['analytics', 'kpis', from, to],
    queryFn: () => analyticsApi.kpis({ from, to }),
  })
  const revenueQuery = useQuery({
    queryKey: ['analytics', 'revenue', currentYear],
    queryFn: () => analyticsApi.revenue(currentYear),
  })
  const ordersQuery = useQuery({
    queryKey: ['analytics', 'orders', from, to, 8],
    queryFn: () => analyticsApi.orders({ from, to, limit: 8 }),
  })
  const erpQuery = useQuery({
    queryKey: ['analytics', 'erp', 'overview', from, to],
    queryFn: () => erpAnalyticsApi.overview({ from, to }),
  })

  const k: KpiSummary | undefined = kpiQuery.data?.data?.data
  const series: RevenueSeries | undefined = revenueQuery.data?.data?.data
  const orders: OrderBrief[] = ordersQuery.data?.data?.data ?? []
  const erp: ErpOverview | undefined = erpQuery.data?.data?.data

  const busy = kpiQuery.isFetching || revenueQuery.isFetching || ordersQuery.isFetching || erpQuery.isFetching
  const refreshAll = () => {
    kpiQuery.refetch()
    revenueQuery.refetch()
    ordersQuery.refetch()
    erpQuery.refetch()
  }

  const failed = kpiQuery.isError || revenueQuery.isError || ordersQuery.isError
  const failure = (kpiQuery.error ?? revenueQuery.error ?? ordersQuery.error) as Error | null

  const kpis = [
    {
      title: t('adminDashboard.kpis.totalOrders'),
      value: fmtInt(k?.totalOrders),
      delta: k?.ordersDeltaPct,
      icon: Package, color: 'bg-blue-500',
    },
    {
      title: t('adminDashboard.kpis.pending'),
      value: fmtInt(k?.pendingOrders),
      icon: RotateCcw, color: 'bg-amber-500',
    },
    {
      title: t('adminDashboard.kpis.revenueDays', { count: dayCount }),
      value: fmtMoney(k?.totalRevenue),
      delta: k?.revenueDeltaPct,
      icon: Wallet, color: 'bg-gold-500',
    },
    {
      title: t('adminDashboard.kpis.cancelled'),
      value: fmtInt(k?.cancelledOrders),
      delta: k?.cancellationRate, deltaInvert: true,
      icon: TrendingDown, color: 'bg-rose-500',
    },
    {
      title: t('adminDashboard.kpis.activeCustomers'),
      value: fmtInt(k?.activeCustomers),
      delta: k?.activeCustomersDeltaPct,
      icon: Users, color: 'bg-emerald-500',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{t('adminDashboard.title')}</h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 text-sm font-medium text-ink-400">
            {t('adminDashboard.greeting', { name: user?.firstName ?? 'Admin', from: fmtDate(from), to: fmtDate(to) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            value={range}
            onChange={(next) => setRange(isDateRangeActive(next) ? next : trailingRange(WINDOW_DAYS))}
          />
          <Link
            to="/admin/reports"
            className="ba-press inline-flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-bold text-ink-600 shadow-elev-1 transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-gold-400 hover:text-gold-700 hover:shadow-gold-sm"
          >
            <TrendingUp size={15} /> {t('adminDashboard.detailedReports')}
          </Link>
          <RefreshButton onClick={refreshAll} busy={busy} />
        </div>
      </div>

      {failed && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-black">{t('adminDashboard.error.title')}</p>
            <p className="mt-0.5 font-medium">
              {failure?.message ?? t('adminShared.unknownError')} {t('adminDashboard.error.backend')}{' '}
              <code className="rounded bg-white/60 px-1">/api/analytics</code>.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi, idx) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            delta={kpi.delta}
            deltaInvert={kpi.deltaInvert}
            Icon={kpi.icon}
            color={kpi.color}
            delay={idx * 70}
            loading={kpiQuery.isLoading}
          />
        ))}
      </div>

      {/* ERP module KPIs — treasury, payments, purchasing, tax, payroll */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-1 w-10 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <h2 className="text-lg font-black text-ink-900">{t('adminDashboard.erp.title')}</h2>
          <p className="hidden text-xs font-medium text-ink-400 sm:block">{t('adminDashboard.erp.hint')}</p>
        </div>
        <ErpKpiStrip ov={erp} loading={erpQuery.isLoading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue bar chart */}
        <div className={`p-6 lg:col-span-2 ${CARD}`}>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-ink-900">{t('adminDashboard.revenue.title')}</h2>
              <p className="mt-0.5 text-xs font-medium text-ink-400">
                {t('adminDashboard.revenue.hint')}
              </p>
            </div>
            <RevenueLegend series={series} />
          </div>

          <RevenueBarChart
            series={series}
            loading={revenueQuery.isLoading}
            onSelectMonth={(y, m) => setMonthPick({ year: y, month: m })}
          />

          {series && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-4">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminDashboard.revenue.total', { year: series.currentYear })}</span>
                <p className="ba-nums text-sm font-black text-ink-900">{fmtMoney(series.currentTotal)}</p>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminDashboard.revenue.vs', { year: series.previousYear })}</span>
                <Delta value={series.growthPct} />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminDashboard.revenue.monthlyAverage')}</span>
                <p className="ba-nums text-sm font-black text-ink-900">{fmtMoney(series.monthlyAverage)}</p>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminDashboard.revenue.projection', { year: series.currentYear })}</span>
                <p className="ba-nums text-sm font-black text-gold-700">{fmtMoney(series.projectedTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Performance ring */}
        <div className={`flex flex-col justify-between p-6 ${CARD}`}>
          <div>
            <h2 className="text-lg font-black text-ink-900">{t('adminDashboard.performance.title')}</h2>
            <p className="mt-0.5 text-xs font-medium text-ink-400">{t('adminDashboard.performance.hint', { count: WINDOW_DAYS })}</p>
          </div>

          {kpiQuery.isLoading || !k ? (
            <div className="ba-skeleton mx-auto my-6 h-40 w-40 rounded-full" />
          ) : (
            <ProgressRing
              pct={k.fulfillmentRate}
              headline={fmtPct(k.fulfillmentRate).replace('+', '')}
              caption={t('adminDashboard.performance.delivered')}
            />
          )}

          <dl className="space-y-2 text-xs font-bold">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-ink-500">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {t('adminDashboard.performance.delivered')}
              </dt>
              <dd className="ba-nums text-ink-900">{kpiQuery.isLoading ? '…' : fmtInt(k?.deliveredOrders)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-ink-500">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {t('adminDashboard.performance.pending')}
              </dt>
              <dd className="ba-nums text-ink-900">{kpiQuery.isLoading ? '…' : fmtInt(k?.pendingOrders)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-ink-500">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> {t('adminDashboard.performance.cancelled')}
              </dt>
              <dd className="ba-nums text-ink-900">{kpiQuery.isLoading ? '…' : fmtInt(k?.cancelledOrders)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-2">
              <dt className="flex items-center gap-2 text-ink-500">
                <span className="h-2.5 w-2.5 rounded-full bg-gold-500" /> {t('adminDashboard.performance.averageBasket')}
              </dt>
              <dd className="ba-nums text-ink-900">{kpiQuery.isLoading ? '…' : fmtMoney(k?.averageBasket)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Recent orders */}
      <div className={`overflow-hidden ${CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-6">
          <div className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-50 text-gold-600 transition-transform duration-300 ease-out-back group-hover:scale-110">
              <ShoppingCart size={17} />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink-900">{t('adminDashboard.recent.title')}</h2>
              <p className="text-xs font-medium text-ink-400">{t('adminDashboard.recent.subtitle', { count: 8 })}</p>
            </div>
          </div>
          <Link
            to="/admin/orders"
            className="ba-press inline-flex items-center gap-1.5 text-xs font-bold text-gold-600 transition-colors hover:text-gold-700"
          >
            {t('adminDashboard.recent.viewAll')} <ArrowRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-left text-sm ${TABLE_MIN}`}>
            <thead>
              <tr className="border-b border-ink-100 bg-gray-50 text-[11px] font-black uppercase tracking-wider text-ink-400">
                <th className="px-6 py-4">{t('adminOrders.columns.number')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.customer')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.date')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.status')}</th>
                <th className="px-6 py-4 text-right">{t('adminOrders.columns.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-semibold">
              {ordersQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-6 py-3.5">
                      <div className="ba-skeleton h-5 rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <ShoppingCart size={38} className="mx-auto mb-3 animate-bob text-ink-200" />
                    <p className="text-sm font-semibold text-ink-400">{t('adminDashboard.recent.empty')}</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="transition-colors duration-200 hover:bg-gold-50/40">
                    <td className="ba-nums px-6 py-4 font-mono text-xs font-extrabold text-ink-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-ink-900">{order.customerName ?? '—'}</p>
                      <p className="text-xs font-medium text-ink-400">{order.customerEmail ?? ''}</p>
                    </td>
                    <td className="ba-nums px-6 py-4 text-xs font-medium text-ink-500">{fmtDate(order.createdAt)}</td>
                    <td className="px-6 py-4">
                      <StatusPill tone={statusTone(order.status)}>
                        {STATUS_FR[order.status ?? ''] ?? order.status ?? '—'}
                      </StatusPill>
                    </td>
                    <td className="ba-nums px-6 py-4 text-right font-black text-ink-900">{fmtMoney(order.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnalyticsDrilldowns
        month={monthPick}
        category={categoryPick}
        from={from}
        to={to}
        onCloseMonth={() => setMonthPick(null)}
        onCloseCategory={() => setCategoryPick(null)}
        onSelectCategory={setCategoryPick}
      />
    </div>
  )
}
