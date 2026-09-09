import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Package, AlertTriangle, XCircle, Plus, Minus, X, Check, Loader2, Settings2,
  TrendingDown, Box, PackageSearch, MapPin,
} from 'lucide-react'
import { inventoryApi, branchesApi } from '../../lib/api'
import {
  INPUT, LABEL, BTN_PRIMARY, BTN_GHOST, CARD, TH_ROW, TABLE_MIN,
  PageHeader, RefreshButton, StatCard, FilterChip, StatusPill, TableSkeleton, EmptyState,
  SearchBar, DateRangeFilter, FilterBar, EMPTY_RANGE, inDateRange, isDateRangeActive, type DateRange,
} from './_ui'

export default function AdminInventory() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith('fr')
  const qc = useQueryClient()
  const [tab, setTab] = useState<'all' | 'low' | 'out'>('all')
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const [adjustDirection, setAdjustDirection] = useState<'in' | 'out'>('in')
  const [adjustQuantity, setAdjustQuantity] = useState('1')
  const [adjustNote, setAdjustNote] = useState('')
  const [settingsItem, setSettingsItem] = useState<any>(null)
  const [settings, setSettings] = useState<any>({ minimumStock: 5, maximumStock: 100, location: '', batchNumber: '', expiryDate: '' })

  const { data: branchData } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const branches: any[] = branchData?.data?.data ?? []

  useEffect(() => {
    if (branchId == null && branches.length > 0) setBranchId(Number(branches[0].id))
  }, [branches, branchId])

  const { data: allData, isLoading: loadingAll, isFetching: fetchingAll, refetch: refetchAll } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: () => inventoryApi.byBranch(branchId!),
    enabled: branchId != null,
  })
  const { data: lowData, isFetching: fetchingLow, refetch: refetchLow } =
    useQuery({ queryKey: ['inv-low', branchId], queryFn: () => inventoryApi.lowStock(branchId!), enabled: branchId != null })
  const { data: outData, isFetching: fetchingOut, refetch: refetchOut } =
    useQuery({ queryKey: ['inv-out', branchId], queryFn: () => inventoryApi.outOfStock(branchId!), enabled: branchId != null })

  /**
   * All three tabs feed off separate queries, so the old handler — which called
   * only the branch query's `refetch` — left the "Stock faible" and "Rupture"
   * tabs showing stale rows after a refresh.
   */
  const refreshing = fetchingAll || fetchingLow || fetchingOut
  const refreshAll = () => { refetchAll(); refetchLow(); refetchOut() }

  const adjustMut = useMutation({
    mutationFn: ({ id, delta, note }: { id: number; delta: number; note: string }) =>
      inventoryApi.adjust(id, delta, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inv-low'] })
      qc.invalidateQueries({ queryKey: ['inv-out'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['stock-summary'] })
      qc.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success(t('adminInventory.toast.adjusted'))
      setAdjustItem(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.response?.data?.message || t('adminInventory.toast.adjustFailed')),
  })

  const settingsMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => inventoryApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inv-low'] })
      qc.invalidateQueries({ queryKey: ['inv-out'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(t('adminInventory.toast.settingsSaved'))
      setSettingsItem(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.response?.data?.message || t('adminInventory.toast.settingsFailed')),
  })

  const allItems: any[] = allData?.data?.data ?? []
  const lowItems: any[] = lowData?.data?.data ?? []
  const outItems: any[] = outData?.data?.data ?? []

  const displayItems = tab === 'all' ? allItems : tab === 'low' ? lowItems : outItems

  // ── Filters ─────────────────────────────────────────────────────
  // The window matches the last stock movement (`updatedAt`), which is what
  // "quand ce stock a-t-il boughé ?" actually means; `createdAt` is only the day
  // the inventory line was opened.
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return displayItems.filter((i: any) => {
      if (term) {
        const name = isFr ? i.product?.nameFr : i.product?.name
        const hit =
          (name ?? '').toLowerCase().includes(term) ||
          (i.product?.name ?? '').toLowerCase().includes(term) ||
          (i.product?.sku ?? '').toLowerCase().includes(term) ||
          (i.location ?? '').toLowerCase().includes(term)
        if (!hit) return false
      }
      return inDateRange(i.updatedAt ?? i.createdAt, dateRange)
    })
  }, [displayItems, search, dateRange, isFr])

  const activeFilters = (search.trim() ? 1 : 0) + (isDateRangeActive(dateRange) ? 1 : 0)
  const clearFilters = () => { setSearch(''); setDateRange(EMPTY_RANGE) }

  const openAdjust = (item: any, direction: 'in' | 'out') => {
    setAdjustItem(item); setAdjustDirection(direction); setAdjustQuantity('1'); setAdjustNote('')
  }

  const submitAdjust = (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = parseInt(adjustQuantity, 10)
    if (!quantity || quantity < 1) return toast.error(t('adminInventory.adjust.quantityInvalid'))
    if (!adjustNote.trim()) return toast.error(t('adminInventory.adjust.reasonRequired'))
    adjustMut.mutate({ id: adjustItem.id, delta: adjustDirection === 'in' ? quantity : -quantity, note: adjustNote.trim() })
  }

  const openSettings = (item: any) => {
    setSettingsItem(item)
    setSettings({
      minimumStock: item.minimumStock ?? 0,
      maximumStock: item.maximumStock ?? 100,
      location: item.location ?? '',
      batchNumber: item.batchNumber ?? '',
      expiryDate: item.expiryDate ?? '',
    })
  }

  const statCards = [
    { label: t('adminInventory.stats.total'), value: allItems.length, icon: Box, color: 'bg-blue-500' },
    { label: t('adminInventory.stats.low'), value: lowItems.length, icon: TrendingDown, color: 'bg-amber-500' },
    { label: t('adminInventory.stats.out'), value: outItems.length, icon: XCircle, color: 'bg-red-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title={t('adminInventory.title')} subtitle={t('adminInventory.subtitle')}>
        <select
          value={branchId ?? ''}
          onChange={(e) => setBranchId(Number(e.target.value))}
          aria-label={t('adminInventory.chooseBranch')}
          className={`${INPUT} sm:w-52`}
        >
          {branches.length === 0 && <option value="">{t('adminInventory.noBranch')}</option>}
          {branches.map((b: any) => (
            <option key={b.id} value={b.id}>{(isFr ? b.nameFr : b.name) ?? b.nameFr ?? b.name}</option>
          ))}
        </select>
        <RefreshButton onClick={refreshAll} busy={refreshing} />
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, color }, i) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            Icon={Icon}
            color={color}
            delay={i * 60}
            loading={loadingAll}
          />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all', label: t('adminShared.all'), count: allItems.length },
          { key: 'low', label: t('adminInventory.lowStock'), count: lowItems.length },
          { key: 'out', label: t('adminInventory.outOfStock'), count: outItems.length },
        ] as const).map(({ key, label, count }) => (
          <FilterChip key={key} active={tab === key} onClick={() => setTab(key)} count={count}>
            {label}
          </FilterChip>
        ))}
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-hidden`}>
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminInventory.itemCount', { count: filtered.length })}
              {activeFilters > 0 ? ` ${t('adminInventory.ofTotal', { total: displayItems.length })}` : ''}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminInventory.search')}
            className="w-full sm:w-72"
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </FilterBar>
        <div className="overflow-x-auto">
        <table className={`w-full text-sm ${TABLE_MIN}`}>
          <thead>
            <tr className={TH_ROW}>
              {[t('adminInventory.columns.product'), 'SKU', t('adminInventory.columns.stock'), t('adminInventory.columns.missing'), t('adminInventory.columns.location'), t('adminInventory.columns.status'), t('adminInventory.columns.adjust')].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 font-semibold">
            {loadingAll ? (
              <TableSkeleton rows={5} cols={7} />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    Icon={PackageSearch}
                    title={t('adminInventory.empty.title')}
                    hint={activeFilters > 0
                      ? t('adminInventory.empty.filtered')
                      : t('adminInventory.empty.tab')}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((item: any) => {
                const isOut = item.quantity <= 0
                const isLow = item.quantity > 0 && item.quantity <= item.minimumStock
                const name = isFr ? item.product?.nameFr : item.product?.name
                return (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="transition-colors duration-200 hover:bg-gold-50/40"
                  >
                    {/* Product */}
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="max-w-[200px] truncate font-bold text-ink-900">{name}</p>
                        <p className="text-xs text-ink-400">{item.product?.brand}</p>
                      </div>
                    </td>
                    {/* SKU */}
                    <td className="ba-nums px-5 py-3.5 font-mono text-xs text-ink-500">
                      {item.product?.sku}
                    </td>
                    {/* Qty */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`ba-nums text-lg font-black ${
                          isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-emerald-600'
                        }`}
                      >
                        {item.quantity}
                      </span>
                    </td>
                    {/* Missing / suggested replenishment */}
                    <td className="px-5 py-3.5">
                      <p className="ba-nums text-xs font-black text-amber-600">{item.missingToMinimum ?? Math.max(0, item.minimumStock - item.quantity)}</p>
                      <p className="ba-nums text-[10px] text-ink-400">{t('adminInventory.suggested', { count: item.suggestedReorderQuantity ?? (item.quantity <= item.minimumStock ? Math.max(0, item.maximumStock - item.quantity) : 0) })}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-1"><MapPin size={11} /> {item.location || '—'}</span>
                      <p className="ba-nums mt-0.5 text-[10px] text-ink-300">{item.minimumStock}–{item.maximumStock}</p>
                    </td>
                    {/* Status badge */}
                    <td className="px-5 py-3.5">
                      {isOut ? (
                        <StatusPill tone="red"><XCircle size={11} /> {t('adminInventory.outOfStock')}</StatusPill>
                      ) : isLow ? (
                        <StatusPill tone="amber"><AlertTriangle size={11} /> {t('adminInventory.low')}</StatusPill>
                      ) : (
                        <StatusPill tone="green"><Package size={11} /> OK</StatusPill>
                      )}
                    </td>
                    {/* Adjust buttons */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openAdjust(item, 'out')}
                          disabled={item.quantity <= 0 || adjustMut.isPending}
                          aria-label={t('adminInventory.removeUnit', { name: name ?? t('adminInventory.thisItem') })}
                          className="ba-press flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100 disabled:opacity-30"
                        >
                          <Minus size={12} />
                        </button>
                        <button
                          onClick={() => openAdjust(item, 'in')}
                          disabled={adjustMut.isPending}
                          aria-label={t('adminInventory.addUnit', { name: name ?? t('adminInventory.thisItem') })}
                          className="ba-press flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => openSettings(item)}
                          aria-label={t('adminInventory.settings.open', { name: name ?? t('adminInventory.thisItem') })}
                          className="ba-press flex h-7 w-7 items-center justify-center rounded-lg border border-ink-100 bg-white text-ink-500 transition hover:border-gold-300 hover:bg-gold-50 hover:text-gold-700"
                        >
                          <Settings2 size={12} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      <AnimatePresence>
        {adjustItem && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/55 p-4 backdrop-blur-sm sm:items-center">
            <motion.form onSubmit={submitAdjust} initial={{ opacity: 0, scale: .95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-elev-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-wider text-gold-600">{t('adminInventory.adjust.eyebrow')}</p><h2 className="text-lg font-black text-ink-900">{adjustDirection === 'in' ? t('adminInventory.adjust.inTitle') : t('adminInventory.adjust.outTitle')}</h2><p className="mt-1 text-xs font-semibold text-ink-400">{isFr ? adjustItem.product?.nameFr : adjustItem.product?.name}</p></div>
                <button type="button" onClick={() => setAdjustItem(null)} className="rounded-xl p-2 text-ink-400 hover:bg-gray-50"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-ink-100 bg-gray-50 p-3 text-center">
                <div><p className="text-[10px] font-bold uppercase text-ink-400">{t('adminInventory.adjust.current')}</p><p className="ba-nums text-xl font-black text-ink-900">{adjustItem.quantity}</p></div>
                <div><p className="text-[10px] font-bold uppercase text-ink-400">{t('adminInventory.adjust.after')}</p><p className={`ba-nums text-xl font-black ${(adjustItem.quantity + (adjustDirection === 'in' ? 1 : -1) * (parseInt(adjustQuantity, 10) || 0)) < 0 ? 'text-red-600' : 'text-gold-700'}`}>{adjustItem.quantity + (adjustDirection === 'in' ? 1 : -1) * (parseInt(adjustQuantity, 10) || 0)}</p></div>
              </div>
              <div><label className={LABEL}>{t('adminInventory.adjust.quantity')} *</label><input autoFocus type="number" min="1" max={adjustDirection === 'out' ? adjustItem.quantity : undefined} required className={INPUT + ' ba-nums'} value={adjustQuantity} onChange={e => setAdjustQuantity(e.target.value)} /></div>
              <div><label className={LABEL}>{t('adminInventory.adjust.reason')} *</label><textarea required rows={3} className={INPUT + ' resize-none'} value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder={t('adminInventory.adjust.reasonPlaceholder')} /></div>
              <div className="flex gap-2"><button type="button" onClick={() => setAdjustItem(null)} className={BTN_GHOST + ' flex-1'}>{t('common.cancel')}</button><button disabled={adjustMut.isPending} className={BTN_PRIMARY + ' flex-1'}>{adjustMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{t('common.confirm')}</button></div>
            </motion.form>
          </div>
        )}

        {settingsItem && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/55 p-4 backdrop-blur-sm sm:items-center">
            <motion.form onSubmit={(e) => { e.preventDefault(); settingsMut.mutate({ id: settingsItem.id, data: { ...settings, minimumStock: Number(settings.minimumStock), maximumStock: Number(settings.maximumStock), expiryDate: settings.expiryDate || null } }) }} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-elev-4">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-gold-600">{t('adminInventory.settings.eyebrow')}</p><h2 className="text-lg font-black text-ink-900">{t('adminInventory.settings.title')}</h2></div><button type="button" onClick={() => setSettingsItem(null)} className="rounded-xl p-2 text-ink-400"><X size={18} /></button></div>
              <div className="grid grid-cols-2 gap-3"><div><label className={LABEL}>{t('adminInventory.settings.minimum')}</label><input type="number" min="0" required className={INPUT + ' ba-nums'} value={settings.minimumStock} onChange={e => setSettings((s: any) => ({ ...s, minimumStock: e.target.value }))} /></div><div><label className={LABEL}>{t('adminInventory.settings.maximum')}</label><input type="number" min={settings.minimumStock || 0} required className={INPUT + ' ba-nums'} value={settings.maximumStock} onChange={e => setSettings((s: any) => ({ ...s, maximumStock: e.target.value }))} /></div></div>
              <div><label className={LABEL}>{t('adminInventory.settings.location')}</label><input className={INPUT} value={settings.location} onChange={e => setSettings((s: any) => ({ ...s, location: e.target.value }))} placeholder={t('adminInventory.settings.locationPlaceholder')} /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className={LABEL}>{t('adminInventory.settings.batch')}</label><input className={INPUT} value={settings.batchNumber} onChange={e => setSettings((s: any) => ({ ...s, batchNumber: e.target.value }))} /></div><div><label className={LABEL}>{t('adminInventory.settings.expiry')}</label><input type="date" className={INPUT} value={settings.expiryDate} onChange={e => setSettings((s: any) => ({ ...s, expiryDate: e.target.value }))} /></div></div>
              <div className="flex gap-2"><button type="button" onClick={() => setSettingsItem(null)} className={BTN_GHOST + ' flex-1'}>{t('common.cancel')}</button><button disabled={settingsMut.isPending} className={BTN_PRIMARY + ' flex-1'}>{settingsMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{t('common.save')}</button></div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
