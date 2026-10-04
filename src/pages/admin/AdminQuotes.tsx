import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
  FileWarning,
  Printer,
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
import { printDocument, type PrintDoc } from './_print';
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
/*  Devis (Quotes) — Gestion commerciale                                       */
/*  Self-contained module: renders standalone with local data until the        */
/*  backend endpoints are wired. Mirrors the AdminOrders layout & tokens.       */
/* -------------------------------------------------------------------------- */

const TVA_RATE = 0.19; // TVA standard tunisienne
const STAMP_DUTY = 1; // Timbre fiscal (TND)

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

interface Quote {
  id: string;
  number: string;
  clientName: string;
  clientKind: 'company' | 'individual';
  issueDate: string; // ISO date
  validUntil: string; // ISO date
  totalHT: number;
  tvaRate: number;
  stampDuty: number;
  itemsCount: number;
  status: QuoteStatus;
}

function computeTTC(q: Quote): number {
  return q.totalHT * (1 + q.tvaRate) + q.stampDuty;
}

const MOCK_QUOTES: Quote[] = [
  { id: 'q1', number: 'DEV-2025-0018', clientName: 'Garage El Amine', clientKind: 'company', issueDate: '2025-02-12', validUntil: '2025-03-14', totalHT: 1240.5, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 7, status: 'sent' },
  { id: 'q2', number: 'DEV-2025-0017', clientName: 'Sté Méditerranée Auto', clientKind: 'company', issueDate: '2025-02-08', validUntil: '2025-03-10', totalHT: 4820.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 14, status: 'accepted' },
  { id: 'q3', number: 'DEV-2025-0016', clientName: 'Mohamed Trabelsi', clientKind: 'individual', issueDate: '2025-02-05', validUntil: '2025-02-20', totalHT: 315.75, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 3, status: 'converted' },
  { id: 'q4', number: 'DEV-2025-0015', clientName: 'Auto Service Sfax', clientKind: 'company', issueDate: '2025-01-29', validUntil: '2025-02-28', totalHT: 2110.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 9, status: 'sent' },
  { id: 'q5', number: 'DEV-2025-0014', clientName: 'Karim Ben Salah', clientKind: 'individual', issueDate: '2025-01-22', validUntil: '2025-02-06', totalHT: 189.9, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 2, status: 'rejected' },
  { id: 'q6', number: 'DEV-2025-0013', clientName: 'Transport Nabeul SARL', clientKind: 'company', issueDate: '2025-01-18', validUntil: '2025-02-17', totalHT: 6740.25, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 21, status: 'accepted' },
  { id: 'q7', number: 'DEV-2025-0012', clientName: 'Garage Central Tunis', clientKind: 'company', issueDate: '2025-01-15', validUntil: '2025-01-30', totalHT: 980.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 5, status: 'expired' },
  { id: 'q8', number: 'DEV-2025-0011', clientName: 'Salma Gharbi', clientKind: 'individual', issueDate: '2025-01-10', validUntil: '2025-01-25', totalHT: 452.3, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 4, status: 'converted' },
  { id: 'q9', number: 'DEV-2025-0010', clientName: 'Flotte Taxi Ariana', clientKind: 'company', issueDate: '2025-01-06', validUntil: '2025-02-05', totalHT: 3560.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 12, status: 'draft' },
  { id: 'q10', number: 'DEV-2024-0209', clientName: 'Sté Logistique Sousse', clientKind: 'company', issueDate: '2024-12-28', validUntil: '2025-01-27', totalHT: 8925.5, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 30, status: 'accepted' },
  { id: 'q11', number: 'DEV-2024-0208', clientName: 'Anis Khemiri', clientKind: 'individual', issueDate: '2024-12-20', validUntil: '2025-01-04', totalHT: 275.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 2, status: 'expired' },
  { id: 'q12', number: 'DEV-2024-0207', clientName: 'Garage El Amine', clientKind: 'company', issueDate: '2024-12-14', validUntil: '2025-01-13', totalHT: 1620.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 8, status: 'draft' },
];

const STATUS_CONFIG: Record<
  QuoteStatus,
  { key: string; fallback: string; Icon: ComponentType<{ className?: string }>; className: string }
> = {
  draft: { key: 'adminQuotes.status.draft', fallback: 'Brouillon', Icon: FileWarning, className: 'bg-ink-100 text-ink-600 ring-ink-200' },
  sent: { key: 'adminQuotes.status.sent', fallback: 'Envoyé', Icon: Send, className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  accepted: { key: 'adminQuotes.status.accepted', fallback: 'Accepté', Icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { key: 'adminQuotes.status.rejected', fallback: 'Refusé', Icon: XCircle, className: 'bg-red-50 text-red-700 ring-red-200' },
  expired: { key: 'adminQuotes.status.expired', fallback: 'Expiré', Icon: Clock, className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  converted: { key: 'adminQuotes.status.converted', fallback: 'Converti', Icon: ArrowRightLeft, className: 'bg-gold-500/10 text-gold-700 ring-gold-500/20' },
};

const STATUS_ORDER: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];
const ROWS_PER_PAGE = 8;

export default function AdminQuotes() {
  const { t, i18n } = useTranslation();
  const { token, hasPermission, isAdmin } = useAuth();
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN';
  // "if i have the access" — write actions are gated on the QUOTE_MANAGE
  // permission (admins always allowed). View is implied by reaching the page.
  const canManage = isAdmin || hasPermission('QUOTE_MANAGE');

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

  const [rows, setRows] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientOptions, setClientOptions] = useState<AdminEntityOption[]>([]);
  const emptyForm = { clientId: null as number | null, clientName: '', clientKind: 'company', issueDate: '', validUntil: '', totalHT: '', itemsCount: '' };
  const [form, setForm] = useState(emptyForm);
  // Pending confirmation dialogs (status change / delete).
  const [toDelete, setToDelete] = useState<Quote | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    { quote: Quote; next: QuoteStatus } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Live backend when available; falls back to the demo dataset otherwise.
      const { items } = await getAdminResource<Quote>(
        ERP_ENDPOINTS.quotes,
        token ?? '',
        MOCK_QUOTES,
      );
      setRows(items);
    } catch {
      setError(t('adminQuotes.error', 'Impossible de charger les devis.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);

  // Load existing client options for the strict create picker.
  useEffect(() => {
    if (!token) return;
    void getAdminEntityOptions('clients', token).then(setClientOptions);
  }, [token]);

  // Create a new quote. Persists to the backend when available, else appends an
  // optimistic local row (demo mode).
  const submitCreate = useCallback(async () => {
    if (!form.clientId || !form.clientName.trim()) {
      toast.error(t('adminQuotes.form.clientRequired', 'Le client est requis.'));
      return;
    }
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const plus30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const payload = {
      clientId: form.clientId,
      clientName: form.clientName.trim(),
      clientKind: form.clientKind as Quote['clientKind'],
      issueDate: form.issueDate || today,
      validUntil: form.validUntil || plus30,
      totalHT: Number(form.totalHT) || 0,
      tvaRate: TVA_RATE,
      stampDuty: STAMP_DUTY,
      itemsCount: Number(form.itemsCount) || 0,
      status: 'draft' as QuoteStatus,
    };
    const created = await createAdminResource<Quote>(ERP_ENDPOINTS.quotes, token ?? '', payload);
    const row: Quote =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
        number: `DEV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      };
    setRows((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    toast.success(
      created
        ? t('adminQuotes.toast.created', 'Devis créé')
        : t('adminQuotes.toast.createdLocal', 'Devis créé (mode démo)'),
    );
  }, [form, t, token]);

  // Print / save-as-PDF a quote using the shared document renderer.
  const printQuote = useCallback(
    (q: Quote) => {
      const tva = q.totalHT * q.tvaRate;
      const doc: PrintDoc = {
        docType: t('adminQuotes.title', 'Devis'),
        number: q.number,
        client: q.clientName,
        clientKind:
          q.clientKind === 'company'
            ? t('adminQuotes.clientKind.company', 'Société')
            : t('adminQuotes.clientKind.individual', 'Particulier'),
        issueDate: q.issueDate,
        dueOrValidLabel: t('adminQuotes.col.validUntil', 'Validité'),
        dueOrValidDate: q.validUntil,
        // No line-level breakdown on quotes yet — render a single summary line.
        lines: [
          {
            label: t('adminQuotes.itemsCount', '{{count}} article(s)', {
              count: q.itemsCount,
            }),
            qty: 1,
            unitPrice: q.totalHT,
          },
        ],
        totals: {
          totalHT: q.totalHT,
          tva,
          timbre: q.stampDuty,
          totalTTC: computeTTC(q),
        },
        labels: {
          seller: t('adminPrint.seller', 'Émetteur'),
          billedTo: t('adminPrint.billedTo', 'Devis pour'),
          mf: t('adminInvoices.preview.mf', 'Matricule fiscal'),
          issue: t('adminQuotes.col.issueDate', 'Date'),
          designation: t('adminInvoices.preview.item', 'Désignation'),
          qty: t('adminInvoices.preview.qty', 'Qté'),
          unitPrice: t('adminInvoices.preview.pu', 'P.U. HT'),
          lineTotal: t('adminInvoices.preview.total', 'Total HT'),
          totalHT: t('adminQuotes.col.totalHT', 'Total HT'),
          tva: t('adminQuotes.totals.tva', 'TVA (19 %)'),
          timbre: t('adminQuotes.totals.stamp', 'Timbre fiscal'),
          retenue: '',
          totalTTC: t('adminQuotes.col.totalTTC', 'Total TTC'),
          thanks: t('adminPrint.quoteValidity', 'Devis valable jusqu\u2019à la date indiquée.'),
        },
      };
      printDocument(doc);
    },
    [t],
  );

  // Convert an accepted quote into an invoice (optimistic: marks converted +
  // stores a pending invoice draft in sessionStorage the Invoices page reads).
  const convertToInvoice = useCallback(
    (q: Quote) => {
      const draft = {
        client: q.clientName,
        clientMF: '—',
        kind: 'invoice',
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
        withholding: false,
        status: 'draft',
        fromQuote: q.number,
        lines: [
          {
            label: t('adminQuotes.convertLine', 'Devis {{n}}', { n: q.number }),
            qty: 1,
            unitPrice: q.totalHT,
          },
        ],
      };
      try {
        // Append to a queue (array) rather than a single key so converting
        // several quotes in a row keeps EVERY draft — the Invoices page drains
        // the whole queue and creates one invoice per entry.
        const KEY = 'ba:pendingInvoiceDrafts';
        let queue: unknown[] = [];
        try {
          const raw = sessionStorage.getItem(KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) queue = parsed;
          }
        } catch {
          /* malformed existing queue — start fresh */
        }
        queue.push(draft);
        sessionStorage.setItem(KEY, JSON.stringify(queue));
      } catch {
        /* storage may be unavailable — non-fatal */
      }
      setRows((prev) =>
        prev.map((r) => (r.id === q.id ? { ...r, status: 'converted' as QuoteStatus } : r)),
      );
      setSelected(null);
      toast.success(
        t('adminQuotes.toast.converted', 'Devis {{n}} converti en facture', {
          n: q.number,
        }),
      );
    },
    [t],
  );

  // Apply a status transition (draft → sent → accepted / rejected …). Persists
  // to the backend when available, else updates local state (demo mode).
  const applyStatus = useCallback(
    async (q: Quote, next: QuoteStatus) => {
      setBusy(true);
      await mutateAdminResource(`${ERP_ENDPOINTS.quotes}/${q.id}`, token ?? '', {
        method: 'PATCH',
        body: { status: next },
      });
      setRows((prev) => prev.map((r) => (r.id === q.id ? { ...r, status: next } : r)));
      setSelected((cur) => (cur && cur.id === q.id ? { ...cur, status: next } : cur));
      setBusy(false);
      setConfirmAction(null);
      const label = t(STATUS_CONFIG[next].key, STATUS_CONFIG[next].fallback);
      toast.success(
        t('adminQuotes.toast.status', 'Devis {{n}} : {{s}}', { n: q.number, s: label }),
      );
    },
    [t, token],
  );

  // Delete a quote (with confirmation). Backend when available, else local.
  const deleteQuote = useCallback(async () => {
    if (!toDelete) return;
    const q = toDelete;
    setBusy(true);
    await mutateAdminResource(`${ERP_ENDPOINTS.quotes}/${q.id}`, token ?? '', {
      method: 'DELETE',
    });
    setRows((prev) => prev.filter((r) => r.id !== q.id));
    setSelected((cur) => (cur && cur.id === q.id ? null : cur));
    setBusy(false);
    setToDelete(null);
    toast.success(
      t('adminQuotes.toast.deleted', 'Devis {{n}} supprimé', { n: q.number }),
    );
  }, [toDelete, t, token]);

  // The next status offered by the primary "advance" button, per current state.
  const nextStatusFor = (s: QuoteStatus): QuoteStatus | null => {
    if (s === 'draft') return 'sent';
    if (s === 'sent') return 'accepted';
    return null;
  };

  const now = Date.now();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (!inDateRange(q.issueDate, dateRange)) return false;
      if (!term) return true;
      return (
        q.number.toLowerCase().includes(term) ||
        q.clientName.toLowerCase().includes(term)
      );
    });
  }, [rows, search, statusFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE),
    [filtered, currentPage],
  );

  const stats = useMemo(() => {
    const pending = rows.filter((q) => q.status === 'sent').length;
    const accepted = rows.filter((q) => q.status === 'accepted');
    const acceptedValue = accepted.reduce((sum, q) => sum + computeTTC(q), 0);
    return {
      total: rows.length,
      pending,
      accepted: accepted.length,
      acceptedValue,
    };
  }, [rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const q of rows) counts[q.status] = (counts[q.status] ?? 0) + 1;
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
            <span className="text-ink-600">{t('adminQuotes.title', 'Devis')}</span>
          </nav>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            {t('adminQuotes.title', 'Devis')}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminQuotes.subtitle', 'Créez, suivez et convertissez vos devis clients.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => fetchQuotes()} busy={loading} />
          {canManage && (
            <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('adminQuotes.new', 'Nouveau devis')}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('adminQuotes.stats.total', 'Total devis')} value={String(stats.total)} Icon={FileText} />
        <StatTile label={t('adminQuotes.stats.pending', 'En attente')} value={String(stats.pending)} Icon={Send} />
        <StatTile label={t('adminQuotes.stats.accepted', 'Acceptés')} value={String(stats.accepted)} Icon={CheckCircle2} />
        <StatTile label={t('adminQuotes.stats.acceptedValue', 'Valeur acceptée')} value={money.format(stats.acceptedValue)} Icon={ArrowRightLeft} />
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
              placeholder={t('adminQuotes.searchPlaceholder', 'Rechercher par n° ou client…')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetToFirstPage();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill
              active={statusFilter === 'all'}
              label={t('adminQuotes.filter.all', 'Tous')}
              count={statusCounts.all}
              onClick={() => {
                setStatusFilter('all');
                resetToFirstPage();
              }}
            />
            {STATUS_ORDER.map((s) => (
              <FilterPill
                key={s}
                active={statusFilter === s}
                label={t(STATUS_CONFIG[s].key, STATUS_CONFIG[s].fallback)}
                count={statusCounts[s]}
                onClick={() => {
                  setStatusFilter(s);
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
                <th className="px-4 py-3 text-left font-semibold">{t('adminQuotes.col.number', 'N° devis')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminQuotes.col.client', 'Client')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminQuotes.col.issueDate', 'Date')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminQuotes.col.validUntil', 'Validité')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminQuotes.col.totalHT', 'Total HT')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminQuotes.col.totalTTC', 'Total TTC')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminQuotes.col.status', 'Statut')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminQuotes.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={ROWS_PER_PAGE} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      Icon={FileText}
                      title={t('adminQuotes.empty.title', 'Aucun devis')}
                      hint={t('adminQuotes.empty.hint', 'Aucun devis ne correspond à votre recherche.')}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((q) => {
                  const cfg = STATUS_CONFIG[q.status];
                  const validTs = new Date(q.validUntil).getTime();
                  const isOverdue = validTs < now && (q.status === 'sent' || q.status === 'draft');
                  return (
                    <tr key={q.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">{q.number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-800">{q.clientName}</div>
                        <div className="text-xs text-ink-400">
                          {q.clientKind === 'company'
                            ? t('adminQuotes.clientKind.company', 'Société')
                            : t('adminQuotes.clientKind.individual', 'Particulier')}
                          {' · '}
                          {t('adminQuotes.itemsCount', '{{count}} article(s)', { count: q.itemsCount })}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(q.issueDate))}</td>
                      <td className={`whitespace-nowrap px-4 py-3 ${isOverdue ? 'font-semibold text-red-600' : 'text-ink-600'}`}>
                        {dateFmt.format(new Date(q.validUntil))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{money.format(q.totalHT)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold text-ink-900">{money.format(computeTTC(q))}</td>
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
                            className={rowActionBtn('neutral')}
                            title={t('adminQuotes.action.view', 'Consulter')}
                            onClick={() => setSelected(q)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <div className="flex w-[150px] items-center justify-end gap-1">
                              {nextStatusFor(q.status) && (
                                <button
                                  type="button"
                                  className={rowActionLabelBtn('blue')}
                                  title={
                                    q.status === 'draft'
                                      ? t('adminQuotes.action.send', 'Envoyer')
                                      : t('adminQuotes.action.accept', 'Marquer accepté')
                                  }
                                  onClick={() =>
                                    setConfirmAction({ quote: q, next: nextStatusFor(q.status)! })
                                  }
                                >
                                  {q.status === 'draft' ? (
                                    <Send className="h-3.5 w-3.5" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  {q.status === 'draft'
                                    ? t('adminQuotes.action.send', 'Envoyer')
                                    : t('adminQuotes.action.acceptShort', 'Accepter')}
                                </button>
                              )}
                              {(q.status === 'draft' || q.status === 'sent') && (
                                <button
                                  type="button"
                                  className={rowActionBtn('red')}
                                  title={t('adminQuotes.action.reject', 'Refuser')}
                                  onClick={() => setConfirmAction({ quote: q, next: 'rejected' })}
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                              {q.status === 'accepted' && (
                                <button
                                  type="button"
                                  className={rowActionLabelBtn('gold')}
                                  title={t('adminQuotes.action.convert', 'Convertir en facture')}
                                  onClick={() => convertToInvoice(q)}
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                  {t('adminQuotes.action.convertShort', 'Facturer')}
                                </button>
                              )}
                            </div>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              className={rowActionBtn('red')}
                              title={t('adminQuotes.action.delete', 'Supprimer')}
                              onClick={() => setToDelete(q)}
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
              {t('adminQuotes.pagination.summary', '{{shown}} sur {{total}} devis', {
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
                {t('adminQuotes.pagination.prev', 'Précédent')}
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
                {t('adminQuotes.pagination.next', 'Suivant')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
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
                    {t('adminQuotes.title', 'Devis')}
                  </div>
                  <div className="ba-nums text-lg font-black text-ink-900">{selected.number}</div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-50"
                  onClick={() => setSelected(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
                <div className="space-y-1">
                  <div className="font-semibold text-ink-900">{selected.clientName}</div>
                  <div className="text-ink-500">
                    {selected.clientKind === 'company'
                      ? t('adminQuotes.clientKind.company', 'Société')
                      : t('adminQuotes.clientKind.individual', 'Particulier')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-ink-50 p-3">
                    <div className="text-xs text-ink-400">{t('adminQuotes.col.issueDate', 'Date')}</div>
                    <div className="ba-nums font-semibold text-ink-800">{dateFmt.format(new Date(selected.issueDate))}</div>
                  </div>
                  <div className="rounded-xl bg-ink-50 p-3">
                    <div className="text-xs text-ink-400">{t('adminQuotes.col.validUntil', 'Validité')}</div>
                    <div className="ba-nums font-semibold text-ink-800">{dateFmt.format(new Date(selected.validUntil))}</div>
                  </div>
                </div>
                <div className="space-y-1.5 rounded-xl bg-ink-50 p-4">
                  <div className="flex items-center justify-between text-ink-600">
                    <span>{t('adminQuotes.col.totalHT', 'Total HT')}</span>
                    <span className="ba-nums">{money.format(selected.totalHT)}</span>
                  </div>
                  <div className="flex items-center justify-between text-ink-600">
                    <span>{t('adminQuotes.totals.tva', 'TVA (19 %)')}</span>
                    <span className="ba-nums">{money.format(selected.totalHT * selected.tvaRate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-ink-600">
                    <span>{t('adminQuotes.totals.stamp', 'Timbre fiscal')}</span>
                    <span className="ba-nums">{money.format(selected.stampDuty)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-ink-200 pt-2 text-base font-black text-ink-900">
                    <span>{t('adminQuotes.col.totalTTC', 'Total TTC')}</span>
                    <span className="ba-nums">{money.format(computeTTC(selected))}</span>
                  </div>
                </div>
              </div>
              <footer className="flex flex-col gap-2 border-t border-ink-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`${BTN_PRIMARY} flex-1 justify-center`}
                    onClick={() => printQuote(selected)}
                  >
                    <Printer className="h-4 w-4" />
                    {t('adminQuotes.action.print', 'Imprimer / PDF')}
                  </button>
                  {canManage && selected.status === 'accepted' && (
                    <button
                      type="button"
                      className={`${BTN_GHOST} flex-1 justify-center`}
                      onClick={() => convertToInvoice(selected)}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      {t('adminQuotes.action.convertShort', 'Facturer')}
                    </button>
                  )}
                </div>
                {/* Status transitions + delete (each confirmed) */}
                {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  {nextStatusFor(selected.status) && (
                    <button
                      type="button"
                      className="ba-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      onClick={() =>
                        setConfirmAction({ quote: selected, next: nextStatusFor(selected.status)! })
                      }
                    >
                      {selected.status === 'draft' ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {selected.status === 'draft'
                        ? t('adminQuotes.action.send', 'Envoyer')
                        : t('adminQuotes.action.accept', 'Marquer accepté')}
                    </button>
                  )}
                  {(selected.status === 'draft' || selected.status === 'sent') && (
                    <button
                      type="button"
                      className="ba-press inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                      onClick={() => setConfirmAction({ quote: selected, next: 'rejected' })}
                    >
                      <XCircle className="h-4 w-4" />
                      {t('adminQuotes.action.reject', 'Refuser')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="ba-press inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                    onClick={() => setToDelete(selected)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('adminQuotes.action.delete', 'Supprimer')}
                  </button>
                </div>
                )}
              </footer>
            </motion.aside>
          </motion.div>
        )}
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
                  {t('adminQuotes.new', 'Nouveau devis')}
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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminQuotes.col.client', 'Client')} *
                  </label>
                  <EntityPicker
                    options={clientOptions.map((c) => ({ id: c.id, label: c.name, sub: c.city }))}
                    value={form.clientId}
                    autoFocus
                    placeholder={t('adminQuotes.form.pickClient', 'Choisir un client…')}
                    emptyLabel={t('adminQuotes.form.noClient', 'Aucun client trouvé')}
                    onChange={(id, opt) =>
                      setForm((f) => ({ ...f, clientId: id, clientName: opt?.label ?? '' }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminQuotes.col.clientKind', 'Type de client')}
                  </label>
                  <select
                    className={INPUT}
                    value={form.clientKind}
                    onChange={(e) => setForm((f) => ({ ...f, clientKind: e.target.value }))}
                  >
                    <option value="company">{t('adminQuotes.clientKind.company', 'Société')}</option>
                    <option value="individual">{t('adminQuotes.clientKind.individual', 'Particulier')}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminQuotes.col.issueDate', 'Date')}
                    </label>
                    <input
                      type="date"
                      className={INPUT}
                      value={form.issueDate}
                      onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminQuotes.col.validUntil', 'Validité')}
                    </label>
                    <input
                      type="date"
                      className={INPUT}
                      value={form.validUntil}
                      onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminQuotes.col.totalHT', 'Total HT')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className={INPUT}
                      value={form.totalHT}
                      onChange={(e) => setForm((f) => ({ ...f, totalHT: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminQuotes.itemsCountLabel', 'Articles')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={INPUT}
                      value={form.itemsCount}
                      onChange={(e) => setForm((f) => ({ ...f, itemsCount: e.target.value }))}
                      placeholder="0"
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
      <ConfirmDialog
        open={!!confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() =>
          confirmAction && void applyStatus(confirmAction.quote, confirmAction.next)
        }
        pending={busy}
        Icon={confirmAction?.next === 'rejected' ? XCircle : CheckCircle2}
        title={
          confirmAction
            ? t('adminQuotes.confirm.statusTitle', 'Changer le statut ?')
            : ''
        }
        detail={confirmAction?.quote.number}
        message={
          confirmAction
            ? t('adminQuotes.confirm.statusMsg', 'Le devis {{n}} passera au statut « {{s}} ».', {
                n: confirmAction.quote.number,
                s: t(
                  STATUS_CONFIG[confirmAction.next].key,
                  STATUS_CONFIG[confirmAction.next].fallback,
                ),
              })
            : ''
        }
        confirmLabel={t('adminQuotes.confirm.statusOk', 'Confirmer')}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void deleteQuote()}
        pending={busy}
        Icon={AlertTriangle}
        title={t('adminQuotes.confirm.deleteTitle', 'Supprimer ce devis ?')}
        detail={toDelete?.number}
        message={t(
          'adminQuotes.confirm.deleteMsg',
          'Cette action est irréversible. Le devis {{n}} sera définitivement supprimé.',
          { n: toDelete?.number ?? '' },
        )}
        confirmLabel={t('adminQuotes.action.delete', 'Supprimer')}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local presentational helpers                                               */
/* -------------------------------------------------------------------------- */

function StatTile({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</span>
        <Icon className="h-4 w-4 text-gold-500" />
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
