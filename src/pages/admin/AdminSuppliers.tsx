import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Phone, Globe, Mail, Receipt, MapPin, Plus, Check, Truck, CreditCard,
} from 'lucide-react'
import { suppliersApi } from '../../lib/api'
import {
  INPUT, BTN_PRIMARY, CARD,
  PageHeader, RefreshButton, SearchBar, Field, CardSkeleton, EmptyState,
  Modal, ModalFooterButtons, StatusPill, ToggleField,
  DateRangeFilter, FilterBar, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'
import ImageUploadField from './ImageUploadField'

/**
 * Keys mirror `Supplier` on the backend exactly. They used to be
 * `contactEmail`/`contactPhone`, which the entity has never had — those two
 * inputs were silently discarded on every save.
 */
const emptyForm = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  taxId: '',
  address: '',
  city: '',
  country: '',
  website: '',
  paymentTerms: '',
  notes: '',
  logoUrl: '',
  active: true,
}

// Colourful avatar backgrounds cycled by index, used when a supplier has no logo
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500',
]

export default function AdminSuppliers() {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm)

  // ── Fetch real supplier list ───────────────────────────────────────────────
  // `activeOnly: false` — the admin table has to show deactivated suppliers,
  // otherwise switching one off makes it disappear permanently.
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => suppliersApi.list(false),
  })
  const suppliers: any[] = data?.data?.data ?? data?.data ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────
  const closeModal = () => { setShowModal(false); setEditItem(null); setForm(emptyForm) }

  const saveMut = useMutation({
    mutationFn: (d: any) =>
      editItem ? suppliersApi.update(editItem.id, d) : suppliersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(t(editItem ? 'adminSuppliers.toast.updated' : 'adminSuppliers.toast.created'))
      closeModal()
    },
    onError: () => toast.error(t('adminSuppliers.toast.saveFailed')),
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMut.mutate(form)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (s: any) => {
    setEditItem(s)
    setForm({
      name: s.name ?? '',
      contactName: s.contactName ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      taxId: s.taxId ?? '',
      address: s.address ?? '',
      city: s.city ?? '',
      country: s.country ?? '',
      website: s.website ?? '',
      paymentTerms: s.paymentTerms ?? '',
      notes: s.notes ?? '',
      logoUrl: s.logoUrl ?? '',
      active: s.active ?? true,
    })
    setShowModal(true)
  }

  // ── Filters ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return suppliers.filter((s: any) => {
      if (term) {
        const hit =
          (s.name ?? '').toLowerCase().includes(term) ||
          (s.country ?? '').toLowerCase().includes(term) ||
          (s.city ?? '').toLowerCase().includes(term) ||
          (s.taxId ?? '').toLowerCase().includes(term) ||
          (s.email ?? '').toLowerCase().includes(term)
        if (!hit) return false
      }
      if (countryFilter && (s.country ?? '') !== countryFilter) return false
      if (stateFilter === 'active' && s.active === false) return false
      if (stateFilter === 'inactive' && s.active !== false) return false
      return inDateRange(s.createdAt, dateRange)
    })
  }, [suppliers, search, countryFilter, stateFilter, dateRange])

  /** Countries come from the rows themselves — there is no reference list. */
  const countries = useMemo(
    () => Array.from(new Set(suppliers.map((s: any) => s.country).filter(Boolean))).sort() as string[],
    [suppliers],
  )

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (countryFilter ? 1 : 0) +
    (stateFilter !== 'all' ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0)

  const clearFilters = () => {
    setSearch('')
    setCountryFilter('')
    setStateFilter('all')
    setDateRange(EMPTY_RANGE)
  }

  const initials = (name: string) =>
    name
      .split(/[\s._@-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('adminSuppliers.title')}
        subtitle={t('adminSuppliers.subtitle', { count: suppliers.length })}
      >
        <RefreshButton onClick={() => refetch()} busy={isFetching} />
        <button onClick={openCreate} className={BTN_PRIMARY}>
          <Plus size={16} /> {t('adminSuppliers.add')}
        </button>
      </PageHeader>

      {/* Search & filters */}
      <div className={`overflow-hidden ${CARD}`}>
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminSuppliers.count', { count: filtered.length })}
              {activeFilters > 0 ? ` ${t('adminSuppliers.ofTotal', { total: suppliers.length })}` : ''}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminSuppliers.search')}
            className="w-full sm:w-72"
          />
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            aria-label={t('adminSuppliers.filterCountry')}
            className={`${INPUT} sm:w-40`}
          >
            <option value="">{t('adminSuppliers.allCountries')}</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as 'all' | 'active' | 'inactive')}
            aria-label={t('adminSuppliers.filterState')}
            className={`${INPUT} sm:w-40`}
          >
            <option value="all">{t('adminSuppliers.allStates')}</option>
            <option value="active">{t('adminShared.active')}</option>
            <option value="inactive">{t('adminShared.inactive')}</option>
          </select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </FilterBar>
      </div>

      {/* Supplier grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton count={6} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          Icon={Truck}
          title={suppliers.length === 0 ? t('adminSuppliers.empty.none') : t('adminSuppliers.empty.noResults')}
          hint={suppliers.length === 0
            ? t('adminSuppliers.empty.initial')
            : t('adminSuppliers.empty.filtered')}
          action={suppliers.length === 0 ? (
            <button onClick={openCreate} className={BTN_PRIMARY}>
              <Plus size={14} /> {t('adminSuppliers.add')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((supplier: any, idx: number) => (
            <motion.button
              key={supplier.id ?? idx}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => openEdit(supplier)}
              aria-label={t('adminSuppliers.editNamed', { name: supplier.name ?? t('adminSuppliers.supplier') })}
              className={`group ba-lift w-full space-y-4 p-5 text-left transition-colors hover:border-gold-300 ${CARD}`}
            >
              {/* Top row: logo when uploaded, initials tile otherwise */}
              <div className="flex items-start justify-between gap-3">
                {supplier.logoUrl ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-100 bg-white">
                    <img
                      src={supplier.logoUrl}
                      alt={t('adminSuppliers.logoAlt', { name: supplier.name ?? '' })}
                      loading="lazy"
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                ) : (
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white ${
                      AVATAR_COLORS[idx % AVATAR_COLORS.length]
                    }`}
                  >
                    {initials(supplier.name ?? '?')}
                  </div>
                )}
                <StatusPill tone={supplier.active === false ? 'gray' : 'green'}>
                  {supplier.active === false ? t('adminShared.inactive') : t('adminShared.active')}
                </StatusPill>
              </div>

              {/* Name & ID */}
              <div>
                <h3 className="text-lg font-extrabold text-ink-900">{supplier.name}</h3>
                {supplier.id && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    #{supplier.id}
                    {supplier.contactName && <span className="normal-case"> · {supplier.contactName}</span>}
                  </span>
                )}
              </div>

              {/* Contact details */}
              <div className="space-y-1.5 border-t border-ink-100 pt-3 text-xs font-semibold text-ink-500">
                {supplier.taxId && (
                  <p className="flex items-center gap-2">
                    <Receipt size={13} className="shrink-0 text-ink-300" />
                    <span className="ba-nums font-bold text-ink-800">{supplier.taxId}</span>
                  </p>
                )}
                {(supplier.city || supplier.country || supplier.address) && (
                  <p className="flex items-center gap-2 truncate">
                    <MapPin size={13} className="shrink-0 text-ink-300" />
                    {[supplier.city, supplier.country].filter(Boolean).join(', ') || supplier.address}
                  </p>
                )}
                {supplier.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={13} className="shrink-0 text-ink-300" />
                    {supplier.phone}
                  </p>
                )}
                {supplier.email && (
                  <p className="flex items-center gap-2 truncate">
                    <Mail size={13} className="shrink-0 text-ink-300" />
                    {supplier.email}
                  </p>
                )}
                {supplier.website && (
                  <p className="flex items-center gap-2 truncate">
                    <Globe size={13} className="shrink-0 text-ink-300" />
                    {supplier.website}
                  </p>
                )}
                {supplier.paymentTerms && (
                  <p className="flex items-center gap-2 truncate">
                    <CreditCard size={13} className="shrink-0 text-ink-300" />
                    {supplier.paymentTerms}
                  </p>
                )}
                {supplier.activeOffersCount !== undefined && (
                  <p className="mt-2 font-bold text-ink-800">
                    {t('adminSuppliers.activeOffers')}:{' '}
                    <span className="ba-nums font-black text-gold-600">{supplier.activeOffersCount}</span>
                  </p>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        <Modal
          open={showModal}
          onClose={closeModal}
          title={t(editItem ? 'adminSuppliers.form.editTitle' : 'adminSuppliers.form.newTitle')}
          subtitle={editItem ? `ID #${editItem.id}` : undefined}
          maxWidth="max-w-lg"
          footer={
            <ModalFooterButtons
              onCancel={closeModal}
              onConfirm={handleSubmit}
              pending={saveMut.isPending}
              confirmLabel={t(editItem ? 'adminSuppliers.form.update' : 'adminSuppliers.form.create')}
              ConfirmIcon={Check}
            />
          }
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label={t('adminSuppliers.form.name')} required>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                className={INPUT}
              />
            </Field>

            <Field
              label={t('adminSuppliers.form.taxId')}
              hint={t('adminSuppliers.form.taxIdHint')}
            >
              <input
                value={form.taxId}
                onChange={(e) => set('taxId', e.target.value)}
                placeholder="1234567A/M/000"
                className={INPUT}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: 'contactName',  label: t('adminSuppliers.form.contactName') },
                { key: 'email',        label: t('adminSuppliers.form.email'), type: 'email' },
                { key: 'phone',        label: t('adminSuppliers.form.phone') },
                { key: 'website',      label: t('adminSuppliers.form.website') },
                { key: 'city',         label: t('adminSuppliers.form.city') },
                { key: 'country',      label: t('adminSuppliers.form.country') },
              ].map(({ key, label, type }) => (
                <Field key={key} label={label}>
                  <input
                    type={type ?? 'text'}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className={INPUT}
                  />
                </Field>
              ))}
            </div>

            <Field label={t('adminSuppliers.form.address')}>
              <input
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label={t('adminSuppliers.form.paymentTerms')} hint={t('adminSuppliers.form.paymentTermsHint')}>
              <input
                value={form.paymentTerms}
                onChange={(e) => set('paymentTerms', e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label={t('adminSuppliers.form.notes')}>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                className={`${INPUT} resize-none`}
              />
            </Field>

            <ToggleField
              checked={form.active}
              onChange={(next) => set('active', next)}
              label={form.active ? t('adminSuppliers.form.active') : t('adminSuppliers.form.inactive')}
            />

            <ImageUploadField
              label={t('adminSuppliers.form.logo')}
              hint={t('adminSuppliers.form.logoHint')}
              value={form.logoUrl}
              onChange={(url) => set('logoUrl', url)}
              folder="suppliers"
              entityId={editItem?.id ?? null}
              upload={suppliersApi.uploadImage}
              remove={suppliersApi.deleteImage}
              shape="square"
              fit="contain"
              className="max-w-[180px]"
            />
          </form>
        </Modal>
      </AnimatePresence>
    </div>
  )
}
