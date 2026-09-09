import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Plus, Edit3, Check,
  ChevronDown, FolderOpen, Folder,
} from 'lucide-react'
import { categoriesApi } from '../../lib/api'
import {
  INPUT, BTN_PRIMARY, CARD,
  PageHeader, RefreshButton, SearchBar, Field, StatusPill, CardSkeleton, EmptyState,
  Modal, ModalFooterButtons, ToggleField,
  DateRangeFilter, FilterBar, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'
import ImageUploadField from './ImageUploadField'

const EMPTY: any = {
  name: '', nameFr: '',
  description: '', descriptionFr: '',
  imageUrl: '', iconName: '',
  sortOrder: 0, active: true, parentId: '',
}

export default function AdminCategories() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith('fr')
  const displayName = (c: any) => (isFr ? c.nameFr : c.name) ?? c.nameFr ?? c.name
  const displayDescription = (c: any) => (isFr ? c.descriptionFr : c.description) ?? c.descriptionFr ?? c.description
  const qc = useQueryClient()
  const [search,    setSearch]    = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [showModal, setShowModal] = useState(false)
  const [editItem,  setEditItem]  = useState<any>(null)
  const [form,      setForm]      = useState<any>(EMPTY)

  // ── Fetch categories ──────────────────────────────────────────────────────
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-categories'],
    queryFn:  categoriesApi.list,
  })
  const categories: any[] = data?.data?.data ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (d: any) =>
      editItem ? categoriesApi.update(editItem.id, d) : categoriesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(t(editItem ? 'adminCategories.toast.updated' : 'adminCategories.toast.created'))
      closeModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t('adminCategories.toast.failed')),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const openCreate = () => { setEditItem(null); setForm(EMPTY); setShowModal(true) }
  /** New category pre-parented to `parentId` (the "Ajouter" chip under a parent). */
  const openCreateChild = (parentId: number) => {
    setEditItem(null); setForm({ ...EMPTY, parentId }); setShowModal(true)
  }
  const openEdit   = (c: any) => {
    setEditItem(c)
    setForm({
      name: c.name ?? '', nameFr: c.nameFr ?? '',
      description: c.description ?? '', descriptionFr: c.descriptionFr ?? '',
      imageUrl: c.imageUrl ?? '', iconName: c.iconName ?? '',
      sortOrder: c.sortOrder ?? 0, active: c.active ?? true,
      parentId: c.parent?.id ?? '',
    })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditItem(null); setForm(EMPTY) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      name:          form.name,
      nameFr:        form.nameFr,
      description:   form.description,
      descriptionFr: form.descriptionFr,
      imageUrl:      form.imageUrl,
      iconName:      form.iconName,
      sortOrder:     parseInt(form.sortOrder) || 0,
      active:        form.active,
    }
    if (form.parentId) payload.parent = { id: Number(form.parentId) }
    saveMut.mutate(payload)
  }

  // ── Filtered ──────────────────────────────────────────────────────────────
  const matchIds = useMemo(() => {
    const t = search.toLowerCase().trim()
    const ids = new Set<number>()
    categories.forEach((c: any) => {
      if (t) {
        const hit =
          (c.name ?? '').toLowerCase().includes(t) ||
          (c.nameFr ?? '').toLowerCase().includes(t) ||
          (c.descriptionFr ?? '').toLowerCase().includes(t)
        if (!hit) return
      }
      if (stateFilter === 'active' && !c.active) return
      if (stateFilter === 'inactive' && c.active) return
      if (!inDateRange(c.createdAt, dateRange)) return
      ids.add(c.id)
    })
    return ids
  }, [categories, search, stateFilter, dateRange])

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (stateFilter !== 'all' ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0)

  const clearFilters = () => {
    setSearch('')
    setStateFilter('all')
    setDateRange(EMPTY_RANGE)
  }

  /**
   * The tree is rendered parent-first, so a sub-category that matches has to
   * pull its parent into the list — otherwise searching for a sub-category name
   * returned "Aucun résultat" even though the row existed.
   */
  const topLevel = useMemo(
    () => categories.filter((c: any) =>
      !c.parent &&
      (matchIds.has(c.id) || categories.some((s: any) => s.parent?.id === c.id && matchIds.has(s.id)))),
    [categories, matchIds],
  )

  const matchCount = matchIds.size

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('adminCategories.title')}
        subtitle={t('adminCategories.total', { count: categories.length })}
      >
        <RefreshButton onClick={() => refetch()} busy={isFetching} />
        <button onClick={openCreate} className={BTN_PRIMARY}>
          <Plus size={16} /> {t('adminCategories.new')}
        </button>
      </PageHeader>

      {/* Search & filters */}
      <div className={`overflow-hidden ${CARD}`}>
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminCategories.count', { count: matchCount })}
              {activeFilters > 0 ? ` ${t('adminCategories.ofTotal', { total: categories.length })}` : ''}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminCategories.search')}
            className="w-full sm:w-72"
          />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as 'all' | 'active' | 'inactive')}
            aria-label={t('adminCategories.filterState')}
            className={`${INPUT} sm:w-44`}
          >
            <option value="all">{t('adminCategories.allStates')}</option>
            <option value="active">{t('adminShared.active')}</option>
            <option value="inactive">{t('adminShared.inactive')}</option>
          </select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </FilterBar>
      </div>

      {/* Categories grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton count={6} />
        </div>
      ) : topLevel.length === 0 ? (
        <EmptyState
          Icon={FolderOpen}
          title={categories.length === 0 ? t('adminCategories.empty.none') : t('adminCategories.empty.noResults')}
          hint={categories.length === 0
            ? undefined
            : t('adminCategories.empty.hint')}
          action={categories.length === 0 ? (
            <button onClick={openCreate} className={BTN_PRIMARY}>
              <Plus size={14} /> {t('adminCategories.empty.createFirst')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {topLevel.map((cat: any, idx: number) => {
            // When a filter is on, only the sub-categories that match are listed —
            // showing the whole branch would contradict the counter above.
            const subs = categories.filter((c: any) =>
              c.parent?.id === cat.id && (activeFilters === 0 || matchIds.has(c.id)))
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`${CARD} overflow-hidden`}
              >
                {/* Parent category row */}
                <div className="flex items-center gap-4 p-4">
                  {/* Icon/Image */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-50">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={displayName(cat)} className="h-10 w-10 rounded-xl object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <Folder size={22} className="text-gold-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-extrabold text-ink-900">
                        {displayName(cat)}
                      </h3>
                      {cat.name && cat.nameFr && cat.name !== cat.nameFr && (
                        <span className="text-xs font-medium text-ink-400">({cat.name})</span>
                      )}
                      <StatusPill tone={cat.active ? 'green' : 'gray'}>
                        {cat.active ? t('adminShared.active') : t('adminShared.inactive')}
                      </StatusPill>
                      {subs.length > 0 && (
                        <StatusPill tone="blue">
                          {t('adminCategories.subCount', { count: subs.length })}
                        </StatusPill>
                      )}
                    </div>
                    {displayDescription(cat) && (
                      <p className="mt-0.5 truncate text-xs font-medium text-ink-400">{displayDescription(cat)}</p>
                    )}
                    <p className="ba-nums mt-0.5 font-mono text-[10px] text-ink-300">ID #{cat.id} · {t('adminCategories.order')} {cat.sortOrder}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openEdit(cat)}
                      className="ba-press flex items-center gap-1.5 rounded-xl border border-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:border-gold-400 hover:text-gold-700"
                    >
                      <Edit3 size={11} /> {t('adminCategories.edit')}
                    </button>
                  </div>
                </div>

                {/* Sub-categories */}
                {subs.length > 0 && (
                  <div className="border-t border-ink-100 bg-gray-50 px-4 py-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-ink-400">{t('adminCategories.subcategories')}</p>
                    <div className="flex flex-wrap gap-2">
                      {subs.map((sub: any) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:border-gold-400"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                          {displayName(sub)}
                          <button
                            onClick={() => openEdit(sub)}
                            aria-label={t('adminCategories.editNamed', { name: displayName(sub) })}
                            className="ba-press ml-1 text-ink-300 transition-colors hover:text-gold-700"
                          >
                            <Edit3 size={10} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => openCreateChild(cat.id)}
                        className="ba-press flex items-center gap-1.5 rounded-lg border border-dashed border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-400 transition-colors hover:border-gold-400 hover:text-gold-700"
                      >
                        <Plus size={11} /> {t('adminCategories.add')}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        <Modal
          open={showModal}
          onClose={closeModal}
          title={t(editItem ? 'adminCategories.form.editTitle' : 'adminCategories.form.newTitle')}
          subtitle={editItem ? `ID #${editItem.id}` : undefined}
          footer={
            <ModalFooterButtons
              onCancel={closeModal}
              onConfirm={handleSubmit}
              pending={saveMut.isPending}
              confirmLabel={t(editItem ? 'adminCategories.form.update' : 'adminCategories.form.create')}
              ConfirmIcon={Check}
            />
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('adminCategories.form.nameFr')} required>
                <input className={INPUT} value={form.nameFr} required
                  onChange={e => set('nameFr', e.target.value)} placeholder={t('adminCategories.form.nameFrPlaceholder')} />
              </Field>
              <Field label={t('adminCategories.form.nameEn')}>
                <input className={INPUT} value={form.name}
                  onChange={e => set('name', e.target.value)} placeholder={t('adminCategories.form.nameEnPlaceholder')} />
              </Field>
            </div>

            <Field label={t('adminCategories.form.parent')}>
              <div className="relative">
                <select
                  value={form.parentId}
                  onChange={e => set('parentId', e.target.value)}
                  className={INPUT + ' appearance-none pr-10'}
                >
                  <option value="">— {t('adminCategories.form.mainCategory')} —</option>
                  {categories
                    .filter((c: any) => !c.parent && c.id !== editItem?.id)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>{displayName(c)}</option>
                    ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-300" />
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('adminCategories.form.descriptionFr')}>
                <textarea className={INPUT + ' resize-none'} rows={2} value={form.descriptionFr}
                  onChange={e => set('descriptionFr', e.target.value)} placeholder={t('adminCategories.form.descriptionFrPlaceholder')} />
              </Field>
              <Field label={t('adminCategories.form.descriptionEn')}>
                <textarea className={INPUT + ' resize-none'} rows={2} value={form.description}
                  onChange={e => set('description', e.target.value)} placeholder={t('adminCategories.form.descriptionEnPlaceholder')} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Uploads to Supabase Storage; only the returned URL is kept. */}
              <ImageUploadField
                label={t('adminCategories.form.image')}
                value={form.imageUrl}
                onChange={(url) => set('imageUrl', url)}
                folder="categories"
                entityId={editItem?.id ?? null}
                upload={categoriesApi.uploadImage}
                remove={categoriesApi.deleteImage}
                shape="wide"
              />
              <Field label={t('adminCategories.form.icon')}>
                <input className={INPUT} value={form.iconName}
                  onChange={e => set('iconName', e.target.value)} placeholder={t('adminCategories.form.iconPlaceholder')} />
              </Field>
            </div>

            <Field label={t('adminCategories.form.sortOrder')}>
              <input type="number" min="0" className={INPUT} value={form.sortOrder}
                onChange={e => set('sortOrder', e.target.value)} />
            </Field>

            <ToggleField
              checked={form.active}
              onChange={(next) => set('active', next)}
              label={t('adminCategories.form.active')}
            />
          </form>
        </Modal>
      </AnimatePresence>
    </div>
  )
}
