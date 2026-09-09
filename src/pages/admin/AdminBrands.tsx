import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Plus, Edit3, Trash2, Check,
  ToggleLeft, ToggleRight, AlertTriangle, Car, ExternalLink,
} from 'lucide-react'
import { brandsApi } from '../../lib/api'
import {
  INPUT, BTN_PRIMARY, CARD,
  PageHeader, RefreshButton, SearchBar, Field, StatusPill, CardSkeleton, EmptyState,
  Modal, ModalFooterButtons, ConfirmDialog, ToggleField,
  DateRangeFilter, FilterBar, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'
import ImageUploadField from './ImageUploadField'

const EMPTY: any = { name: '', logoUrl: '', websiteUrl: '', sortOrder: 0, active: true }

export default function AdminBrands() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [search,    setSearch]    = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [showModal, setShowModal] = useState(false)
  const [editItem,  setEditItem]  = useState<any>(null)
  const [form,      setForm]      = useState<any>(EMPTY)
  const [deleteItem, setDeleteItem] = useState<any>(null)

  // ── Fetch brands (all of them, including inactive, for management) ─────────
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['admin-brands'],
    queryFn:  () => brandsApi.list(false),
  })
  const brands: any[] = data?.data?.data ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────
  // The public carousel reads the ['brands'] key, so invalidate both: an admin
  // edit must show up on the storefront without a reload.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-brands'] })
    qc.invalidateQueries({ queryKey: ['brands'] })
  }

  const saveMut = useMutation({
    mutationFn: (d: any) => (editItem ? brandsApi.update(editItem.id, d) : brandsApi.create(d)),
    onSuccess: () => {
      invalidate()
      toast.success(editItem ? t('adminBrands.updated') : t('adminBrands.created'))
      closeModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t('adminBrands.saveError')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => brandsApi.delete(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('adminBrands.deleted'))
      setDeleteItem(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t('adminBrands.deleteError')),
  })

  const toggleMut = useMutation({
    mutationFn: (b: any) => brandsApi.update(b.id, { ...b, active: !b.active }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.response?.data?.message || t('adminBrands.saveError')),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const openCreate = () => {
    setEditItem(null)
    // Append after the current last brand so new entries land at the end of
    // the carousel instead of jumping to the front.
    const nextOrder = brands.length
      ? Math.max(...brands.map((b: any) => b.sortOrder ?? 0)) + 1
      : 0
    setForm({ ...EMPTY, sortOrder: nextOrder })
    setShowModal(true)
  }

  const openEdit = (b: any) => {
    setEditItem(b)
    setForm({
      name:       b.name ?? '',
      logoUrl:    b.logoUrl ?? '',
      websiteUrl: b.websiteUrl ?? '',
      sortOrder:  b.sortOrder ?? 0,
      active:     b.active ?? true,
    })
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditItem(null); setForm(EMPTY) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('adminBrands.nameRequired'))
      return
    }
    saveMut.mutate({
      name:       form.name.trim(),
      logoUrl:    form.logoUrl.trim() || null,
      websiteUrl: form.websiteUrl.trim() || null,
      sortOrder:  parseInt(form.sortOrder, 10) || 0,
      active:     form.active,
    })
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return brands.filter((b: any) => {
      if (q && !(b.name ?? '').toLowerCase().includes(q)) return false
      if (stateFilter === 'active' && !b.active) return false
      if (stateFilter === 'inactive' && b.active) return false
      return inDateRange(b.createdAt, dateRange)
    })
  }, [brands, search, stateFilter, dateRange])

  const filterCount =
    (search.trim() ? 1 : 0) +
    (stateFilter !== 'all' ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0)

  const clearFilters = () => {
    setSearch('')
    setStateFilter('all')
    setDateRange(EMPTY_RANGE)
  }

  const activeCount = brands.filter((b: any) => b.active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('adminBrands.title')}
        subtitle={t('adminBrands.subtitle', { total: brands.length, active: activeCount })}
      >
        <RefreshButton onClick={() => refetch()} busy={isFetching} label={t('adminBrands.refresh')} />
        <button onClick={openCreate} className={BTN_PRIMARY}>
          <Plus size={16} /> {t('adminBrands.new')}
        </button>
      </PageHeader>

      {/* Search & filters */}
      <div className={`overflow-hidden ${CARD}`}>
        <FilterBar
          activeCount={filterCount}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {filterCount > 0
                ? t('adminBrands.countShownOf', { shown: filtered.length, total: brands.length })
                : t('adminBrands.countShown', { shown: filtered.length })}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminBrands.searchPlaceholder')}
            className="w-full sm:w-72"
          />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as 'all' | 'active' | 'inactive')}
            aria-label={t('adminBrands.filterState')}
            className={`${INPUT} sm:w-48`}
          >
            <option value="all">{t('adminBrands.allStates')}</option>
            <option value="active">{t('adminBrands.onlyVisible')}</option>
            <option value="inactive">{t('adminBrands.onlyHidden')}</option>
          </select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </FilterBar>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton count={6} />
        </div>
      ) : isError ? (
        <EmptyState Icon={AlertTriangle} title={t('adminBrands.loadError')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          Icon={Car}
          title={brands.length === 0 ? t('adminBrands.emptyNone') : t('adminBrands.emptySearch')}
          hint={brands.length === 0 ? undefined : t('adminBrands.emptyFiltered')}
          action={brands.length === 0 ? (
            <button onClick={openCreate} className={BTN_PRIMARY}>
              <Plus size={14} /> {t('adminBrands.createFirst')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b: any, idx: number) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              className={`ba-lift flex flex-col gap-3 p-4 ${CARD} transition-colors hover:border-gold-300`}
            >
              <div className="flex items-center gap-3">
                {/* Logo preview, with initials as a fallback so a dead URL is obvious */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-ink-100 bg-gray-50 p-1.5">
                  {b.logoUrl ? (
                    <img
                      src={b.logoUrl}
                      alt={b.name}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.style.display = 'none'
                        img.parentElement?.classList.add('text-ink-200')
                      }}
                    />
                  ) : (
                    <span className="text-sm font-black text-ink-200">
                      {(b.name ?? '?').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-extrabold text-ink-900">{b.name}</h3>
                    <StatusPill tone={b.active ? 'green' : 'gray'}>
                      {b.active ? t('adminBrands.active') : t('adminBrands.inactive')}
                    </StatusPill>
                  </div>
                  <p className="ba-nums mt-0.5 font-mono text-[10px] text-ink-300">
                    ID #{b.id} · {t('adminBrands.order')} {b.sortOrder}
                  </p>
                  {b.websiteUrl && (
                    <a
                      href={b.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ba-underline mt-0.5 inline-flex items-center gap-1 truncate text-[11px] font-semibold text-gold-700"
                    >
                      <ExternalLink size={10} /> {t('adminBrands.website')}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-ink-100 pt-3">
                <button
                  onClick={() => toggleMut.mutate(b)}
                  disabled={toggleMut.isPending}
                  title={b.active ? t('adminBrands.hide') : t('adminBrands.show')}
                  className="ba-press flex items-center gap-1.5 text-xs font-bold text-ink-500 transition-colors hover:text-gold-700 disabled:opacity-50"
                >
                  {b.active
                    ? <ToggleRight size={20} className="text-emerald-500" />
                    : <ToggleLeft  size={20} className="text-ink-200" />}
                  {b.active ? t('adminBrands.visible') : t('adminBrands.hidden')}
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => openEdit(b)}
                    className="ba-press flex items-center gap-1.5 rounded-xl border border-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:border-gold-400 hover:text-gold-700"
                  >
                    <Edit3 size={11} /> {t('common.edit')}
                  </button>
                  <button
                    onClick={() => setDeleteItem(b)}
                    className="ba-press flex items-center gap-1.5 rounded-xl border border-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 size={11} /> {t('common.delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Create / edit modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        <Modal
          open={showModal}
          onClose={closeModal}
          title={editItem ? t('adminBrands.editTitle') : t('adminBrands.newTitle')}
          subtitle={editItem ? `ID #${editItem.id}` : undefined}
          footer={
            <ModalFooterButtons
              onCancel={closeModal}
              onConfirm={handleSubmit}
              pending={saveMut.isPending}
              cancelLabel={t('common.cancel')}
              confirmLabel={editItem ? t('common.save') : t('common.add')}
              ConfirmIcon={Check}
            />
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t('adminBrands.name')} required>
              <input
                className={INPUT}
                value={form.name}
                required
                onChange={(e) => set('name', e.target.value)}
                placeholder={t('adminBrands.namePlaceholder')}
              />
            </Field>

            {/* Uploads to Supabase Storage; the brand row only keeps the URL. */}
            <ImageUploadField
              label={t('adminBrands.logoUrl')}
              hint={t('adminBrands.logoHint')}
              value={form.logoUrl}
              onChange={(url) => set('logoUrl', url)}
              folder="brands"
              entityId={editItem?.id ?? null}
              upload={brandsApi.uploadImage}
              remove={brandsApi.deleteImage}
              shape="wide"
              fit="contain"
            />

            {/* Without a logo the carousel falls back to initials — show that. */}
            {!form.logoUrl && (
              <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-gray-50 p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-elev-1">
                  <span className="text-xs font-black text-ink-200">
                    {(form.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-ink-400">
                    {t('adminBrands.preview')}
                  </p>
                  <p className="truncate text-sm font-bold text-ink-900">
                    {form.name || t('adminBrands.namePlaceholder')}
                  </p>
                </div>
              </div>
            )}

            <Field label={t('adminBrands.websiteUrl')}>
              <input
                className={INPUT}
                value={form.websiteUrl}
                onChange={(e) => set('websiteUrl', e.target.value)}
                placeholder="https://www.volkswagen.com"
              />
            </Field>

            <Field label={t('adminBrands.sortOrder')} hint={t('adminBrands.sortHint')}>
              <input
                type="number"
                min="0"
                className={INPUT}
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', e.target.value)}
              />
            </Field>

            <ToggleField
              checked={form.active}
              onChange={(next) => set('active', next)}
              label={t('adminBrands.visibleOnSite')}
            />
          </form>
        </Modal>
      </AnimatePresence>

      {/* ── Delete confirmation ────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteItem}
        onCancel={() => setDeleteItem(null)}
        onConfirm={() => deleteMut.mutate(deleteItem.id)}
        pending={deleteMut.isPending}
        Icon={AlertTriangle}
        title={t('adminBrands.deleteTitle')}
        detail={deleteItem?.name}
        message={t('adminBrands.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
