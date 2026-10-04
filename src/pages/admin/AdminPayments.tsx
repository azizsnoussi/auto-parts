import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import {
  Wallet,
  Search,
  Plus,
  Eye,
  Banknote,
  CreditCard,
  Landmark,
  FileCheck,
  Coins,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAdminResource,
  createAdminResource,
  mutateAdminResource,
  getAdminEntityOptions,
  type AdminEntityOption,
  ERP_ENDPOINTS,
} from '../../api';
import {
  INPUT,
  TH_ROW,
  TABLE_MIN_WIDE,
  CARD,
  BTN_PRIMARY,
  BTN_GHOST,
  EmptyState,
  RefreshButton,
  TableSkeleton,
  ConfirmDialog,
  DateRangeFilter,
  EMPTY_RANGE,
  inDateRange,
  type DateRange,
  ROW_ACTIONS_CELL,
  ROW_ACTIONS,
  rowActionBtn,
  rowActionLabelBtn,
  EntityPicker,
} from './_ui';

/* -------------------------------------------------------------------------- */
/*  Règlements / Encaissements (Payments) — Gestion commerciale                */
/*  Self-contained module: renders standalone with local data until the        */
/*  backend endpoints are wired.                                                */
/* -------------------------------------------------------------------------- */

type PayDirection = 'in' | 'out'; // encaissement client / décaissement fournisseur
type PayMethod = 'cash' | 'cheque' | 'transfer' | 'card' | 'traite';
type PayStatus = 'pending' | 'cleared' | 'bounced' | 'cancelled';

interface Payment {
  id: string;
  reference: string;
  direction: PayDirection;
  party: string; // client ou fournisseur
  method: PayMethod;
  linkedDoc: string; // facture liée
  date: string; // ISO
  amount: number; // TND
  status: PayStatus;
}

const MOCK_PAYMENTS: Payment[] = [
  { id: 'r1', reference: 'REG-2025-0121', direction: 'in', party: 'Sté Méditerranée Auto', method: 'transfer', linkedDoc: 'FAC-2025-0203', date: '2025-02-16', amount: 5738.0, status: 'cleared' },
  { id: 'r2', reference: 'REG-2025-0120', direction: 'in', party: 'Garage El Amine', method: 'cheque', linkedDoc: 'FAC-2025-0202', date: '2025-02-15', amount: 1476.2, status: 'pending' },
  { id: 'r3', reference: 'REG-2025-0119', direction: 'out', party: 'Bosch Tunisie', method: 'transfer', linkedDoc: 'BC-2025-0042', date: '2025-02-14', amount: 10020.8, status: 'cleared' },
  { id: 'r4', reference: 'REG-2025-0118', direction: 'in', party: 'Mohamed Trabelsi', method: 'cash', linkedDoc: 'FAC-2025-0198', date: '2025-02-13', amount: 376.8, status: 'cleared' },
  { id: 'r5', reference: 'REG-2025-0117', direction: 'in', party: 'Transport Nabeul SARL', method: 'traite', linkedDoc: 'FAC-2025-0201', date: '2025-02-12', amount: 8021.1, status: 'pending' },
  { id: 'r6', reference: 'REG-2025-0116', direction: 'out', party: 'Valeo Distribution', method: 'cheque', linkedDoc: 'BC-2025-0041', date: '2025-02-11', amount: 3713.4, status: 'bounced' },
  { id: 'r7', reference: 'REG-2025-0115', direction: 'in', party: 'Flotte Taxi Ariana', method: 'card', linkedDoc: 'FAC-2025-0197', date: '2025-02-10', amount: 4236.4, status: 'cleared' },
  { id: 'r8', reference: 'REG-2025-0114', direction: 'in', party: 'Sté Logistique Sousse', method: 'transfer', linkedDoc: 'FAC-2025-0195', date: '2025-02-08', amount: 10621.3, status: 'cleared' },
  { id: 'r9', reference: 'REG-2025-0113', direction: 'out', party: 'Michelin Tunisie', method: 'transfer', linkedDoc: 'BC-2025-0038', date: '2025-02-06', amount: 14852.2, status: 'cleared' },
  { id: 'r10', reference: 'REG-2025-0112', direction: 'in', party: 'Salma Gharbi', method: 'cash', linkedDoc: 'FAC-2025-0190', date: '2025-02-04', amount: 539.4, status: 'cleared' },
  { id: 'r11', reference: 'REG-2025-0111', direction: 'in', party: 'Auto Service Sfax', method: 'cheque', linkedDoc: 'FAC-2025-0188', date: '2025-02-02', amount: 2511.9, status: 'cancelled' },
  { id: 'r12', reference: 'REG-2025-0110', direction: 'out', party: 'Sté Batteries Assad', method: 'traite', linkedDoc: 'BC-2025-0037', date: '2025-01-31', amount: 6224.7, status: 'pending' },
];

const METHOD_CONFIG: Record<
  PayMethod,
  { key: string; fallback: string; Icon: ComponentType<{ className?: string }> }
> = {
  cash: { key: 'adminPayments.method.cash', fallback: 'Espèces', Icon: Banknote },
  cheque: { key: 'adminPayments.method.cheque', fallback: 'Chèque', Icon: FileCheck },
  transfer: { key: 'adminPayments.method.transfer', fallback: 'Virement', Icon: Landmark },
  card: { key: 'adminPayments.method.card', fallback: 'Carte', Icon: CreditCard },
  traite: { key: 'adminPayments.method.traite', fallback: 'Traite', Icon: Coins },
};

const STATUS_CONFIG: Record<
  PayStatus,
  { key: string; fallback: string; Icon: ComponentType<{ className?: string }>; className: string }
> = {
  pending: { key: 'adminPayments.status.pending', fallback: 'En attente', Icon: Clock, className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  cleared: { key: 'adminPayments.status.cleared', fallback: 'Encaissé', Icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  bounced: { key: 'adminPayments.status.bounced', fallback: 'Rejeté', Icon: XCircle, className: 'bg-red-50 text-red-700 ring-red-200' },
  cancelled: { key: 'adminPayments.status.cancelled', fallback: 'Annulé', Icon: XCircle, className: 'bg-ink-100 text-ink-600 ring-ink-200' },
};

const STATUS_ORDER: PayStatus[] = ['pending', 'cleared', 'bounced', 'cancelled'];
const ROWS_PER_PAGE = 8;

export default function AdminPayments() {
  const { t, i18n } = useTranslation();
  const { token, hasPermission, isAdmin } = useAuth();
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN';
  // "if i have the access" — write actions gated on PAYMENT_MANAGE.
  const canManage = isAdmin || hasPermission('PAYMENT_MANAGE');

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    [locale],
  );
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale],
  );

  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<PayDirection | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PayStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientOptions, setClientOptions] = useState<AdminEntityOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<AdminEntityOption[]>([]);
  const emptyForm = {
    partyId: null as number | null,
    party: '',
    direction: 'in' as PayDirection,
    method: 'transfer' as PayMethod,
    linkedDoc: '',
    amount: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<Payment | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ payment: Payment; next: PayStatus } | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, live: isLive } = await getAdminResource<Payment>(
        ERP_ENDPOINTS.payments,
        token ?? '',
        MOCK_PAYMENTS,
      );
      setRows(items);
      setLive(isLive);
    } catch {
      setError(t('adminPayments.error', 'Impossible de charger les règlements.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  // Load pickable clients and suppliers for the create modal. Which list is
  // shown depends on the payment direction (in → client, out → supplier).
  useEffect(() => {
    if (!token) return;
    void getAdminEntityOptions('clients', token).then(setClientOptions);
    void getAdminEntityOptions('suppliers', token).then(setSupplierOptions);
  }, [token]);

  // The party options for the currently-selected direction.
  const partyOptions = form.direction === 'in' ? clientOptions : supplierOptions;

  // Advance a payment status (pending → cleared, or mark bounced/cancelled).
  const applyStatus = useCallback(
    async (payment: Payment, next: PayStatus) => {
      setBusy(true);
      await mutateAdminResource(`${ERP_ENDPOINTS.payments}/${payment.id}`, token ?? '', {
        method: 'PATCH',
        body: { status: next },
      });
      setRows((prev) => prev.map((r) => (r.id === payment.id ? { ...r, status: next } : r)));
      setSelected((cur) => (cur && cur.id === payment.id ? { ...cur, status: next } : cur));
      setBusy(false);
      setConfirmAction(null);
      toast.success(
        t('adminPayments.toast.status', 'Règlement {{n}} : {{s}}', {
          n: payment.reference,
          s: t(STATUS_CONFIG[next].key, STATUS_CONFIG[next].fallback),
        }),
      );
    },
    [t, token],
  );

  // Delete a payment (with confirmation). Backend when available, else local.
  const deletePayment = useCallback(async () => {
    if (!toDelete) return;
    const payment = toDelete;
    setBusy(true);
    await mutateAdminResource(`${ERP_ENDPOINTS.payments}/${payment.id}`, token ?? '', {
      method: 'DELETE',
    });
    setRows((prev) => prev.filter((r) => r.id !== payment.id));
    setSelected((cur) => (cur && cur.id === payment.id ? null : cur));
    setBusy(false);
    setToDelete(null);
    toast.success(t('adminPayments.toast.deleted', 'Règlement {{n}} supprimé', { n: payment.reference }));
  }, [toDelete, t, token]);

  // Create a new payment. Persists to backend when available, else appends an
  // optimistic local row (demo mode).
  const submitCreate = useCallback(async () => {
    if (!form.partyId || !form.party.trim()) {
      toast.error(t('adminPayments.form.partyRequired', 'La partie (client/fournisseur) est requise.'));
      return;
    }
    setSaving(true);
    const payload = {
      partyId: form.partyId,
      direction: form.direction,
      party: form.party.trim(),
      method: form.method,
      linkedDoc: form.linkedDoc.trim(),
      date: new Date().toISOString().slice(0, 10),
      amount: Number(form.amount) || 0,
      status: 'pending' as PayStatus,
    };
    const created = await createAdminResource<Payment>(ERP_ENDPOINTS.payments, token ?? '', payload);
    const row: Payment =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
        reference: `REG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      };
    setRows((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    toast.success(
      created
        ? t('adminPayments.toast.created', 'Règlement créé')
        : t('adminPayments.toast.createdLocal', 'Règlement créé (mode démo)'),
    );
  }, [form, t, token]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (directionFilter !== 'all' && p.direction !== directionFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!inDateRange(p.date, dateRange)) return false;
      if (!term) return true;
      return (
        p.reference.toLowerCase().includes(term) ||
        p.party.toLowerCase().includes(term) ||
        p.linkedDoc.toLowerCase().includes(term)
      );
    });
  }, [rows, search, directionFilter, statusFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE),
    [filtered, currentPage],
  );

  const stats = useMemo(() => {
    const inflow = rows
      .filter((p) => p.direction === 'in' && p.status === 'cleared')
      .reduce((s, p) => s + p.amount, 0);
    const outflow = rows
      .filter((p) => p.direction === 'out' && p.status === 'cleared')
      .reduce((s, p) => s + p.amount, 0);
    const pending = rows.filter((p) => p.status === 'pending').length;
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      pending,
    };
  }, [rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const p of rows) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  const resetToFirstPage = () => setPage(1);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-1 text-xs font-medium text-ink-400">
            {t('adminLayout.sections.gestionCommerciale', 'Gestion commerciale')}
            <span className="mx-1.5">/</span>
            <span className="text-ink-600">{t('adminPayments.title', 'Règlements')}</span>
          </nav>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            {t('adminPayments.title', 'Règlements & encaissements')}
            {!loading && !live && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                {t('common.demoData', 'Données démo')}
              </span>
            )}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminPayments.subtitle', 'Suivez les encaissements clients et décaissements fournisseurs.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => void fetchPayments()} busy={loading} />
          {canManage && (
            <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('adminPayments.new', 'Nouveau règlement')}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('adminPayments.stats.inflow', 'Encaissé')} value={money.format(stats.inflow)} Icon={Banknote} tone="emerald" />
        <StatTile label={t('adminPayments.stats.outflow', 'Décaissé')} value={money.format(stats.outflow)} Icon={CreditCard} tone="red" />
        <StatTile label={t('adminPayments.stats.net', 'Solde net')} value={money.format(stats.net)} Icon={Wallet} tone="gold" />
        <StatTile label={t('adminPayments.stats.pending', 'En attente')} value={String(stats.pending)} Icon={Clock} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table card */}
      <div className={CARD}>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className={`${INPUT} pl-9`}
              placeholder={t('adminPayments.searchPlaceholder', 'Rechercher par réf., tiers ou facture…')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetToFirstPage();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill
              active={directionFilter === 'all'}
              label={t('adminPayments.filter.all', 'Tous')}
              onClick={() => {
                setDirectionFilter('all');
                resetToFirstPage();
              }}
            />
            <FilterPill
              active={directionFilter === 'in'}
              label={t('adminPayments.filter.in', 'Encaissements')}
              onClick={() => {
                setDirectionFilter('in');
                resetToFirstPage();
              }}
            />
            <FilterPill
              active={directionFilter === 'out'}
              label={t('adminPayments.filter.out', 'Décaissements')}
              onClick={() => {
                setDirectionFilter('out');
                resetToFirstPage();
              }}
            />
            <span className="mx-1 h-5 w-px bg-ink-100" />
            {STATUS_ORDER.map((s) => (
              <FilterPill
                key={s}
                active={statusFilter === s}
                label={t(STATUS_CONFIG[s].key, STATUS_CONFIG[s].fallback)}
                count={statusCounts[s]}
                onClick={() => {
                  setStatusFilter((cur) => (cur === s ? 'all' : s));
                  resetToFirstPage();
                }}
              />
            ))}
          </div>
          <DateRangeFilter
            value={dateRange}
            onChange={(r) => {
              setDateRange(r);
              resetToFirstPage();
            }}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
            <thead>
              <tr className={TH_ROW}>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPayments.col.reference', 'Référence')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPayments.col.party', 'Tiers')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPayments.col.method', 'Mode')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPayments.col.doc', 'Document')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPayments.col.date', 'Date')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminPayments.col.amount', 'Montant')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPayments.col.status', 'Statut')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminPayments.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={ROWS_PER_PAGE} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      Icon={Wallet}
                      title={t('adminPayments.empty.title', 'Aucun règlement')}
                      hint={t('adminPayments.empty.hint', 'Aucun règlement ne correspond à votre recherche.')}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const method = METHOD_CONFIG[p.method];
                  const isIn = p.direction === 'in';
                  return (
                    <tr key={p.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">{p.reference}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-800">{p.party}</div>
                        <div className="text-xs text-ink-400">
                          {isIn
                            ? t('adminPayments.direction.in', 'Client')
                            : t('adminPayments.direction.out', 'Fournisseur')}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-ink-600">
                          <method.Icon className="h-3.5 w-3.5 text-ink-400" />
                          {t(method.key, method.fallback)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-ink-500">{p.linkedDoc}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(p.date))}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold ${isIn ? 'text-emerald-700' : 'text-red-600'}`}>
                        {isIn ? '+' : '−'}
                        {money.format(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.className}`}>
                          <cfg.Icon className="h-3.5 w-3.5" />
                          {t(cfg.key, cfg.fallback)}
                        </span>
                      </td>
                      <td className={ROW_ACTIONS_CELL}>
                        <div className={ROW_ACTIONS}>
                          <button
                            type="button"
                            onClick={() => setSelected(p)}
                            className={rowActionBtn('neutral')}
                            title={t('adminPayments.action.view', 'Consulter')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && p.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ payment: p, next: 'cleared' })}
                              className={rowActionLabelBtn('emerald')}
                              title={t('adminPayments.action.markCleared', 'Marquer encaissé')}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t('adminPayments.status.cleared', 'Encaissé')}
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setToDelete(p)}
                              className={rowActionBtn('red')}
                              title={t('adminPayments.action.delete', 'Supprimer')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-4 text-sm text-ink-500">
            <span>
              {t('adminPayments.pagination.summary', '{{shown}} sur {{total}} règlements', {
                shown: paginated.length,
                total: filtered.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={BTN_GHOST}
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('adminPayments.pagination.prev', 'Précédent')}
              </button>
              <span className="ba-nums text-ink-600">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className={BTN_GHOST}
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('adminPayments.pagination.next', 'Suivant')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (() => {
          const cfg = STATUS_CONFIG[selected.status];
          const method = METHOD_CONFIG[selected.method];
          const isIn = selected.direction === 'in';
          return (
            <motion.div
              className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            >
              <motion.aside
                className="flex h-full w-full max-w-md flex-col bg-white shadow-elev-4"
                initial={{ x: 40, opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                  <div>
                    <div className="text-xs font-medium text-ink-400">
                      {isIn
                        ? t('adminPayments.direction.in', 'Client')
                        : t('adminPayments.direction.out', 'Fournisseur')}
                    </div>
                    <div className="ba-nums text-lg font-black text-ink-900">{selected.reference}</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-ink-500 hover:bg-ink-50"
                    onClick={() => setSelected(null)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
                  <div
                    className={`rounded-2xl p-4 text-center ${
                      isIn ? 'bg-emerald-50' : 'bg-red-50'
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPayments.col.amount', 'Montant')}
                    </div>
                    <div
                      className={`ba-nums mt-1 text-3xl font-black ${
                        isIn ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {isIn ? '+' : '−'}
                      {money.format(selected.amount)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">{t('adminPayments.col.party', 'Tiers')}</span>
                      <span className="font-semibold text-ink-900">{selected.party}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">{t('adminPayments.col.method', 'Mode')}</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink-900">
                        <method.Icon className="h-3.5 w-3.5 text-ink-400" />
                        {t(method.key, method.fallback)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">{t('adminPayments.col.doc', 'Document')}</span>
                      <span className="ba-nums font-semibold text-ink-900">{selected.linkedDoc}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">{t('adminPayments.col.date', 'Date')}</span>
                      <span className="ba-nums font-semibold text-ink-900">
                        {dateFmt.format(new Date(selected.date))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">{t('adminPayments.col.status', 'Statut')}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.className}`}
                      >
                        <cfg.Icon className="h-3.5 w-3.5" />
                        {t(cfg.key, cfg.fallback)}
                      </span>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <footer className="space-y-2 border-t border-ink-100 px-5 py-4">
                    {selected.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ payment: selected, next: 'cleared' })}
                          className={`${BTN_PRIMARY} justify-center`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t('adminPayments.status.cleared', 'Encaissé')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ payment: selected, next: 'bounced' })}
                          className={`${BTN_GHOST} justify-center text-red-600 hover:bg-red-50`}
                        >
                          <XCircle className="h-4 w-4" />
                          {t('adminPayments.status.bounced', 'Rejeté')}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setToDelete(selected)}
                      className={`${BTN_GHOST} w-full justify-center text-red-600 hover:bg-red-50`}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('adminPayments.action.delete', 'Supprimer')}
                    </button>
                  </footer>
                )}
              </motion.aside>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && setShowCreate(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-2xl bg-white shadow-elev-4"
              initial={{ y: 24, opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <h2 className="text-lg font-black text-ink-900">
                  {t('adminPayments.new', 'Nouveau règlement')}
                </h2>
                <button
                  type="button"
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-50"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="space-y-4 px-5 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPayments.col.direction', 'Sens')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.direction}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          direction: e.target.value as PayDirection,
                          // Reset the party when switching between client/supplier.
                          partyId: null,
                          party: '',
                        }))
                      }
                    >
                      <option value="in">{t('adminPayments.direction.in', 'Encaissement')}</option>
                      <option value="out">{t('adminPayments.direction.out', 'Décaissement')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPayments.col.method', 'Mode')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.method}
                      onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PayMethod }))}
                    >
                      <option value="cash">{t('adminPayments.method.cash', 'Espèces')}</option>
                      <option value="cheque">{t('adminPayments.method.cheque', 'Chèque')}</option>
                      <option value="transfer">{t('adminPayments.method.transfer', 'Virement')}</option>
                      <option value="card">{t('adminPayments.method.card', 'Carte')}</option>
                      <option value="traite">{t('adminPayments.method.traite', 'Traite')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {form.direction === 'in'
                      ? t('adminPayments.direction.in', 'Client')
                      : t('adminPayments.direction.out', 'Fournisseur')}{' '}
                    *
                  </label>
                  <EntityPicker
                    options={partyOptions.map((o) => ({ id: o.id, label: o.name, sub: o.taxId ?? o.city }))}
                    value={form.partyId}
                    onChange={(id, opt) => setForm((f) => ({ ...f, partyId: id, party: opt?.label ?? '' }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPayments.col.linkedDoc', 'Document lié')}
                    </label>
                    <input
                      className={INPUT}
                      value={form.linkedDoc}
                      onChange={(e) => setForm((f) => ({ ...f, linkedDoc: e.target.value }))}
                      placeholder="FAC-2025-0203"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPayments.col.amount', 'Montant')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className={INPUT}
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </div>

              <footer className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
                <button
                  type="button"
                  className={BTN_GHOST}
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  onClick={() => void submitCreate()}
                  disabled={saving}
                >
                  <Plus className="h-4 w-4" />
                  {t('common.create', 'Créer')}
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status-change confirmation */}
      {confirmAction && (() => {
        const cfg = STATUS_CONFIG[confirmAction.next];
        return (
          <ConfirmDialog
            open
            Icon={cfg.Icon}
            title={t('adminPayments.confirm.statusTitle', 'Changer le statut')}
            message={t('adminPayments.confirm.statusMessage', 'Passer le règlement {{n}} à « {{s}} » ?', {
              n: confirmAction.payment.reference,
              s: t(cfg.key, cfg.fallback),
            })}
            confirmLabel={t(cfg.key, cfg.fallback)}
            cancelLabel={t('common.cancel', 'Annuler')}
            pending={busy}
            onConfirm={() => void applyStatus(confirmAction.payment, confirmAction.next)}
            onCancel={() => setConfirmAction(null)}
          />
        );
      })()}

      {/* Delete confirmation */}
      {toDelete && (
        <ConfirmDialog
          open
          Icon={AlertTriangle}
          title={t('adminPayments.confirm.deleteTitle', 'Supprimer le règlement')}
          message={t('adminPayments.confirm.deleteMessage', 'Supprimer définitivement le règlement {{n}} ?', {
            n: toDelete.reference,
          })}
          confirmLabel={t('adminPayments.action.delete', 'Supprimer')}
          cancelLabel={t('common.cancel', 'Annuler')}
          pending={busy}
          onConfirm={() => void deletePayment()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local presentational helpers                                               */
/* -------------------------------------------------------------------------- */

const TONE_ICON: Record<string, string> = {
  gold: 'text-gold-500',
  emerald: 'text-emerald-500',
  red: 'text-red-500',
  ink: 'text-ink-400',
};

function StatTile({
  label,
  value,
  Icon,
  tone = 'ink',
}: {
  label: string;
  value: string;
  Icon: ComponentType<{ className?: string }>;
  tone?: 'gold' | 'emerald' | 'red' | 'ink';
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</span>
        <Icon className={`h-4 w-4 ${TONE_ICON[tone]}`} />
      </div>
      <div className="mt-2 ba-nums text-2xl font-black text-ink-900">{value}</div>
    </div>
  );
}

function FilterPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ba-press rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
      }`}
    >
      {label}
      {typeof count === 'number' && <span className="ml-1.5 opacity-60">{count}</span>}
    </button>
  );
}
