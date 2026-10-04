/**
 * Wire types for `GET /api/analytics/*`, mirroring `AnalyticsDtos.java`.
 *
 * Two conventions the backend guarantees and every consumer here relies on:
 *
 * - **Percentages are `number | null`.** `null` means the comparison base was
 *   zero, so a growth figure is undefined — render `—`, never `+100%`.
 * - **Amounts are plain numbers** (serialised from `BigDecimal(10,2)`), and are
 *   never null. Series are zero-filled, so a `0` really means "no sales", not
 *   "no data".
 */

import i18n from '../../i18n'

export type Pct = number | null

export interface MonthPoint {
  year: number
  /** 1-based, so January is 1. */
  month: number
  /** Short French label, e.g. `Jan`, `Fév`, `Aoû`. */
  label: string
  revenue: number
  orders: number
}

export interface DayPoint {
  /** ISO `YYYY-MM-DD`. */
  date: string
  day: number
  revenue: number
  orders: number
}

export interface RevenueSeries {
  currentYear: number
  previousYear: number
  /** Always 12 entries. */
  current: MonthPoint[]
  /** Always 12 entries. */
  previous: MonthPoint[]
  /** Highest monthly revenue across both years — scale the Y axis from this. */
  maxRevenue: number
  currentTotal: number
  previousTotal: number
  currentOrders: number
  previousOrders: number
  growthPct: Pct
  monthlyAverage: number
  projectedTotal: number
}

export interface KpiSummary {
  from: string
  to: string
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  cancelledOrders: number
  deliveredOrders: number
  totalRevenue: number
  averageBasket: number
  unitsSold: number
  averageItemsPerOrder: Pct
  totalCustomers: number
  newCustomers: number
  activeCustomers: number
  repeatCustomers: number
  fulfillmentRate: Pct
  cancellationRate: Pct
  repeatRate: Pct
  activationRate: Pct
  previousRevenue: number
  previousOrders: number
  previousBasket: number
  previousActiveCustomers: number
  revenueDeltaPct: Pct
  ordersDeltaPct: Pct
  basketDeltaPct: Pct
  activeCustomersDeltaPct: Pct
}

export interface CategoryShare {
  /** `0` is the "Sans catégorie" bucket, not a real row in `categories`. */
  categoryId: number
  label: string
  revenue: number
  units: number
  orders: number
  pct: number
}

export interface TopProduct {
  productId: number
  sku: string | null
  name: string | null
  brand: string | null
  imageUrl: string | null
  categoryLabel: string | null
  units: number
  revenue: number
  stockQuantity: number
}

export interface TopCustomer {
  customerId: number
  name: string | null
  email: string | null
  segment: string | null
  orders: number
  revenue: number
}

export interface StatusSlice {
  status: string
  orders: number
  revenue: number
  pct: number
}

export interface PaymentSlice {
  /** `NON_RENSEIGNE` when the order carries no payment method. */
  method: string
  orders: number
  revenue: number
  pct: number
}

export interface OrderBrief {
  id: number
  orderNumber: string
  createdAt: string
  status: string | null
  paymentStatus: string | null
  paymentMethod: string | null
  customerId: number | null
  customerName: string | null
  customerEmail: string | null
  total: number
}

export interface Overview {
  kpis: KpiSummary
  revenue: RevenueSeries
  categories: CategoryShare[]
  topProducts: TopProduct[]
  topCustomers: TopCustomer[]
  statuses: StatusSlice[]
  payments: PaymentSlice[]
  /** Empty for windows longer than 120 days — fall back to the monthly series. */
  daily: DayPoint[]
  lowStockProducts: number
  outOfStockProducts: number
  activeProducts: number
  /** True when the window holds no orders at all. Drives the empty state. */
  empty: boolean
  generatedAt: string
}

// ── ERP analytics wire types (mirror `ErpAnalyticsDtos.java`) ────────────────

/**
 * A labelled amount + count slice, reused for status / method / type / contract
 * breakdowns across the ERP summaries. `pct` is the share of the group's total
 * amount, 0-100. For count-only groups (delivery notes, HR contracts) `amount`
 * and `pct` are `0`.
 */
export interface ErpSlice {
  /** Machine key, e.g. `pending`, `cheque`, `tva`, `CDI`. */
  key: string
  count: number
  amount: number
  pct: number
}

export interface ErpPaymentsSummary {
  total: number
  /** direction = in (encaissements clients). */
  inflow: number
  /** direction = out (décaissements fournisseurs). */
  outflow: number
  /** inflow − outflow. */
  net: number
  cleared: number
  pending: number
  bounced: number
  byStatus: ErpSlice[]
  byMethod: ErpSlice[]
}

export interface ErpPurchasingSummary {
  total: number
  totalHT: number
  /** Orders not yet fully received (draft|sent|confirmed|partial). */
  open: number
  openValue: number
  received: number
  byStatus: ErpSlice[]
}

export interface ErpDeliverySummary {
  total: number
  /** delivered / total, 0-100. */
  deliveredRate: number
  /** Delivered but not yet linked to an invoice. */
  toInvoice: number
  delivered: number
  pending: number
  byStatus: ErpSlice[]
}

export interface ErpTaxSummary {
  total: number
  totalDue: number
  overdue: number
  toFile: number
  paid: number
  overdueCount: number
  byType: ErpSlice[]
  byStatus: ErpSlice[]
}

export interface ErpTreasurySummary {
  accounts: number
  /** Snapshot sum of all account balances (not period-scoped). */
  totalBalance: number
  cashBalance: number
  bankBalance: number
  movementsIn: number
  movementsOut: number
  instrumentsInPortfolio: number
  instrumentsPortfolioValue: number
  accountBalances: ErpSlice[]
}

export interface ErpHrSummary {
  headcount: number
  activeHeadcount: number
  monthlyPayroll: number
  pendingLeaves: number
  byContract: ErpSlice[]
}

export interface ErpOverview {
  from: string
  to: string
  payments: ErpPaymentsSummary
  purchasing: ErpPurchasingSummary
  delivery: ErpDeliverySummary
  tax: ErpTaxSummary
  treasury: ErpTreasurySummary
  hr: ErpHrSummary
}

export interface MonthDetail {
  year: number
  month: number
  label: string
  revenue: number
  orders: number
  units: number
  averageBasket: number
  activeCustomers: number
  previousYearRevenue: number
  yoyDeltaPct: Pct
  previousMonthRevenue: number
  momDeltaPct: Pct
  daily: DayPoint[]
  topProducts: TopProduct[]
  categories: CategoryShare[]
  statuses: StatusSlice[]
  recentOrders: OrderBrief[]
}

export interface CategoryDetail {
  categoryId: number
  label: string
  revenue: number
  units: number
  orders: number
  pct: number
  averageUnitPrice: number
  productCount: number
  monthly: MonthPoint[]
  topProducts: TopProduct[]
  recentOrders: OrderBrief[]
}

// ── shared formatting ──────────────────────────────────────────────────────

/** Dynamic label maps retained for consumers that index by backend enum code. */
export const STATUS_FR: Record<string, string> = new Proxy({}, {
  get: (_target, key: string) => i18n.t(`adminShared.orderStatus.${key}`, { defaultValue: key === 'INCONNU' ? i18n.t('analytics.unknown') : key }),
})

export const PAYMENT_FR: Record<string, string> = new Proxy({}, {
  get: (_target, key: string) => i18n.t(`analytics.payment.${key}`, { defaultValue: key }),
})

const locale = () => i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN'

/** `1234567` → `1 234 567`. */
export const fmtInt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n))

/** `1234.5` → `1 234,50 TND`. */
export const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} TND`

/**
 * Compact money for chart axes and tight tiles: `1 234 567` → `1.2M`, `14200` →
 * `14.2k`. Keeps one decimal so a 14.2k label is not rounded to 14k.
 */
export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n)
}

/** `12.3` → `+12,3 %`; `null` → `—`. */
export const fmtPct = (p: Pct) =>
  p == null ? '—' : `${p > 0 ? '+' : ''}${p.toLocaleString(locale(), { maximumFractionDigits: 1 })} %`

/** `40` → `40 %`. For shares, which are never negative and never null. */
export const fmtShare = (p: number) =>
  `${p.toLocaleString(locale(), { maximumFractionDigits: 1 })} %`

/** ISO date/datetime → `12/03/2025`. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Localized short month label from a language-neutral year/month pair. */
export function fmtMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(new Date(year, month - 1, 1))
}

/** Local `YYYY-MM-DD`. `toISOString()` is avoided: it shifts to UTC. */
export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Inclusive `[from, to]` covering the trailing `days` days, ending today. */
export function trailingRange(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

/** Inclusive `[from, to]` covering a whole calendar year. */
export function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** Tailwind tone for a delta: positive is good, unless `invert` (e.g. cancellations). */
export const deltaTone = (p: Pct, invert = false) => {
  if (p == null || p === 0) return 'text-ink-400'
  const good = invert ? p < 0 : p > 0
  return good ? 'text-emerald-600' : 'text-rose-500'
}
