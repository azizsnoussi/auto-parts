import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import {
  Calendar, Clock, CheckCircle, XCircle, User, Wrench,
  AlertCircle, ChevronLeft, ChevronRight, X, Building2,
} from 'lucide-react'
import { adminAppointmentsApi } from '../../lib/api'
import {
  CARD,
  PageHeader, RefreshButton, SearchBar, FilterChip, EmptyState,
  DateRangeFilter, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'

const STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const
type ApptStatus = (typeof STATUSES)[number]

// Kept local rather than routed through `StatusPill`: the workshop pipeline needs
// sky/violet stages that the shared tone list doesn't carry, and the dot colour
// is reused by the day-view rows.
const STATUS_META: Record<ApptStatus, { badge: string; dot: string }> = {
  PENDING: { badge: 'bg-amber-50 text-amber-600 border border-amber-200', dot: 'bg-amber-500' },
  CONFIRMED: { badge: 'bg-sky-50 text-sky-600 border border-sky-200', dot: 'bg-sky-500' },
  IN_PROGRESS: { badge: 'bg-violet-50 text-violet-600 border border-violet-200', dot: 'bg-violet-500' },
  COMPLETED: { badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { badge: 'bg-red-50 text-red-600 border border-red-200', dot: 'bg-red-500' },
  NO_SHOW: { badge: 'bg-ink-50 text-ink-500 border border-ink-100', dot: 'bg-ink-400' },
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const meta = STATUS_META[status as ApptStatus]
  if (!meta) return <span className="text-xs text-ink-400">{status}</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {t(`adminShared.appointmentStatus.${status}`)}
    </span>
  )
}

export default function AdminAppointments() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = i18n.language === 'fr' ? fr : enUS

  const [filterStatus, setFilterStatus] = useState<string>('')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [detailError, setDetailError] = useState('')

  // ── Fetch all appointments via admin endpoint ──────────────────────────────
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['admin-appointments', filterStatus],
    queryFn: async () => {
      try {
        // Try the admin-specific endpoint first
        const res = await adminAppointmentsApi.getAll(
          filterStatus ? { status: filterStatus } : undefined
        )
        return (res.data?.data ?? res.data ?? []) as any[]
      } catch {
        // Fallback: fetch branch 1 appointments if admin/all not available
        const res = await adminAppointmentsApi.getByBranch(
          1,
          filterStatus ? { status: filterStatus } : undefined
        )
        return (res.data?.data ?? res.data ?? []) as any[]
      }
    },
    staleTime: 30_000,
  })

  const appointments: any[] = Array.isArray(data) ? data : []

  // ── Filter by search term + appointment date window ───────────────────────
  // The window is matched against `appointmentDate` (the day of the visit), not
  // `createdAt` (when it was booked) — that is the date the planning is about.
  // The status is applied by the API; these two are local, since the query
  // already returns the whole list.
  const term = search.trim().toLowerCase()
  const filtered = appointments.filter((a: any) => {
    if (term) {
      const name = `${a.customer?.firstName ?? ''} ${a.customer?.lastName ?? ''}`.toLowerCase()
      const svc = ((i18n.language === 'fr' ? a.service?.nameFr : a.service?.name) ?? '').toLowerCase()
      if (!name.includes(term) && !svc.includes(term)) return false
    }
    return inDateRange(a.appointmentDate, dateRange)
  })

  const activeFilters =
    (term ? 1 : 0) + (filterStatus ? 1 : 0) + (isDateRangeActive(dateRange) ? 1 : 0)

  useEffect(() => setCurrentPage(1), [filterStatus, search, dateRange.from, dateRange.to])

  const totalPages = Math.ceil(filtered.length / rowsPerPage)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [currentPage, filtered, rowsPerPage])

  useEffect(() => {
    const requestedId = Number(searchParams.get('appointmentId'))
    if (!requestedId || isLoading || selectedAppt || detailError) return
    const target = appointments.find((appointment) => appointment.id === requestedId)
    if (target) {
      setSelectedAppt(target)
      return
    }
    void adminAppointmentsApi.getById(requestedId)
      .then((response) => setSelectedAppt(response.data?.data ?? response.data))
        .catch(() => setDetailError(t('adminAppointments.errors.requested')))
      }, [appointments, detailError, isLoading, searchParams, selectedAppt, t])

  const closeAppointment = () => {
    setSelectedAppt(null)
    setDetailError('')
    if (searchParams.has('appointmentId')) {
      const next = new URLSearchParams(searchParams)
      next.delete('appointmentId')
      setSearchParams(next, { replace: true })
    }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminAppointmentsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appointments'] })
      toast.success(t('adminAppointments.toast.updated'))
    },
    onError: () => toast.error(t('adminAppointments.toast.updateFailed')),
  })

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      adminAppointmentsApi.cancel(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appointments'] })
      toast.success(t('adminAppointments.toast.cancelled'))
    },
    onError: () => toast.error(t('adminAppointments.toast.cancelFailed')),
  })

  // ── Stat counts ───────────────────────────────────────────────────────────
  const statusCounts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = appointments.filter((a: any) => a.status === s).length
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title={t('adminAppointments.title')} subtitle={t('adminAppointments.subtitle')}>
        <RefreshButton onClick={() => refetch()} busy={isFetching} />
      </PageHeader>

      {/* Status stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((s) => {
          const meta = STATUS_META[s]
          const active = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              aria-pressed={active}
              className={`ba-press rounded-2xl border p-4 text-left transition-all duration-300 ease-out-expo ${
                active
                  ? 'border-gold-300 bg-gold-50 shadow-gold-sm'
                  : 'border-ink-100 bg-white shadow-elev-1 hover:border-gold-200 hover:shadow-elev-2'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-ink-400">
                {t(`adminShared.appointmentStatus.${s}`)}
              </p>
              <p className={`ba-nums mt-1 text-2xl font-black ${active ? 'text-gold-600' : 'text-ink-900'}`}>
                {isLoading ? '—' : statusCounts[s] ?? 0}
              </p>
            </button>
          )
        })}
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('adminAppointments.search')}
          className="w-full sm:w-64"
        />

        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!filterStatus} onClick={() => setFilterStatus('')} count={appointments.length}>
            {t('adminShared.all')}
          </FilterChip>
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={filterStatus === s}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            >
              {t(`adminShared.appointmentStatus.${s}`)}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          <AlertCircle size={16} className="shrink-0" />
          {t('adminAppointments.errors.load')}
        </div>
      )}
      {detailError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          <AlertCircle size={16} className="shrink-0" />
          {detailError}
        </div>
      )}

      {/* Day view header */}
      <div className={`overflow-hidden ${CARD}`}>
        <div className="flex items-center gap-3 border-b border-ink-100 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-50">
            <Calendar size={18} className="text-gold-600" />
          </div>
          <div>
            <h2 className="font-black text-ink-900">
              {isDateRangeActive(dateRange)
                ? dateRange.from === dateRange.to && dateRange.from
                  ? format(new Date(`${dateRange.from}T00:00:00`), 'EEEE dd MMMM yyyy', { locale })
                  : `${dateRange.from || '…'} → ${dateRange.to || '…'}`
                : format(new Date(), 'EEEE dd MMMM yyyy', { locale })}
            </h2>
            <p className="text-xs font-medium text-ink-400">
              {t('adminAppointments.count', { count: filtered.length })}{filterStatus ? ` · ${t(`adminShared.appointmentStatus.${filterStatus}`)}` : ''}
            </p>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="ba-skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              Icon={Calendar}
              title={filterStatus ? t('adminAppointments.empty.status', { status: t(`adminShared.appointmentStatus.${filterStatus}`) }) : t('adminAppointments.empty.title')}
              hint={activeFilters > 0 ? t('adminAppointments.empty.filtered') : t('adminAppointments.empty.initial')}
            />
          ) : (
            <div className="space-y-3">
              {paginated.map((appt: any) => (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex cursor-pointer items-center gap-4 rounded-xl border border-ink-100 bg-gray-50 px-4 py-3.5 transition-colors hover:border-gold-200 hover:bg-gold-50/50"
                  onClick={() => setSelectedAppt(appt)}
                >
                  {/* Time block */}
                  <div className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-ink-100 bg-white text-center shadow-elev-1">
                    <p className="ba-nums text-xs font-black text-ink-900">
                      {appt.startTime?.slice(0, 5) ?? '—'}
                    </p>
                    <p className="ba-nums text-[10px] font-medium text-ink-400">
                      {appt.endTime?.slice(0, 5) ?? ''}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink-900">
                        {i18n.language === 'fr' ? appt.service?.nameFr : appt.service?.name}
                      </p>
                      <StatusBadge status={appt.status} />
                    </div>
                    <div className="flex gap-4 text-xs text-ink-500">
                      <span className="flex items-center gap-1">
                        <User size={11} />
                        {appt.customer?.firstName} {appt.customer?.lastName}
                      </span>
                      {appt.branch && (
                        <span className="flex items-center gap-1">
                          <ChevronRight size={11} />
                          {(i18n.language === 'fr' ? appt.branch?.nameFr : appt.branch?.name) ?? appt.branch?.nameFr ?? appt.branch?.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions — stopPropagation so a status change doesn't also open the drawer */}
                  <div className="flex shrink-0 gap-2">
                    {appt.status === 'PENDING' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: appt.id, status: 'CONFIRMED' }) }}
                        disabled={updateStatus.isPending}
                        className="ba-press flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle size={12} /> {t('adminAppointments.actions.confirm')}
                      </button>
                    )}
                    {appt.status === 'CONFIRMED' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: appt.id, status: 'IN_PROGRESS' }) }}
                        disabled={updateStatus.isPending}
                        className="ba-press flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-100 disabled:opacity-50"
                      >
                        <Wrench size={12} /> {t('adminAppointments.actions.start')}
                      </button>
                    )}
                    {appt.status === 'IN_PROGRESS' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: appt.id, status: 'COMPLETED' }) }}
                        disabled={updateStatus.isPending}
                        className="ba-press flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle size={12} /> {t('adminAppointments.actions.finish')}
                      </button>
                    )}
                    {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(appt.status) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); cancelMut.mutate({ id: appt.id, reason: 'Annulé par l\'admin' }) }}
                        disabled={cancelMut.isPending}
                        className="ba-press flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle size={12} /> {t('adminShared.cancel')}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        {filtered.length > rowsPerPage && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 px-5 py-4 text-xs font-bold text-ink-500 sm:flex-row">
            <div className="flex items-center gap-2">
              <span>{t('adminShared.rowsPerPage')}</span>
              <select value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setCurrentPage(1) }}
                className="rounded-lg border border-ink-100 bg-white px-2 py-1 font-bold">
                <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span>{t('adminShared.pageRange', { from: (currentPage - 1) * rowsPerPage + 1, to: Math.min(currentPage * rowsPerPage, filtered.length), total: filtered.length })}</span>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label={t('adminShared.previousPage')}
                className="rounded-lg border border-ink-100 p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button>
              <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)} aria-label={t('adminShared.nextPage')}
                className="rounded-lg border border-ink-100 p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Appointment Detail Drawer ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedAppt && (() => {
          const APPT_STEPS = [
            { key: 'PENDING', icon: '📋' },
            { key: 'CONFIRMED', icon: '✅' },
            { key: 'IN_PROGRESS', icon: '🔧' },
            { key: 'COMPLETED', icon: '🏁' },
          ]
          const stepIdx = APPT_STEPS.findIndex(s => s.key === selectedAppt.status)
          const isCancelled = selectedAppt.status === 'CANCELLED' || selectedAppt.status === 'NO_SHOW'

          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-ink-900/55 backdrop-blur-sm" onClick={closeAppointment} />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                role="dialog"
                aria-modal="true"
                aria-label={t('adminAppointments.drawer.aria', { id: selectedAppt.id })}
                className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-elev-4">

                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-4 sm:px-6">
                  <div>
                    <h3 className="text-lg font-black text-ink-900">{t('adminAppointments.drawer.title', { id: selectedAppt.id })}</h3>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {selectedAppt.date ? format(new Date(selectedAppt.date), 'EEEE dd MMMM yyyy', { locale }) : '—'}
                    </p>
                  </div>
                  <button onClick={closeAppointment} aria-label={t('adminShared.close')}
                    className="ba-press rounded-xl p-2 text-ink-400 transition-colors hover:bg-gray-50 hover:text-ink-700">
                    <X size={18} />
                  </button>
                </div>

                {/* Status Stepper */}
                <div className="border-b border-ink-100 px-6 py-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminAppointments.drawer.progress')}</p>
                  {isCancelled ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
                      <span className="text-lg" aria-hidden="true">❌</span>
                      <span className="text-sm font-bold text-rose-600">
                        {t(`adminShared.appointmentStatus.${selectedAppt.status}`)}
                      </span>
                    </div>
                  ) : (
                    <ol className="flex w-full items-center gap-0">
                      {APPT_STEPS.map((step, i) => {
                        const done = i <= stepIdx
                        const active = i === stepIdx
                        return (
                          <li key={step.key} className="flex flex-1 items-center"
                            aria-current={active ? 'step' : undefined}>
                            <div className="flex flex-1 flex-col items-center">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm transition-all duration-300 ease-out-back ${
                                done ? 'border-gold-500 bg-gold-500 text-white shadow-gold-md'
                                     : 'border-ink-100 bg-white text-ink-400'
                              } ${active ? 'scale-110 ring-4 ring-gold-500/20' : ''}`}>
                                {done ? <CheckCircle size={16} /> : <span aria-hidden="true">{step.icon}</span>}
                              </div>
                              <p className={`mt-1.5 text-center text-[10px] font-bold ${done ? 'text-gold-600' : 'text-ink-400'}`}>
                                {t(`adminShared.appointmentStatus.${step.key}`)}
                              </p>
                            </div>
                            {i < APPT_STEPS.length - 1 && (
                              <div className={`mx-0.5 h-0.5 flex-1 rounded-full ${i < stepIdx ? 'bg-gold-500' : 'bg-ink-100'}`} />
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>

                {/* Details */}
                <div className="border-b border-ink-100 px-6 py-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminShared.details')}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <Wrench size={14} className="shrink-0 text-gold-600" />
                      <div>
                          <p className="text-[10px] font-bold text-ink-400">{t('adminAppointments.drawer.service')}</p>
                        <p className="text-sm font-bold text-ink-900">
                          {i18n.language === 'fr' ? selectedAppt.service?.nameFr : selectedAppt.service?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <Clock size={14} className="shrink-0 text-ink-300" />
                      <div>
                        <p className="text-[10px] font-bold text-ink-400">{t('adminAppointments.drawer.schedule')}</p>
                        <p className="ba-nums text-sm font-bold text-ink-900">
                          {selectedAppt.startTime?.slice(0, 5) ?? '—'} — {selectedAppt.endTime?.slice(0, 5) ?? '—'}
                        </p>
                      </div>
                    </div>
                    {selectedAppt.branch && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                        <Building2 size={14} className="shrink-0 text-ink-300" />
                        <div>
                          <p className="text-[10px] font-bold text-ink-400">{t('adminAppointments.drawer.branch')}</p>
                          <p className="text-sm font-bold text-ink-900">
                            {(i18n.language === 'fr' ? selectedAppt.branch?.nameFr : selectedAppt.branch?.name) ?? selectedAppt.branch?.nameFr ?? selectedAppt.branch?.name}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer */}
                <div className="border-b border-ink-100 px-6 py-4">
                  <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ink-400">
                    <User size={12} /> {t('adminAppointments.drawer.customer')}
                  </p>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[10px] font-bold text-ink-400">{t('adminAppointments.drawer.name')}</p>
                      <p className="text-sm font-bold text-ink-900">
                        {selectedAppt.customer?.firstName} {selectedAppt.customer?.lastName}
                      </p>
                    </div>
                    {selectedAppt.customer?.email && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-ink-400">Email</p>
                        <p className="break-all text-sm font-bold text-ink-900">{selectedAppt.customer.email}</p>
                      </div>
                    )}
                    {selectedAppt.customer?.phone && (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-[10px] font-bold text-ink-400">{t('adminAppointments.drawer.phone')}</p>
                        <p className="ba-nums text-sm font-bold text-ink-900">{selectedAppt.customer.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedAppt.notes && (
                  <div className="border-b border-ink-100 px-6 py-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminAppointments.drawer.notes')}</p>
                    <p className="rounded-xl bg-gray-50 p-3 text-sm text-ink-600">{selectedAppt.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 py-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminAppointments.drawer.actions')}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAppt.status === 'PENDING' && (
                      <button onClick={() => { updateStatus.mutate({ id: selectedAppt.id, status: 'CONFIRMED' }); setSelectedAppt(null) }}
                        className="ba-press flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-elev-2 transition-colors hover:bg-emerald-600">
                        <CheckCircle size={14} /> {t('adminAppointments.actions.confirm')}
                      </button>
                    )}
                    {selectedAppt.status === 'CONFIRMED' && (
                      <button onClick={() => { updateStatus.mutate({ id: selectedAppt.id, status: 'IN_PROGRESS' }); setSelectedAppt(null) }}
                        className="ba-press flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-elev-2 transition-colors hover:bg-violet-600">
                        <Wrench size={14} /> {t('adminAppointments.actions.start')}
                      </button>
                    )}
                    {selectedAppt.status === 'IN_PROGRESS' && (
                      <button onClick={() => { updateStatus.mutate({ id: selectedAppt.id, status: 'COMPLETED' }); setSelectedAppt(null) }}
                        className="ba-press flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-elev-2 transition-colors hover:bg-emerald-600">
                        <CheckCircle size={14} /> {t('adminAppointments.actions.finish')}
                      </button>
                    )}
                    {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(selectedAppt.status) && (
                      <button onClick={() => { cancelMut.mutate({ id: selectedAppt.id, reason: "Annulé par l'admin" }); setSelectedAppt(null) }}
                        className="ba-press flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-elev-2 transition-colors hover:bg-red-600">
                        <XCircle size={14} /> {t('adminShared.cancel')}
                      </button>
                    )}
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
