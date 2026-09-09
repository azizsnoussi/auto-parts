import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Edit3, Trash2, X, Check, Loader2, Package,
  Tag, Image, ToggleLeft, ToggleRight, ChevronDown, Star,
  AlertCircle, Percent, DollarSign, Boxes, Eye, EyeOff, History,
} from 'lucide-react'
import { adminProductsApi, categoriesApi } from '../../lib/api'
import {
  INPUT, LABEL, BTN_PRIMARY, CardSkeleton, EmptyState, RefreshButton,
  DateRangeFilter, FilterBar, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'
import ImageUploadField from './ImageUploadField'
import StockMovementsDrawer from './StockMovementsDrawer'

// ─── Empty form state ──────────────────────────────────────────────────────
const EMPTY: any = {
  name: '', nameFr: '',
  description: '', descriptionFr: '',
  brand: '', sku: '', oemReference: '',
  price: '',
  discountedPrice: '',      // promo price
  promoLabel: '',           // e.g. "PROMO", "SOLDES", "-20%"
  categoryId: '',
  stockQuantity: '0',
  minimumStock: '5',
  imageUrl: '',
  active: true,
  featured: false,
}

// ─── Stock status helper ───────────────────────────────────────────────────
function stockBadge(qty: number, minimumStock = 5) {
  if (qty <= 0)  return { state: 'out', cls: 'bg-red-50 text-red-600 border-red-200' }
  if (qty <= minimumStock) return { state: 'low', cls: 'bg-amber-50 text-amber-600 border-amber-200' }
  return { state: 'in', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
}

// ─── Field component ───────────────────────────────────────────────────────
function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className={LABEL}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const TEXTAREA = INPUT + ' resize-none'

/** What the catalogue is narrowed by, beyond the free-text box. */
type StateFilter = 'all' | 'active' | 'inactive' | 'featured' | 'promo'
type StockFilter = 'all' | 'in' | 'low' | 'out'

const STATE_FILTERS: StateFilter[] = ['all', 'active', 'inactive', 'featured', 'promo']
const STOCK_FILTERS: StockFilter[] = ['all', 'in', 'low', 'out']

export default function AdminProducts() {
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith('fr')
  const locale = isFr ? 'fr-TN' : 'en-TN'
  const productName = (p: any) => (isFr ? p?.nameFr : p?.name) || p?.nameFr || p?.name || '—'
  const categoryName = (c: any) => (isFr ? c?.nameFr : c?.name) || c?.nameFr || c?.name || '—'
  const money = (value: any) => new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

  const [search,    setSearch]    = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [showModal, setShowModal] = useState(false)
  const [editItem,  setEditItem]  = useState<any>(null)
  const [form,      setForm]      = useState<any>(EMPTY)
  const [activeTab, setActiveTab] = useState<'info' | 'promo' | 'media'>('info')
  const [deleteId,  setDeleteId]  = useState<number | null>(null)
  /** Product whose stock ledger is open. Stock is no longer edited on the form. */
  const [stockItem, setStockItem] = useState<any>(null)

  // ── Fetch products ─────────────────────────────────────────────────────────
  const { data: prodData, isLoading, isFetching: fetchingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => adminProductsApi.list({ size: 2000 }),
  })
  const products: any[] = prodData?.data?.data?.content ?? prodData?.data?.data ?? []

  // ── Fetch categories ───────────────────────────────────────────────────────
  const { data: catData, isFetching: fetchingCats, refetch: refetchCats } =
    useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const categories: any[] = catData?.data?.data ?? []

  /** The form's category picker is fed by a second query, so refresh both. */
  const refreshing = fetchingProducts || fetchingCats
  const refreshAll = () => { refetchProducts(); refetchCats() }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (d: any) =>
      editItem ? adminProductsApi.update(editItem.id, d) : adminProductsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(t(editItem ? 'adminProducts.toast.updated' : 'adminProducts.toast.created'))
      closeModal()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || t('adminProducts.toast.saveFailed')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminProductsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(t('adminProducts.toast.deleted'))
      setDeleteId(null)
    },
    onError: () => toast.error(t('adminProducts.toast.deleteFailed')),
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setEditItem(null); setForm(EMPTY); setActiveTab('info'); setShowModal(true)
  }

  const openEdit = (p: any) => {
    setEditItem(p)
    setForm({
      name:           p.name ?? '',
      nameFr:         p.nameFr ?? '',
      description:    p.description ?? '',
      descriptionFr:  p.descriptionFr ?? '',
      brand:          p.brand ?? '',
      sku:            p.sku ?? '',
      oemReference:   p.oemReference ?? '',
      price:          p.price ?? '',
      discountedPrice: p.discountedPrice ?? '',
      promoLabel:     p.promoLabel ?? '',
      categoryId:     p.category?.id ?? p.categoryId ?? '',
      stockQuantity:  p.stockQuantity ?? 0,
      minimumStock:   p.minimumStock ?? 5,
      imageUrl:       p.imageUrl ?? '',
      active:         p.active ?? true,
      featured:       p.featured ?? false,
    })
    setActiveTab('info')
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditItem(null); setForm(EMPTY) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      name:           form.name,
      nameFr:         form.nameFr,
      description:    form.description,
      descriptionFr:  form.descriptionFr,
      brand:          form.brand,
      sku:            form.sku,
      oemReference:   form.oemReference,
      price:          parseFloat(form.price) || 0,
      imageUrl:       form.imageUrl,
      active:         form.active,
      featured:       form.featured,
      minimumStock:   Math.max(0, parseInt(form.minimumStock, 10) || 0),
    }
    // `stockQuantity` is only meaningful on create, where the backend files it as
    // an opening balance. On update the ledger owns the number — sending it would
    // be ignored anyway, and offering the field would suggest otherwise.
    if (!editItem) payload.stockQuantity = parseInt(form.stockQuantity) || 0
    if (form.categoryId) payload.categoryId = Number(form.categoryId)
    if (form.discountedPrice) {
      payload.discountedPrice = parseFloat(form.discountedPrice)
      payload.promoLabel      = form.promoLabel || 'PROMO'
    } else {
      payload.discountedPrice = null
      payload.promoLabel      = null
    }
    saveMut.mutate(payload)
  }

  // ── Discount % auto calc ───────────────────────────────────────────────────
  const discountPct = useMemo(() => {
    const base  = parseFloat(form.price)
    const promo = parseFloat(form.discountedPrice)
    if (base > 0 && promo > 0 && promo < base)
      return Math.round(((base - promo) / base) * 100)
    return null
  }, [form.price, form.discountedPrice])

  // ── Filtered list ─────────────────────────────────────────────────────────
  // The query already pulls the whole catalogue (size: 200), so narrowing here
  // costs nothing and keeps every control instant.
  const filtered = useMemo(() => {
    const t = search.toLowerCase().trim()
    return products.filter((p: any) => {
      if (t) {
        const hit =
          (p.name ?? '').toLowerCase().includes(t) ||
          (p.nameFr ?? '').toLowerCase().includes(t) ||
          (p.brand ?? '').toLowerCase().includes(t) ||
          (p.sku ?? '').toLowerCase().includes(t) ||
          (p.oemReference ?? '').toLowerCase().includes(t)
        if (!hit) return false
      }

      if (categoryFilter && String(p.category?.id ?? p.categoryId ?? '') !== categoryFilter) return false
      if (brandFilter && (p.brand ?? '') !== brandFilter) return false

      const hasPromo = Boolean(p.discountedPrice && p.discountedPrice < p.price)
      if (stateFilter === 'active'   && p.active === false) return false
      if (stateFilter === 'inactive' && p.active !== false) return false
      if (stateFilter === 'featured' && !p.featured) return false
      if (stateFilter === 'promo'    && !hasPromo) return false

      const qty = Number(p.stockQuantity ?? 0)
      const threshold = Number(p.minimumStock ?? 5)
      if (stockFilter === 'in'  && !(qty > threshold)) return false
      if (stockFilter === 'low' && !(qty > 0 && qty <= threshold)) return false
      if (stockFilter === 'out' && qty > 0) return false

      return inDateRange(p.createdAt, dateRange)
    })
  }, [products, search, categoryFilter, brandFilter, stateFilter, stockFilter, dateRange])

  /** Brands come from the data itself: there is no brand endpoint for products. */
  const brands = useMemo(
    () => Array.from(new Set(products.map((p: any) => p.brand).filter(Boolean))).sort() as string[],
    [products],
  )

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (brandFilter ? 1 : 0) +
    (stateFilter !== 'all' ? 1 : 0) +
    (stockFilter !== 'all' ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0)

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setBrandFilter('')
    setStateFilter('all')
    setStockFilter('all')
    setDateRange(EMPTY_RANGE)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{t('adminProducts.title')}</h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="ba-nums mt-2 text-sm font-medium text-ink-400">
            {t('adminProducts.catalogCount', { count: products.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton onClick={refreshAll} busy={refreshing} />
          <button onClick={openCreate} className={BTN_PRIMARY}>
            <Plus size={16} /> {t('adminProducts.add')}
          </button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-elev-1">
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminProducts.count', { count: filtered.length })}
              {activeFilters > 0 ? ` ${t('adminProducts.ofTotal', { total: products.length })}` : ''}
            </span>
          }
        >
          <div className="group relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 transition-colors group-focus-within:text-gold-600" />
            <input
              type="text"
              placeholder={t('adminProducts.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT} pl-10`}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={t('adminProducts.filterCategory')}
            className={`${INPUT} sm:w-44`}
          >
            <option value="">{t('adminProducts.allCategories')}</option>
            {categories.map((c: any) => (
              <option key={c.id} value={String(c.id)}>{categoryName(c)}</option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            aria-label={t('adminProducts.filterBrand')}
            className={`${INPUT} sm:w-40`}
          >
            <option value="">{t('adminProducts.allBrands')}</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as StateFilter)}
            aria-label={t('adminProducts.filterState')}
            className={`${INPUT} sm:w-40`}
          >
            {STATE_FILTERS.map((k) => (
              <option key={k} value={k}>{t(`adminProducts.stateFilter.${k}`)}</option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            aria-label={t('adminProducts.filterStock')}
            className={`${INPUT} sm:w-44`}
          >
            {STOCK_FILTERS.map((k) => (
              <option key={k} value={k}>{t(`adminProducts.stockFilter.${k}`)}</option>
            ))}
          </select>

          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </FilterBar>
      </div>

      {/* Products grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CardSkeleton count={8} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          Icon={Package}
          title={products.length === 0 ? t('adminProducts.empty.none') : t('adminProducts.empty.noResults')}
          hint={products.length === 0
            ? t('adminProducts.empty.initial')
            : t('adminProducts.empty.filtered')}
          action={
            <button onClick={openCreate} className={BTN_PRIMARY}>
              <Plus size={15} /> {t('adminProducts.create')}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p: any, idx: number) => {
            const badge = stockBadge(p.stockQuantity ?? 0, p.minimumStock ?? 5)
            const hasPromo = p.discountedPrice && p.discountedPrice < p.price
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx, 10) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="ba-lift group overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-elev-1 transition-colors hover:border-gold-300"
              >
                {/* Product image */}
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-gray-50 to-gold-50/40">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={productName(p)}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package size={32} className="text-ink-200" />
                    </div>
                  )}
                  {/* Promo badge */}
                  {hasPromo && (
                    <div className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white shadow-elev-1">
                      {p.promoLabel || 'PROMO'}
                    </div>
                  )}
                  {/* Active toggle */}
                  <div className={`absolute right-2 top-2 h-5 w-5 rounded-full border-2 border-white shadow-elev-1 ${p.active ? 'bg-emerald-500' : 'bg-ink-200'}`} title={p.active ? t('adminShared.active') : t('adminShared.inactive')} />
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="truncate text-xs font-bold uppercase tracking-wider text-gold-600">
                    {p.brand || '—'}
                  </p>
                  <h3 className="mt-0.5 line-clamp-2 text-sm font-extrabold leading-snug text-ink-900">
                    {productName(p)}
                  </h3>

                  {/* Price row */}
                  <div className="ba-nums mt-2 flex items-baseline gap-2">
                    {hasPromo ? (
                      <>
                        <span className="text-base font-black text-red-600">
                          {money(p.discountedPrice)} TND
                        </span>
                        <span className="text-xs text-ink-400 line-through">
                          {money(p.price)}
                        </span>
                        <span className="text-[10px] font-black text-red-500">
                          -{Math.round(((p.price - p.discountedPrice) / p.price) * 100)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-base font-black text-ink-900">
                        {money(p.price)} TND
                      </span>
                    )}
                  </div>

                  {/* Stock — the number is derived from the ledger, so the pill
                      doubles as the entry point to the achat/vente history. */}
                  <button
                    onClick={() => setStockItem(p)}
                    title={t('adminProducts.stock.openHint')}
                    className={`ba-nums ba-press mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-transform hover:-translate-y-0.5 ${badge.cls}`}
                  >
                    <Boxes size={10} /> {t(`adminProducts.stock.${badge.state}`)} ({p.stockQuantity ?? 0})
                  </button>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3">
                    <button
                      onClick={() => openEdit(p)}
                      className="ba-press flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-100 py-1.5 text-xs font-bold text-ink-600 transition-all duration-300 ease-out-expo hover:border-gold-400 hover:text-gold-700"
                    >
                      <Edit3 size={12} /> {t('adminProducts.edit')}
                    </button>
                    <button
                      onClick={() => setStockItem(p)}
                      aria-label={t('adminProducts.stock.movements')}
                      title={t('adminProducts.stock.purchasesSales')}
                      className="ba-press flex h-8 w-8 items-center justify-center rounded-xl border border-ink-100 text-ink-400 transition-all duration-300 ease-out-expo hover:border-gold-400 hover:bg-gold-50 hover:text-gold-700"
                    >
                      <History size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      aria-label={t('adminProducts.delete.action')}
                      className="ba-press flex h-8 w-8 items-center justify-center rounded-xl border border-ink-100 text-ink-400 transition-all duration-300 ease-out-expo hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Delete confirm dialog ──────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteId !== null && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/55 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="mb-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-elev-4 sm:mb-0"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle size={22} className="text-red-600" />
              </div>
              <h3 className="text-lg font-black text-ink-900">{t('adminProducts.delete.title')}</h3>
              <p className="mt-1 text-sm text-ink-500">{t('adminProducts.delete.message')}</p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="ba-press flex-1 rounded-xl border border-ink-100 py-2.5 text-sm font-bold text-ink-600 transition-colors hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(deleteId!)}
                  className="ba-press flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t('adminProducts.delete.action')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Create / Edit Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-elev-4 sm:max-h-[90vh] sm:rounded-3xl"
            >
              {/* Modal header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black text-ink-900 sm:text-lg">
                    {t(editItem ? 'adminProducts.form.editTitle' : 'adminProducts.form.newTitle')}
                  </h2>
                  <p className="ba-nums truncate text-xs font-medium text-ink-400">
                    {editItem ? `ID #${editItem.id}` : t('adminProducts.form.subtitle')}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  aria-label={t('common.close')}
                  className="ba-press shrink-0 rounded-xl p-2 text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-700"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs — scroll sideways rather than wrapping on a phone. */}
              <div className="flex shrink-0 gap-1 overflow-x-auto px-4 pt-4 sm:px-6">
                {[
                  { id: 'info',  label: t('adminProducts.tabs.info'), icon: Package },
                  { id: 'promo', label: t('adminProducts.tabs.promo'), icon: Tag },
                  { id: 'media', label: t('adminProducts.tabs.media'), icon: Image },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    aria-pressed={activeTab === id}
                    className={`ba-press flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 ease-out-expo ${
                      activeTab === id
                        ? 'bg-gold-500 text-ink-900 shadow-gold-sm'
                        : 'text-ink-500 hover:bg-gold-50 hover:text-gold-700'
                    }`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 sm:px-6">

                {/* ── Tab: Informations ─────────────────────────────────── */}
                {activeTab === 'info' && (
                  <>
                    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                      <Field label={t('adminProducts.form.nameFr')} required>
                        <input className={INPUT} value={form.nameFr} required
                          onChange={e => set('nameFr', e.target.value)}
                          placeholder={t('adminProducts.form.nameFrPlaceholder')} />
                      </Field>
                      <Field label={t('adminProducts.form.nameEn')}>
                        <input className={INPUT} value={form.name}
                          onChange={e => set('name', e.target.value)}
                          placeholder={t('adminProducts.form.nameEnPlaceholder')} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3">
                      <Field label={t('adminProducts.form.brand')}>
                        <input className={INPUT} value={form.brand}
                          onChange={e => set('brand', e.target.value)}
                          placeholder="Bosch, NGK..." />
                      </Field>
                      <Field label="SKU">
                        <input className={INPUT} value={form.sku}
                          onChange={e => set('sku', e.target.value)}
                          placeholder="BOS-0451103..." />
                      </Field>
                      <Field label={t('adminProducts.form.oemReference')}>
                        <input className={INPUT} value={form.oemReference}
                          onChange={e => set('oemReference', e.target.value)}
                          placeholder="0451103141" />
                      </Field>
                    </div>

                    <Field label={t('adminProducts.form.category')}>
                      <div className="relative">
                        <select
                          value={form.categoryId}
                          onChange={e => set('categoryId', e.target.value)}
                          className={INPUT + ' appearance-none pr-10'}
                        >
                          <option value="">— {t('adminProducts.form.selectCategory')} —</option>
                          {categories.map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {categoryName(c)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                      </div>
                    </Field>

                    <Field label={t('adminProducts.form.descriptionFr')}>
                      <textarea className={TEXTAREA} rows={3} value={form.descriptionFr}
                        onChange={e => set('descriptionFr', e.target.value)}
                        placeholder={t('adminProducts.form.descriptionFrPlaceholder')} />
                    </Field>
                    <Field label={t('adminProducts.form.descriptionEn')}>
                      <textarea className={TEXTAREA} rows={2} value={form.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder={t('adminProducts.form.descriptionEnPlaceholder')} />
                    </Field>

                    {/* Active / Featured toggles */}
                    <div className="flex items-center gap-6 pt-1">
                      <button type="button" onClick={() => set('active', !form.active)}
                        className="ba-press flex items-center gap-2 text-sm font-bold text-ink-700">
                        {form.active
                          ? <ToggleRight size={22} className="text-emerald-500" />
                          : <ToggleLeft  size={22} className="text-ink-200" />}
                        {t('adminProducts.form.active')}
                      </button>
                      <button type="button" onClick={() => set('featured', !form.featured)}
                        className="ba-press flex items-center gap-2 text-sm font-bold text-ink-700">
                        <Star size={16} className={form.featured ? 'text-gold-500 fill-gold-500' : 'text-ink-200'} />
                        {t('adminProducts.form.featured')}
                      </button>
                    </div>
                  </>
                )}

                {/* ── Tab: Prix & Promo ─────────────────────────────────── */}
                {activeTab === 'promo' && (
                  <>
                    <div className="space-y-4 rounded-2xl border border-gold-200 bg-gold-50/60 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-black text-ink-900">
                        <DollarSign size={15} className="text-gold-600" /> {t('adminProducts.form.basePrice')}
                      </h3>
                      <Field label={t('adminProducts.form.normalPrice')} required>
                        <div className="relative">
                          <input
                            type="number" step="0.01" min="0"
                            className={INPUT + ' ba-nums pl-14'} value={form.price} required
                            onChange={e => set('price', e.target.value)}
                            placeholder="0.00"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-400">TND</span>
                        </div>
                      </Field>
                    </div>

                    <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-4">
                      <h3 className="text-sm font-black text-red-700 flex items-center gap-2">
                        <Percent size={15} className="text-red-500" /> {t('adminProducts.form.promoPriceTitle')}
                      </h3>
                      <Field label={t('adminProducts.form.promoPrice')}>
                        <div className="relative">
                          <input
                            type="number" step="0.01" min="0"
                            className={INPUT + ' ba-nums pl-14 border-red-200 focus:border-red-400'}
                            value={form.discountedPrice}
                            onChange={e => set('discountedPrice', e.target.value)}
                            placeholder={t('adminProducts.form.promoPricePlaceholder')}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-sm font-bold">TND</span>
                        </div>
                      </Field>

                      {/* Auto discount percentage */}
                      {discountPct !== null && (
                        <div className="flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2">
                          <Percent size={14} className="text-red-600" />
                          <span className="text-sm font-black text-red-700">
                            {t('adminProducts.form.discount', { percent: discountPct })}
                          </span>
                          <span className="text-xs text-red-500">
                            ({t('adminProducts.form.savings', { amount: money(parseFloat(form.price) - parseFloat(form.discountedPrice)) })})
                          </span>
                        </div>
                      )}

                      <Field label={t('adminProducts.form.promoLabel')}>
                        <input className={INPUT + ' border-red-200 focus:border-red-400'} value={form.promoLabel}
                          onChange={e => set('promoLabel', e.target.value)}
                          placeholder={t('adminProducts.form.promoLabelPlaceholder')} />
                        <p className="mt-1 text-[10px] text-ink-400">
                          {t('adminProducts.form.promoLabelHint')}
                        </p>
                      </Field>

                      {form.discountedPrice && (
                        <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-200 px-3 py-2">
                          <Tag size={14} className="text-red-600" />
                          <span className="text-xs font-bold text-red-700">
                            {t('adminProducts.form.badgePreview')} <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] ml-1">{form.promoLabel || 'PROMO'}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── Tab: Image & Stock ────────────────────────────────── */}
                {activeTab === 'media' && (
                  <>
                    {/* Uploads to Supabase Storage; only the returned URL is kept. */}
                    <ImageUploadField
                      label={t('adminProducts.form.image')}
                      value={form.imageUrl}
                      onChange={(url) => set('imageUrl', url)}
                      folder="products"
                      entityId={editItem?.id ?? null}
                      upload={adminProductsApi.uploadImage}
                      remove={adminProductsApi.deleteImage}
                      fit="contain"
                      hint={t('adminProducts.form.imageHint')}
                    />

                    <Field label={t('adminProducts.stock.minimum')} required>
                      <input
                        type="number" min="0" required
                        className={INPUT + ' ba-nums'} value={form.minimumStock}
                        onChange={e => set('minimumStock', e.target.value)}
                      />
                      <p className="mt-1 text-[10px] text-ink-400">{t('adminProducts.stock.minimumHint')}</p>
                    </Field>

                    {editItem ? (
                      /* On an existing product the ledger owns the balance, so the
                         form shows it read-only and sends the user to the journal
                         instead of letting them overwrite it without a reason. */
                      <div className="space-y-3 rounded-2xl border border-gold-200 bg-gold-50/60 p-4">
                        <h3 className="flex items-center gap-2 text-sm font-black text-ink-900">
                          <Boxes size={15} className="text-gold-600" /> {t('adminProducts.stock.current')}
                        </h3>
                        <p className="ba-nums text-3xl font-black text-ink-900">
                          {editItem.stockQuantity ?? 0}
                          <span className="ml-2 text-xs font-bold text-ink-400">{t('adminProducts.stock.units')}</span>
                        </p>
                        <p className="text-xs font-medium text-ink-500">
                          {t('adminProducts.stock.ledgerHint')}
                        </p>
                        <button
                          type="button"
                          onClick={() => { const p = editItem; closeModal(); setStockItem(p) }}
                          className={BTN_PRIMARY + ' w-full'}
                        >
                          <History size={15} /> {t('adminProducts.stock.openLedger')}
                        </button>
                      </div>
                    ) : (
                      <Field label={t('adminProducts.stock.initial')} required>
                        <div className="flex items-center gap-3">
                          <button type="button"
                            onClick={() => set('stockQuantity', Math.max(0, parseInt(form.stockQuantity || 0) - 1))}
                            aria-label={t('adminProducts.stock.decrease')}
                            className="ba-press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-100 text-lg font-bold text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-700"
                          >−</button>
                          <input type="number" min="0" className={INPUT + ' ba-nums text-center'} value={form.stockQuantity}
                            onChange={e => set('stockQuantity', e.target.value)} />
                          <button type="button"
                            onClick={() => set('stockQuantity', parseInt(form.stockQuantity || 0) + 1)}
                            aria-label={t('adminProducts.stock.increase')}
                            className="ba-press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-100 text-lg font-bold text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-700"
                          >+</button>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-400">
                          {t('adminProducts.stock.initialHint')}
                        </p>
                      </Field>
                    )}

                    {/* Stock status indicator */}
                    {(() => {
                      const b = stockBadge(parseInt(String(editItem ? (editItem.stockQuantity ?? 0) : form.stockQuantity) || '0'), parseInt(String(form.minimumStock) || '5'))
                      return (
                        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${b.cls}`}>
                          <Boxes size={15} />
                          {t('adminProducts.stock.status')}: {t(`adminProducts.stock.${b.state}`)}
                        </div>
                      )
                    })()}
                  </>
                )}
              </form>

              {/* Modal footer */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ink-100 bg-gray-50 px-6 py-4">
                <div className="flex gap-2">
                  {['info', 'promo', 'media'].map((tab) => (
                    <button key={tab} type="button"
                      onClick={() => setActiveTab(tab as any)}
                      aria-label={t('adminProducts.tabs.open', { tab: t(`adminProducts.tabs.${tab}`) })}
                      className={`h-2 w-8 rounded-full transition-all duration-300 ease-out-expo ${activeTab === tab ? 'bg-gold-500' : 'bg-ink-100 hover:bg-gold-300'}`}
                    />
                  ))}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal}
                    className="ba-press rounded-xl border border-ink-100 bg-white px-5 py-2.5 text-sm font-bold text-ink-600 transition-colors hover:bg-gray-100">
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSubmit as any}
                    disabled={saveMut.isPending}
                    className={BTN_PRIMARY}
                  >
                    {saveMut.isPending
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Check size={15} />}
                    {t(editItem ? 'adminProducts.form.update' : 'adminProducts.form.create')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Stock ledger drawer (achats / ventes / reste) ────────────────── */}
      <AnimatePresence>
        {stockItem && (
          <StockMovementsDrawer product={stockItem} onClose={() => setStockItem(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
