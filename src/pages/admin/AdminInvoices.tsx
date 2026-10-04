import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ComponentType,
} from 'react';
import {
  FileText,
  Plus,
  Search,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Send,
  Trash2,
  X,
  Eye,
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
  getAdminProductOptions,
  getAdminServiceOptions,
  type AdminEntityOption,
  type AdminProductOption,
  type AdminServiceOption,
  ERP_ENDPOINTS,
} from '../../api';
import { printDocument, type PrintDoc } from './_print';
import {
  CARD,
  INPUT,
  BTN_PRIMARY,
  BTN_GHOST,
  TH_ROW,
  TABLE_MIN_WIDE,
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
  EntityPicker,
  LineItemsEditor,
  EMPTY_LINE,
  type LineItem,
} from './_ui';

/* -------------------------------------------------------------------------- */
/*  Tunisian fiscal constants                                                 */
/* -------------------------------------------------------------------------- */

/** Taux de TVA standard en Tunisie. */
const TVA_RATE = 0.19;
/** Timbre fiscal sur facture (dinar). */
const TIMBRE_FISCAL = 1.0;
/** Taux de retenue à la source (marchés publics / prestations). */
const RETENUE_RATE = 0.015;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
type InvoiceKind = 'invoice' | 'credit_note';

interface InvoiceLine {
  label: string;
  qty: number;
  unitPrice: number; // HT
}

interface Invoice {
  id: string;
  number: string;
  kind: InvoiceKind;
  client: string;
  clientMF: string; // Matricule fiscal
  issueDate: string; // ISO
  dueDate: string; // ISO
  status: InvoiceStatus;
  withholding: boolean; // retenue à la source appliquée
  lines: InvoiceLine[];
}

/* -------------------------------------------------------------------------- */
/*  Mock data (standalone — replace with API once backend is ready)           */
/* -------------------------------------------------------------------------- */

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-2024-0001',
    number: 'FAC-2024-0001',
    kind: 'invoice',
    client: 'Garage El Amara',
    clientMF: '1234567/A/M/000',
    issueDate: '2024-05-02',
    dueDate: '2024-06-01',
    status: 'paid',
    withholding: false,
    lines: [
      { label: 'Plaquettes de frein Bosch', qty: 4, unitPrice: 62.5 },
      { label: 'Filtre à huile Mann', qty: 2, unitPrice: 18.0 },
    ],
  },
  {
    id: 'inv-2024-0002',
    number: 'FAC-2024-0002',
    kind: 'invoice',
    client: 'Société Trans-Med',
    clientMF: '0998877/B/C/000',
    issueDate: '2024-05-14',
    dueDate: '2024-06-13',
    status: 'sent',
    withholding: true,
    lines: [
      { label: 'Amortisseurs KYB (paire)', qty: 6, unitPrice: 145.0 },
      { label: 'Kit distribution SKF', qty: 3, unitPrice: 210.0 },
    ],
  },
  {
    id: 'inv-2024-0003',
    number: 'FAC-2024-0003',
    kind: 'invoice',
    client: 'Auto Service Béja',
    clientMF: '5544332/A/P/000',
    issueDate: '2024-04-08',
    dueDate: '2024-05-08',
    status: 'overdue',
    withholding: false,
    lines: [
      { label: 'Batterie Varta 70Ah', qty: 5, unitPrice: 235.0 },
      { label: 'Bougies NGK (jeu)', qty: 8, unitPrice: 44.0 },
    ],
  },
  {
    id: 'inv-2024-0004',
    number: 'FAC-2024-0004',
    kind: 'invoice',
    client: 'Particulier — M. Trabelsi',
    clientMF: '—',
    issueDate: '2024-05-20',
    dueDate: '2024-06-19',
    status: 'draft',
    withholding: false,
    lines: [{ label: 'Huile moteur Total 5W30 (5L)', qty: 2, unitPrice: 89.0 }],
  },
  {
    id: 'inv-2024-0005',
    number: 'AV-2024-0001',
    kind: 'credit_note',
    client: 'Garage El Amara',
    clientMF: '1234567/A/M/000',
    issueDate: '2024-05-22',
    dueDate: '2024-05-22',
    status: 'paid',
    withholding: false,
    lines: [{ label: 'Retour plaquettes défectueuses', qty: 1, unitPrice: 62.5 }],
  },
];

/* -------------------------------------------------------------------------- */
/*  Totals helper (Tunisian layout: HT → TVA → Timbre → Retenue → TTC)        */
/* -------------------------------------------------------------------------- */

function computeTotals(inv: Invoice) {
  const sign = inv.kind === 'credit_note' ? -1 : 1;
  const totalHT =
    sign * inv.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const tva = totalHT * TVA_RATE;
  const timbre = inv.kind === 'credit_note' ? 0 : TIMBRE_FISCAL;
  const retenue = inv.withholding ? (totalHT + tva) * RETENUE_RATE : 0;
  const totalTTC = totalHT + tva + timbre - retenue;
  return { totalHT, tva, timbre, retenue, totalTTC };
}

/* -------------------------------------------------------------------------- */
/*  Status badge                                                              */
/* -------------------------------------------------------------------------- */

const STATUS_META: Record<
  InvoiceStatus,
  { icon: ComponentType<{ className?: string }>; cls: string }
> = {
  draft: { icon: FileText, cls: 'bg-ink-100 text-ink-600' },
  sent: { icon: Clock, cls: 'bg-blue-50 text-blue-700' },
  paid: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700' },
  overdue: { icon: AlertTriangle, cls: 'bg-red-50 text-red-700' },
  cancelled: { icon: X, cls: 'bg-ink-100 text-ink-400 line-through' },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {t(`adminInvoices.status.${status}`, status)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const ROWS_PER_PAGE = 8;

const EMPTY_FORM = {
  clientId: null as number | null,
  client: '',
  clientMF: '',
  issueDate: '',
  dueDate: '',
  kind: 'invoice' as InvoiceKind,
  withholding: false,
  lines: [{ ...EMPTY_LINE }] as LineItem[],
};

/* -------------------------------------------------------------------------- */
/*  Quote → Invoice bridge (sessionStorage queue)                             */
/*                                                                            */
/*  Converting a quote stashes a draft in sessionStorage; the Invoices page   */
/*  drains the queue on load and materialises one invoice per draft. A queue  */
/*  (array) is used so converting several quotes in a row does not overwrite  */
/*  earlier drafts — the previous single-key design only kept the last one.   */
/* -------------------------------------------------------------------------- */

const PENDING_DRAFTS_KEY = 'ba:pendingInvoiceDrafts';
const LEGACY_DRAFT_KEY = 'ba:pendingInvoiceDraft';

type PendingDraft = {
  client?: string;
  clientMF?: string;
  kind?: string;
  issueDate?: string;
  dueDate?: string;
  withholding?: boolean;
  fromQuote?: string;
  lines?: Array<{ label?: string; qty?: number; unitPrice?: number }>;
};

/** Read and clear every queued draft (supports the legacy single-key form). */
function drainPendingInvoiceDrafts(): PendingDraft[] {
  const out: PendingDraft[] = [];
  try {
    const raw = sessionStorage.getItem(PENDING_DRAFTS_KEY);
    if (raw) {
      sessionStorage.removeItem(PENDING_DRAFTS_KEY);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
    }
    const legacy = sessionStorage.getItem(LEGACY_DRAFT_KEY);
    if (legacy) {
      sessionStorage.removeItem(LEGACY_DRAFT_KEY);
      out.push(JSON.parse(legacy));
    }
  } catch {
    /* malformed / unavailable storage — ignore */
  }
  return out;
}

/** Build a full Invoice row from a queued draft. `index` seeds the number. */
function buildInvoiceFromDraft(d: PendingDraft, index: number): Invoice {
  const issueDate = d.issueDate || new Date().toISOString().slice(0, 10);
  const dueDate =
    d.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const kind: InvoiceKind = d.kind === 'credit_note' ? 'credit_note' : 'invoice';
  const lines: InvoiceLine[] =
    Array.isArray(d.lines) && d.lines.length
      ? d.lines.map((l) => ({
          label: String(l.label ?? 'Article'),
          qty: Number(l.qty) || 1,
          unitPrice: Number(l.unitPrice) || 0,
        }))
      : [{ label: 'Article', qty: 1, unitPrice: 0 }];
  const year = new Date(issueDate).getFullYear();
  const seq = String(index + 1).padStart(4, '0');
  const prefix = kind === 'credit_note' ? 'AV' : 'FAC';
  return {
    id: `local-${Date.now()}-${index}`,
    number: `${prefix}-${year}-${seq}`,
    kind,
    client: String(d.client ?? ''),
    clientMF: d.clientMF && d.clientMF !== '—' ? String(d.clientMF) : '—',
    issueDate,
    dueDate,
    status: 'draft',
    withholding: Boolean(d.withholding),
    lines,
  };
}

export default function AdminInvoices() {
  const { t, i18n } = useTranslation();
  const { token, hasPermission, isAdmin } = useAuth();
  const locale = i18n.language?.startsWith('fr') ? 'fr-TN' : 'en-TN';
  const isFr = i18n.language?.startsWith('fr') ?? false;
  // "if i have the access" — write actions gated on INVOICE_MANAGE.
  const canManage = isAdmin || hasPermission('INVOICE_MANAGE');

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
      }),
    [locale],
  );
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  );

  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [kindFilter, setKindFilter] = useState<'all' | InvoiceKind>('all');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientOptions, setClientOptions] = useState<AdminEntityOption[]>([]);
  const [productOptions, setProductOptions] = useState<AdminProductOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<AdminServiceOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [toDelete, setToDelete] = useState<Invoice | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    { invoice: Invoice; next: InvoiceStatus } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await getAdminResource<Invoice>(
        ERP_ENDPOINTS.invoices,
        token ?? '',
        MOCK_INVOICES,
      );
      setRows(items);
    } catch {
      setError(t('adminInvoices.errors.load', 'Échec du chargement des factures.'));
      setRows(MOCK_INVOICES);
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token) return;
    getAdminEntityOptions('clients', token).then(setClientOptions).catch(() => {});
    setProductsLoading(true);
    void Promise.all([
      getAdminProductOptions(token, isFr).then(setProductOptions).catch(() => {}),
      getAdminServiceOptions(token, isFr).then(setServiceOptions).catch(() => {}),
    ]).finally(() => setProductsLoading(false));
  }, [token, isFr]);

  // Drain any queued invoice drafts produced by converting quotes. Several
  // quotes may have been converted in a row, so we materialise ALL of them —
  // one invoice per draft — instead of only pre-filling the create modal with
  // the last one (which previously silently dropped the others).
  useEffect(() => {
    const drafts = drainPendingInvoiceDrafts();
    if (!drafts.length) return;

    setRows((prev) => {
      const created = drafts.map((d, i) => buildInvoiceFromDraft(d, prev.length + i));
      // Persist to the backend when available (fire-and-forget; demo mode keeps
      // the local rows regardless of the network result).
      created.forEach((row) => {
        const { id: _id, number: _n, ...payload } = row;
        void createAdminResource<Invoice>(ERP_ENDPOINTS.invoices, token ?? '', payload).catch(
          () => {},
        );
      });
      return [...created.reverse(), ...prev];
    });

    setPage(1);
    const names = drafts.map((d) => d.fromQuote).filter(Boolean).join(', ');
    toast.success(
      drafts.length === 1
        ? t('adminInvoices.fromQuote', 'Facture créée depuis le devis {{n}}', { n: names })
        : t('adminInvoices.fromQuotesMany', '{{count}} factures créées depuis les devis {{n}}', {
            count: drafts.length,
            n: names,
          }),
    );
  }, [t, token]);

  const submitCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.clientId || !form.client.trim()) {
        toast.error(t('adminInvoices.create.errClient', 'Le client est requis.'));
        return;
      }
      const validLines = form.lines.filter((l) => l.label.trim());
      if (!validLines.length) {
        toast.error(t('adminInvoices.create.errLines', 'Ajoutez au moins une ligne.'));
        return;
      }
      setSaving(true);
      try {
        const today = new Date();
        const issueDate = form.issueDate || today.toISOString().slice(0, 10);
        const dueDate =
          form.dueDate ||
          new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
        const lines: InvoiceLine[] = validLines.map((l) => ({
          label: l.label.trim(),
          qty: Number(l.qty) || 1,
          unitPrice: Number(l.unitPrice) || 0,
        }));
        const payload = {
          clientId: form.clientId,
          client: form.client.trim(),
          clientMF: form.clientMF.trim() || '—',
          kind: form.kind,
          issueDate,
          dueDate,
          withholding: form.withholding,
          status: 'draft' as InvoiceStatus,
          lines,
        };
        const created = await createAdminResource<Invoice>(
          ERP_ENDPOINTS.invoices,
          token ?? '',
          payload,
        );
        const year = new Date(issueDate).getFullYear();
        const seq = String(rows.length + 1).padStart(4, '0');
        const prefix = form.kind === 'credit_note' ? 'AV' : 'FAC';
        const row: Invoice =
          created ?? {
            id: `local-${Date.now()}`,
            number: `${prefix}-${year}-${seq}`,
            ...payload,
          };
        setRows((prev) => [row, ...prev]);
        toast.success(
          t('adminInvoices.create.success', 'Facture créée : {{n}}', {
            n: row.number,
          }),
        );
        setForm({ ...EMPTY_FORM });
        setShowCreate(false);
        setPage(1);
      } catch {
        toast.error(t('adminInvoices.create.errSave', "Échec de l'enregistrement."));
      } finally {
        setSaving(false);
      }
    },
    [form, rows.length, t, token],
  );

  const printInvoice = useCallback(
    (inv: Invoice) => {
      const totals = computeTotals(inv);
      const doc: PrintDoc = {
        docType:
          inv.kind === 'credit_note'
            ? t('adminInvoices.kind.credit_note', 'Avoir')
            : t('adminInvoices.kind.invoice', 'Facture'),
        number: inv.number,
        client: inv.client,
        clientMF: inv.clientMF,
        issueDate: inv.issueDate,
        dueOrValidLabel: t('adminInvoices.col.due', 'Échéance'),
        dueOrValidDate: inv.dueDate,
        lines: inv.lines.map((l) => ({
          label: l.label,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
        totals: {
          totalHT: totals.totalHT,
          tva: totals.tva,
          timbre: totals.timbre,
          retenue: totals.retenue,
          totalTTC: totals.totalTTC,
        },
        labels: {
          seller: t('adminPrint.seller', 'Émetteur'),
          billedTo: t('adminPrint.billedTo', 'Facturé à'),
          mf: t('adminInvoices.preview.mf', 'Matricule fiscal'),
          issue: t('adminInvoices.col.issue', 'Émission'),
          designation: t('adminInvoices.preview.item', 'Désignation'),
          qty: t('adminInvoices.preview.qty', 'Qté'),
          unitPrice: t('adminInvoices.preview.pu', 'P.U. HT'),
          lineTotal: t('adminInvoices.preview.total', 'Total HT'),
          totalHT: t('adminInvoices.totals.ht', 'Total HT'),
          tva: t('adminInvoices.totals.tva', 'TVA (19 %)'),
          timbre: t('adminInvoices.totals.timbre', 'Timbre fiscal'),
          retenue: t('adminInvoices.totals.retenue', 'Retenue à la source (1,5 %)'),
          totalTTC: t('adminInvoices.totals.ttc', 'Net à payer TTC'),
          thanks: t('adminPrint.thanks', 'Merci de votre confiance.'),
        },
      };
      printDocument(doc);
    },
    [t],
  );

  // Apply a status transition (draft → sent → paid …). Persists to backend when
  // available, else updates local state (demo mode).
  const applyStatus = useCallback(
    async (inv: Invoice, next: InvoiceStatus) => {
      setBusy(true);
      await mutateAdminResource(`${ERP_ENDPOINTS.invoices}/${inv.id}`, token ?? '', {
        method: 'PATCH',
        body: { status: next },
      });
      setRows((prev) => prev.map((r) => (r.id === inv.id ? { ...r, status: next } : r)));
      setPreview((cur) => (cur && cur.id === inv.id ? { ...cur, status: next } : cur));
      setBusy(false);
      setConfirmAction(null);
      toast.success(
        t('adminInvoices.toast.status', 'Facture {{n}} : {{s}}', {
          n: inv.number,
          s: t(`adminInvoices.status.${next}`, next),
        }),
      );
    },
    [t, token],
  );

  // Delete an invoice (with confirmation).
  const deleteInvoice = useCallback(async () => {
    if (!toDelete) return;
    const inv = toDelete;
    setBusy(true);
    await mutateAdminResource(`${ERP_ENDPOINTS.invoices}/${inv.id}`, token ?? '', {
      method: 'DELETE',
    });
    setRows((prev) => prev.filter((r) => r.id !== inv.id));
    setPreview((cur) => (cur && cur.id === inv.id ? null : cur));
    setBusy(false);
    setToDelete(null);
    toast.success(
      t('adminInvoices.toast.deleted', 'Facture {{n}} supprimée', { n: inv.number }),
    );
  }, [toDelete, t, token]);

  // Next status offered by the primary "advance" button, per current state.
  const nextStatusFor = (s: InvoiceStatus): InvoiceStatus | null => {
    if (s === 'draft') return 'sent';
    if (s === 'sent' || s === 'overdue') return 'paid';
    return null;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (kindFilter !== 'all' && inv.kind !== kindFilter) return false;
      if (!inDateRange(inv.issueDate, dateRange)) return false;
      if (!q) return true;
      return (
        inv.number.toLowerCase().includes(q) ||
        inv.client.toLowerCase().includes(q) ||
        inv.clientMF.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, kindFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () =>
      filtered.slice(
        (currentPage - 1) * ROWS_PER_PAGE,
        currentPage * ROWS_PER_PAGE,
      ),
    [filtered, currentPage],
  );

  /* --- KPI summary (invoices only, positive amounts) --------------------- */
  const kpis = useMemo(() => {
    let facture = 0;
    let tvaCollectee = 0;
    let enAttente = 0;
    let paye = 0;
    for (const inv of rows) {
      const { totalHT, tva, totalTTC } = computeTotals(inv);
      facture += totalHT;
      tvaCollectee += tva;
      if (inv.status === 'paid') paye += totalTTC;
      else if (inv.status === 'sent' || inv.status === 'overdue')
        enAttente += totalTTC;
    }
    return { facture, tvaCollectee, enAttente, paye };
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* --- Title block ---------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-1 text-xs font-medium text-ink-400">
            {t('adminLayout.sections.gestionCommerciale', 'Gestion commerciale')}
            <span className="mx-1.5">/</span>
            <span className="text-ink-600">
              {t('adminInvoices.title', 'Factures & Avoirs')}
            </span>
          </nav>
          <h1 className="text-2xl font-black text-ink-900">
            {t('adminInvoices.title', 'Factures & Avoirs')}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t(
              'adminInvoices.subtitle',
              'Émission, suivi et encaissement des factures clients conformes à la réglementation tunisienne (TVA 19 %, timbre fiscal, retenue à la source).',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={refresh} busy={loading} />
          {canManage && (
            <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('adminInvoices.actions.new', 'Nouvelle facture')}
            </button>
          )}
        </div>
      </div>

      {/* --- KPIs ----------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          Icon={Receipt}
          label={t('adminInvoices.kpi.turnover', "Chiffre d'affaires HT")}
          value={money.format(kpis.facture)}
        />
        <KpiTile
          Icon={FileText}
          label={t('adminInvoices.kpi.vat', 'TVA collectée')}
          value={money.format(kpis.tvaCollectee)}
        />
        <KpiTile
          Icon={Clock}
          label={t('adminInvoices.kpi.pending', 'En attente')}
          value={money.format(kpis.enAttente)}
        />
        <KpiTile
          Icon={CheckCircle2}
          label={t('adminInvoices.kpi.paid', 'Encaissé')}
          value={money.format(kpis.paye)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* --- Table container ------------------------------------------------ */}
      <div className={CARD}>
        {/* Filter bar */}
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className={`${INPUT} pl-9`}
              placeholder={t(
                'adminInvoices.searchPlaceholder',
                'N° facture, client, matricule fiscal…',
              )}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${INPUT} w-auto`}
              value={kindFilter}
              onChange={(e) => {
                setKindFilter(e.target.value as typeof kindFilter);
                setPage(1);
              }}
            >
              <option value="all">
                {t('adminInvoices.filters.allKinds', 'Tous les documents')}
              </option>
              <option value="invoice">
                {t('adminInvoices.kind.invoice', 'Factures')}
              </option>
              <option value="credit_note">
                {t('adminInvoices.kind.credit_note', 'Avoirs')}
              </option>
            </select>
            <select
              className={`${INPUT} w-auto`}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter);
                setPage(1);
              }}
            >
              <option value="all">
                {t('adminInvoices.filters.allStatuses', 'Tous les statuts')}
              </option>
              {(
                ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]
              ).map((s) => (
                <option key={s} value={s}>
                  {t(`adminInvoices.status.${s}`, s)}
                </option>
              ))}
            </select>
            <DateRangeFilter
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-sm ${TABLE_MIN_WIDE}`}>
            <thead>
              <tr className={TH_ROW}>
                <th className="px-4 py-3">{t('adminInvoices.col.number', 'N°')}</th>
                <th className="px-4 py-3">{t('adminInvoices.col.client', 'Client')}</th>
                <th className="px-4 py-3">{t('adminInvoices.col.issue', 'Émission')}</th>
                <th className="px-4 py-3">{t('adminInvoices.col.due', 'Échéance')}</th>
                <th className="px-4 py-3 text-right">
                  {t('adminInvoices.col.ht', 'Montant HT')}
                </th>
                <th className="px-4 py-3 text-right">
                  {t('adminInvoices.col.ttc', 'Total TTC')}
                </th>
                <th className="px-4 py-3">{t('adminInvoices.col.status', 'Statut')}</th>
                <th className="px-4 py-3 text-right">
                  {t('adminInvoices.col.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      Icon={FileText}
                      title={t('adminInvoices.empty.title', 'Aucune facture')}
                      hint={t(
                        'adminInvoices.empty.hint',
                        'Ajustez vos filtres ou créez une nouvelle facture.',
                      )}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((inv) => {
                  const totals = computeTotals(inv);
                  return (
                    <tr
                      key={inv.id}
                      className="border-t border-ink-100 transition-colors hover:bg-ink-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-semibold text-ink-900">
                          {inv.kind === 'credit_note' ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                              {t('adminInvoices.kind.credit_note', 'Avoir')}
                            </span>
                          ) : null}
                          <span className="ba-nums">{inv.number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-800">{inv.client}</div>
                        <div className="text-xs text-ink-400 ba-nums">
                          {inv.clientMF}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-600 ba-nums">
                        {dateFmt.format(new Date(inv.issueDate))}
                      </td>
                      <td className="px-4 py-3 text-ink-600 ba-nums">
                        {dateFmt.format(new Date(inv.dueDate))}
                      </td>
                      <td className="px-4 py-3 text-right ba-nums text-ink-700">
                        {money.format(totals.totalHT)}
                      </td>
                      <td className="px-4 py-3 text-right ba-nums font-semibold text-ink-900">
                        {money.format(totals.totalTTC)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className={ROW_ACTIONS_CELL}>
                        <div className={ROW_ACTIONS}>
                          <button
                            type="button"
                            className={rowActionBtn('gold')}
                            title={t('adminInvoices.actions.view', 'Aperçu')}
                            onClick={() => setPreview(inv)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={rowActionBtn('gold')}
                            title={t('adminInvoices.actions.print', 'Imprimer')}
                            onClick={() => printInvoice(inv)}
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={rowActionBtn('gold')}
                            title={t('adminInvoices.actions.download', 'Télécharger PDF')}
                            onClick={() => printInvoice(inv)}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {canManage && nextStatusFor(inv.status) && (
                            <button
                              type="button"
                              className={rowActionBtn('blue')}
                              title={
                                inv.status === 'draft'
                                  ? t('adminInvoices.actions.send', 'Envoyer')
                                  : t('adminInvoices.actions.markPaid', 'Marquer payée')
                              }
                              onClick={() =>
                                setConfirmAction({ invoice: inv, next: nextStatusFor(inv.status)! })
                              }
                            >
                              {inv.status === 'draft' ? (
                                <Send className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              className={rowActionBtn('red')}
                              title={t('adminInvoices.actions.delete', 'Supprimer')}
                              onClick={() => setToDelete(inv)}
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
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
            <span className="ba-nums">
              {t('adminInvoices.pagination.count', {
                defaultValue: '{{count}} document(s)',
                count: filtered.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={BTN_GHOST}
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('adminInvoices.pagination.prev', 'Précédent')}
              </button>
              <span className="ba-nums px-1">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className={BTN_GHOST}
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('adminInvoices.pagination.next', 'Suivant')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Preview drawer ------------------------------------------------- */}
      <AnimatePresence>
        {preview && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
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
                    {preview.kind === 'credit_note'
                      ? t('adminInvoices.kind.credit_note', 'Avoir')
                      : t('adminInvoices.kind.invoice', 'Facture')}
                  </div>
                  <div className="ba-nums text-lg font-black text-ink-900">
                    {preview.number}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-50"
                  onClick={() => setPreview(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
                <div className="space-y-1">
                  <div className="font-semibold text-ink-900">{preview.client}</div>
                  <div className="text-ink-500">
                    {t('adminInvoices.preview.mf', 'Matricule fiscal')}:{' '}
                    <span className="ba-nums">{preview.clientMF}</span>
                  </div>
                  <div className="text-ink-500">
                    {t('adminInvoices.col.issue', 'Émission')}:{' '}
                    <span className="ba-nums">
                      {dateFmt.format(new Date(preview.issueDate))}
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-ink-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-ink-500">
                      <tr>
                        <th className="px-3 py-2">
                          {t('adminInvoices.preview.item', 'Désignation')}
                        </th>
                        <th className="px-3 py-2 text-right">
                          {t('adminInvoices.preview.qty', 'Qté')}
                        </th>
                        <th className="px-3 py-2 text-right">
                          {t('adminInvoices.preview.pu', 'P.U. HT')}
                        </th>
                        <th className="px-3 py-2 text-right">
                          {t('adminInvoices.preview.total', 'Total HT')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lines.map((l, idx) => (
                        <tr key={idx} className="border-t border-ink-100">
                          <td className="px-3 py-2 text-ink-800">{l.label}</td>
                          <td className="px-3 py-2 text-right ba-nums">{l.qty}</td>
                          <td className="px-3 py-2 text-right ba-nums">
                            {money.format(l.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-right ba-nums">
                            {money.format(l.qty * l.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const totals = computeTotals(preview);
                  const Row = ({
                    label,
                    value,
                    strong,
                  }: {
                    label: string;
                    value: number;
                    strong?: boolean;
                  }) => (
                    <div
                      className={`flex items-center justify-between ${
                        strong
                          ? 'border-t border-ink-200 pt-2 text-base font-black text-ink-900'
                          : 'text-ink-600'
                      }`}
                    >
                      <span>{label}</span>
                      <span className="ba-nums">{money.format(value)}</span>
                    </div>
                  );
                  return (
                    <div className="space-y-1.5 rounded-xl bg-ink-50 p-4">
                      <Row label={t('adminInvoices.totals.ht', 'Total HT')} value={totals.totalHT} />
                      <Row
                        label={t('adminInvoices.totals.tva', 'TVA (19 %)')}
                        value={totals.tva}
                      />
                      {totals.timbre > 0 && (
                        <Row
                          label={t('adminInvoices.totals.timbre', 'Timbre fiscal')}
                          value={totals.timbre}
                        />
                      )}
                      {preview.withholding && (
                        <Row
                          label={t('adminInvoices.totals.retenue', 'Retenue à la source (1,5 %)')}
                          value={-totals.retenue}
                        />
                      )}
                      <Row
                        label={t('adminInvoices.totals.ttc', 'Net à payer TTC')}
                        value={totals.totalTTC}
                        strong
                      />
                    </div>
                  );
                })()}
              </div>

              <footer className="flex flex-col gap-2 border-t border-ink-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`${BTN_PRIMARY} flex-1 justify-center`}
                    onClick={() => printInvoice(preview)}
                  >
                    <Printer className="h-4 w-4" />
                    {t('adminInvoices.actions.print', 'Imprimer')}
                  </button>
                  <button
                    type="button"
                    className={`${BTN_GHOST} flex-1 justify-center`}
                    onClick={() => printInvoice(preview)}
                  >
                    <Download className="h-4 w-4" />
                    {t('adminInvoices.actions.download', 'PDF')}
                  </button>
                </div>
                {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  {nextStatusFor(preview.status) && (
                    <button
                      type="button"
                      className="ba-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      onClick={() =>
                        setConfirmAction({ invoice: preview, next: nextStatusFor(preview.status)! })
                      }
                    >
                      {preview.status === 'draft' ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {preview.status === 'draft'
                        ? t('adminInvoices.actions.send', 'Envoyer')
                        : t('adminInvoices.actions.markPaid', 'Marquer payée')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="ba-press inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                    onClick={() => setToDelete(preview)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('adminInvoices.actions.delete', 'Supprimer')}
                  </button>
                </div>
                )}
              </footer>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Create modal --------------------------------------------------- */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
              onClick={() => !saving && setShowCreate(false)}
            />
            <motion.form
              onSubmit={submitCreate}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-elev-3"
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
            >
              <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <h2 className="text-lg font-black text-ink-900">
                  {t('adminInvoices.create.title', 'Nouvelle facture')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-wider text-ink-500">
                    {t('adminInvoices.create.client', 'Client')} *
                  </label>
                  <EntityPicker
                    options={clientOptions.map((c) => ({ id: c.id, label: c.name, sub: c.taxId ?? c.city }))}
                    value={form.clientId}
                    autoFocus
                    placeholder={t('adminInvoices.create.clientPh', 'Choisir un client…')}
                    emptyLabel={t('adminInvoices.create.noClient', 'Aucun client trouvé')}
                    onChange={(id, opt) =>
                      setForm((f) => ({
                        ...f,
                        clientId: id,
                        client: opt?.label ?? '',
                        // Auto-fill the fiscal id from the picked client when known.
                        clientMF:
                          (id != null ? clientOptions.find((c) => c.id === id)?.taxId : undefined) ?? f.clientMF,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wider text-ink-500">
                      {t('adminInvoices.create.mf', 'Matricule fiscal')}
                    </label>
                    <input
                      className={INPUT}
                      value={form.clientMF}
                      onChange={(e) => setForm((f) => ({ ...f, clientMF: e.target.value }))}
                      placeholder="1234567/A/M/000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wider text-ink-500">
                      {t('adminInvoices.create.kind', 'Type')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.kind}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, kind: e.target.value as InvoiceKind }))
                      }
                    >
                      <option value="invoice">
                        {t('adminInvoices.kind.invoice', 'Facture')}
                      </option>
                      <option value="credit_note">
                        {t('adminInvoices.kind.credit_note', 'Avoir')}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wider text-ink-500">
                      {t('adminInvoices.create.issueDate', "Date d'émission")}
                    </label>
                    <input
                      type="date"
                      className={INPUT}
                      value={form.issueDate}
                      onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wider text-ink-500">
                      {t('adminInvoices.create.dueDate', "Date d'échéance")}
                    </label>
                    <input
                      type="date"
                      className={INPUT}
                      value={form.dueDate}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-wider text-ink-500">
                    {t('adminInvoices.create.lines', 'Articles')}
                  </label>
                  <LineItemsEditor
                    lines={form.lines}
                    onChange={(lines) => setForm((f) => ({ ...f, lines }))}
                    productOptions={productOptions.map((p) => ({
                      id: p.id,
                      label: p.name,
                      price: p.price,
                      sub: money.format(p.price),
                    }))}
                    serviceOptions={serviceOptions.map((s) => ({
                      id: s.id,
                      label: s.name,
                      price: s.price,
                      sub: money.format(s.price),
                    }))}
                    productsLoading={productsLoading}
                    money={(n) => money.format(n)}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                  <input
                    type="checkbox"
                    checked={form.withholding}
                    onChange={(e) => setForm((f) => ({ ...f, withholding: e.target.checked }))}
                    className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
                  />
                  {t('adminInvoices.create.withholding', 'Appliquer la retenue à la source (1,5 %)')}
                </label>
              </div>

              <footer className="flex items-center gap-2 border-t border-ink-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className={`${BTN_GHOST} flex-1 justify-center`}
                  disabled={saving}
                >
                  {t('adminInvoices.create.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className={`${BTN_PRIMARY} flex-1 justify-center`}
                  disabled={saving}
                >
                  <Plus className="h-4 w-4" />
                  {saving
                    ? t('adminInvoices.create.saving', 'Enregistrement…')
                    : t('adminInvoices.create.submit', 'Créer')}
                </button>
              </footer>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status-change confirmation */}
      <ConfirmDialog
        open={!!confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() =>
          confirmAction && void applyStatus(confirmAction.invoice, confirmAction.next)
        }
        pending={busy}
        Icon={CheckCircle2}
        title={t('adminInvoices.confirm.statusTitle', 'Changer le statut ?')}
        detail={confirmAction?.invoice.number}
        message={
          confirmAction
            ? t('adminInvoices.confirm.statusMsg', 'La facture {{n}} passera au statut « {{s}} ».', {
                n: confirmAction.invoice.number,
                s: t(`adminInvoices.status.${confirmAction.next}`, confirmAction.next),
              })
            : ''
        }
        confirmLabel={t('adminInvoices.confirm.statusOk', 'Confirmer')}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void deleteInvoice()}
        pending={busy}
        Icon={AlertTriangle}
        title={t('adminInvoices.confirm.deleteTitle', 'Supprimer cette facture ?')}
        detail={toDelete?.number}
        message={t(
          'adminInvoices.confirm.deleteMsg',
          'Cette action est irréversible. La facture {{n}} sera définitivement supprimée.',
          { n: toDelete?.number ?? '' },
        )}
        confirmLabel={t('adminInvoices.actions.delete', 'Supprimer')}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local KPI tile (gold/ink tokens, no count-up so currency stays intact)    */
/* -------------------------------------------------------------------------- */

function KpiTile({
  Icon,
  label,
  value,
}: {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="ba-lift flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-elev-1 transition-colors hover:border-gold-300 sm:gap-4 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-50 text-gold-700 sm:h-12 sm:w-12">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <span className="block truncate text-[10px] font-black uppercase tracking-wider text-ink-400 sm:text-[11px]">
          {label}
        </span>
        <span className="ba-nums block truncate text-lg font-black leading-tight text-ink-900 sm:text-xl">
          {value}
        </span>
      </div>
    </div>
  );
}
