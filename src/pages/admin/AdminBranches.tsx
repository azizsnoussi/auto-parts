import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  MapPin, Plus, Edit3, Check, Phone, Mail, Clock,
  Building2,
} from 'lucide-react'
import { branchesApi } from '../../lib/api'
import {
  INPUT, BTN_PRIMARY, CARD,
  PageHeader, RefreshButton, Field, StatusPill, CardSkeleton, EmptyState,
  Modal, ModalFooterButtons, SearchBar, FilterBar,
} from './_ui'
import ImageUploadField from './ImageUploadField'

const emptyForm = {
  name: '', nameFr: '', agencyCode: '', address: '', city: 'Sousse', country: 'Tunisie',
  phone: '', email: '', openingTime: '08:00:00', closingTime: '18:00:00',
  workshopCapacity: 4, carWashCapacity: 2, imageUrl: '', active: true,
}

/** Same padding the backend applies, so the preview matches the real reference. */
const padAgency = (code: string, id?: number) => {
  const raw = (code ?? '').trim()
  if (raw) return raw.length === 1 ? `0${raw}` : raw
  return id != null ? String(id).padStart(2, '0') : '01'
}

/** Backend BranchStatus → StatusPill tone. */
const STATUS_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  ACTIVE: 'green', MAINTENANCE: 'amber', CLOSED: 'red',
}

export default function AdminBranches() {
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith('fr')
  const branchName = (branch: any) => (isFr ? branch?.nameFr : branch?.name) || branch?.nameFr || branch?.name || '—'
  const statusLabel = (status: string) => t(`adminBranches.status.${status}`, { defaultValue: status })
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['branches'],
    queryFn: branchesApi.list,
  })
  const branches = data?.data?.data ?? []

  /**
   * No date window here on purpose: a workshop opens a handful of branches over
   * its whole life, so "créées cette semaine" would never match anything. City
   * and operating status are the two questions this page actually gets asked.
   */
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return (branches as any[]).filter((b: any) => {
      if (term) {
        const hit =
          (b.nameFr ?? '').toLowerCase().includes(term) ||
          (b.name ?? '').toLowerCase().includes(term) ||
          (b.city ?? '').toLowerCase().includes(term) ||
          (b.address ?? '').toLowerCase().includes(term) ||
          (b.phone ?? '').toLowerCase().includes(term)
        if (!hit) return false
      }
      if (statusFilter === 'INACTIVE') return b.active === false
      if (statusFilter) return b.status === statusFilter
      return true
    })
  }, [branches, search, statusFilter])

  const activeFilters = (search.trim() ? 1 : 0) + (statusFilter ? 1 : 0)
  const clearFilters = () => { setSearch(''); setStatusFilter('') }

  const closeModal = () => { setShowModal(false); setEditItem(null); setForm(emptyForm) }

  const saveMut = useMutation({
    mutationFn: (d: any) => editItem ? branchesApi.update(editItem.id, d) : branchesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success(t(editItem ? 'adminBranches.toast.updated' : 'adminBranches.toast.created'))
      closeModal()
    },
    onError: () => toast.error(t('adminBranches.toast.saveFailed')),
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const openEdit = (b: any) => {
    setEditItem(b)
    setForm({
      name: b.name, nameFr: b.nameFr, agencyCode: b.agencyCode ?? '',
      address: b.address, city: b.city,
      country: b.country, phone: b.phone, email: b.email,
      openingTime: b.openingTime, closingTime: b.closingTime,
      workshopCapacity: b.workshopCapacity, carWashCapacity: b.carWashCapacity,
      imageUrl: b.imageUrl ?? '',
      active: b.active, status: b.status,
    })
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMut.mutate(form)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('adminBranches.title')}
        subtitle={t('adminBranches.subtitle', { count: branches.length })}
      >
        <RefreshButton onClick={() => refetch()} busy={isFetching} />
        <button
          onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true) }}
          className={BTN_PRIMARY}
        >
          <Plus size={16} /> {t('adminBranches.add')}
        </button>
      </PageHeader>

      {/* Filters */}
      <div className={`overflow-hidden ${CARD}`}>
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminBranches.count', { count: filtered.length })}
              {activeFilters > 0 ? ` ${t('adminBranches.ofTotal', { total: branches.length })}` : ''}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('adminBranches.search')}
            className="w-full sm:w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('adminBranches.filterStatus')}
            className={`${INPUT} sm:w-48`}
          >
            <option value="">{t('adminBranches.allStatuses')}</option>
            <option value="ACTIVE">{statusLabel('ACTIVE')}</option>
            <option value="MAINTENANCE">{statusLabel('MAINTENANCE')}</option>
            <option value="CLOSED">{statusLabel('CLOSED')}</option>
            <option value="INACTIVE">{statusLabel('INACTIVE')}</option>
          </select>
        </FilterBar>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton count={4} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          Icon={Building2}
          title={branches.length === 0 ? t('adminBranches.empty.none') : t('adminBranches.empty.noResults')}
          hint={branches.length === 0
            ? t('adminBranches.empty.initial')
            : t('adminBranches.empty.filtered')}
          action={branches.length === 0 ? (
            <button
              onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true) }}
              className={BTN_PRIMARY}
            >
              <Plus size={14} /> {t('adminBranches.add')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((b: any, i: number) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`group ba-lift p-5 transition-colors hover:border-gold-300 ${CARD}`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50">
                  <Building2 size={20} className="text-gold-600" />
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={STATUS_TONE[b.status] ?? 'gray'}>
                    {statusLabel(b.status)}
                  </StatusPill>
                  <button
                    onClick={() => openEdit(b)}
                    aria-label={t('adminBranches.editNamed', { name: branchName(b) })}
                    className="ba-press flex h-7 w-7 items-center justify-center rounded-lg border border-ink-100 bg-white text-ink-400 opacity-0 transition-opacity hover:border-gold-400 hover:text-gold-700 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              </div>

              <h3 className="text-base font-black text-ink-900">{branchName(b)}</h3>
              {/* The agency code is the branch's bookkeeping code. It is no longer
                  part of the invoice number — every agence draws from one shared
                  yearly register, so a reference reads FACTURE-26000001. */}
              <p className="ba-nums mt-1 font-mono text-[11px] font-bold text-ink-400">
                {t('adminBranches.branchCode', { code: padAgency(b.agencyCode, b.id) })}
              </p>

              <div className="mt-3 space-y-1.5 text-sm text-ink-500">
                <p className="flex items-center gap-2">
                  <MapPin size={13} className="shrink-0 text-gold-600" />
                  {b.address}, {b.city}
                </p>
                {b.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={13} className="shrink-0 text-gold-600" /> {b.phone}
                  </p>
                )}
                {b.email && (
                  <p className="flex items-center gap-2">
                    <Mail size={13} className="shrink-0 text-gold-600" /> {b.email}
                  </p>
                )}
                <p className="ba-nums flex items-center gap-2">
                  <Clock size={13} className="shrink-0 text-gold-600" />
                  {b.openingTime?.slice(0, 5)} – {b.closingTime?.slice(0, 5)}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-ink-100 bg-gray-50 p-3 text-center">
                  <p className="ba-nums text-xl font-black text-ink-900">{b.workshopCapacity}</p>
                  <p className="text-[10px] font-semibold text-ink-400">{t('adminBranches.workshopCapacity')}</p>
                </div>
                <div className="rounded-xl border border-ink-100 bg-gray-50 p-3 text-center">
                  <p className="ba-nums text-xl font-black text-ink-900">{b.carWashCapacity}</p>
                  <p className="text-[10px] font-semibold text-ink-400">{t('adminBranches.carWashCapacity')}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        <Modal
          open={showModal}
          onClose={closeModal}
          title={t(editItem ? 'adminBranches.form.editTitle' : 'adminBranches.form.newTitle')}
          subtitle={editItem ? `ID #${editItem.id}` : undefined}
          maxWidth="max-w-md"
          footer={
            <ModalFooterButtons
              onCancel={closeModal}
              onConfirm={handleSubmit}
              pending={saveMut.isPending}
              confirmLabel={t(editItem ? 'adminBranches.form.update' : 'adminBranches.form.create')}
              ConfirmIcon={Check}
            />
          }
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { key: 'name',    label: t('adminBranches.form.nameEn') },
              { key: 'nameFr',  label: t('adminBranches.form.nameFr') },
              { key: 'address', label: t('adminBranches.form.address') },
              { key: 'city',    label: t('adminBranches.form.city') },
              { key: 'phone',   label: t('adminBranches.form.phone') },
              { key: 'email',   label: t('adminBranches.form.email'), type: 'email' },
            ].map(({ key, label, type }) => (
              <Field key={key} label={label}>
                <input
                  value={form[key] ?? ''}
                  onChange={(e) => set(key, e.target.value)}
                  type={type ?? 'text'}
                  className={INPUT}
                />
              </Field>
            ))}

            {/* Bookkeeping code for the site. Left blank the backend falls back to
                the padded id. It does not appear in the invoice number: factures and
                achats are numbered from one register shared by all the agences. */}
            <Field
              label={t('adminBranches.form.agencyCode')}
              hint={t('adminBranches.form.agencyCodeHint', {
                code: padAgency(form.agencyCode, editItem?.id),
                reference: `FACTURE-${String(new Date().getFullYear()).slice(-2)}000001`,
              })}
            >
              <input
                value={form.agencyCode ?? ''}
                onChange={(e) => set('agencyCode', e.target.value)}
                maxLength={8}
                placeholder={editItem?.id != null ? String(editItem.id).padStart(2, '0') : '01'}
                className={INPUT + ' ba-nums font-mono'}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('adminBranches.form.opening')}>
                <input
                  value={form.openingTime}
                  onChange={(e) => set('openingTime', e.target.value)}
                  type="time"
                  className={INPUT}
                />
              </Field>
              <Field label={t('adminBranches.form.closing')}>
                <input
                  value={form.closingTime}
                  onChange={(e) => set('closingTime', e.target.value)}
                  type="time"
                  className={INPUT}
                />
              </Field>
              <Field label={t('adminBranches.workshopCapacity')}>
                <input
                  value={form.workshopCapacity}
                  onChange={(e) => set('workshopCapacity', parseInt(e.target.value) || 0)}
                  type="number" min="1"
                  className={INPUT}
                />
              </Field>
              <Field label={t('adminBranches.carWashCapacity')}>
                <input
                  value={form.carWashCapacity}
                  onChange={(e) => set('carWashCapacity', parseInt(e.target.value) || 0)}
                  type="number" min="1"
                  className={INPUT}
                />
              </Field>
            </div>

            <ImageUploadField
              label={t('adminBranches.form.image')}
              hint={t('adminBranches.form.imageHint')}
              value={form.imageUrl}
              onChange={(url) => set('imageUrl', url)}
              folder="branches"
              entityId={editItem?.id ?? null}
              upload={branchesApi.uploadImage}
              remove={branchesApi.deleteImage}
            />
          </form>
        </Modal>
      </AnimatePresence>
    </div>
  )
}
