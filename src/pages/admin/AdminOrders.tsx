import { useState, useMemo, useEffect, useCallback, useRef, type ComponentType } from "react"
import { getAccessToken } from "../../lib/cookies"
import {
  Search, Loader2, Calendar, Truck, AlertCircle, Eye, X, Package,
  User, MapPin, CreditCard, CheckCircle, ClipboardList, Cog, XCircle, RotateCcw,
  ChevronLeft, ChevronRight, PackageSearch,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  INPUT, TH_ROW, TABLE_MIN_WIDE, EmptyState, RefreshButton, TableSkeleton,
  DateRangeFilter, FilterBar, EMPTY_RANGE, isDateRangeActive, type DateRange,
} from "./_ui"
import {
  getAdminOrders,
  getAdminOrder,
  updateOrderStatus,
  AdminOrder,
} from "../../api"

const ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
] as const
type OrderStatus = (typeof ORDER_STATUSES)[number]

function badgeColor(status: string) {
  if (status === 'PENDING') return "bg-amber-50 text-amber-600 border border-amber-200"
  if (status === 'DELIVERED' || status === 'CONFIRMED') return "bg-emerald-50 text-emerald-600 border border-emerald-200"
  if (status === 'CANCELLED' || status === 'REFUNDED') return "bg-rose-50 text-rose-500 border border-rose-200"
  if (status === 'SHIPPED') return "bg-blue-50 text-blue-600 border border-blue-200"
  if (status === 'PROCESSING') return "bg-violet-50 text-violet-600 border border-violet-200"
  return "bg-gray-100 text-ink-500 border border-ink-100"
}

// ── Order Status Stepper ─────────────────────────────────────────────────────
const ORDER_STEPS: { key: OrderStatus; icon: ComponentType<{ size?: number | string }> }[] = [
  { key: 'PENDING', icon: ClipboardList },
  { key: 'CONFIRMED', icon: CheckCircle },
  { key: 'PROCESSING', icon: Cog },
  { key: 'SHIPPED', icon: Truck },
  { key: 'DELIVERED', icon: Package },
]

function OrderStepper({ status }: { status: string }) {
  const { t } = useTranslation()
  const currentIdx = ORDER_STEPS.findIndex(s => s.key === status)
  const isCancelled = status === 'CANCELLED' || status === 'REFUNDED'

  if (isCancelled) {
    const Icon = status === 'CANCELLED' ? XCircle : RotateCcw
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
        <Icon size={18} />
        <span className="text-sm font-bold text-rose-600">
          {t(`adminOrders.statusResult.${status}`)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex w-full items-center gap-0 py-2">
      {ORDER_STEPS.map((step, i) => {
        const done   = i <= currentIdx
        const active = i === currentIdx
        const Icon   = step.icon
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07, type: 'spring', stiffness: 420, damping: 22 }}
              className="relative flex flex-1 flex-col items-center"
            >
              <div className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm transition-all duration-500 ease-out-expo ${
                done ? 'border-gold-500 bg-gold-500 text-ink-900 shadow-gold-md'
                     : 'border-ink-100 bg-white text-ink-300'
              } ${active ? 'scale-110 ring-4 ring-gold-500/25' : ''}`}>
                <Icon size={16} />
                {active && (
                  <span aria-hidden className="absolute inset-0 rounded-full border-2 border-gold-500 animate-ping-ring" />
                )}
              </div>
              <p className={`mt-1.5 text-center text-[10px] font-bold leading-tight ${done ? 'text-gold-700' : 'text-ink-300'}`}>
                {t(`adminShared.orderStatus.${step.key}`)}
              </p>
            </motion.div>
            {i < ORDER_STEPS.length - 1 && (
              <div className="mx-0.5 h-0.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gold-500 transition-[width] duration-700 ease-out-expo"
                  style={{ width: i < currentIdx ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function AdminOrders() {
  const { t, i18n } = useTranslation()
  const language = i18n.language.startsWith('fr') ? 'fr' : 'en'
  const locale = language === 'fr' ? 'fr-TN' : 'en-TN'
  const money = (value: unknown) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))
  const date = (value?: string | null) => value ? new Intl.DateTimeFormat(locale).format(new Date(value)) : '—'
  const adminToken = getAccessToken() ?? ''
  const [searchParams, setSearchParams] = useSearchParams()

  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [minTotal, setMinTotal] = useState("")
  const [maxTotal, setMaxTotal] = useState("")
  const [rowsPerPage, setRowsPerPage] = useState(5)
  const [currentPage, setCurrentPage] = useState(1)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const requestedOrderRef = useRef<number | null>(null)

  // Any filter change has to send the reader back to page 1 — otherwise a
  // narrowed result set leaves them stranded on a page that no longer exists.
  const resetPage = () => setCurrentPage(1)

  const clearFilters = () => {
    setSearch("")
    setStatusFilter('')
    setDateRange(EMPTY_RANGE)
    setMinTotal("")
    setMaxTotal("")
    resetPage()
  }

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0) +
    (minTotal || maxTotal ? 1 : 0)

  // ─── Fetch orders ─────────────────────────────────────────────────────────
  // The status and the date window are applied by the API, not here. That
  // matters: the fetch is capped at 200 rows, so filtering a date client-side
  // would only ever search the 200 most recent orders and would quietly report
  // "aucune commande" for any older month.
  const fetchOrders = useCallback(async () => {
    if (!adminToken) {
      setError(t('adminOrders.errors.noToken'))
      return
    }
    setLoading(true)
    setError("")
    try {
      const page = await getAdminOrders(adminToken, statusFilter || undefined, 0, 200, {
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
      })
      setOrders(page.content ?? [])
      setTotalCount(page.totalElements ?? page.content?.length ?? 0)
    } catch (e: any) {
      setError(e.message ?? t('adminOrders.errors.load'))
    } finally {
      setLoading(false)
    }
  }, [adminToken, statusFilter, dateRange.from, dateRange.to, t])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const requestedId = Number(searchParams.get('orderId'))
    if (!requestedId || loading || selectedOrder) return
    const target = orders.find((order) => order.id === requestedId)
    if (target) {
      setSelectedOrder(target)
      requestedOrderRef.current = requestedId
      return
    }
    if (requestedOrderRef.current === requestedId || !adminToken) return
    requestedOrderRef.current = requestedId
    void getAdminOrder(requestedId, adminToken)
      .then(setSelectedOrder)
      .catch(() => setError(t('adminOrders.errors.requested')))
  }, [adminToken, loading, orders, searchParams, selectedOrder, t])

  const closeOrder = () => {
    setSelectedOrder(null)
    requestedOrderRef.current = null
    if (searchParams.has('orderId')) {
      const next = new URLSearchParams(searchParams)
      next.delete('orderId')
      setSearchParams(next, { replace: true })
    }
  }

  // ─── Client-side narrowing (search + amount range) ────────────────────────
  // These two stay local so typing stays instant: they refine the window the
  // API already returned instead of costing a round trip per keystroke.
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    const min = minTotal === "" ? null : Number(minTotal)
    const max = maxTotal === "" ? null : Number(maxTotal)

    return orders.filter((o) => {
      if (term) {
        const hit =
          o.orderNumber.toLowerCase().includes(term) ||
          (o.clientUsername ?? "").toLowerCase().includes(term) ||
          (o.clientEmail ?? "").toLowerCase().includes(term) ||
          (o.delivery?.addressLine1 ?? "").toLowerCase().includes(term)
        if (!hit) return false
      }

      const total = Number(o.total ?? o.totalAmount ?? 0)
      // `Number.isFinite` guards a half-typed "1," or "-" in the box, which
      // would otherwise be NaN and hide every row.
      if (min !== null && Number.isFinite(min) && total < min) return false
      if (max !== null && Number.isFinite(max) && total > max) return false

      return true
    })
  }, [orders, search, minTotal, maxTotal])

  const totalPages = Math.ceil(filtered.length / rowsPerPage)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, currentPage, rowsPerPage])

  // ─── Status update ────────────────────────────────────────────────────────
  const handleStatusUpdate = async (order: AdminOrder, status: OrderStatus) => {
    if (!adminToken) return
    setUpdatingId(order.id)
    try {
      const updated = await updateOrderStatus(order.id, status, adminToken)
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      if (selectedOrder?.id === order.id) setSelectedOrder(updated)
    } catch {
      setError(t('adminOrders.errors.updateStatus'))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{t('adminOrders.title')}</h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink-400">
            {t('adminOrders.breadcrumb')}
          </p>
        </div>
        <RefreshButton onClick={fetchOrders} busy={loading} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-elev-1">
        {/* Search & filter bar */}
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminOrders.count', { count: filtered.length })}
              {activeFilters > 0 && totalCount > filtered.length ? ` ${t('adminOrders.ofTotal', { total: totalCount })}` : ''}
            </span>
          }
        >
          <div className="group relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 transition-colors group-focus-within:text-gold-600" size={18} />
            <input
              type="text"
              placeholder={t('adminOrders.search')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetPage()
              }}
              className={`${INPUT} pl-11`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | '')
              resetPage()
            }}
            aria-label={t('adminOrders.filterStatus')}
            className={`${INPUT} sm:w-44`}
          >
            <option value="">{t('adminOrders.allStatuses')}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`adminShared.orderStatus.${s}`)}</option>
            ))}
          </select>

          {/* Amount window. Two narrow number inputs beat a slider here: the
              admin usually knows the figure they are hunting for. */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-ink-100 bg-white px-3 py-2.5 shadow-elev-1 transition-all duration-300 ease-out-expo focus-within:border-gold-400 focus-within:shadow-gold-sm">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-ink-400">TND</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder={t('adminOrders.min')}
              value={minTotal}
              onChange={(e) => { setMinTotal(e.target.value); resetPage() }}
              aria-label={t('adminOrders.minAmount')}
              className="ba-nums w-16 bg-transparent text-xs font-bold text-ink-900 placeholder-ink-300 focus:outline-none"
            />
            <span aria-hidden className="text-xs font-black text-ink-300">→</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder={t('adminOrders.max')}
              value={maxTotal}
              onChange={(e) => { setMaxTotal(e.target.value); resetPage() }}
              aria-label={t('adminOrders.maxAmount')}
              className="ba-nums w-16 bg-transparent text-xs font-bold text-ink-900 placeholder-ink-300 focus:outline-none"
            />
          </div>

          <DateRangeFilter
            value={dateRange}
            onChange={(r) => { setDateRange(r); resetPage() }}
          />
        </FilterBar>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-left text-sm text-ink-900 ${TABLE_MIN_WIDE}`}>
            <thead>
              <tr className={TH_ROW}>
                <th className="px-6 py-4">{t('adminOrders.columns.number')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.customer')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.date')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.status')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.total')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.delivery')}</th>
                <th className="px-6 py-4">{t('adminOrders.columns.address')}</th>
                <th className="w-28 px-6 py-4 text-center">{t('adminOrders.columns.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-semibold text-ink-700">
              {loading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      Icon={PackageSearch}
                      title={t('adminOrders.empty.title')}
                      hint={
                        activeFilters > 0
                          ? t('adminOrders.empty.filtered')
                          : t('adminOrders.empty.initial')
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((order) => {
                  const isUpdating = updatingId === order.id
                  const deliveryDate = (order.delivery as any)?.estimatedDeliveryDate
                    ? String((order.delivery as any).estimatedDeliveryDate).substring(0, 10)
                    : "—"

                  return (
                    <tr key={order.id} className="transition-colors duration-200 hover:bg-gold-50/40">
                      <td className="ba-nums px-6 py-4 font-mono text-xs font-extrabold text-ink-900">{order.orderNumber}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-ink-900">{order.clientUsername ?? "—"}</p>
                        <p className="text-xs font-medium text-ink-400">{order.clientEmail ?? ""}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-ink-500">
                        <span className="ba-nums flex items-center gap-1.5">
                          <Calendar size={14} className="text-ink-300" />
                          {date(order.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeColor(order.status)}`}>
                          {t(`adminShared.orderStatus.${order.status}`)}
                        </span>
                      </td>
                      <td className="ba-nums px-6 py-4 font-black text-ink-900">
                        {money(order.total)} TND
                      </td>
                      <td className="px-6 py-4 font-medium text-ink-500">
                        <span className="ba-nums flex items-center gap-1.5">
                          <Truck size={14} className="text-ink-300" />
                          {deliveryDate}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-6 py-4 font-medium text-ink-500">
                        {order.delivery?.addressLine1 && order.delivery?.city
                          ? `${order.delivery.addressLine1}, ${order.delivery.city}`
                          : "—"}
                      </td>
                      {/*
                        Action cell is intentionally "Détails" only. The status
                        `<select>` that used to live here was removed: the order
                        state is now changed exclusively from the detail drawer,
                        so a mis-click in a dense table can no longer silently
                        move an order to "Livrée" or "Annulée".
                      */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setSelectedOrder(order)}
                            className="ba-press flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-600 transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-blue-100">
                            <Eye size={11} /> {t('adminShared.details')}
                          </button>
                          {isUpdating && <Loader2 size={16} className="animate-spin text-gold-600" />}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-ink-100 p-4 text-xs font-bold text-ink-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span>{t('adminShared.rowsPerPage')}</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1) }}
              className="ba-nums rounded-lg border border-ink-100 bg-white px-2 py-1 font-bold transition-colors focus:border-gold-500 focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="ba-nums">
              {t('adminShared.pageRange', { from: filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1, to: Math.min(currentPage * rowsPerPage, filtered.length), total: filtered.length })}
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                aria-label={t('adminShared.previousPage')}
                className="ba-press rounded-lg border border-ink-100 p-1.5 transition-all duration-300 ease-out-expo hover:border-gold-400 hover:text-gold-700 disabled:opacity-50"
              ><ChevronLeft size={14} /></button>
              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(currentPage + 1)}
                aria-label={t('adminShared.nextPage')}
                className="ba-press rounded-lg border border-ink-100 p-1.5 transition-all duration-300 ease-out-expo hover:border-gold-400 hover:text-gold-700 disabled:opacity-50"
              ><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Detail Drawer ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedOrder && (() => {
          const items = selectedOrder.items ?? []
          const isUpdating = updatingId === selectedOrder.id
          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm" onClick={closeOrder} />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-white shadow-elev-4">

                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
                  <div>
                    <h3 className="text-lg font-black text-ink-900">{t('adminOrders.drawer.title', { number: selectedOrder.orderNumber })}</h3>
                    <p className="ba-nums mt-0.5 text-xs text-ink-400">
                      {t('adminOrders.drawer.created', { date: date(selectedOrder.createdAt) })}
                    </p>
                  </div>
                  <button onClick={closeOrder} aria-label={t('adminShared.close')}
                    className="ba-press rounded-xl p-2 text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-700">
                    <X size={18} />
                  </button>
                </div>

                {/* Status Stepper */}
                <div className="border-b border-ink-100 px-6 py-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminOrders.drawer.progress')}</p>
                  <OrderStepper status={selectedOrder.status} />
                </div>

                {/* Status change */}
                {/*
                  Sole status control in the app. Shows its own pending state
                  because the row-level select was removed, so there is no other
                  affordance telling the operator the PATCH is in flight.
                */}
                <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
                  <p className="text-sm font-bold text-ink-600">{t('adminOrders.drawer.changeStatus')}</p>
                  <div className="flex items-center gap-2">
                    {isUpdating && <Loader2 size={15} className="animate-spin text-gold-600" />}
                    <select value={selectedOrder.status}
                      disabled={isUpdating}
                      aria-busy={isUpdating}
                      onChange={e => handleStatusUpdate(selectedOrder, e.target.value as OrderStatus)}
                      className="cursor-pointer rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs font-bold transition-colors focus:border-gold-500 focus:outline-none disabled:opacity-50">
                      {ORDER_STATUSES.map(s => <option key={s} value={s}>{t(`adminShared.orderStatus.${s}`)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Customer info */}
                <div className="border-b border-ink-100 px-6 py-4">
                  <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ink-400">
                    <User size={12} /> {t('adminOrders.drawer.customer')}
                  </p>
                  <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gold-50">
                      <p className="text-[10px] font-bold text-ink-400">{t('adminOrders.drawer.name')}</p>
                      <p className="text-sm font-bold text-ink-900">{selectedOrder.clientUsername ?? '—'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gold-50">
                      <p className="text-[10px] font-bold text-ink-400">Email</p>
                      <p className="truncate text-sm font-bold text-ink-900">{selectedOrder.clientEmail ?? '—'}</p>
                    </div>
                    {selectedOrder.customer?.phone && (
                      <div className="rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gold-50">
                        <p className="text-[10px] font-bold text-ink-400">{t('adminOrders.drawer.phone')}</p>
                        <p className="ba-nums text-sm font-bold text-ink-900">{selectedOrder.customer.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipping address */}
                {selectedOrder.delivery && (
                  <div className="border-b border-ink-100 px-6 py-4">
                    <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ink-400">
                      <MapPin size={12} /> {t('adminOrders.drawer.shippingAddress')}
                    </p>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-sm font-bold text-ink-900">{selectedOrder.delivery.addressLine1}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{selectedOrder.delivery.city}</p>
                      {selectedOrder.delivery.trackingNumber && (
                        <p className="ba-nums mt-2 text-xs font-bold text-gold-700">
                          {t('adminOrders.drawer.tracking', { number: selectedOrder.delivery.trackingNumber })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Order items */}
                <div className="border-b border-ink-100 px-6 py-4">
                  <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ink-400">
                    <Package size={12} /> {t('adminOrders.drawer.items', { count: items.length })}
                  </p>
                  {items.length === 0 ? (
                    <p className="py-3 text-center text-xs text-ink-400">{t('adminOrders.drawer.noItems')}</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <motion.div
                          key={item.id ?? idx}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(idx, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                          className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gold-50"
                        >
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-100 bg-white">
                            <img
                              src={item.product?.imageUrl ?? item.product?.imageUrls?.[0] ?? '/images/placeholder.png'}
                              alt={(language === 'fr' ? item.productNameFr ?? item.product?.nameFr : item.productName ?? item.product?.name) ?? t('adminOrders.drawer.itemFallback', { number: idx + 1 })}
                              loading="lazy"
                              className="h-full w-full object-contain p-1"
                              onError={(event) => {
                                event.currentTarget.onerror = null
                                event.currentTarget.src = '/images/placeholder.png'
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink-900">{(language === 'fr' ? item.productNameFr ?? item.product?.nameFr : item.productName ?? item.product?.name) ?? t('adminOrders.drawer.itemFallback', { number: idx + 1 })}</p>
                            <p className="ba-nums text-xs text-ink-400">{t('adminOrders.drawer.quantity')}: {item.quantity} × {money(item.unitPrice)} TND</p>
                          </div>
                          <p className="ba-nums shrink-0 text-sm font-black text-ink-900">
                            {money(item.lineTotal ?? item.totalPrice ?? (item.quantity ?? 0) * (item.unitPrice ?? 0))} TND
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment summary */}
                <div className="px-6 py-4">
                  <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ink-400">
                    <CreditCard size={12} /> {t('adminOrders.drawer.financialSummary')}
                  </p>
                  <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100">
                    {[
                      { label: t('adminOrders.drawer.subtotal'), value: selectedOrder.subtotal },
                      { label: t('adminOrders.drawer.taxes'), value: selectedOrder.taxAmount },
                      { label: t('adminOrders.drawer.shipping'), value: selectedOrder.shippingCost },
                      { label: t('adminOrders.drawer.discount'), value: selectedOrder.discount },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-semibold text-ink-500">{label}</span>
                        <span className="ba-nums text-xs font-bold text-ink-700">{money(value)} TND</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-gold-50 px-4 py-3">
                      <span className="text-sm font-black text-ink-900">{t('adminOrders.columns.total')}</span>
                      <span className="ba-nums text-sm font-black text-gold-700">{money(selectedOrder.total)} TND</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
