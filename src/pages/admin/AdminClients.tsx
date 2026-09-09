import { useState, useEffect, useCallback, useRef } from "react"
import { getAccessToken } from '../../lib/cookies'
import { useTranslation } from 'react-i18next'
import { Loader2, Mail, Users, AlertCircle, AlertTriangle, Trash2, Eye, X, Phone, MapPin, Calendar, ShoppingCart, Wallet, BadgeCheck } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { getAdminClients, deleteAdminClient, AdminClient, CustomerSegment } from "../../api"
import {
  INPUT, BTN_DANGER, CARD, TH_ROW, TABLE_MIN_WIDE,
  PageHeader, RefreshButton, SearchBar, StatCard, TableSkeleton, EmptyState, ConfirmDialog,
  DateRangeFilter, FilterBar, EMPTY_RANGE, isDateRangeActive, type DateRange,
} from './_ui'

// Backend enum: NEW | REGULAR | VIP | INACTIVE | FLEET
const SEGMENTS: CustomerSegment[] = ['NEW', 'REGULAR', 'VIP', 'INACTIVE', 'FLEET']

const SEGMENT_STYLES: Record<CustomerSegment, string> = {
  NEW:      'bg-blue-50 text-blue-600 border-blue-200',
  REGULAR:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  VIP:      'bg-gold-50 text-gold-700 border-gold-300',
  INACTIVE: 'bg-ink-50 text-ink-500 border-ink-100',
  FLEET:    'bg-violet-50 text-violet-600 border-violet-200',
}

export default function AdminClients() {
  const adminToken = getAccessToken() ?? ''
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN'
  const segmentLabel = (value: CustomerSegment) => t(`adminClients.segment.${value}`, { defaultValue: value })
  const money = (n: number) => `${n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TND`

  const [clients, setClients] = useState<AdminClient[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [segment, setSegment] = useState<CustomerSegment | ''>('')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(0) // 0-based, matches the backend
  const [deleting, setDeleting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  // ─── Debounce search input ────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  // ─── Fetch clients (server-side pagination) ───────────────────────────────
  // Every filter is sent to the API rather than applied to the fetched rows:
  // this list is paginated server-side, so narrowing one page would hide
  // matches sitting on the other pages and report a wrong total.
  const fetchClients = useCallback(async () => {
    if (!adminToken) {
      setError(t('adminClients.error.noToken'))
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await getAdminClients(
        adminToken,
        debouncedSearch || undefined,
        page,
        rowsPerPage,
        {
          segment: segment || undefined,
          sortBy: 'createdAt',
          dir: 'desc',
          withOrderCounts: true,
          createdFrom: dateRange.from || undefined,
          createdTo: dateRange.to || undefined,
        },
      )
      setClients(result.content ?? [])
      setTotalElements(result.totalElements ?? 0)
      setSelectedIds([])
    } catch (e: any) {
      setError(e.message ?? t('adminClients.error.loadFailed'))
      setClients([])
      setTotalElements(0)
    } finally {
      setLoading(false)
    }
  }, [adminToken, debouncedSearch, page, rowsPerPage, segment, dateRange.from, dateRange.to, t])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const activeFilters =
    (debouncedSearch.trim() ? 1 : 0) +
    (segment ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0)

  const clearFilters = () => {
    setSearch('')
    setSegment('')
    setDateRange(EMPTY_RANGE)
    setPage(0)
  }

  // ─── Pagination (driven by the backend's totalElements) ───────────────────
  const totalPages = Math.max(1, Math.ceil(totalElements / rowsPerPage))
  const rangeStart = totalElements === 0 ? 0 : page * rowsPerPage + 1
  const rangeEnd = Math.min((page + 1) * rowsPerPage, totalElements)

  const handleSelectAll = (checked: boolean) =>
    setSelectedIds(checked ? clients.map((c) => c.id) : [])

  const handleSelectRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  // ─── Delete: persists via DELETE /api/customers/{id} (soft delete) ────────
  const handleDeleteSelected = async () => {
    setDeleting(true)
    setError("")
    const failed: number[] = []
    for (const id of selectedIds) {
      try {
        await deleteAdminClient(id, adminToken)
      } catch {
        failed.push(id)
      }
    }
    setDeleting(false)
    setConfirmBulkDelete(false)

    if (failed.length > 0) {
      setError(t('adminClients.error.deleteFailed', { count: failed.length, ids: failed.join(', #') }))
    }
    await fetchClients()
  }

  // ─── Avatar initials ──────────────────────────────────────────────────────
  const initials = (name: string) =>
    name.split(/[\s._@]/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"

  const avatarColor = (id: number) => {
    const colors = [
      "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500",
      "bg-rose-500", "bg-cyan-500", "bg-amber-500", "bg-pink-500",
    ]
    return colors[id % colors.length]
  }

  const vipCount = clients.filter((c) => c.segment === 'VIP').length
  const revenue = clients.reduce((s, c) => s + (c.totalSpent ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Title */}
      <PageHeader title={t('adminClients.title')} subtitle={t('adminClients.subtitle')}>
        {selectedIds.length > 0 && (
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={deleting}
            className={BTN_DANGER}
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {t('adminClients.deleteSelected', { count: selectedIds.length })}
          </button>
        )}
        <RefreshButton onClick={fetchClients} busy={loading} />
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:grid-cols-3">
        <StatCard label={t('adminClients.kpi.total')} value={totalElements} Icon={Users} color="bg-blue-500" loading={loading} />
        <StatCard label={t('adminClients.kpi.vipPage')} value={vipCount} Icon={BadgeCheck} color="bg-gold-500" delay={60} loading={loading} />
        <StatCard label={t('adminClients.kpi.spentPage')} value={Math.round(revenue)} Icon={Wallet} color="bg-emerald-500" delay={120} suffix="TND" loading={loading} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Table Container */}
      <div className={`overflow-hidden ${CARD}`}>
        {/* Search & filter bar */}
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminClients.count', { count: totalElements })}
              {activeFilters > 0 ? ` ${t('adminClients.found')}` : ` ${t('adminClients.total')}`}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminClients.search')}
            className="w-full sm:w-72"
          />
          <select
            value={segment}
            onChange={(e) => { setSegment(e.target.value as CustomerSegment | ''); setPage(0) }}
            aria-label={t('adminClients.filterSegment')}
            className={`${INPUT} sm:w-48`}
          >
            <option value="">{t('adminClients.allSegments')}</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>{segmentLabel(s)}</option>
            ))}
          </select>
          <DateRangeFilter
            value={dateRange}
            onChange={(r) => { setDateRange(r); setPage(0) }}
          />
        </FilterBar>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-left text-sm text-ink-900 ${TABLE_MIN_WIDE}`}>
            <thead>
              <tr className={TH_ROW}>
                <th className="w-12 px-6 py-4">
                  <input
                    type="checkbox"
                    checked={clients.length > 0 && clients.every((c) => selectedIds.includes(c.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label={t('adminClients.a11y.selectAll')}
                    className="rounded border-ink-200 accent-gold-500 focus:ring-gold-500"
                  />
                </th>
                <th className="px-6 py-4">{t('adminClients.columns.name')}</th>
                <th className="px-6 py-4">{t('adminClients.columns.contact')}</th>
                <th className="px-6 py-4">{t('adminClients.columns.segment')}</th>
                <th className="px-6 py-4 text-center">{t('adminClients.columns.orders')}</th>
                <th className="px-6 py-4 text-right">{t('adminClients.columns.spent')}</th>
                <th className="px-6 py-4">{t('adminClients.columns.registered')}</th>
                <th className="px-6 py-4 text-center">{t('adminClients.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-semibold text-ink-800">
              {loading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      Icon={Users}
                      title={t('adminClients.empty.title')}
                      hint={activeFilters > 0 ? t('adminClients.empty.hint') : undefined}
                    />
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-gold-50/40">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(client.id)}
                        onChange={(e) => handleSelectRow(client.id, e.target.checked)}
                        aria-label={t('adminClients.a11y.selectNamed', { name: client.username })}
                        className="rounded border-ink-200 accent-gold-500 focus:ring-gold-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Generated avatar with initials */}
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${avatarColor(client.id)}`}
                        >
                          {initials(client.username ?? '')}
                        </div>
                        <div>
                          <p className="font-extrabold text-ink-900">{client.username}</p>
                          <span className="ba-nums text-[10px] uppercase tracking-widest text-ink-400">
                            #{client.id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-ink-500">
                      <span className="flex items-center gap-1.5">
                        <Mail size={14} className="shrink-0 text-ink-300" />
                        {client.email ?? '—'}
                      </span>
                      {client.phone && (
                        <span className="ba-nums mt-1 flex items-center gap-1.5 text-xs">
                          <Phone size={12} className="shrink-0 text-ink-300" />
                          {client.phone}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                        SEGMENT_STYLES[client.segment ?? 'NEW']
                      }`}>
                        {segmentLabel(client.segment ?? 'NEW')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="ba-nums rounded-full bg-ink-50 px-2.5 py-1 text-xs font-bold text-ink-700">
                        {client.ordersCount ?? 0}
                      </span>
                    </td>
                    <td className="ba-nums px-6 py-4 text-right font-bold text-ink-900">
                      {money(client.totalSpent ?? 0)}
                    </td>
                    <td className="ba-nums px-6 py-4 font-medium text-ink-500">
                      {client.createdAt
                        ? new Date(client.createdAt).toLocaleDateString(locale)
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setSelectedClient(client)}
                        aria-label={t('adminClients.a11y.viewNamed', { name: client.username })}
                        className="ba-press mx-auto flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-100">
                        <Eye size={11} /> {t('adminClients.view')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-ink-100 p-4 text-xs font-bold text-ink-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span>{t('adminClients.pagination.rowsPerPage')}:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0) }}
              aria-label={t('adminClients.pagination.rowsPerPage')}
              className="rounded-lg border border-ink-100 bg-white px-2 py-1 font-bold focus:border-gold-500 focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="ba-nums">
              {t('adminClients.pagination.range', { start: rangeStart, end: rangeEnd, total: totalElements })}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label={t('adminClients.pagination.previous')}
                className="ba-press rounded-lg border border-ink-100 p-1.5 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >&lt;</button>
              <button
                disabled={page >= totalPages - 1 || loading}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t('adminClients.pagination.next')}
                className="ba-press rounded-lg border border-ink-100 p-1.5 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Client Detail Drawer ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink-900/55 backdrop-blur-sm" onClick={() => setSelectedClient(null)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label={t('adminClients.drawer.a11y', { name: selectedClient.username })}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-elev-4">

              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white ${avatarColor(selectedClient.id)}`}>
                    {initials(selectedClient.username ?? '')}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink-900">{selectedClient.username}</h3>
                    <p className="ba-nums text-xs text-ink-400">{t('adminClients.drawer.clientNumber', { id: selectedClient.id })}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedClient(null)} aria-label={t('common.close')}
                  className="ba-press rounded-xl p-2 text-ink-400 transition-colors hover:bg-gray-50 hover:text-ink-700">
                  <X size={18} />
                </button>
              </div>

              {/* Segment */}
              <div className="border-b border-ink-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink-600">{t('adminClients.columns.segment')}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${
                    SEGMENT_STYLES[selectedClient.segment ?? 'NEW']
                  }`}>
                    <BadgeCheck size={12} /> {segmentLabel(selectedClient.segment ?? 'NEW')}
                  </span>
                </div>
              </div>

              {/* Info grid */}
              <div className="border-b border-ink-100 px-6 py-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminClients.drawer.information')}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <Mail size={14} className="shrink-0 text-ink-300" />
                    <div>
                      <p className="text-[10px] font-bold text-ink-400">Email</p>
                      <p className="text-sm font-bold text-ink-900">{selectedClient.email ?? '—'}</p>
                    </div>
                  </div>
                  {selectedClient.phone && (
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <Phone size={14} className="shrink-0 text-ink-300" />
                      <div>
                        <p className="text-[10px] font-bold text-ink-400">{t('adminClients.drawer.phone')}</p>
                        <p className="ba-nums text-sm font-bold text-ink-900">{selectedClient.phone}</p>
                      </div>
                    </div>
                  )}
                  {selectedClient.city && (
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <MapPin size={14} className="shrink-0 text-ink-300" />
                      <div>
                        <p className="text-[10px] font-bold text-ink-400">{t('adminClients.drawer.city')}</p>
                        <p className="text-sm font-bold text-ink-900">{selectedClient.city}</p>
                      </div>
                    </div>
                  )}
                  {selectedClient.address && (
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <MapPin size={14} className="shrink-0 text-ink-300" />
                      <div>
                        <p className="text-[10px] font-bold text-ink-400">{t('adminClients.drawer.address')}</p>
                        <p className="text-sm font-bold text-ink-900">{selectedClient.address}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <Calendar size={14} className="shrink-0 text-ink-300" />
                    <div>
                      <p className="text-[10px] font-bold text-ink-400">{t('adminClients.drawer.registrationDate')}</p>
                      <p className="ba-nums text-sm font-bold text-ink-900">
                        {selectedClient.createdAt ? new Date(selectedClient.createdAt).toLocaleDateString(locale) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-6 py-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminClients.drawer.statistics')}</p>
                <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                  <div className="rounded-xl border border-gold-200 bg-gold-50 p-4 text-center">
                    <ShoppingCart size={18} className="mx-auto mb-1 text-gold-600" />
                    <p className="ba-nums text-2xl font-black text-ink-900">{selectedClient.ordersCount ?? 0}</p>
                    <p className="text-[10px] font-bold uppercase text-ink-400">{t('adminClients.columns.orders')}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <Wallet size={18} className="mx-auto mb-1 text-emerald-600" />
                    <p className="ba-nums text-lg font-black text-ink-900">{money(selectedClient.totalSpent ?? 0)}</p>
                    <p className="text-[10px] font-bold uppercase text-ink-400">{t('adminClients.columns.spent')}</p>
                  </div>
                  <div className="rounded-xl border border-ink-100 bg-gray-50 p-4 text-center xs:col-span-2">
                    <Users size={18} className="mx-auto mb-1 text-ink-500" />
                    <p className="ba-nums text-2xl font-black text-ink-900">{selectedClient.totalVisits ?? 0}</p>
                    <p className="text-[10px] font-bold uppercase text-ink-400">{t('adminClients.drawer.visits')}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={handleDeleteSelected}
        pending={deleting}
        Icon={AlertTriangle}
        title={t('adminClients.confirm.title', { count: selectedIds.length })}
        message={t('adminClients.confirm.message')}
      />
    </div>
  )
}
