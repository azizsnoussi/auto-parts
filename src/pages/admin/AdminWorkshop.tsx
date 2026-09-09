import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Wrench, Clock, User, Car, ArrowRight, Plus, X, CheckCircle } from 'lucide-react'
import { customersApi, vehiclesApi, workshopApi } from '../../lib/api'
import {
  INPUT, CARD, BTN_PRIMARY, Field, Modal, ModalFooterButtons, PageHeader, RefreshButton,
  SearchBar, DateRangeFilter, FilterBar, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'

const EMPTY_WO = { customerId: '', vehicleId: '', vehicleMileage: '', customerComplaints: '' }

// Column tints are per-stage semantics, not brand colours, so they stay literal.
const STATUSES = [
  { key: 'APPOINTMENT', color: 'border-slate-200 bg-slate-50', accent: 'text-slate-600', badge: 'bg-slate-100 text-slate-600' },
  { key: 'CHECK_IN', color: 'border-sky-200 bg-sky-50', accent: 'text-sky-600', badge: 'bg-sky-100 text-sky-700' },
  { key: 'INSPECTION', color: 'border-yellow-200 bg-yellow-50', accent: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'ESTIMATE', color: 'border-orange-200 bg-orange-50', accent: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  { key: 'CUSTOMER_APPROVAL', color: 'border-amber-200 bg-amber-50', accent: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  { key: 'WORK_IN_PROGRESS', color: 'border-blue-200 bg-blue-50', accent: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  { key: 'QUALITY_CONTROL', color: 'border-violet-200 bg-violet-50', accent: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  { key: 'READY', color: 'border-emerald-200 bg-emerald-50', accent: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700'},
  { key: 'DELIVERED', color: 'border-green-200 bg-green-50', accent: 'text-green-600', badge: 'bg-green-100 text-green-700' },
]

export default function AdminWorkshop() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN'
  const qc = useQueryClient()
  const [selectedWO, setSelectedWO] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<any>(EMPTY_WO)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)

  // One query per status column
  const queries = STATUSES.map(({ key }) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['workshop', key],
      queryFn: () => workshopApi.byStatus(key),
      staleTime: 30_000,
    })
  )

  /** The board is nine independent queries, so refresh has to fan out. */
  const refreshing = queries.some(q => q.isFetching)
  const refreshAll = () => queries.forEach(q => q.refetch())

  // Pickers for the create form. Only fetched while the modal is open.
  const { data: custData } = useQuery({
    queryKey: ['workshop-customers'],
    queryFn: () => customersApi.list({ size: 200 }),
    enabled: showModal,
  })
  const customers: any[] = custData?.data?.data?.content ?? custData?.data?.data ?? []

  const { data: vehData } = useQuery({
    queryKey: ['workshop-vehicles', form.customerId],
    queryFn: () => vehiclesApi.byCustomer(Number(form.customerId)),
    enabled: showModal && !!form.customerId,
  })
  const vehicles: any[] = vehData?.data?.data ?? []

  const closeModal = () => { setShowModal(false); setForm(EMPTY_WO) }

  /**
   * `POST /workshop/work-orders` deserialises straight into the `WorkOrder`
   * entity, so the FKs travel as `{ id }` stubs. `workOrderNumber` is generated
   * server-side by `WorkOrderService.create`, and `customer`/`vehicle` are both
   * `nullable = false` — hence the guard in `submit`.
   */
  const createMut = useMutation({
    mutationFn: (d: object) => workshopApi.create(d),
    onSuccess: () => {
      STATUSES.forEach(({ key }) => qc.invalidateQueries({ queryKey: ['workshop', key] }))
      toast.success(t('adminWorkshop.toast.created'))
      closeModal()
    },
    onError: (e: any) => toast.error(
      e?.response?.data?.error || e?.response?.data?.message || e?.message ||
      t('adminWorkshop.toast.createFailed')
    ),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerId) { toast.error(t('adminWorkshop.toast.selectCustomer')); return }
    if (!form.vehicleId)  { toast.error(t('adminWorkshop.toast.selectVehicle')); return }
    createMut.mutate({
      customer: { id: Number(form.customerId) },
      vehicle:  { id: Number(form.vehicleId) },
      status: 'APPOINTMENT',
      vehicleMileage: form.vehicleMileage ? Number(form.vehicleMileage) : 0,
      customerComplaints: form.customerComplaints || null,
    })
  }

  const advanceMut = useMutation({
    mutationFn: (id: number) => workshopApi.advance(id),
    onSuccess: () => {
      STATUSES.forEach(({ key }) => qc.invalidateQueries({ queryKey: ['workshop', key] }))
      toast.success(t('adminWorkshop.toast.advanced'))
    },
    onError: () => toast.error(t('adminWorkshop.toast.advanceFailed')),
  })

  /**
   * The board is nine independent status queries, so filtering happens per
   * column on already-fetched rows. The window matches `createdAt` — the day the
   * order was opened — because a card moves across the board over several days
   * and its stage timestamps are all nullable until it reaches them.
   */
  const visibleIn = useCallback((rows: any[]) => {
    const term = search.toLowerCase().trim()
    return rows.filter((wo: any) => {
      if (term) {
        const hit =
          (wo.workOrderNumber ?? '').toLowerCase().includes(term) ||
          `${wo.customer?.firstName ?? ''} ${wo.customer?.lastName ?? ''}`.toLowerCase().includes(term) ||
          (wo.vehicle?.licensePlate ?? '').toLowerCase().includes(term) ||
          `${wo.vehicle?.brand ?? ''} ${wo.vehicle?.model ?? ''}`.toLowerCase().includes(term)
        if (!hit) return false
      }
      return inDateRange(wo.createdAt, dateRange)
    })
  }, [search, dateRange])

  const activeFilters = (search.trim() ? 1 : 0) + (isDateRangeActive(dateRange) ? 1 : 0)
  const clearFilters = () => { setSearch(''); setDateRange(EMPTY_RANGE) }

  const totalCards = queries.reduce((sum, q) => {
    const items: any[] = q.data?.data?.data ?? []
    return sum + visibleIn(items).length
  }, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('adminWorkshop.title')}
        subtitle={t('adminWorkshop.subtitle', { count: totalCards })}
      >
        <RefreshButton onClick={refreshAll} busy={refreshing} />
        <button onClick={() => setShowModal(true)} className={BTN_PRIMARY}>
          <Plus size={16} /> {t('adminWorkshop.newOrder')}
        </button>
      </PageHeader>

      {/* Filters */}
      <div className={`overflow-hidden ${CARD}`}>
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminWorkshop.shown', { count: totalCards })}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminWorkshop.search')}
            className="w-full sm:w-80"
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </FilterBar>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {STATUSES.map(({ key, color, accent, badge }, idx) => {
            const q = queries[idx]
            const items: any[] = visibleIn(q.data?.data?.data ?? [])

            return (
              <div
                key={key}
                className={`flex w-64 flex-col rounded-2xl border ${color}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between border-b border-black/5 p-3">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${accent}`}>
                      {t(`adminWorkshop.status.${key}`)}
                    </p>
                    <p className="ba-nums mt-0.5 text-xl font-black text-ink-900">
                      {q.isLoading ? '…' : items.length}
                    </p>
                  </div>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${badge}`}>
                    <Wrench size={13} />
                  </div>
                </div>

                {/* Cards */}
                <div className="max-h-[60vh] flex-1 space-y-2 overflow-y-auto p-2">
                  {q.isLoading ? (
                    <div className="ba-skeleton h-24 rounded-xl" />
                  ) : items.length === 0 ? (
                    <p className="py-8 text-center text-xs text-ink-400">
                      {activeFilters > 0 ? t('adminWorkshop.noResults') : t('adminWorkshop.empty')}
                    </p>
                  ) : (
                    items.map((wo: any) => (
                      <motion.div
                        key={wo.id}
                        layout
                        role="button"
                        tabIndex={0}
                        aria-label={t('adminWorkshop.openOrder', { number: wo.workOrderNumber })}
                        className="cursor-pointer rounded-xl border border-ink-100 bg-white p-3 shadow-elev-1 transition-all duration-300 ease-out-expo hover:border-gold-200 hover:shadow-elev-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40"
                        onClick={() => setSelectedWO(wo)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedWO(wo) }
                        }}
                      >
                        {/* Order number */}
                        <div className="mb-2 flex items-start justify-between">
                          <p className="font-mono text-xs font-black text-ink-900">
                            {wo.workOrderNumber}
                          </p>
                          <Wrench size={12} className={accent} />
                        </div>

                        {/* Customer & vehicle */}
                        <div className="space-y-1 text-[11px] text-ink-500">
                          <p className="flex items-center gap-1">
                            <User size={10} className="shrink-0" />
                            {wo.customer?.firstName} {wo.customer?.lastName}
                          </p>
                          <p className="flex items-center gap-1">
                            <Car size={10} className="shrink-0" />
                            {wo.vehicle?.brand} {wo.vehicle?.model}
                          </p>
                          {wo.checkInAt && (
                            <p className="ba-nums flex items-center gap-1">
                              <Clock size={10} className="shrink-0" />
                              {new Date(wo.checkInAt).toLocaleTimeString(locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>

                        {/* Advance button — stopPropagation so it doesn't also open the drawer */}
                        {key !== 'DELIVERED' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); advanceMut.mutate(wo.id) }}
                            disabled={advanceMut.isPending}
                            className="ba-press mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg border border-ink-100 bg-gray-50 py-1.5 text-[10px] font-bold text-ink-600 transition-colors hover:border-gold-300 hover:bg-gold-50 hover:text-gold-700 disabled:opacity-40"
                          >
                            {t('adminWorkshop.advance')} <ArrowRight size={10} />
                          </button>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Create work order ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <Modal
            open={showModal}
            onClose={closeModal}
            title={t('adminWorkshop.form.title')}
            subtitle={t('adminWorkshop.form.subtitle')}
            maxWidth="max-w-md"
            footer={
              <ModalFooterButtons
                onCancel={closeModal}
                onConfirm={submit}
                pending={createMut.isPending}
                confirmLabel={t('adminWorkshop.form.create')}
                ConfirmIcon={Plus}
              />
            }
          >
            <form onSubmit={submit} className="space-y-3">
              <Field label={t('adminWorkshop.form.customer')} required>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value, vehicleId: '' })}
                  className={INPUT}
                  required
                >
                  <option value="">— {t('adminWorkshop.form.selectCustomer')} —</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}{c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={t('adminWorkshop.form.vehicle')}
                required
                hint={!form.customerId
                  ? t('adminWorkshop.form.chooseCustomerFirst')
                  : vehicles.length === 0
                    ? t('adminWorkshop.form.noVehicles')
                    : undefined}
              >
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  className={INPUT}
                  disabled={!form.customerId || vehicles.length === 0}
                  required
                >
                  <option value="">— {t('adminWorkshop.form.selectVehicle')} —</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} {v.year ?? ''}{v.licensePlate ? ` · ${v.licensePlate}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('adminWorkshop.form.mileage')}>
                <input
                  type="number"
                  min={0}
                  value={form.vehicleMileage}
                  onChange={(e) => setForm({ ...form, vehicleMileage: e.target.value })}
                  className={INPUT}
                  placeholder={t('adminWorkshop.form.mileageExample')}
                />
              </Field>

              <Field label={t('adminWorkshop.form.complaints')}>
                <textarea
                  rows={3}
                  value={form.customerComplaints}
                  onChange={(e) => setForm({ ...form, customerComplaints: e.target.value })}
                  className={`${INPUT} resize-none`}
                  placeholder={t('adminWorkshop.form.complaintsPlaceholder')}
                />
              </Field>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Workshop Detail Drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {selectedWO && (() => {
          const currentStepIdx = STATUSES.findIndex(s => s.key === selectedWO.status)

          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-ink-900/55 backdrop-blur-sm" onClick={() => setSelectedWO(null)} />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                role="dialog"
                aria-modal="true"
                aria-label={t('adminWorkshop.drawer.aria', { number: selectedWO.workOrderNumber })}
                className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-white shadow-elev-4">

                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-4 sm:px-6">
                  <div>
                    <h3 className="font-mono text-lg font-black text-ink-900">{selectedWO.workOrderNumber}</h3>
                    <p className="mt-0.5 text-xs text-ink-400">{t('adminWorkshop.drawer.workOrder')}</p>
                  </div>
                  <button onClick={() => setSelectedWO(null)} aria-label={t('adminShared.close')}
                    className="ba-press rounded-xl p-2 text-ink-400 transition-colors hover:bg-gray-50 hover:text-ink-700">
                    <X size={18} />
                  </button>
                </div>

                {/* Kanban Stepper */}
                <div className="border-b border-ink-100 px-6 py-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminWorkshop.drawer.progress')}</p>
                  <ol className="grid grid-cols-2 gap-2 xs:grid-cols-3">
                    {STATUSES.map((step, i) => {
                      const done = i <= currentStepIdx
                      const active = i === currentStepIdx
                      return (
                        <li key={step.key}
                          aria-current={active ? 'step' : undefined}
                          className={`rounded-xl border-2 px-2 py-2 text-center transition-all duration-300 ease-out-expo ${
                            active ? 'border-gold-500 bg-gold-50 shadow-gold-sm' :
                            done ? 'border-emerald-300 bg-emerald-50' :
                            'border-ink-100 bg-gray-50'
                          }`}>
                          <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            active ? 'bg-gold-500 text-white' :
                            done ? 'bg-emerald-500 text-white' :
                            'bg-ink-100 text-ink-400'
                          }`}>
                            {done ? <CheckCircle size={12} /> : i + 1}
                          </div>
                          <p className={`text-[9px] font-bold leading-tight ${
                            active ? 'text-gold-600' : done ? 'text-emerald-600' : 'text-ink-400'
                          }`}>{t(`adminWorkshop.status.${step.key}`)}</p>
                        </li>
                      )
                    })}
                  </ol>
                </div>

                {/* Customer & Vehicle */}
                <div className="border-b border-ink-100 px-6 py-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminWorkshop.drawer.customerVehicle')}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <User size={14} className="shrink-0 text-ink-300" />
                      <div>
                        <p className="text-[10px] font-bold text-ink-400">{t('adminWorkshop.form.customer')}</p>
                        <p className="text-sm font-bold text-ink-900">
                          {selectedWO.customer?.firstName} {selectedWO.customer?.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <Car size={14} className="shrink-0 text-ink-300" />
                      <div>
                        <p className="text-[10px] font-bold text-ink-400">{t('adminWorkshop.form.vehicle')}</p>
                        <p className="text-sm font-bold text-ink-900">
                          {selectedWO.vehicle?.brand} {selectedWO.vehicle?.model} {selectedWO.vehicle?.year ?? ''}
                        </p>
                        {selectedWO.vehicle?.licensePlate && (
                          <p className="ba-nums text-xs text-ink-500">{selectedWO.vehicle.licensePlate}</p>
                        )}
                      </div>
                    </div>
                    {selectedWO.checkInAt && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                        <Clock size={14} className="shrink-0 text-ink-300" />
                        <div>
                          <p className="text-[10px] font-bold text-ink-400">{t('adminWorkshop.drawer.checkIn')}</p>
                          <p className="ba-nums text-sm font-bold text-ink-900">
                            {new Date(selectedWO.checkInAt).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedWO.leadMechanic && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                        <Wrench size={14} className="shrink-0 text-ink-300" />
                        <div>
                          <p className="text-[10px] font-bold text-ink-400">{t('adminWorkshop.drawer.mechanic')}</p>
                          <p className="text-sm font-bold text-ink-900">
                            {selectedWO.leadMechanic.firstName} {selectedWO.leadMechanic.lastName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {(selectedWO.customerComplaints || selectedWO.mechanicNotes) && (
                  <div className="border-b border-ink-100 px-6 py-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-ink-400">{t('adminWorkshop.drawer.notes')}</p>
                    {selectedWO.customerComplaints && (
                      <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-ink-600">
                        {selectedWO.customerComplaints}
                      </p>
                    )}
                    {selectedWO.mechanicNotes && (
                      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-ink-600">
                        {selectedWO.mechanicNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {selectedWO.status !== 'DELIVERED' && (
                  <div className="px-6 py-5">
                    <button
                      onClick={() => { advanceMut.mutate(selectedWO.id); setSelectedWO(null) }}
                      disabled={advanceMut.isPending}
                      className={`w-full justify-center ${BTN_PRIMARY}`}>
                      {t('adminWorkshop.drawer.advanceNext')} <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
