/**
 * Stock ledger panel for one product — the achat / vente history and the
 * remainder computed from it.
 *
 * Stock used to be a number someone typed into the product form: placing an
 * order never touched it, so the figure on a card was fiction after the first
 * sale and there was no way to find out why. The backend now derives
 * `stockQuantity` from `stock_movements`, and this drawer is where those
 * movements are read and created.
 *
 * The type list comes from `GET /stock/movement-types` rather than a local copy
 * of the enum, so adding a case on the backend shows up here without a
 * frontend change.
 */
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  X, Plus, Loader2, Boxes, TrendingUp, TrendingDown, Check,
  ShoppingCart, Truck, AlertTriangle, History, ChevronDown,
} from 'lucide-react'
import { stockApi, suppliersApi, branchesApi } from '../../lib/api'
import { INPUT, LABEL, BTN_PRIMARY, BTN_GHOST, EmptyState, RefreshButton, StatusPill, TH_ROW } from './_ui'

type MovementType = {
  value: string
  label: string
  inbound: boolean
  sign: number
}

/** Fallback list so the form still works if `/stock/movement-types` is slow. */
const FALLBACK_TYPES: MovementType[] = [
  { value: 'OPENING',         label: 'OPENING',         inbound: true,  sign: 1 },
  { value: 'PURCHASE',        label: 'PURCHASE',        inbound: true,  sign: 1 },
  { value: 'SALE',            label: 'SALE',            inbound: false, sign: -1 },
  { value: 'RETURN_CUSTOMER', label: 'RETURN_CUSTOMER', inbound: true,  sign: 1 },
  { value: 'RETURN_SUPPLIER', label: 'RETURN_SUPPLIER', inbound: false, sign: -1 },
  { value: 'ADJUSTMENT_IN',   label: 'ADJUSTMENT_IN',   inbound: true,  sign: 1 },
  { value: 'ADJUSTMENT_OUT',  label: 'ADJUSTMENT_OUT',  inbound: false, sign: -1 },
  { value: 'LOSS',            label: 'LOSS',            inbound: false, sign: -1 },
]

const EMPTY_FORM = {
  type: 'PURCHASE',
  quantity: '1',
  unitPrice: '',
  supplierId: '',
  branchId: '',
  reference: '',
  note: '',
  occurredOn: '',
}

/** One headline figure. Kept local: the shared StatCard animates a count-up
 *  that would re-run on every refetch inside a drawer. */
function Tile({
  label, value, hint, tone, Icon,
}: {
  label: string
  value: string
  hint?: string
  tone: 'gold' | 'green' | 'red' | 'ink'
  Icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  const tones = {
    gold:  'border-gold-200 bg-gold-50 text-gold-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red:   'border-red-200 bg-red-50 text-red-700',
    ink:   'border-ink-100 bg-gray-50 text-ink-700',
  }
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} />
        <p className="truncate text-[10px] font-black uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className="ba-nums mt-1 text-xl font-black">{value}</p>
      {hint && <p className="ba-nums mt-0.5 truncate text-[10px] font-semibold opacity-70">{hint}</p>}
    </div>
  )
}

export default function StockMovementsDrawer({
  product, onClose,
}: {
  product: any
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith('fr')
  const locale = isFr ? 'fr-TN' : 'en-TN'
  const fmtQty = (n: number) => new Intl.NumberFormat(locale).format(n)
  const fmtMoney = (n: number) => new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)
  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: '2-digit' })
  }
  const productName = (value: any) => (isFr ? value?.nameFr : value?.name) || value?.nameFr || value?.name || '—'
  const branchName = (value: any) => (isFr ? value?.nameFr : value?.name) || value?.nameFr || value?.name || '—'
  const typeLabel = (type: MovementType | undefined, code?: string) => {
    const value = code ?? type?.value ?? ''
    return t(`stockMovements.type.${value}`, { defaultValue: type?.label || value })
  }
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)

  const productId: number = product?.id

  const { data: typesData } = useQuery({
    queryKey: ['stock-movement-types'],
    queryFn: stockApi.movementTypes,
    staleTime: Infinity,
  })
  const types: MovementType[] = typesData?.data?.data ?? FALLBACK_TYPES

  const { data: sumData, isLoading: loadingSummary, isFetching: fetchingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['stock-summary', productId],
    queryFn: () => stockApi.summary(productId),
    enabled: !!productId,
  })
  const summary: any = sumData?.data?.data ?? null

  const { data: mvData, isLoading: loadingMoves, isFetching: fetchingMoves, refetch: refetchMoves } = useQuery({
    queryKey: ['stock-movements', productId],
    queryFn: () => stockApi.movements(productId, { size: 100 }),
    enabled: !!productId,
  })
  const movements: any[] = mvData?.data?.data?.content ?? []

  const { data: supData } = useQuery({ queryKey: ['suppliers'], queryFn: () => suppliersApi.list() })
  const suppliers: any[] = supData?.data?.data ?? []

  // The agency decides the trailing code of the ACHAT-… reference the backend mints.
  const { data: branchData } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const branches: any[] = branchData?.data?.data ?? []

  const selectedType = useMemo(
    () => types.find((t) => t.value === form.type) ?? types[0],
    [types, form.type],
  )

  const recordMut = useMutation({
    mutationFn: (d: object) => stockApi.record(productId, d),
    onSuccess: () => {
      // The product list caches the balance, so it has to be invalidated too or
      // the card keeps showing the pre-movement quantity.
      qc.invalidateQueries({ queryKey: ['stock-summary', productId] })
      qc.invalidateQueries({ queryKey: ['stock-movements', productId] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inv-low'] })
      qc.invalidateQueries({ queryKey: ['inv-out'] })
      toast.success(t('stockMovements.toast.recorded'))
      setForm(EMPTY_FORM)
      setShowForm(false)
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.error || e?.response?.data?.message || e?.message || t('stockMovements.toast.recordFailed'),
      ),
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseInt(form.quantity, 10)
    if (!qty || qty <= 0) { toast.error(t('stockMovements.validation.quantity')); return }

    const payload: any = { type: form.type, quantity: qty }
    if (form.unitPrice !== '')  payload.unitPrice = parseFloat(form.unitPrice)
    if (form.supplierId !== '') payload.supplierId = Number(form.supplierId)
    if (form.branchId !== '')   payload.branchId = Number(form.branchId)
    if (form.reference)         payload.reference = form.reference
    if (form.note)              payload.note = form.note
    if (form.occurredOn)        payload.occurredOn = form.occurredOn
    recordMut.mutate(payload)
  }

  const remaining   = summary?.stockQuantity ?? product?.stockQuantity ?? 0
  const purchased   = summary?.totalPurchased ?? 0
  const sold        = summary?.totalSold ?? 0
  const opening     = summary?.totalOpening ?? 0
  const totalIn     = summary?.totalIn ?? 0
  const totalOut    = summary?.totalOut ?? 0
  const margin      = summary?.margin ?? 0
  const busy        = fetchingSummary || fetchingMoves

  /** The cached column and the ledger must agree; showing a mismatch beats
   *  silently trusting the cache. */
  const drift =
    summary && summary.ledgerBalance != null && summary.ledgerBalance !== summary.stockQuantity

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink-900/45 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-elev-4"
        role="dialog"
        aria-label={t('stockMovements.a11y.dialog')}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-100 bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-gold-600">{t('stockMovements.stock')}</p>
            <h2 className="truncate text-base font-black text-ink-900 sm:text-lg">
              {productName(product)}
            </h2>
            <p className="ba-nums truncate text-xs font-medium text-ink-400">
              {product?.brand || '—'} · {product?.sku || `#${productId}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <RefreshButton onClick={() => { refetchSummary(); refetchMoves() }} busy={busy} />
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="ba-press rounded-xl p-2 text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {/* ── Computed balance ─────────────────────────────────────────── */}
          <div>
            <p className={LABEL}>{t('stockMovements.calculation.title')}</p>
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-4">
              <Tile
                label={t('stockMovements.calculation.in')} tone="green" Icon={TrendingUp}
                value={fmtQty(totalIn)}
                hint={t('stockMovements.calculation.purchases', { count: purchased, value: fmtQty(purchased) })}
              />
              <Tile
                label={t('stockMovements.calculation.out')} tone="red" Icon={TrendingDown}
                value={fmtQty(totalOut)}
                hint={t('stockMovements.calculation.sales', { count: sold, value: fmtQty(sold) })}
              />
              <Tile
                label={t('stockMovements.calculation.remaining')} tone="gold" Icon={Boxes}
                value={fmtQty(remaining)}
                hint={t('stockMovements.calculation.threshold', { value: fmtQty(summary?.minimumStock ?? product?.minimumStock ?? 0) })}
              />
              <Tile
                label={t('stockMovements.calculation.margin')} tone="ink" Icon={ShoppingCart}
                value={`${fmtMoney(margin)} TND`}
                hint={t('stockMovements.calculation.marginHint')}
              />
            </div>

            {/* The arithmetic, spelled out — this is the "reste" the user asked
                to see rather than a number to trust blindly. */}
            <div className="ba-nums mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-ink-100 bg-gray-50 px-4 py-3 text-sm font-bold text-ink-600">
              <span className="text-ink-400">{t('stockMovements.calculation.opening')}</span>
              <span className="text-ink-900">{fmtQty(opening)}</span>
              <span className="text-emerald-600">+ {t('stockMovements.calculation.in').toLowerCase()} {fmtQty(totalIn - opening)}</span>
              <span className="text-red-500">− {t('stockMovements.calculation.out').toLowerCase()} {fmtQty(totalOut)}</span>
              <span className="text-ink-300">=</span>
              <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-ink-900">
                {t('stockMovements.calculation.inStock', { value: fmtQty(remaining) })}
              </span>
            </div>

            {drift && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span className="ba-nums">
                  {t('stockMovements.calculation.drift', {
                    product: fmtQty(summary.stockQuantity),
                    ledger: fmtQty(summary.ledgerBalance),
                  })}
                </span>
              </div>
            )}
          </div>

          {/* ── Per-type breakdown ───────────────────────────────────────── */}
          {!!summary?.byType?.length && (
            <div>
              <p className={LABEL}>{t('stockMovements.breakdown')}</p>
              <div className="flex flex-wrap gap-2">
                {summary.byType.map((l: any) => (
                  <span
                    key={l.type}
                    className={`ba-nums inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                      l.inbound
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-600'
                    }`}
                  >
                    {l.inbound ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {typeLabel(types.find((item) => item.value === l.type), l.type)} : {l.inbound ? '+' : '−'}{fmtQty(l.units)}
                    <span className="opacity-60">({fmtMoney(l.value)} TND)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── New movement ─────────────────────────────────────────────── */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className={BTN_PRIMARY + ' w-full'}>
              <Plus size={16} /> {t('stockMovements.new.open')}
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gold-200 bg-gold-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-black text-ink-900">
                  <Plus size={14} className="text-gold-600" /> {t('stockMovements.new.title')}
                </h3>
                <button
                  type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                  aria-label={t('common.cancel')} className="ba-press text-ink-400 hover:text-gold-700"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Type picker — the sign is shown so the effect is never a guess. */}
              <div>
                <label className={LABEL}>{t('stockMovements.form.type')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {types.map((t) => (
                    <button
                      key={t.value} type="button"
                      onClick={() => set('type', t.value)}
                      aria-pressed={form.type === t.value}
                      className={`ba-press inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-300 ease-out-expo ${
                        form.type === t.value
                          ? t.inbound
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-elev-1'
                            : 'border-red-500 bg-red-500 text-white shadow-elev-1'
                          : 'border-ink-100 bg-white text-ink-500 hover:border-gold-400 hover:text-gold-700'
                      }`}
                    >
                      {t.inbound ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {typeLabel(t)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                <div>
                  <label className={LABEL}>{t('stockMovements.form.quantity')} *</label>
                  <input
                    type="number" min="1" required
                    className={INPUT + ' ba-nums'}
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL}>
                    {t(selectedType?.inbound ? 'stockMovements.form.purchaseUnitPrice' : 'stockMovements.form.saleUnitPrice')}
                  </label>
                  <input
                    type="number" step="0.01" min="0"
                    className={INPUT + ' ba-nums'}
                    value={form.unitPrice}
                    onChange={(e) => set('unitPrice', e.target.value)}
                    placeholder="TND"
                  />
                </div>
              </div>

              {form.type === 'PURCHASE' || form.type === 'RETURN_SUPPLIER' ? (
                <div>
                  <label className={LABEL}>{t('stockMovements.form.supplier')}</label>
                  <div className="relative">
                    <select
                      className={INPUT + ' appearance-none pr-10'}
                      value={form.supplierId}
                      onChange={(e) => set('supplierId', e.target.value)}
                    >
                      <option value="">— {t('adminShared.none')} —</option>
                      {suppliers.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  </div>
                </div>
              ) : null}

              {/* Agency — the last segment of the ACHAT-… number for a purchase. */}
              <div>
                <label className={LABEL}>{t('stockMovements.form.branch')}</label>
                <div className="relative">
                  <select
                    className={INPUT + ' appearance-none pr-10'}
                    value={form.branchId}
                    onChange={(e) => set('branchId', e.target.value)}
                  >
                    <option value="">— {t('stockMovements.form.defaultBranch')} —</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {branchName(b)} ({b.agencyCode || String(b.id).padStart(2, '0')})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                </div>
                {form.type === 'PURCHASE' && (
                  <p className="ba-nums mt-1 font-mono text-[10px] font-bold text-ink-400">
                    {t('stockMovements.form.assignedReference')}: ACHAT-XXXXXXX-{String(new Date().getFullYear()).slice(-2)}-{
                      form.branchId
                        ? (branches.find((b: any) => String(b.id) === String(form.branchId))?.agencyCode
                            || String(form.branchId).padStart(2, '0'))
                        : '01'
                    }
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                <div>
                  <label className={LABEL}>{t('stockMovements.form.supplierReference')}</label>
                  <input
                    className={INPUT} value={form.reference}
                    onChange={(e) => set('reference', e.target.value)}
                    placeholder={t('stockMovements.form.supplierReferencePlaceholder')}
                  />
                </div>
                <div>
                  <label className={LABEL}>{t('stockMovements.form.date')}</label>
                  <input
                    type="date" className={INPUT} value={form.occurredOn}
                    onChange={(e) => set('occurredOn', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>{t('stockMovements.form.note')}</label>
                <input
                  className={INPUT} value={form.note}
                  onChange={(e) => set('note', e.target.value)}
                  placeholder={t('stockMovements.form.notePlaceholder')}
                />
              </div>

              {/* Projected result, so an impossible sale is obvious before saving */}
              <div className="ba-nums flex flex-wrap items-center gap-2 text-xs font-bold text-ink-500">
                <span>{t('stockMovements.form.after')}:</span>
                {(() => {
                  const qty = parseInt(form.quantity, 10) || 0
                  const next = remaining + (selectedType?.sign ?? 1) * qty
                  const bad = next < 0
                  return (
                    <StatusPill tone={bad ? 'red' : 'gold'}>
                      {bad ? t('stockMovements.form.insufficient') : t('stockMovements.calculation.inStock', { value: fmtQty(next) })}
                    </StatusPill>
                  )
                })()}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                  className={BTN_GHOST + ' flex-1'}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={recordMut.isPending} className={BTN_PRIMARY + ' flex-1'}>
                  {recordMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {t('common.save')}
                </button>
              </div>
            </form>
          )}

          {/* ── History ──────────────────────────────────────────────────── */}
          <div>
            <p className={LABEL}>{t('stockMovements.history.title')}</p>
            {loadingSummary || loadingMoves ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ba-skeleton h-12 rounded-xl" />
                ))}
              </div>
            ) : movements.length === 0 ? (
              <EmptyState
                Icon={History}
                title={t('stockMovements.history.empty')}
                hint={t('stockMovements.history.emptyHint')}
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-ink-100">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className={TH_ROW}>
                    <tr>
                      <th className="px-3 py-2.5">{t('stockMovements.history.date')}</th>
                      <th className="px-3 py-2.5">{t('stockMovements.history.type')}</th>
                      <th className="px-3 py-2.5">{t('stockMovements.history.document')}</th>
                      <th className="px-3 py-2.5 text-right">{t('stockMovements.history.quantity')}</th>
                      <th className="px-3 py-2.5 text-right">{t('stockMovements.history.unitPrice')}</th>
                      <th className="px-3 py-2.5 text-right">{t('stockMovements.history.remaining')}</th>
                      <th className="px-3 py-2.5">{t('stockMovements.history.reference')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m: any) => {
                      const inbound = (m.signedQuantity ?? 0) >= 0
                      return (
                        <tr key={m.id} className="border-b border-ink-100 last:border-0 hover:bg-gold-50/40">
                          <td className="ba-nums whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-ink-500">
                            {fmtDate(m.occurredAt || m.createdAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${
                                inbound
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-red-200 bg-red-50 text-red-600'
                              }`}
                            >
                              {inbound ? <Truck size={10} /> : <ShoppingCart size={10} />}
                              {typeLabel(types.find((item) => item.value === m.type), m.type)}
                            </span>
                          </td>
                          {/* An achat carries its own ACHAT-… number; a vente shows the
                              FACTURE-… of the order it came from. */}
                          <td className="ba-nums whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-bold text-ink-600">
                            {m.documentNumber || m.reference || '—'}
                          </td>
                          <td className={`ba-nums px-3 py-2.5 text-right font-black ${inbound ? 'text-emerald-600' : 'text-red-500'}`}>
                            {inbound ? '+' : '−'}{fmtQty(m.quantity)}
                          </td>
                          <td className="ba-nums px-3 py-2.5 text-right text-xs font-semibold text-ink-500">
                            {m.unitPrice != null ? fmtMoney(m.unitPrice) : '—'}
                          </td>
                          <td className="ba-nums px-3 py-2.5 text-right font-bold text-ink-900">
                            {fmtQty(m.stockAfter ?? 0)}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2.5 text-xs font-semibold text-ink-400" title={m.note || m.reference || ''}>
                            {m.reference || m.note || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  )
}
