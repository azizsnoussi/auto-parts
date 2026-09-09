import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Wrench, Plus, Clock, Edit3, Trash2, Check, Globe, Tag, AlertTriangle,
} from 'lucide-react'
import { servicesApi } from '../../lib/api'
import {
  INPUT, BTN_PRIMARY, CARD,
  PageHeader, RefreshButton, Field, StatusPill, CardSkeleton, EmptyState,
  Modal, ModalFooterButtons, CheckboxField, ConfirmDialog,
  SearchBar, DateRangeFilter, FilterBar, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'
import ImageUploadField from './ImageUploadField'

const CATEGORIES = [
  'OIL_CHANGE', 'CAR_WASH', 'ENGINE_WASH', 'BRAKES', 'BATTERY',
  'DIAGNOSTIC', 'AIR_CONDITIONING', 'MAINTENANCE', 'TIRES', 'SUSPENSION',
]

const emptyForm = {
  name: '', nameFr: '', description: '', descriptionFr: '',
  category: 'MAINTENANCE', price: '', durationMinutes: '60',
  imageUrl: '',
  bookableOnline: true, active: true,
}

export default function AdminServices() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith('fr')
  const categoryLabel = (code: string) => t(`adminServices.category.${code}`, { defaultValue: code })
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [deleteItem, setDeleteItem] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'inactive' | 'online'>('all')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)

  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ['services'], queryFn: servicesApi.list })
  const services = data?.data?.data ?? []

  // ── Filters ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return (services as any[]).filter((s: any) => {
      if (term) {
        const hit =
          (s.name ?? '').toLowerCase().includes(term) ||
          (s.nameFr ?? '').toLowerCase().includes(term) ||
          (s.description ?? '').toLowerCase().includes(term) ||
          (s.descriptionFr ?? '').toLowerCase().includes(term)
        if (!hit) return false
      }
      if (categoryFilter && s.category !== categoryFilter) return false
      if (stateFilter === 'active' && !s.active) return false
      if (stateFilter === 'inactive' && s.active) return false
      if (stateFilter === 'online' && !s.bookableOnline) return false
      return inDateRange(s.createdAt, dateRange)
    })
  }, [services, search, categoryFilter, stateFilter, dateRange])

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (stateFilter !== 'all' ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0)

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setStateFilter('all')
    setDateRange(EMPTY_RANGE)
  }

  const closeModal = () => { setShowModal(false); setEditItem(null); setForm(emptyForm) }

  const saveMut = useMutation({
    mutationFn: (d: any) =>
      editItem ? servicesApi.update(editItem.id, d) : servicesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      toast.success(t(editItem ? 'adminServices.toast.updated' : 'adminServices.toast.created'))
      closeModal()
    },
    onError: () => toast.error(t('adminServices.toast.saveFailed')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => servicesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      toast.success(t('adminServices.toast.deleted'))
      setDeleteItem(null)
    },
    onError: () => toast.error(t('adminServices.toast.deleteFailed')),
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const openEdit = (s: any) => {
    setEditItem(s)
    setForm({
      name: s.name, nameFr: s.nameFr, description: s.description ?? '',
      descriptionFr: s.descriptionFr ?? '', category: s.category,
      price: String(s.price), durationMinutes: String(s.durationMinutes),
      imageUrl: s.imageUrl ?? '',
      bookableOnline: s.bookableOnline, active: s.active,
    })
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMut.mutate({
      ...form,
      price: parseFloat(form.price),
      durationMinutes: parseInt(form.durationMinutes),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title={t('adminServices.title')} subtitle={t('adminServices.subtitle')}>
        <RefreshButton onClick={() => refetch()} busy={isFetching} />
        <button
          onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true) }}
          className={BTN_PRIMARY}
        >
          <Plus size={16} /> {t('adminServices.add')}
        </button>
      </PageHeader>

      {/* Filters */}
      <div className={`overflow-hidden ${CARD}`}>
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminServices.count', { count: filtered.length })}
              {activeFilters > 0 ? ` ${t('adminServices.ofTotal', { total: services.length })}` : ''}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminServices.search')}
            className="w-full sm:w-72"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={t('adminServices.filterCategory')}
            className={`${INPUT} sm:w-48`}
          >
            <option value="">{t('adminServices.allCategories')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as 'all' | 'active' | 'inactive' | 'online')}
            aria-label={t('adminServices.filterState')}
            className={`${INPUT} sm:w-48`}
          >
            <option value="all">{t('adminServices.allStates')}</option>
            <option value="active">{t('adminShared.active')}</option>
            <option value="inactive">{t('adminShared.inactive')}</option>
            <option value="online">{t('adminServices.onlineBookable')}</option>
          </select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </FilterBar>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton count={6} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          Icon={Wrench}
          title={services.length === 0 ? t('adminServices.empty.none') : t('adminServices.empty.noResults')}
          hint={services.length === 0
            ? t('adminServices.empty.initial')
            : t('adminServices.empty.filtered')}
          action={services.length === 0 ? (
            <button
              onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true) }}
              className={BTN_PRIMARY}
            >
              <Plus size={14} /> {t('adminServices.add')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s: any, i: number) => {
            const name = (isFr ? s.nameFr : s.name) || s.nameFr || s.name
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`group ba-lift p-5 ${CARD} transition-colors hover:border-gold-300 ${!s.active ? 'opacity-50' : ''}`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-50">
                    <Wrench size={18} className="text-gold-600" />
                  </div>
                  <div className="flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(s)}
                      aria-label={t('adminServices.editNamed', { name })}
                      className="ba-press flex h-7 w-7 items-center justify-center rounded-lg border border-ink-100 bg-white text-ink-400 transition-colors hover:border-gold-400 hover:text-gold-700"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteItem(s)}
                      aria-label={t('adminServices.deleteNamed', { name })}
                      className="ba-press flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-black leading-snug text-ink-900">{name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  <Tag size={9} /> {categoryLabel(s.category)}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="ba-nums text-lg font-black text-gold-600">{s.price} TND</p>
                    <p className="ba-nums flex items-center gap-1 text-xs text-ink-400">
                      <Clock size={10} /> {s.durationMinutes} min
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {s.bookableOnline && (
                      <StatusPill tone="blue"><Globe size={9} /> {t('adminServices.online')}</StatusPill>
                    )}
                    <StatusPill tone={s.active ? 'green' : 'gray'}>
                      {s.active ? t('adminShared.active') : t('adminShared.inactive')}
                    </StatusPill>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        <Modal
          open={showModal}
          onClose={closeModal}
          title={t(editItem ? 'adminServices.form.editTitle' : 'adminServices.form.newTitle')}
          subtitle={editItem ? `ID #${editItem.id}` : undefined}
          footer={
            <ModalFooterButtons
              onCancel={closeModal}
              onConfirm={handleSubmit}
              pending={saveMut.isPending}
              confirmLabel={t(editItem ? 'adminServices.form.update' : 'adminServices.form.create')}
              ConfirmIcon={Check}
            />
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: 'name',   label: t('adminServices.form.nameEn'), placeholder: t('adminServices.form.nameEnPlaceholder') },
                { key: 'nameFr', label: t('adminServices.form.nameFr'), placeholder: t('adminServices.form.nameFrPlaceholder') },
              ].map(({ key, label, placeholder }) => (
                <Field key={key} label={label} required>
                  <input
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={placeholder}
                    required
                    className={INPUT}
                  />
                </Field>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: 'description',   label: t('adminServices.form.descriptionEn') },
                { key: 'descriptionFr', label: t('adminServices.form.descriptionFr') },
              ].map(({ key, label }) => (
                <Field key={key} label={label}>
                  <textarea
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    rows={2}
                    className={`${INPUT} resize-none`}
                  />
                </Field>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t('adminServices.form.category')}>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className={INPUT}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{categoryLabel(c)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('adminServices.form.price')} required>
                <input
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  type="number" step="0.5" min="0" required
                  className={INPUT}
                />
              </Field>
              <Field label={t('adminServices.form.duration')} required>
                <input
                  value={form.durationMinutes}
                  onChange={(e) => set('durationMinutes', e.target.value)}
                  type="number" min="1" required
                  className={INPUT}
                />
              </Field>
            </div>

            <ImageUploadField
              label={t('adminServices.form.image')}
              hint={t('adminServices.form.imageHint')}
              value={form.imageUrl}
              onChange={(url) => set('imageUrl', url)}
              folder="services"
              entityId={editItem?.id ?? null}
              upload={servicesApi.uploadImage}
              remove={servicesApi.deleteImage}
            />

            <div className="flex gap-4">
              {[
                { key: 'bookableOnline', label: t('adminServices.form.bookableOnline') },
                { key: 'active',         label: t('adminShared.active') },
              ].map(({ key, label }) => (
                <CheckboxField
                  key={key}
                  checked={form[key]}
                  onChange={(next) => set(key, next)}
                  label={label}
                />
              ))}
            </div>
          </form>
        </Modal>
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteItem}
        onCancel={() => setDeleteItem(null)}
        onConfirm={() => deleteMut.mutate(deleteItem.id)}
        pending={deleteMut.isPending}
        Icon={AlertTriangle}
        title={t('adminServices.delete.title')}
        detail={deleteItem ? ((isFr ? deleteItem.nameFr : deleteItem.name) || deleteItem.nameFr || deleteItem.name) : undefined}
        message={t('adminServices.delete.message')}
      />
    </div>
  )
}
