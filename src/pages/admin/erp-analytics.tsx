/**
 * ERP back-office analytics sections, shared by `AdminDashboard` and
 * `AdminReports`.
 *
 * Where `analytics-charts.tsx` renders the e-commerce funnel (orders, products,
 * customers) from `GET /api/analytics/*`, this file renders the ERP modules the
 * dashboard and reports pages were previously blind to — règlements, achats,
 * livraisons, fiscalité, trésorerie and RH — from `GET /api/analytics/erp/*`.
 *
 * Two entry points:
 * - {@link ErpKpiStrip} — a compact KPI row for the dashboard.
 * - {@link ErpModulesSection} — the full set of module cards for the reports page.
 *
 * Both take an already-fetched {@link ErpOverview}; the page owns the query so it
 * can share the date window with the rest of its analytics.
 */
import { type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Banknote, ClipboardList, Landmark, Receipt, Truck,
  Users2, Wallet,
} from 'lucide-react'
import { CARD, StatusPill } from './_ui'
import {
  type ErpOverview, type ErpSlice,
  fmtInt, fmtMoney, fmtShare,
} from './analytics-types'

// ── shared bits ──────────────────────────────────────────────────────────────

/** Tone for an ERP status/type key, reused across every module breakdown. */
export function erpTone(key: string): 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'gray' {
  switch (key) {
    case 'cleared':
    case 'received':
    case 'delivered':
    case 'paid':
    case 'cashed':
      return 'green'
    case 'pending':
    case 'preparing':
    case 'draft':
    case 'to_file':
    case 'portfolio':
    case 'sent':
    case 'confirmed':
    case 'partial':
      return 'amber'
    case 'bounced':
    case 'overdue':
    case 'cancelled':
    case 'returned':
      return 'red'
    case 'in':
      return 'green'
    case 'out':
      return 'blue'
    default:
      return 'gray'
  }
}

/** A compact ERP KPI tile for the dashboard strip. */
function ErpKpi({
  title, value, sub, Icon, color, to,
}: {
  title: string
  value: string
  sub?: string
  Icon: ComponentType<{ size?: number | string }>
  color: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="ba-lift ba-press group flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-elev-1 transition-colors hover:border-gold-300"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-elev-1 transition-transform duration-300 ease-out-back group-hover:scale-110 group-hover:-rotate-6 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-black uppercase tracking-wider text-ink-400">{title}</span>
        <p className="ba-nums truncate text-lg font-black leading-tight text-ink-900">{value}</p>
        {sub && <p className="truncate text-[11px] font-semibold text-ink-400">{sub}</p>}
      </div>
      <ArrowRight size={15} className="shrink-0 text-ink-300 transition-transform duration-300 group-hover:translate-x-0.5" />
    </Link>
  )
}

/**
 * Compact list of ERP slices (status/method/type/contract). Amount-less groups
 * (delivery notes, HR contracts) render count only.
 */
function ErpSliceList({
  slices, labels, showAmount = true,
}: {
  slices: ErpSlice[]
  labels: (key: string) => string
  showAmount?: boolean
}) {
  const { t } = useTranslation()
  if (!slices.length) {
    return <p className="text-xs font-semibold text-ink-400">{t('analytics.empty.noData')}</p>
  }
  return (
    <ul className="space-y-2.5">
      {slices.map((s) => (
        <li key={s.key} className="flex items-center gap-3">
          <span className="w-32 shrink-0">
            <StatusPill tone={erpTone(s.key)}>{labels(s.key)}</StatusPill>
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-50">
            <span className="block h-full bg-ink-300" style={{ width: `${Math.max(s.pct, 1.5)}%` }} />
          </span>
          <span className="ba-nums w-24 shrink-0 text-right text-xs font-bold text-ink-600">
            {fmtInt(s.count)}{showAmount ? ` · ${fmtShare(s.pct)}` : ''}
          </span>
          {showAmount && (
            <span className="ba-nums hidden w-32 shrink-0 text-right text-xs font-black text-ink-900 sm:block">
              {fmtMoney(s.amount)}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Card header used by the module cards. */
function ModuleHead({
  title, hint, to, linkLabel, Icon,
}: {
  title: string
  hint?: string
  to: string
  linkLabel: string
  Icon: ComponentType<{ size?: number | string }>
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
          <Icon size={17} />
        </div>
        <div>
          <h3 className="text-base font-black text-ink-900">{title}</h3>
          {hint && <p className="text-[11px] font-medium text-ink-400">{hint}</p>}
        </div>
      </div>
      <Link
        to={to}
        className="ba-press inline-flex items-center gap-1.5 text-xs font-bold text-gold-700 transition-colors hover:text-gold-800"
      >
        {linkLabel} <ArrowRight size={13} />
      </Link>
    </div>
  )
}

/** A `label / value` figure inside a module card. */
function Figure({ label, value, tone = 'text-ink-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <span className="block text-[10px] font-black uppercase tracking-wider text-ink-400">{label}</span>
      <p className={`ba-nums text-sm font-black ${tone}`}>{value}</p>
    </div>
  )
}

// ── dashboard KPI strip ──────────────────────────────────────────────────────

/**
 * A one-glance ERP row for the dashboard: net treasury, receivables/payables,
 * open purchase orders, tax owed and payroll. Each tile links to its module.
 */
export function ErpKpiStrip({ ov, loading }: { ov?: ErpOverview; loading?: boolean }) {
  const { t } = useTranslation()

  if (loading || !ov) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ba-skeleton h-[76px] rounded-2xl" />)}
      </div>
    )
  }

  const tiles = [
    {
      title: t('adminDashboard.erp.treasury'),
      value: fmtMoney(ov.treasury.totalBalance),
      sub: t('adminDashboard.erp.accountsCount', { count: ov.treasury.accounts }),
      Icon: Landmark, color: 'bg-teal-500', to: '/admin/treasury',
    },
    {
      title: t('adminDashboard.erp.receivable'),
      value: fmtMoney(ov.payments.inflow),
      sub: t('adminDashboard.erp.pendingAmount', { amount: fmtMoney(ov.payments.pending) }),
      Icon: Banknote, color: 'bg-emerald-500', to: '/admin/payments',
    },
    {
      title: t('adminDashboard.erp.payable'),
      value: fmtMoney(ov.payments.outflow),
      sub: t('adminDashboard.erp.netAmount', { amount: fmtMoney(ov.payments.net) }),
      Icon: Wallet, color: 'bg-blue-500', to: '/admin/payments',
    },
    {
      title: t('adminDashboard.erp.openPurchase'),
      value: fmtMoney(ov.purchasing.openValue),
      sub: t('adminDashboard.erp.openCount', { count: ov.purchasing.open }),
      Icon: ClipboardList, color: 'bg-indigo-500', to: '/admin/purchase-orders',
    },
    {
      title: t('adminDashboard.erp.taxDue'),
      value: fmtMoney(ov.tax.totalDue),
      sub: t('adminDashboard.erp.overdueCount', { count: ov.tax.overdueCount }),
      Icon: Receipt, color: ov.tax.overdueCount > 0 ? 'bg-rose-500' : 'bg-amber-500', to: '/admin/tax',
    },
    {
      title: t('adminDashboard.erp.payroll'),
      value: fmtMoney(ov.hr.monthlyPayroll),
      sub: t('adminDashboard.erp.headcount', { count: ov.hr.activeHeadcount }),
      Icon: Users2, color: 'bg-gold-500', to: '/admin/hr',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <ErpKpi key={tile.title} {...tile} />
      ))}
    </div>
  )
}

// ── reports module section ─────────────────────────────────────────────────

/**
 * The full ERP module breakdown for the reports page: one card per module with
 * headline figures and a status/type distribution.
 */
export function ErpModulesSection({ ov, loading }: { ov?: ErpOverview; loading?: boolean }) {
  const { t } = useTranslation()

  const payLabel = (k: string) => t(`adminReports.erp.payStatus.${k}`, k)
  const methodLabel = (k: string) => t(`adminReports.erp.method.${k}`, k)
  const poLabel = (k: string) => t(`adminReports.erp.poStatus.${k}`, k)
  const dnLabel = (k: string) => t(`adminReports.erp.dnStatus.${k}`, k)
  const taxTypeLabel = (k: string) => t(`adminReports.erp.taxType.${k}`, k)
  const contractLabel = (k: string) => t(`adminReports.erp.contract.${k}`, k)

  if (loading || !ov) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`ba-skeleton h-64 ${CARD}`} />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-1 w-10 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
        <h2 className="text-lg font-black text-ink-900">{t('adminReports.erp.title')}</h2>
        <p className="hidden text-xs font-medium text-ink-400 sm:block">{t('adminReports.erp.hint')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Règlements */}
        <div className={`space-y-4 p-6 ${CARD}`}>
          <ModuleHead
            title={t('adminReports.erp.payments')}
            hint={t('adminReports.erp.paymentsHint')}
            to="/admin/payments" linkLabel={t('adminReports.erp.open')} Icon={Banknote}
          />
          <div className="grid grid-cols-2 gap-3 border-y border-ink-100 py-4 sm:grid-cols-4">
            <Figure label={t('adminReports.erp.inflow')} value={fmtMoney(ov.payments.inflow)} tone="text-emerald-600" />
            <Figure label={t('adminReports.erp.outflow')} value={fmtMoney(ov.payments.outflow)} tone="text-rose-500" />
            <Figure label={t('adminReports.erp.net')} value={fmtMoney(ov.payments.net)} tone="text-gold-700" />
            <Figure label={t('adminReports.erp.pending')} value={fmtMoney(ov.payments.pending)} tone="text-amber-600" />
          </div>
          <ErpSliceList slices={ov.payments.byStatus} labels={payLabel} />
          <div className="border-t border-ink-100 pt-4">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-400">{t('adminReports.erp.byMethod')}</span>
            <ErpSliceList slices={ov.payments.byMethod} labels={methodLabel} />
          </div>
        </div>

        {/* Trésorerie */}
        <div className={`space-y-4 p-6 ${CARD}`}>
          <ModuleHead
            title={t('adminReports.erp.treasury')}
            hint={t('adminReports.erp.treasuryHint')}
            to="/admin/treasury" linkLabel={t('adminReports.erp.open')} Icon={Landmark}
          />
          <div className="grid grid-cols-2 gap-3 border-y border-ink-100 py-4 sm:grid-cols-4">
            <Figure label={t('adminReports.erp.totalBalance')} value={fmtMoney(ov.treasury.totalBalance)} tone="text-gold-700" />
            <Figure label={t('adminReports.erp.cash')} value={fmtMoney(ov.treasury.cashBalance)} />
            <Figure label={t('adminReports.erp.bank')} value={fmtMoney(ov.treasury.bankBalance)} />
            <Figure label={t('adminReports.erp.portfolio')} value={fmtMoney(ov.treasury.instrumentsPortfolioValue)} tone="text-amber-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Figure label={t('adminReports.erp.movementsIn')} value={fmtMoney(ov.treasury.movementsIn)} tone="text-emerald-600" />
            <Figure label={t('adminReports.erp.movementsOut')} value={fmtMoney(ov.treasury.movementsOut)} tone="text-rose-500" />
          </div>
          <div className="border-t border-ink-100 pt-4">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-400">{t('adminReports.erp.accountBalances')}</span>
            <ErpSliceList slices={ov.treasury.accountBalances} labels={(k) => k} />
          </div>
        </div>

        {/* Achats */}
        <div className={`space-y-4 p-6 ${CARD}`}>
          <ModuleHead
            title={t('adminReports.erp.purchasing')}
            hint={t('adminReports.erp.purchasingHint')}
            to="/admin/purchase-orders" linkLabel={t('adminReports.erp.open')} Icon={ClipboardList}
          />
          <div className="grid grid-cols-2 gap-3 border-y border-ink-100 py-4 sm:grid-cols-4">
            <Figure label={t('adminReports.erp.poTotal')} value={fmtInt(ov.purchasing.total)} />
            <Figure label={t('adminReports.erp.poValue')} value={fmtMoney(ov.purchasing.totalHT)} tone="text-gold-700" />
            <Figure label={t('adminReports.erp.poOpen')} value={fmtInt(ov.purchasing.open)} tone="text-amber-600" />
            <Figure label={t('adminReports.erp.poReceived')} value={fmtInt(ov.purchasing.received)} tone="text-emerald-600" />
          </div>
          <ErpSliceList slices={ov.purchasing.byStatus} labels={poLabel} />
        </div>

        {/* Livraisons */}
        <div className={`space-y-4 p-6 ${CARD}`}>
          <ModuleHead
            title={t('adminReports.erp.delivery')}
            hint={t('adminReports.erp.deliveryHint')}
            to="/admin/delivery-notes" linkLabel={t('adminReports.erp.open')} Icon={Truck}
          />
          <div className="grid grid-cols-2 gap-3 border-y border-ink-100 py-4 sm:grid-cols-4">
            <Figure label={t('adminReports.erp.dnTotal')} value={fmtInt(ov.delivery.total)} />
            <Figure label={t('adminReports.erp.dnDelivered')} value={fmtInt(ov.delivery.delivered)} tone="text-emerald-600" />
            <Figure label={t('adminReports.erp.dnRate')} value={fmtShare(ov.delivery.deliveredRate)} tone="text-gold-700" />
            <Figure label={t('adminReports.erp.dnToInvoice')} value={fmtInt(ov.delivery.toInvoice)} tone="text-amber-600" />
          </div>
          <ErpSliceList slices={ov.delivery.byStatus} labels={dnLabel} showAmount={false} />
        </div>

        {/* Fiscalité */}
        <div className={`space-y-4 p-6 ${CARD}`}>
          <ModuleHead
            title={t('adminReports.erp.tax')}
            hint={t('adminReports.erp.taxHint')}
            to="/admin/tax" linkLabel={t('adminReports.erp.open')} Icon={Receipt}
          />
          <div className="grid grid-cols-2 gap-3 border-y border-ink-100 py-4 sm:grid-cols-4">
            <Figure label={t('adminReports.erp.taxDue')} value={fmtMoney(ov.tax.totalDue)} tone="text-gold-700" />
            <Figure label={t('adminReports.erp.taxOverdue')} value={fmtMoney(ov.tax.overdue)} tone="text-rose-500" />
            <Figure label={t('adminReports.erp.taxToFile')} value={fmtMoney(ov.tax.toFile)} tone="text-amber-600" />
            <Figure label={t('adminReports.erp.taxPaid')} value={fmtMoney(ov.tax.paid)} tone="text-emerald-600" />
          </div>
          <ErpSliceList slices={ov.tax.byType} labels={taxTypeLabel} />
        </div>

        {/* RH */}
        <div className={`space-y-4 p-6 ${CARD}`}>
          <ModuleHead
            title={t('adminReports.erp.hr')}
            hint={t('adminReports.erp.hrHint')}
            to="/admin/hr" linkLabel={t('adminReports.erp.open')} Icon={Users2}
          />
          <div className="grid grid-cols-2 gap-3 border-y border-ink-100 py-4 sm:grid-cols-4">
            <Figure label={t('adminReports.erp.headcount')} value={fmtInt(ov.hr.headcount)} />
            <Figure label={t('adminReports.erp.active')} value={fmtInt(ov.hr.activeHeadcount)} tone="text-emerald-600" />
            <Figure label={t('adminReports.erp.payroll')} value={fmtMoney(ov.hr.monthlyPayroll)} tone="text-gold-700" />
            <Figure label={t('adminReports.erp.pendingLeaves')} value={fmtInt(ov.hr.pendingLeaves)} tone="text-amber-600" />
          </div>
          <ErpSliceList slices={ov.hr.byContract} labels={contractLabel} showAmount={false} />
        </div>
      </div>
    </div>
  )
}
