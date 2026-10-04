import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import {
  Truck,
  Search,
  Plus,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  PackageCheck,
  FileText,
  MapPin,
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
  mutateAdminResource,
  createAdminResource,
  getAdminEntityOptions,
  getAdminProductOptions,
  getAdminOrders,
  type AdminEntityOption,
  type AdminProductOption,
  type AdminOrder,
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
  LineItemsEditor,
  EMPTY_LINE,
  type LineItem,
} from './_ui';

/* -------------------------------------------------------------------------- */
/*  Bons de livraison (Delivery Notes) — Gestion commerciale                   */
/*  Self-contained module: renders standalone with local data until the        */
/*  backend endpoints are wired.                                                */
/* -------------------------------------------------------------------------- */

type DnStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'returned' | 'cancelled';

interface DeliveryNote {
  id: string;
  number: string;
  clientName: string;
  city: string;
  issueDate: string; // ISO date
  deliveredDate: string | null; // ISO date
  itemsCount: number;
  linkedInvoice: string | null; // invoice number when invoiced
  status: DnStatus;
}

const MOCK_NOTES: DeliveryNote[] = [
  { id: 'd1', number: 'BL-2025-0088', clientName: 'Garage El Amine', city: 'Tunis', issueDate: '2025-02-15', deliveredDate: null, itemsCount: 7, linkedInvoice: null, status: 'shipped' },
  { id: 'd2', number: 'BL-2025-0087', clientName: 'Sté Méditerranée Auto', city: 'Sfax', issueDate: '2025-02-14', deliveredDate: '2025-02-16', itemsCount: 14, linkedInvoice: 'FAC-2025-0203', status: 'delivered' },
  { id: 'd3', number: 'BL-2025-0086', clientName: 'Auto Service Sfax', city: 'Sfax', issueDate: '2025-02-12', deliveredDate: null, itemsCount: 9, linkedInvoice: null, status: 'preparing' },
  { id: 'd4', number: 'BL-2025-0085', clientName: 'Transport Nabeul SARL', city: 'Nabeul', issueDate: '2025-02-10', deliveredDate: '2025-02-12', itemsCount: 21, linkedInvoice: 'FAC-2025-0201', status: 'delivered' },
  { id: 'd5', number: 'BL-2025-0084', clientName: 'Flotte Taxi Ariana', city: 'Ariana', issueDate: '2025-02-08', deliveredDate: null, itemsCount: 12, linkedInvoice: null, status: 'pending' },
  { id: 'd6', number: 'BL-2025-0083', clientName: 'Mohamed Trabelsi', city: 'Sousse', issueDate: '2025-02-06', deliveredDate: '2025-02-07', itemsCount: 3, linkedInvoice: 'FAC-2025-0198', status: 'delivered' },
  { id: 'd7', number: 'BL-2025-0082', clientName: 'Garage Central Tunis', city: 'Tunis', issueDate: '2025-02-03', deliveredDate: null, itemsCount: 5, linkedInvoice: null, status: 'returned' },
  { id: 'd8', number: 'BL-2025-0081', clientName: 'Sté Logistique Sousse', city: 'Sousse', issueDate: '2025-01-30', deliveredDate: '2025-02-02', itemsCount: 30, linkedInvoice: 'FAC-2025-0195', status: 'delivered' },
  { id: 'd9', number: 'BL-2025-0080', clientName: 'Karim Ben Salah', city: 'Bizerte', issueDate: '2025-01-28', deliveredDate: null, itemsCount: 2, linkedInvoice: null, status: 'cancelled' },
  { id: 'd10', number: 'BL-2025-0079', clientName: 'Salma Gharbi', city: 'Gabès', issueDate: '2025-01-25', deliveredDate: '2025-01-27', itemsCount: 4, linkedInvoice: 'FAC-2025-0190', status: 'delivered' },
  { id: 'd11', number: 'BL-2025-0078', clientName: 'Garage El Amine', city: 'Tunis', issueDate: '2025-01-22', deliveredDate: null, itemsCount: 8, linkedInvoice: null, status: 'shipped' },
  { id: 'd12', number: 'BL-2025-0077', clientName: 'Anis Khemiri', city: 'Monastir', issueDate: '2025-01-19', deliveredDate: null, itemsCount: 6, linkedInvoice: null, status: 'preparing' },
];

const STATUS_CONFIG: Record<
  DnStatus,
  { key: string; fallback: string; Icon: ComponentType<{ className?: string }>; className: string }
> = {
  pending: { key: 'adminDeliveryNotes.status.pending', fallback: 'En attente', Icon: Clock, className: 'bg-ink-100 text-ink-600 ring-ink-200' },
  preparing: { key: 'adminDeliveryNotes.status.preparing', fallback: 'Préparation', Icon: PackageCheck, className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  shipped: { key: 'adminDeliveryNotes.status.shipped', fallback: 'Expédié', Icon: Truck, className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  delivered: { key: 'adminDeliveryNotes.status.delivered', fallback: 'Livré', Icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  returned: { key: 'adminDeliveryNotes.status.returned', fallback: 'Retourné', Icon: XCircle, className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  cancelled: { key: 'adminDeliveryNotes.status.cancelled', fallback: 'Annulé', Icon: XCircle, className: 'bg-red-50 text-red-700 ring-red-200' },
};

const STATUS_ORDER: DnStatus[] = ['pending', 'preparing', 'shipped', 'delivered', 'returned', 'cancelled'];
const ROWS_PER_PAGE = 8;

export default function AdminDeliveryNotes() {
  const { t, i18n } = useTranslation();
  const { token, hasPermission, isAdmin } = useAuth();
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN';
  const isFr = i18n.language.startsWith('fr');
  // "if i have the access" — write actions gated on DELIVERY_NOTE_MANAGE.
  const canManage = isAdmin || hasPermission('DELIVERY_NOTE_MANAGE');

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale],
  );
  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
      }),
    [locale],
  );

  const [rows, setRows] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DnStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DeliveryNote | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientOptions, setClientOptions] = useState<AdminEntityOption[]>([]);
  const [productOptions, setProductOptions] = useState<AdminProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [orderOptions, setOrderOptions] = useState<AdminOrder[]>([]);
  // Item source toggle for the create modal: pick from the product catalogue,
  // or import the line items from an existing order.
  const [itemSource, setItemSource] = useState<'catalog' | 'order'>('catalog');
  const [sourceOrderId, setSourceOrderId] = useState<number | null>(null);
  const emptyForm = {
    clientId: null as number | null,
    clientName: '',
    city: '',
    issueDate: '',
    lines: [{ ...EMPTY_LINE }] as LineItem[],
  };
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<DeliveryNote | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ note: DeliveryNote; next: DnStatus } | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, live: isLive } = await getAdminResource<DeliveryNote>(
        ERP_ENDPOINTS.deliveryNotes,
        token ?? '',
        MOCK_NOTES,
      );
      setRows(items);
      setLive(isLive);
    } catch {
      setError(t('adminDeliveryNotes.error', 'Impossible de charger les bons de livraison.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  // Load pickable clients, products (catalogue) and recent orders for the
  // create modal so line items can come from either source.
  useEffect(() => {
    if (!token) return;
    void getAdminEntityOptions('clients', token).then(setClientOptions);
    setProductsLoading(true);
    void getAdminProductOptions(token, isFr)
      .then(setProductOptions)
      .finally(() => setProductsLoading(false));
    void getAdminOrders(token, undefined, 0, 50)
      .then((p) => setOrderOptions(p.content ?? []))
      .catch(() => {});
  }, [token, isFr]);

  // Generate an invoice from a delivered, not-yet-invoiced note. Optimistic in demo.
  const invoiceNote = useCallback(
    async (dn: DeliveryNote) => {
      const ok = await mutateAdminResource(`${ERP_ENDPOINTS.deliveryNotes}/${dn.id}/invoice`, token ?? '', {
        method: 'POST',
      });
      const generated = `FAC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
      setRows((prev) => prev.map((r) => (r.id === dn.id ? { ...r, linkedInvoice: generated } : r)));
      setSelected((cur) => (cur && cur.id === dn.id ? { ...cur, linkedInvoice: generated } : cur));
      toast.success(
        ok
          ? t('adminDeliveryNotes.toast.invoiced', 'Facture générée')
          : t('adminDeliveryNotes.toast.invoicedLocal', 'Facture générée (mode démo)'),
      );
    },
    [t, token],
  );

  // Create a new delivery note. Persists to backend when available, else
  // appends an optimistic local row (demo mode). Line items are taken from the
  // form (catalogue or imported from an order) — itemsCount is derived.
  const submitCreate = useCallback(async () => {
    if (!form.clientId || !form.clientName.trim()) {
      toast.error(t('adminDeliveryNotes.form.clientRequired', 'Le client est requis.'));
      return;
    }
    const validLines = form.lines.filter((l) => l.label.trim());
    if (!validLines.length) {
      toast.error(t('adminDeliveryNotes.form.linesRequired', 'Ajoutez au moins une ligne.'));
      return;
    }
    setSaving(true);
    const itemsCount = validLines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    const payload = {
      clientId: form.clientId,
      clientName: form.clientName.trim(),
      city: form.city.trim(),
      issueDate: form.issueDate || new Date().toISOString().slice(0, 10),
      deliveredDate: null,
      itemsCount,
      lines: validLines.map((l) => ({
        productId: l.productId,
        label: l.label.trim(),
        qty: Number(l.qty) || 1,
        unitPrice: Number(l.unitPrice) || 0,
      })),
      linkedInvoice: null,
      status: 'pending' as DnStatus,
    };
    const created = await createAdminResource<DeliveryNote>(ERP_ENDPOINTS.deliveryNotes, token ?? '', payload);
    const row: DeliveryNote =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
        number: `BL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      };
    setRows((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    setItemSource('catalog');
    setSourceOrderId(null);
    toast.success(
      created
        ? t('adminDeliveryNotes.toast.created', 'Bon de livraison créé')
        : t('adminDeliveryNotes.toast.createdLocal', 'Bon créé (mode démo)'),
    );
  }, [form, t, token]);

  // Import the line items of an existing order into the create form.
  const importOrderLines = useCallback(
    (orderId: number | null) => {
      setSourceOrderId(orderId);
      if (orderId == null) return;
      const order = orderOptions.find((o) => o.id === orderId);
      if (!order) return;
      const lines: LineItem[] = (order.items ?? []).map((it) => ({
        productId: it.product?.id ?? null,
        label:
          (isFr ? it.productNameFr : it.productName) ||
          it.product?.name ||
          it.productName ||
          t('adminDeliveryNotes.form.orderItem', 'Article'),
        qty: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      }));
      setForm((f) => ({
        ...f,
        lines: lines.length ? lines : [{ ...EMPTY_LINE }],
      }));
    },
    [orderOptions, isFr, t],
  );

  // Advance the note status (pending → preparing → shipped → delivered).
  const applyStatus = useCallback(
    async (dn: DeliveryNote, next: DnStatus) => {
      setBusy(true);
      await mutateAdminResource(`${ERP_ENDPOINTS.deliveryNotes}/${dn.id}`, token ?? '', {
        method: 'PATCH',
        body: { status: next, ...(next === 'delivered' ? { deliveredDate: new Date().toISOString().slice(0, 10) } : {}) },
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === dn.id
            ? { ...r, status: next, deliveredDate: next === 'delivered' ? new Date().toISOString().slice(0, 10) : r.deliveredDate }
            : r,
        ),
      );
      setSelected((cur) =>
        cur && cur.id === dn.id
          ? { ...cur, status: next, deliveredDate: next === 'delivered' ? new Date().toISOString().slice(0, 10) : cur.deliveredDate }
          : cur,
      );
      setBusy(false);
      setConfirmAction(null);
      toast.success(
        t('adminDeliveryNotes.toast.status', 'Bon {{n}} : {{s}}', {
          n: dn.number,
          s: t(STATUS_CONFIG[next].key, STATUS_CONFIG[next].fallback),
        }),
      );
    },
    [t, token],
  );

  // Delete a note (with confirmation). Backend when available, else local.
  const deleteNote = useCallback(async () => {
    if (!toDelete) return;
    const dn = toDelete;
    setBusy(true);
    await mutateAdminResource(`${ERP_ENDPOINTS.deliveryNotes}/${dn.id}`, token ?? '', {
      method: 'DELETE',
    });
    setRows((prev) => prev.filter((r) => r.id !== dn.id));
    setSelected((cur) => (cur && cur.id === dn.id ? null : cur));
    setBusy(false);
    setToDelete(null);
    toast.success(t('adminDeliveryNotes.toast.deleted', 'Bon {{n}} supprimé', { n: dn.number }));
  }, [toDelete, t, token]);

  // Next status offered by the advance button.
  const nextStatusFor = (s: DnStatus): DnStatus | null => {
    if (s === 'pending') return 'preparing';
    if (s === 'preparing') return 'shipped';
    if (s === 'shipped') return 'delivered';
    return null;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((dn) => {
      if (statusFilter !== 'all' && dn.status !== statusFilter) return false;
      if (!inDateRange(dn.issueDate, dateRange)) return false;
      if (!term) return true;
      return (
        dn.number.toLowerCase().includes(term) ||
        dn.clientName.toLowerCase().includes(term) ||
        dn.city.toLowerCase().includes(term)
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
    const inTransit = rows.filter((dn) => dn.status === 'shipped' || dn.status === 'preparing').length;
    const delivered = rows.filter((dn) => dn.status === 'delivered').length;
    const toInvoice = rows.filter((dn) => dn.status === 'delivered' && !dn.linkedInvoice).length;
    return {
      total: rows.length,
      inTransit,
      delivered,
      toInvoice,
    };
  }, [rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const dn of rows) counts[dn.status] = (counts[dn.status] ?? 0) + 1;
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
            <span className="text-ink-600">{t('adminDeliveryNotes.title', 'Bons de livraison')}</span>
          </nav>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            {t('adminDeliveryNotes.title', 'Bons de livraison')}
            {!loading && !live && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                {t('common.demoData', 'Données démo')}
              </span>
            )}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminDeliveryNotes.subtitle', 'Suivez vos expéditions et générez les factures associées.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => void fetchNotes()} busy={loading} />
          {canManage && (
            <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('adminDeliveryNotes.new', 'Nouveau bon')}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('adminDeliveryNotes.stats.total', 'Total bons')} value={String(stats.total)} Icon={Truck} />
        <StatTile label={t('adminDeliveryNotes.stats.inTransit', 'En transit')} value={String(stats.inTransit)} Icon={Clock} />
        <StatTile label={t('adminDeliveryNotes.stats.delivered', 'Livrés')} value={String(stats.delivered)} Icon={CheckCircle2} />
        <StatTile label={t('adminDeliveryNotes.stats.toInvoice', 'À facturer')} value={String(stats.toInvoice)} Icon={FileText} />
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
              placeholder={t('adminDeliveryNotes.searchPlaceholder', 'Rechercher par n°, client ou ville…')}
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
              label={t('adminDeliveryNotes.filter.all', 'Tous')}
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
                <th className="px-4 py-3 text-left font-semibold">{t('adminDeliveryNotes.col.number', 'N° bon')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminDeliveryNotes.col.client', 'Client')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminDeliveryNotes.col.issueDate', 'Émission')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminDeliveryNotes.col.deliveredDate', 'Livré le')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminDeliveryNotes.col.invoice', 'Facture')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminDeliveryNotes.col.status', 'Statut')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminDeliveryNotes.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={ROWS_PER_PAGE} cols={7} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      Icon={Truck}
                      title={t('adminDeliveryNotes.empty.title', 'Aucun bon de livraison')}
                      hint={t('adminDeliveryNotes.empty.hint', 'Aucun bon ne correspond à votre recherche.')}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((dn) => {
                  const cfg = STATUS_CONFIG[dn.status];
                  return (
                    <tr key={dn.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">{dn.number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-800">{dn.clientName}</div>
                        <div className="flex items-center gap-1 text-xs text-ink-400">
                          <MapPin className="h-3 w-3" />
                          {dn.city}
                          {' · '}
                          {t('adminDeliveryNotes.itemsCount', '{{count}} article(s)', { count: dn.itemsCount })}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(dn.issueDate))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                        {dn.deliveredDate ? dateFmt.format(new Date(dn.deliveredDate)) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {dn.linkedInvoice ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700">
                            <FileText className="h-3.5 w-3.5" />
                            {dn.linkedInvoice}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-300">{t('adminDeliveryNotes.notInvoiced', 'Non facturé')}</span>
                        )}
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
                            onClick={() => setSelected(dn)}
                            className={rowActionBtn('neutral')}
                            title={t('adminDeliveryNotes.action.view', 'Consulter')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (() => {
                            const next = nextStatusFor(dn.status);
                            if (!next) return null;
                            const nextCfg = STATUS_CONFIG[next];
                            return (
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ note: dn, next })}
                                className={rowActionLabelBtn('blue')}
                                title={t('adminDeliveryNotes.action.advance', 'Passer à : {{s}}', {
                                  s: t(nextCfg.key, nextCfg.fallback),
                                })}
                              >
                                <nextCfg.Icon className="h-3.5 w-3.5" />
                                {t(nextCfg.key, nextCfg.fallback)}
                              </button>
                            );
                          })()}
                          {canManage && dn.status === 'delivered' && !dn.linkedInvoice && (
                            <button
                              type="button"
                              onClick={() => void invoiceNote(dn)}
                              className={rowActionLabelBtn('gold')}
                              title={t('adminDeliveryNotes.action.invoice', 'Générer la facture')}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {t('adminDeliveryNotes.action.invoiceShort', 'Facturer')}
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setToDelete(dn)}
                              className={rowActionBtn('red')}
                              title={t('adminDeliveryNotes.action.delete', 'Supprimer')}
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
              {t('adminDeliveryNotes.pagination.summary', '{{shown}} sur {{total}} bons', {
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
                {t('adminDeliveryNotes.pagination.prev', 'Précédent')}
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
                {t('adminDeliveryNotes.pagination.next', 'Suivant')}
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
                    {t('adminDeliveryNotes.title', 'Bons de livraison')}
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

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
                <div className="space-y-1">
                  <div className="font-semibold text-ink-900">{selected.clientName}</div>
                  <div className="flex items-center gap-1 text-ink-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {selected.city}
                  </div>
                  <div className="text-ink-500">
                    {t('adminDeliveryNotes.itemsCount', '{{count}} article(s)', { count: selected.itemsCount })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-ink-50 p-3">
                    <div className="text-xs text-ink-400">{t('adminDeliveryNotes.col.issueDate', 'Émission')}</div>
                    <div className="ba-nums font-semibold text-ink-900">
                      {dateFmt.format(new Date(selected.issueDate))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-ink-50 p-3">
                    <div className="text-xs text-ink-400">{t('adminDeliveryNotes.col.deliveredDate', 'Livré le')}</div>
                    <div className="ba-nums font-semibold text-ink-900">
                      {selected.deliveredDate ? dateFmt.format(new Date(selected.deliveredDate)) : '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-400">{t('adminDeliveryNotes.col.status', 'Statut')}</span>
                  {(() => {
                    const cfg = STATUS_CONFIG[selected.status];
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.className}`}
                      >
                        <cfg.Icon className="h-3.5 w-3.5" />
                        {t(cfg.key, cfg.fallback)}
                      </span>
                    );
                  })()}
                </div>

                <div className="rounded-xl bg-ink-50 p-3">
                  <div className="text-xs text-ink-400">{t('adminDeliveryNotes.col.invoice', 'Facture')}</div>
                  <div className="ba-nums font-semibold text-ink-900">
                    {selected.linkedInvoice ?? (
                      <span className="text-ink-400">{t('adminDeliveryNotes.notInvoiced', 'Non facturé')}</span>
                    )}
                  </div>
                </div>
              </div>

              {canManage && (
                <footer className="space-y-2 border-t border-ink-100 px-5 py-4">
                  {(() => {
                    const next = nextStatusFor(selected.status);
                    if (!next) return null;
                    const nextCfg = STATUS_CONFIG[next];
                    return (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ note: selected, next })}
                        className={`${BTN_PRIMARY} w-full justify-center`}
                      >
                        <nextCfg.Icon className="h-4 w-4" />
                        {t('adminDeliveryNotes.action.advance', 'Passer à : {{s}}', {
                          s: t(nextCfg.key, nextCfg.fallback),
                        })}
                      </button>
                    );
                  })()}
                  {selected.status === 'delivered' && !selected.linkedInvoice && (
                    <button
                      type="button"
                      onClick={() => void invoiceNote(selected)}
                      className={`${BTN_PRIMARY} w-full justify-center`}
                    >
                      <FileText className="h-4 w-4" />
                      {t('adminDeliveryNotes.action.invoice', 'Générer la facture')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setToDelete(selected)}
                    className={`${BTN_GHOST} w-full justify-center text-red-600 hover:bg-red-50`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('adminDeliveryNotes.action.delete', 'Supprimer')}
                  </button>
                </footer>
              )}
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
                  {t('adminDeliveryNotes.new', 'Nouveau bon')}
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

              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminDeliveryNotes.col.client', 'Client')} *
                  </label>
                  <EntityPicker
                    options={clientOptions.map((c) => ({ id: c.id, label: c.name, sub: c.taxId ?? c.city }))}
                    value={form.clientId}
                    autoFocus
                    onChange={(id, opt) =>
                      setForm((f) => ({
                        ...f,
                        clientId: id,
                        clientName: opt?.label ?? '',
                        city: f.city || (opt?.sub && !opt.sub.match(/^\d/) ? opt.sub : f.city),
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminDeliveryNotes.col.city', 'Ville')}
                    </label>
                    <input
                      className={INPUT}
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="Tunis"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminDeliveryNotes.col.issueDate', 'Date')}
                    </label>
                    <input
                      type="date"
                      className={INPUT}
                      value={form.issueDate}
                      onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Item source: catalogue or existing order */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminDeliveryNotes.form.itemSource', 'Source des articles')}
                  </label>
                  <div className="inline-flex rounded-lg bg-ink-50 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setItemSource('catalog');
                        setSourceOrderId(null);
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        itemSource === 'catalog' ? 'bg-white text-ink-900 shadow-elev-1' : 'text-ink-500 hover:text-ink-700'
                      }`}
                    >
                      {t('adminDeliveryNotes.form.fromCatalog', 'Catalogue produits')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemSource('order')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        itemSource === 'order' ? 'bg-white text-ink-900 shadow-elev-1' : 'text-ink-500 hover:text-ink-700'
                      }`}
                    >
                      {t('adminDeliveryNotes.form.fromOrder', 'Depuis une commande')}
                    </button>
                  </div>
                </div>

                {itemSource === 'order' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminDeliveryNotes.form.pickOrder', 'Choisir une commande')}
                    </label>
                    <EntityPicker
                      options={orderOptions.map((o) => ({
                        id: o.id,
                        label: o.orderNumber ?? `#${o.id}`,
                        sub:
                          o.clientUsername ??
                          ([o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') ||
                            o.clientEmail ||
                            undefined),
                      }))}
                      value={sourceOrderId}
                      placeholder={t('adminDeliveryNotes.form.pickOrder', 'Choisir une commande')}
                      onChange={(id) => importOrderLines(id)}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminDeliveryNotes.col.items', 'Articles')} *
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
                    productsLoading={productsLoading}
                    money={(n) => money.format(n)}
                  />
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
            title={t('adminDeliveryNotes.confirm.statusTitle', 'Changer le statut')}
            message={t('adminDeliveryNotes.confirm.statusMessage', 'Passer le bon {{n}} à « {{s}} » ?', {
              n: confirmAction.note.number,
              s: t(cfg.key, cfg.fallback),
            })}
            confirmLabel={t(cfg.key, cfg.fallback)}
            cancelLabel={t('common.cancel', 'Annuler')}
            pending={busy}
            onConfirm={() => void applyStatus(confirmAction.note, confirmAction.next)}
            onCancel={() => setConfirmAction(null)}
          />
        );
      })()}

      {/* Delete confirmation */}
      {toDelete && (
        <ConfirmDialog
          open
          Icon={AlertTriangle}
          title={t('adminDeliveryNotes.confirm.deleteTitle', 'Supprimer le bon')}
          message={t('adminDeliveryNotes.confirm.deleteMessage', 'Supprimer définitivement le bon {{n}} ?', {
            n: toDelete.number,
          })}
          confirmLabel={t('adminDeliveryNotes.action.delete', 'Supprimer')}
          cancelLabel={t('common.cancel', 'Annuler')}
          pending={busy}
          onConfirm={() => void deleteNote()}
          onCancel={() => setToDelete(null)}
        />
      )}
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
