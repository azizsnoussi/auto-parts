/**
 * Analytics reports, driven entirely by `GET /api/analytics/overview`.
 *
 * This page used to be hardcoded: a fixed `M 20 80 Q 50 30…` sparkline, literal
 * `14.2k` / `28.6k` labels, a `Panier moyen 185.00 TND` tile and a four-row
 * category split that never changed. Everything now comes from one request, and
 * every tile, bar and row is a control that opens the matching drill-down
 * (`/analytics/revenue/{year}/{month}`, `/analytics/categories/{id}`).
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle, ArrowRight, BarChart3, Boxes, Calendar, DollarSign, Package,
  PackageX, ShoppingCart, TrendingUp, Users, Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../../lib/api'
import {
  CARD, EmptyState, FilterChip, PageHeader, RefreshButton, StatCard,
  DateRangeFilter, EMPTY_RANGE, isDateRangeActive, type DateRange,
} from './_ui'
import {
  AnalyticsDrilldowns, CategoryDistribution, Delta, OrdersTable, ProgressRing,
  RevenueBarChart, RevenueLegend, SliceList, TopProductsTable, statusTone,
} from './analytics-charts'
import {
  type Overview, type Pct,
  PAYMENT_FR, STATUS_FR,
  fmtDate, fmtInt, fmtMoney, fmtPct, fmtShare, toIsoDate, trailingRange, yearRange,
} from './analytics-types'

/** Selectable windows. `year` also pins the revenue chart to that calendar year. */
const PERIODS = [
  { key: '7',    labelKey: 'adminReports.periods.7' },
  { key: '30',   labelKey: 'adminReports.periods.30' },
  { key: '90',   labelKey: 'adminReports.periods.90' },
  { key: '365',  labelKey: 'adminReports.periods.365' },
  { key: 'year', labelKey: 'adminReports.periods.year' },
] as const

type PeriodKey = (typeof PERIODS)[number]['key']

/** Money tile. `StatCard` can't be used: its `value` must be a countable number. */
function MoneyCard({
  label, value, delta, deltaLabel, Icon, tint,
}: {
  label: string
  value: string
  delta?: Pct
  deltaLabel?: string
  Icon: React.ComponentType<{ size?: number | string }>
  tint: string
}) {
  return (
    <div className={`ba-lift flex items-center gap-4 p-5 ${CARD}`}>
      <div className={`shrink-0 rounded-xl p-3 ${tint}`}>
        <Icon size={24} />
      </div>
      <div className="min-w-0">
        <span className="text-[11px] font-black uppercase tracking-wider text-ink-400">{label}</span>
        <p className="ba-nums mt-1 truncate text-2xl font-black leading-tight text-ink-900">{value}</p>
        {delta !== undefined && <Delta value={delta} suffix={deltaLabel} />}
      </div>
    </div>
  )
}

/** Card header with an optional right-hand slot. */
function CardHead({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-ink-900">{title}</h2>
        {hint && <p className="text-xs font-medium text-ink-400">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

/** Stock health tile — links straight into the matching inventory filter. */
function StockTile({
  label, value, tone, Icon, to,
}: {
  label: string
  value: number
  tone: string
  Icon: React.ComponentType<{ size?: number | string }>
  to: string
}) {
  return (
    <Link to={to} className={`ba-lift ba-press flex items-center gap-3 p-4 ${CARD} hover:border-gold-300`}>
      <div className={`shrink-0 rounded-xl p-2.5 ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{label}</span>
        <p className="ba-nums text-xl font-black leading-tight text-ink-900">{fmtInt(value)}</p>
      </div>
      <ArrowRight size={15} className="shrink-0 text-ink-300" />
    </Link>
  )
}

export default function AdminReports() {
  const { t, i18n } = useTranslation()
  const currentYear = new Date().getFullYear()
  const [period, setPeriod] = useState<PeriodKey>('30')
  /**
   * Free window. The preset chips cover the usual questions, but "le mois de
   * ramadan" or "la semaine du salon" are not presets — an explicit range wins
   * over the selected chip whenever it is set.
   */
  const [customRange, setCustomRange] = useState<DateRange>(EMPTY_RANGE)
  const customActive = isDateRangeActive(customRange)

  /** The window sent to the API, plus the calendar year the chart is pinned to. */
  const { from, to, chartYear } = useMemo(() => {
    if (customActive) {
      // A half-open window is legitimate: "depuis le 1er mars" has no end date.
      const start = customRange.from || `${currentYear}-01-01`
      const end = customRange.to || toIsoDate(new Date())
      return { from: start, to: end, chartYear: Number(end.slice(0, 4)) || currentYear }
    }
    if (period === 'year') return { ...yearRange(currentYear), chartYear: currentYear }
    return { ...trailingRange(Number(period)), chartYear: currentYear }
  }, [period, currentYear, customActive, customRange.from, customRange.to])

  const [monthPick, setMonthPick] = useState<{ year: number; month: number } | null>(null)
  const [categoryPick, setCategoryPick] = useState<number | null>(null)

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['analytics', 'overview', from, to, chartYear],
    queryFn: () => analyticsApi.overview({ from, to, year: chartYear }),
  })

  const ov: Overview | undefined = data?.data?.data
  const k = ov?.kpis
  const periodLabel = customActive
    ? t('adminReports.customPeriod', { from: fmtDate(from), to: fmtDate(to) })
    : t(PERIODS.find((p) => p.key === period)?.labelKey ?? 'adminReports.periods.30')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminReports.title')}
        subtitle={
          ov
            ? t('adminReports.subtitleData', { count: fmtInt(ov.kpis.totalOrders), period: periodLabel.toLowerCase() })
            : t('adminReports.subtitle')
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <FilterChip
              key={p.key}
              active={!customActive && period === p.key}
              onClick={() => { setPeriod(p.key); setCustomRange(EMPTY_RANGE) }}
            >
              {t(p.labelKey)}
            </FilterChip>
          ))}
          {/* `presets={false}`: the chips above already are the presets. */}
          <DateRangeFilter value={customRange} onChange={setCustomRange} presets={false} />
          <RefreshButton onClick={() => refetch()} busy={isFetching} />
        </div>
      </PageHeader>

      {isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-black">{t('adminReports.error.title')}</p>
            <p className="mt-0.5 font-medium">
              {(error as Error)?.message ?? t('adminShared.unknownError')} {t('adminReports.error.backend')}{' '}
              <code className="rounded bg-white/60 px-1">/api/analytics</code>.
            </p>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {isLoading || !k ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className={`ba-skeleton h-[104px] ${CARD}`} />)
        ) : (
          <>
            <MoneyCard
              label={t('adminReports.metrics.revenue')} value={fmtMoney(k.totalRevenue)}
              delta={k.revenueDeltaPct} deltaLabel={t('adminReports.metrics.vsPrevious')}
              Icon={Wallet} tint="bg-gold-50 text-gold-600"
            />
            <MoneyCard
              label={t('adminReports.metrics.averageBasket')} value={fmtMoney(k.averageBasket)}
              delta={k.basketDeltaPct} deltaLabel={t('adminReports.metrics.paidOrders', { count: fmtInt(k.paidOrders) })}
              Icon={DollarSign} tint="bg-blue-50 text-blue-500"
            />
            <MoneyCard
              label={t('adminReports.metrics.orders')} value={fmtInt(k.totalOrders)}
              delta={k.ordersDeltaPct} deltaLabel={t('adminReports.metrics.pending', { count: fmtInt(k.pendingOrders) })}
              Icon={ShoppingCart} tint="bg-emerald-50 text-emerald-500"
            />
            <MoneyCard
              label={t('adminReports.metrics.activeCustomers')} value={fmtInt(k.activeCustomers)}
              delta={k.activeCustomersDeltaPct} deltaLabel={t('adminReports.metrics.newCustomers', { count: fmtInt(k.newCustomers) })}
              Icon={Users} tint="bg-indigo-50 text-indigo-500"
            />
          </>
        )}
      </div>

      {ov?.empty && (
        <div className={CARD}>
          <EmptyState
            Icon={BarChart3}
            title={t('adminReports.empty.title')}
            hint={t('adminReports.empty.hint', { from: fmtDate(from), to: fmtDate(to) })}
            action={
              <Link
                to="/admin/orders"
                className="ba-press ba-shine inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 bg-[length:200%_100%] px-5 py-2.5 text-sm font-bold text-ink-900 shadow-gold-md transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-[position:100%_0]"
              >
                {t('adminReports.empty.viewOrders')} <ArrowRight size={15} />
              </Link>
            }
          />
        </div>
      )}

      {/* Revenue chart + category split */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className={`space-y-4 p-6 xl:col-span-3 ${CARD}`}>
          <CardHead
            title={t('adminReports.sections.monthlySales')}
            hint={
              ov
                ? t('adminReports.sections.monthlySalesHint', { current: ov.revenue.currentYear, previous: ov.revenue.previousYear })
                : t('common.loading')
            }
          >
            <div className="flex items-center gap-3">
              <RevenueLegend series={ov?.revenue} />
              <Calendar size={18} className="text-ink-300" />
            </div>
          </CardHead>

          <RevenueBarChart
            series={ov?.revenue}
            loading={isLoading}
            onSelectMonth={(y, m) => setMonthPick({ year: y, month: m })}
          />

          {ov && (
            <div className="grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-4">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminReports.revenue.total', { year: ov.revenue.currentYear })}</span>
                <p className="ba-nums text-sm font-black text-ink-900">{fmtMoney(ov.revenue.currentTotal)}</p>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminReports.revenue.growth')}</span>
                <Delta value={ov.revenue.growthPct} />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminReports.revenue.monthlyAverage')}</span>
                <p className="ba-nums text-sm font-black text-ink-900">{fmtMoney(ov.revenue.monthlyAverage)}</p>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminReports.revenue.annualProjection')}</span>
                <p className="ba-nums text-sm font-black text-gold-700">{fmtMoney(ov.revenue.projectedTotal)}</p>
              </div>
            </div>
          )}
        </div>

        <div className={`space-y-5 p-6 xl:col-span-2 ${CARD}`}>
          <CardHead title={t('adminReports.sections.categoryDistribution')} hint={t('adminReports.sections.categoryHint')} />
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="ba-skeleton h-12 rounded-xl" />)}
            </div>
          ) : (
            <CategoryDistribution categories={ov?.categories ?? []} onSelect={setCategoryPick} />
          )}
        </div>
      </div>

      {/* Operational quality */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={`p-6 ${CARD}`}>
          <CardHead title={t('adminReports.sections.deliveryRate')} hint={t('adminReports.sections.deliveryHint')} />
          {isLoading || !k ? <div className="ba-skeleton mx-auto my-6 h-40 w-40 rounded-full" /> : (
            <>
              <ProgressRing
                pct={k.fulfillmentRate}
                headline={fmtPct(k.fulfillmentRate).replace('+', '')}
                caption={t('adminReports.labels.delivered')}
              />
              <dl className="space-y-2 border-t border-ink-100 pt-4 text-xs font-bold">
                <div className="flex justify-between"><dt className="text-ink-400">{t('adminReports.labels.delivered')}</dt><dd className="ba-nums text-emerald-600">{fmtInt(k.deliveredOrders)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">{t('adminReports.labels.pending')}</dt><dd className="ba-nums text-amber-600">{fmtInt(k.pendingOrders)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">{t('adminReports.labels.cancelled')}</dt><dd className="ba-nums text-red-500">{fmtInt(k.cancelledOrders)} ({fmtPct(k.cancellationRate).replace('+', '')})</dd></div>
              </dl>
            </>
          )}
        </div>

        <div className={`p-6 ${CARD}`}>
          <CardHead title={t('adminReports.sections.retention')} hint={t('adminReports.sections.retentionHint')} />
          {isLoading || !k ? <div className="ba-skeleton mx-auto my-6 h-40 w-40 rounded-full" /> : (
            <>
              <ProgressRing
                pct={k.repeatRate}
                headline={fmtPct(k.repeatRate).replace('+', '')}
                caption={t('adminReports.labels.repeat')}
              />
              <dl className="space-y-2 border-t border-ink-100 pt-4 text-xs font-bold">
                <div className="flex justify-between"><dt className="text-ink-400">{t('adminReports.labels.repeatCustomers')}</dt><dd className="ba-nums text-ink-900">{fmtInt(k.repeatCustomers)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">{t('adminReports.labels.totalBase')}</dt><dd className="ba-nums text-ink-900">{fmtInt(k.totalCustomers)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">{t('adminReports.labels.activationRate')}</dt><dd className="ba-nums text-ink-900">{fmtShare(k.activationRate ?? 0)}</dd></div>
              </dl>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className={`space-y-4 p-6 ${CARD}`}>
            <CardHead title={t('adminReports.sections.volume')} hint={t('adminReports.sections.overPeriod', { period: periodLabel.toLowerCase() })} />
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
              <StatCard label={t('adminReports.labels.unitsSold')} value={k?.unitsSold ?? 0} Icon={Package} loading={isLoading} />
              <StatCard label={t('adminReports.labels.newCustomers')} value={k?.newCustomers ?? 0} Icon={Users} color="bg-indigo-500" loading={isLoading} delay={60} />
            </div>
            {k && (
              <p className="text-xs font-semibold text-ink-400">
                {t('adminReports.labels.itemsPerOrder', { count: k.averageItemsPerOrder?.toFixed(2) ?? '—' })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StockTile label={t('adminReports.labels.activeProducts')} value={ov?.activeProducts ?? 0} tone="bg-emerald-50 text-emerald-500" Icon={Boxes} to="/admin/products" />
            <StockTile label={t('adminReports.labels.lowStock')} value={ov?.lowStockProducts ?? 0} tone="bg-amber-50 text-amber-500" Icon={TrendingUp} to="/admin/inventory" />
            <StockTile label={t('adminReports.labels.outOfStock')} value={ov?.outOfStockProducts ?? 0} tone="bg-red-50 text-red-500" Icon={PackageX} to="/admin/inventory" />
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={`space-y-4 p-6 ${CARD}`}>
          <CardHead title={t('adminReports.sections.orderStatuses')} hint={t('adminReports.sections.breakdownHint')} />
          {isLoading ? <div className="ba-skeleton h-32 rounded-xl" /> : (
            <SliceList slices={ov?.statuses ?? []} labels={STATUS_FR} tone={statusTone} />
          )}
        </div>
        <div className={`space-y-4 p-6 ${CARD}`}>
          <CardHead title={t('adminReports.sections.paymentMethods')} hint={t('adminReports.sections.breakdownHint')} />
          {isLoading ? <div className="ba-skeleton h-32 rounded-xl" /> : (
            <SliceList slices={ov?.payments ?? []} labels={PAYMENT_FR} tone={() => 'gray'} />
          )}
        </div>
      </div>

      {/* Top products */}
      <div className={`overflow-hidden ${CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <CardHead title={t('adminReports.sections.topSales')} hint={t('adminReports.sections.topSalesHint')} />
          <Link to="/admin/products" className="ba-press inline-flex items-center gap-1.5 text-sm font-bold text-gold-700 transition-colors hover:text-gold-800">
            {t('adminReports.links.catalog')} <ArrowRight size={14} />
          </Link>
        </div>
        {isLoading ? <div className="ba-skeleton m-6 h-48 rounded-xl" /> : <TopProductsTable products={ov?.topProducts ?? []} />}
      </div>

      {/* Top customers */}
      <div className={`overflow-hidden ${CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <CardHead title={t('adminReports.sections.topCustomers')} hint={t('adminReports.sections.topCustomersHint')} />
          <Link to="/admin/clients" className="ba-press inline-flex items-center gap-1.5 text-sm font-bold text-gold-700 transition-colors hover:text-gold-800">
            {t('adminReports.links.allCustomers')} <ArrowRight size={14} />
          </Link>
        </div>
        {isLoading ? (
          <div className="ba-skeleton m-6 h-40 rounded-xl" />
        ) : (ov?.topCustomers.length ?? 0) === 0 ? (
          <EmptyState Icon={Users} title={t('adminReports.empty.noActiveCustomer')} hint={t('adminReports.empty.noCustomerOrders')} />
        ) : (
          <div className="divide-y divide-ink-100">
            {ov!.topCustomers.map((c, i) => (
              <div key={c.customerId} className="flex items-center gap-4 px-6 py-3.5">
                <span className="ba-nums flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-50 text-xs font-black text-gold-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{c.name ?? '—'}</p>
                  <p className="truncate text-[11px] font-medium text-ink-400">{c.email ?? ''}</p>
                </div>
                <span className="ba-nums hidden shrink-0 text-xs font-bold text-ink-500 sm:block">{t('adminReports.labels.orderShort', { count: fmtInt(c.orders) })}</span>
                <span className="ba-nums shrink-0 text-sm font-black text-ink-900">{fmtMoney(c.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent orders in the window */}
      <div className={`overflow-hidden ${CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <CardHead title={t('adminReports.sections.periodOrders')} hint={t('adminReports.sections.periodDates', { from: fmtDate(from), to: fmtDate(to) })} />
          <Link to="/admin/orders" className="ba-press inline-flex items-center gap-1.5 text-sm font-bold text-gold-700 transition-colors hover:text-gold-800">
            {t('adminReports.links.allOrders')} <ArrowRight size={14} />
          </Link>
        </div>
        {isLoading ? <div className="ba-skeleton m-6 h-40 rounded-xl" /> : <PeriodOrders from={from} to={to} />}
      </div>

      {ov && (
        <p className="text-center text-[11px] font-medium text-ink-300">
          {t('adminReports.generated', { date: new Date(ov.generatedAt).toLocaleString(i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN') })}
        </p>
      )}

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

/** Order feed for the selected window — its own query so it can be cached separately. */
function PeriodOrders({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'orders', from, to],
    queryFn: () => analyticsApi.orders({ from, to, limit: 15 }),
  })
  if (isLoading) return <div className="ba-skeleton m-6 h-40 rounded-xl" />
  return <OrdersTable orders={data?.data?.data ?? []} />
}
