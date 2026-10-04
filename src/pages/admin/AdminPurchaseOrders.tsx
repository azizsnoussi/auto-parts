import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import {
  ClipboardList,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  Trash2,
  AlertTriangle,
  Printer,
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
import { printDocument, type PrintDoc } from './_print';

/* -------------------------------------------------------------------------- */
/*  Bons de commande (Purchase Orders) — Gestion commerciale                   */
/*  Self-contained module: renders standalone with local data until the        */
/*  backend endpoints are wired. Mirrors the AdminQuotes layout & tokens.       */
/* -------------------------------------------------------------------------- */

const TVA_RATE = 0.19; // TVA standard tunisienne
const STAMP_DUTY = 1; // Timbre fiscal (TND)

type PoStatus = 'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled';

interface PurchaseOrder {
  id: string;
  number: string;
  supplierId?: number | null;
  supplierName: string;
  orderDate: string; // ISO date
  expectedDate: string; // ISO date
  totalHT: number;
  tvaRate: number;
  stampDuty: number;
  itemsCount: number;
  status: PoStatus;
  /** Line items retained so receiving can book PURCHASE stock movements. */
  lines?: LineItem[];
}

function computeTTC(po: PurchaseOrder): number {
  return po.totalHT * (1 + po.tvaRate) + po.stampDuty;
}

const MOCK_ORDERS: PurchaseOrder[] = [
  { id: 'p1', number: 'BC-2025-0042', supplierName: 'Bosch Tunisie', orderDate: '2025-02-14', expectedDate: '2025-02-28', totalHT: 8420.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 18, status: 'confirmed', lines: [
    { productId: 101, label: 'Plaquettes de frein avant Bosch BP-1204', qty: 6, unitPrice: 480.0 },
    { productId: 102, label: 'Disque de frein ventilé Bosch DF-338', qty: 4, unitPrice: 620.0 },
    { productId: 103, label: 'Filtre à huile Bosch F-026', qty: 8, unitPrice: 385.0 },
  ] },
  { id: 'p2', number: 'BC-2025-0041', supplierName: 'Valeo Distribution', orderDate: '2025-02-11', expectedDate: '2025-02-25', totalHT: 3120.5, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 9, status: 'sent', lines: [
    { productId: 201, label: 'Embrayage complet Valeo 826-704', qty: 3, unitPrice: 720.5 },
    { productId: 202, label: 'Essuie-glace Valeo Silencio 600mm', qty: 12, unitPrice: 79.5 },
  ] },
  { id: 'p3', number: 'BC-2025-0040', supplierName: 'Sté Filtres du Sud', orderDate: '2025-02-07', expectedDate: '2025-02-21', totalHT: 1540.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 24, status: 'partial' },
  { id: 'p4', number: 'BC-2025-0039', supplierName: 'NGK Maghreb', orderDate: '2025-02-03', expectedDate: '2025-02-17', totalHT: 960.75, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 12, status: 'received' },
  { id: 'p5', number: 'BC-2025-0038', supplierName: 'Michelin Tunisie', orderDate: '2025-01-30', expectedDate: '2025-02-13', totalHT: 12480.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 40, status: 'confirmed' },
  { id: 'p6', number: 'BC-2025-0037', supplierName: 'Sté Batteries Assad', orderDate: '2025-01-26', expectedDate: '2025-02-09', totalHT: 5230.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 15, status: 'received' },
  { id: 'p7', number: 'BC-2025-0036', supplierName: 'Mann Filter Import', orderDate: '2025-01-22', expectedDate: '2025-02-05', totalHT: 2110.4, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 30, status: 'cancelled' },
  { id: 'p8', number: 'BC-2025-0035', supplierName: 'Bosch Tunisie', orderDate: '2025-01-18', expectedDate: '2025-02-01', totalHT: 7690.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 22, status: 'received' },
  { id: 'p9', number: 'BC-2025-0034', supplierName: 'Sté Huiles Total', orderDate: '2025-01-14', expectedDate: '2025-01-28', totalHT: 4380.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 16, status: 'draft' },
  { id: 'p10', number: 'BC-2025-0033', supplierName: 'Brembo Distribution', orderDate: '2025-01-09', expectedDate: '2025-01-23', totalHT: 9950.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 27, status: 'received' },
  { id: 'p11', number: 'BC-2024-0208', supplierName: 'Valeo Distribution', orderDate: '2024-12-27', expectedDate: '2025-01-10', totalHT: 1875.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 8, status: 'partial' },
  { id: 'p12', number: 'BC-2024-0207', supplierName: 'NGK Maghreb', orderDate: '2024-12-19', expectedDate: '2025-01-02', totalHT: 640.0, tvaRate: TVA_RATE, stampDuty: STAMP_DUTY, itemsCount: 5, status: 'draft' },
];

const STATUS_CONFIG: Record<
  PoStatus,
  { key: string; fallback: string; Icon: ComponentType<{ className?: string }>; className: string }
> = {
  draft: { key: 'adminPurchaseOrders.status.draft', fallback: 'Brouillon', Icon: ClipboardList, className: 'bg-ink-100 text-ink-600 ring-ink-200' },
  sent: { key: 'adminPurchaseOrders.status.sent', fallback: 'Envoyé', Icon: Send, className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  confirmed: { key: 'adminPurchaseOrders.status.confirmed', fallback: 'Confirmé', Icon: CheckCircle2, className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  partial: { key: 'adminPurchaseOrders.status.partial', fallback: 'Partiel', Icon: Truck, className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  received: { key: 'adminPurchaseOrders.status.received', fallback: 'Réceptionné', Icon: PackageCheck, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled: { key: 'adminPurchaseOrders.status.cancelled', fallback: 'Annulé', Icon: XCircle, className: 'bg-red-50 text-red-700 ring-red-200' },
};

const STATUS_ORDER: PoStatus[] = ['draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled'];
const ROWS_PER_PAGE = 8;

export default function AdminPurchaseOrders() {
  const { t, i18n } = useTranslation();
  const { token, hasPermission, isAdmin } = useAuth();
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN';
  const isFr = i18n.language.startsWith('fr');
  // "if i have the access" — write actions gated on PURCHASE_ORDER_MANAGE.
  const canManage = isAdmin || hasPermission('PURCHASE_ORDER_MANAGE');

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

  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PoStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<AdminEntityOption[]>([]);
  const [productOptions, setProductOptions] = useState<AdminProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [orderOptions, setOrderOptions] = useState<AdminOrder[]>([]);
  // Item source toggle for the create modal: catalogue or an existing order.
  const [itemSource, setItemSource] = useState<'catalog' | 'order'>('catalog');
  const [sourceOrderId, setSourceOrderId] = useState<number | null>(null);
  const emptyForm = {
    supplierId: null as number | null,
    supplierName: '',
    orderDate: '',
    expectedDate: '',
    lines: [{ ...EMPTY_LINE }] as LineItem[],
  };
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<PurchaseOrder | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ po: PurchaseOrder; next: PoStatus } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Live backend when available; falls back to the demo dataset otherwise.
      const { items, live: isLive } = await getAdminResource<PurchaseOrder>(
        ERP_ENDPOINTS.purchaseOrders,
        token ?? '',
        MOCK_ORDERS,
      );
      setRows(items);
      setLive(isLive);
    } catch {
      setError(t('adminPurchaseOrders.error', 'Impossible de charger les bons de commande.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Load pickable suppliers, products (catalogue) and recent orders for the
  // create modal so line items can come from either source.
  useEffect(() => {
    if (!token) return;
    void getAdminEntityOptions('suppliers', token).then(setSupplierOptions);
    setProductsLoading(true);
    void getAdminProductOptions(token, isFr)
      .then(setProductOptions)
      .finally(() => setProductsLoading(false));
    void getAdminOrders(token, undefined, 0, 50)
      .then((p) => setOrderOptions(p.content ?? []))
      .catch(() => {});
  }, [token, isFr]);

  // Mark a confirmed/partial order as received. The backend's
  // PATCH /purchase-orders/{id}/receive is what books the stock: it walks the
  // order lines and files a PURCHASE (+qty) movement per catalogue product, in
  // one transaction, and is idempotent (a second call is a no-op). The client
  // must NOT post stock movements itself or the goods would be counted twice.
  const receiveOrder = useCallback(
    async (po: PurchaseOrder) => {
      setBusy(true);
      const ok = await mutateAdminResource(`${ERP_ENDPOINTS.purchaseOrders}/${po.id}/receive`, token ?? '', {
        method: 'PATCH',
      });
      setRows((prev) => prev.map((r) => (r.id === po.id ? { ...r, status: 'received' } : r)));
      setSelected((cur) => (cur && cur.id === po.id ? { ...cur, status: 'received' } : cur));
      setBusy(false);
      toast.success(
        ok
          ? t('adminPurchaseOrders.toast.receivedStock', 'Réceptionné — stock mis à jour.')
          : t('adminPurchaseOrders.toast.receivedLocal', 'Réception enregistrée (mode démo)'),
      );
    },
    [t, token],
  );

  // Build a printable/PDF document from a purchase order and open the browser
  // print dialog (the user picks "Enregistrer au format PDF"). Read-only, so it
  // is available even without PURCHASE_ORDER_MANAGE.
  const printOrder = useCallback(
    (po: PurchaseOrder) => {
      const lines = (po.lines ?? []).map((l) => ({
        label: l.label,
        qty: l.qty,
        unitPrice: l.unitPrice,
      }));
      const doc: PrintDoc = {
        docType: t('adminPurchaseOrders.print.docType', 'Bon de commande'),
        number: po.number,
        client: po.supplierName,
        issueDate: po.orderDate,
        dueOrValidLabel: t('adminPurchaseOrders.col.expectedDate', 'Livraison prévue'),
        dueOrValidDate: po.expectedDate,
        lines,
        totals: {
          totalHT: po.totalHT,
          tva: po.totalHT * po.tvaRate,
          timbre: po.stampDuty,
          totalTTC: computeTTC(po),
        },
        labels: {
          seller: t('adminPrint.seller', 'Émetteur'),
          billedTo: t('adminPurchaseOrders.print.supplier', 'Fournisseur'),
          mf: t('adminInvoices.preview.mf', 'Matricule fiscal'),
          issue: t('adminPurchaseOrders.col.orderDate', 'Date de commande'),
          designation: t('adminInvoices.preview.item', 'Désignation'),
          qty: t('adminInvoices.preview.qty', 'Qté'),
          unitPrice: t('adminInvoices.preview.pu', 'P.U. HT'),
          lineTotal: t('adminInvoices.preview.total', 'Total HT'),
          totalHT: t('adminInvoices.totals.ht', 'Total HT'),
          tva: t('adminInvoices.totals.tva', 'TVA (19 %)'),
          timbre: t('adminInvoices.totals.timbre', 'Timbre fiscal'),
          retenue: t('adminInvoices.totals.retenue', 'Retenue à la source (1,5 %)'),
          totalTTC: t('adminInvoices.totals.ttc', 'Total TTC'),
          thanks: t('adminPrint.thanks', 'Merci de votre confiance.'),
        },
      };
      printDocument(doc);
    },
    [t],
  );

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
          t('adminPurchaseOrders.form.orderItem', 'Article'),
        qty: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      }));
      setForm((f) => ({ ...f, lines: lines.length ? lines : [{ ...EMPTY_LINE }] }));
    },
    [orderOptions, isFr, t],
  );

  // Advance the order status (draft → sent → confirmed → partial → received).
  // Reaching "received" must add the goods to stock, so delegate to receiveOrder
  // rather than a plain status PATCH.
  const applyStatus = useCallback(
    async (po: PurchaseOrder, next: PoStatus) => {
      if (next === 'received') {
        setConfirmAction(null);
        await receiveOrder(po);
        return;
      }
      setBusy(true);
      await mutateAdminResource(`${ERP_ENDPOINTS.purchaseOrders}/${po.id}`, token ?? '', {
        method: 'PATCH',
        body: { status: next },
      });
      setRows((prev) => prev.map((r) => (r.id === po.id ? { ...r, status: next } : r)));
      setSelected((cur) => (cur && cur.id === po.id ? { ...cur, status: next } : cur));
      setBusy(false);
      setConfirmAction(null);
      toast.success(
        t('adminPurchaseOrders.toast.status', 'Bon {{n}} : {{s}}', {
          n: po.number,
          s: t(STATUS_CONFIG[next].key, STATUS_CONFIG[next].fallback),
        }),
      );
    },
    [t, token, receiveOrder],
  );

  // Delete an order (with confirmation). Backend when available, else local.
  const deleteOrder = useCallback(async () => {
    if (!toDelete) return;
    const po = toDelete;
    setBusy(true);
    await mutateAdminResource(`${ERP_ENDPOINTS.purchaseOrders}/${po.id}`, token ?? '', {
      method: 'DELETE',
    });
    setRows((prev) => prev.filter((r) => r.id !== po.id));
    setSelected((cur) => (cur && cur.id === po.id ? null : cur));
    setBusy(false);
    setToDelete(null);
    toast.success(t('adminPurchaseOrders.toast.deleted', 'Bon {{n}} supprimé', { n: po.number }));
  }, [toDelete, t, token]);

  // Next status offered by the advance button.
  const nextStatusFor = (s: PoStatus): PoStatus | null => {
    if (s === 'draft') return 'sent';
    if (s === 'sent') return 'confirmed';
    if (s === 'confirmed') return 'partial';
    if (s === 'partial') return 'received';
    return null;
  };

  // Create a new purchase order. Persists to the backend when available, else
  // appends an optimistic local row (demo mode). Line items drive totals.
  const submitCreate = useCallback(async () => {
    if (!form.supplierId || !form.supplierName.trim()) {
      toast.error(t('adminPurchaseOrders.form.supplierRequired', 'Le fournisseur est requis.'));
      return;
    }
    const validLines = form.lines.filter((l) => l.label.trim());
    if (!validLines.length) {
      toast.error(t('adminPurchaseOrders.form.linesRequired', 'Ajoutez au moins une ligne.'));
      return;
    }
    setSaving(true);
    const totalHT = validLines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
    const itemsCount = validLines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    const payload = {
      supplierId: form.supplierId,
      supplierName: form.supplierName.trim(),
      orderDate: form.orderDate || new Date().toISOString().slice(0, 10),
      expectedDate: form.expectedDate || new Date().toISOString().slice(0, 10),
      totalHT,
      tvaRate: TVA_RATE,
      stampDuty: STAMP_DUTY,
      itemsCount,
      lines: validLines.map((l) => ({
        productId: l.productId,
        label: l.label.trim(),
        qty: Number(l.qty) || 1,
        unitPrice: Number(l.unitPrice) || 0,
      })),
      status: 'draft' as PoStatus,
    };
    const created = await createAdminResource<PurchaseOrder>(ERP_ENDPOINTS.purchaseOrders, token ?? '', payload);
    const row: PurchaseOrder =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
        number: `BC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      };
    setRows((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    setItemSource('catalog');
    setSourceOrderId(null);
    toast.success(
      created
        ? t('adminPurchaseOrders.toast.created', 'Bon de commande créé')
        : t('adminPurchaseOrders.toast.createdLocal', 'Bon créé (mode démo)'),
    );
  }, [form, t, token]);

  const now = Date.now();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((po) => {
      if (statusFilter !== 'all' && po.status !== statusFilter) return false;
      if (!inDateRange(po.orderDate, dateRange)) return false;
      if (!term) return true;
      return (
        po.number.toLowerCase().includes(term) ||
        po.supplierName.toLowerCase().includes(term)
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
    const pending = rows.filter((po) => po.status === 'sent' || po.status === 'confirmed').length;
    const received = rows.filter((po) => po.status === 'received');
    const openValue = rows
      .filter((po) => po.status !== 'received' && po.status !== 'cancelled')
      .reduce((sum, po) => sum + computeTTC(po), 0);
    return {
      total: rows.length,
      pending,
      received: received.length,
      openValue,
    };
  }, [rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const po of rows) counts[po.status] = (counts[po.status] ?? 0) + 1;
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
            <span className="text-ink-600">{t('adminPurchaseOrders.title', 'Bons de commande')}</span>
          </nav>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            {t('adminPurchaseOrders.title', 'Bons de commande')}
            {!loading && !live && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                {t('common.demoData', 'Données démo')}
              </span>
            )}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminPurchaseOrders.subtitle', 'Gérez vos commandes fournisseurs et le suivi des réceptions.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => void fetchOrders()} busy={loading} />
          {canManage && (
            <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('adminPurchaseOrders.new', 'Nouveau bon')}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('adminPurchaseOrders.stats.total', 'Total bons')} value={String(stats.total)} Icon={ClipboardList} />
        <StatTile label={t('adminPurchaseOrders.stats.pending', 'En attente')} value={String(stats.pending)} Icon={Send} />
        <StatTile label={t('adminPurchaseOrders.stats.received', 'Réceptionnés')} value={String(stats.received)} Icon={PackageCheck} />
        <StatTile label={t('adminPurchaseOrders.stats.openValue', 'Encours fournisseurs')} value={money.format(stats.openValue)} Icon={Truck} />
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
              placeholder={t('adminPurchaseOrders.searchPlaceholder', 'Rechercher par n° ou fournisseur…')}
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
              label={t('adminPurchaseOrders.filter.all', 'Tous')}
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
                <th className="px-4 py-3 text-left font-semibold">{t('adminPurchaseOrders.col.number', 'N° bon')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPurchaseOrders.col.supplier', 'Fournisseur')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPurchaseOrders.col.orderDate', 'Date')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPurchaseOrders.col.expectedDate', 'Livraison prévue')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminPurchaseOrders.col.totalHT', 'Total HT')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminPurchaseOrders.col.totalTTC', 'Total TTC')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminPurchaseOrders.col.status', 'Statut')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminPurchaseOrders.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={ROWS_PER_PAGE} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      Icon={ClipboardList}
                      title={t('adminPurchaseOrders.empty.title', 'Aucun bon de commande')}
                      hint={t('adminPurchaseOrders.empty.hint', 'Aucun bon ne correspond à votre recherche.')}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((po) => {
                  const cfg = STATUS_CONFIG[po.status];
                  const expectedTs = new Date(po.expectedDate).getTime();
                  const isLate = expectedTs < now && (po.status === 'sent' || po.status === 'confirmed' || po.status === 'partial');
                  return (
                    <tr key={po.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">{po.number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-800">{po.supplierName}</div>
                        <div className="text-xs text-ink-400">
                          {t('adminPurchaseOrders.itemsCount', '{{count}} article(s)', { count: po.itemsCount })}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(po.orderDate))}</td>
                      <td className={`whitespace-nowrap px-4 py-3 ${isLate ? 'font-semibold text-red-600' : 'text-ink-600'}`}>
                        {dateFmt.format(new Date(po.expectedDate))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{money.format(po.totalHT)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold text-ink-900">{money.format(computeTTC(po))}</td>
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
                            onClick={() => setSelected(po)}
                            className={rowActionBtn('neutral')}
                            title={t('adminPurchaseOrders.action.view', 'Consulter')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printOrder(po)}
                            className={rowActionBtn('neutral')}
                            title={t('adminPurchaseOrders.action.print', 'Imprimer / PDF')}
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {canManage && (() => {
                            const next = nextStatusFor(po.status);
                            if (!next) return null;
                            const nextCfg = STATUS_CONFIG[next];
                            return (
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ po, next })}
                                className={rowActionLabelBtn('blue')}
                                title={t('adminPurchaseOrders.action.advance', 'Passer à : {{s}}', {
                                  s: t(nextCfg.key, nextCfg.fallback),
                                })}
                              >
                                <nextCfg.Icon className="h-3.5 w-3.5" />
                                {t(nextCfg.key, nextCfg.fallback)}
                              </button>
                            );
                          })()}
                          {canManage && (po.status === 'confirmed' || po.status === 'partial') && (
                            <button
                              type="button"
                              onClick={() => void receiveOrder(po)}
                              className={rowActionLabelBtn('emerald')}
                              title={t('adminPurchaseOrders.action.receive', 'Réceptionner')}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              {t('adminPurchaseOrders.action.receiveShort', 'Recevoir')}
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setToDelete(po)}
                              className={rowActionBtn('red')}
                              title={t('adminPurchaseOrders.action.delete', 'Supprimer')}
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
              {t('adminPurchaseOrders.pagination.summary', '{{shown}} sur {{total}} bons', {
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
                {t('adminPurchaseOrders.pagination.prev', 'Précédent')}
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
                {t('adminPurchaseOrders.pagination.next', 'Suivant')}
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
                    {t('adminPurchaseOrders.title', 'Bons de commande')}
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
                  <div className="font-semibold text-ink-900">{selected.supplierName}</div>
                  <div className="text-ink-500">
                    {t('adminPurchaseOrders.itemsCount', '{{count}} article(s)', { count: selected.itemsCount })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-ink-50 p-3">
                    <div className="text-xs text-ink-400">{t('adminPurchaseOrders.col.orderDate', 'Date')}</div>
                    <div className="ba-nums font-semibold text-ink-900">
                      {dateFmt.format(new Date(selected.orderDate))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-ink-50 p-3">
                    <div className="text-xs text-ink-400">
                      {t('adminPurchaseOrders.col.expectedDate', 'Livraison prévue')}
                    </div>
                    <div className="ba-nums font-semibold text-ink-900">
                      {dateFmt.format(new Date(selected.expectedDate))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl bg-ink-50 p-4">
                  <div className="flex items-center justify-between text-ink-600">
                    <span>{t('adminPurchaseOrders.col.totalHT', 'Total HT')}</span>
                    <span className="ba-nums">{money.format(selected.totalHT)}</span>
                  </div>
                  <div className="flex items-center justify-between text-ink-600">
                    <span>{t('adminInvoices.totals.tva', 'TVA (19 %)')}</span>
                    <span className="ba-nums">{money.format(selected.totalHT * selected.tvaRate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-ink-600">
                    <span>{t('adminInvoices.totals.timbre', 'Timbre fiscal')}</span>
                    <span className="ba-nums">{money.format(selected.stampDuty)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-ink-200 pt-2 text-base font-black text-ink-900">
                    <span>{t('adminPurchaseOrders.col.totalTTC', 'Total TTC')}</span>
                    <span className="ba-nums">{money.format(computeTTC(selected))}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminPurchaseOrders.detail.lines', 'Articles')}
                  </div>
                  {selected.lines && selected.lines.length > 0 ? (
                    <ul className="divide-y divide-ink-100 rounded-xl ring-1 ring-inset ring-ink-100">
                      {selected.lines.map((line, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink-900">{line.label}</div>
                            <div className="ba-nums text-xs text-ink-500">
                              {t('adminPurchaseOrders.detail.lineQty', '{{qty}} × {{price}}', {
                                qty: line.qty,
                                price: money.format(line.unitPrice),
                              })}
                            </div>
                          </div>
                          <div className="ba-nums whitespace-nowrap font-semibold text-ink-800">
                            {money.format((Number(line.qty) || 0) * (Number(line.unitPrice) || 0))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl bg-ink-50 px-3 py-3 text-xs text-ink-500">
                      {t('adminPurchaseOrders.detail.noLines', 'Aucune ligne détaillée pour ce bon de commande.')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-400">{t('adminPurchaseOrders.col.status', 'Statut')}</span>
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
              </div>

              <div className="border-t border-ink-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => printOrder(selected)}
                  className={`${BTN_GHOST} w-full justify-center`}
                >
                  <Printer className="h-4 w-4" />
                  {t('adminPurchaseOrders.action.print', 'Imprimer / PDF')}
                </button>
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
                        onClick={() => setConfirmAction({ po: selected, next })}
                        className={`${BTN_PRIMARY} w-full justify-center`}
                      >
                        <nextCfg.Icon className="h-4 w-4" />
                        {t('adminPurchaseOrders.action.advance', 'Passer à : {{s}}', {
                          s: t(nextCfg.key, nextCfg.fallback),
                        })}
                      </button>
                    );
                  })()}
                  {(selected.status === 'confirmed' || selected.status === 'partial') && (
                    <button
                      type="button"
                      onClick={() => void receiveOrder(selected)}
                      className={`${BTN_PRIMARY} w-full justify-center`}
                    >
                      <PackageCheck className="h-4 w-4" />
                      {t('adminPurchaseOrders.action.receive', 'Réceptionner')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setToDelete(selected)}
                    className={`${BTN_GHOST} w-full justify-center text-red-600 hover:bg-red-50`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('adminPurchaseOrders.action.delete', 'Supprimer')}
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
                  {t('adminPurchaseOrders.new', 'Nouveau bon')}
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
                    {t('adminPurchaseOrders.col.supplier', 'Fournisseur')} *
                  </label>
                  <EntityPicker
                    options={supplierOptions.map((s) => ({ id: s.id, label: s.name, sub: s.taxId ?? s.city }))}
                    value={form.supplierId}
                    autoFocus
                    onChange={(id, opt) =>
                      setForm((f) => ({ ...f, supplierId: id, supplierName: opt?.label ?? '' }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPurchaseOrders.col.orderDate', 'Date')}
                    </label>
                    <input
                      type="date"
                      className={INPUT}
                      value={form.orderDate}
                      onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPurchaseOrders.col.expectedDate', 'Livraison prévue')}
                    </label>
                    <input
                      type="date"
                      className={INPUT}
                      value={form.expectedDate}
                      onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Item source: catalogue or existing order */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminPurchaseOrders.form.itemSource', 'Source des articles')}
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
                      {t('adminPurchaseOrders.form.fromCatalog', 'Catalogue produits')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemSource('order')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        itemSource === 'order' ? 'bg-white text-ink-900 shadow-elev-1' : 'text-ink-500 hover:text-ink-700'
                      }`}
                    >
                      {t('adminPurchaseOrders.form.fromOrder', 'Depuis une commande')}
                    </button>
                  </div>
                </div>

                {itemSource === 'order' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminPurchaseOrders.form.pickOrder', 'Choisir une commande')}
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
                      placeholder={t('adminPurchaseOrders.form.pickOrder', 'Choisir une commande')}
                      onChange={(id) => importOrderLines(id)}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminPurchaseOrders.itemsCountLabel', 'Articles')} *
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
            title={t('adminPurchaseOrders.confirm.statusTitle', 'Changer le statut')}
            message={t('adminPurchaseOrders.confirm.statusMessage', 'Passer le bon {{n}} à « {{s}} » ?', {
              n: confirmAction.po.number,
              s: t(cfg.key, cfg.fallback),
            })}
            confirmLabel={t(cfg.key, cfg.fallback)}
            cancelLabel={t('common.cancel', 'Annuler')}
            pending={busy}
            onConfirm={() => void applyStatus(confirmAction.po, confirmAction.next)}
            onCancel={() => setConfirmAction(null)}
          />
        );
      })()}

      {/* Delete confirmation */}
      {toDelete && (
        <ConfirmDialog
          open
          Icon={AlertTriangle}
          title={t('adminPurchaseOrders.confirm.deleteTitle', 'Supprimer le bon')}
          message={t('adminPurchaseOrders.confirm.deleteMessage', 'Supprimer définitivement le bon {{n}} ?', {
            n: toDelete.number,
          })}
          confirmLabel={t('adminPurchaseOrders.action.delete', 'Supprimer')}
          cancelLabel={t('common.cancel', 'Annuler')}
          pending={busy}
          onConfirm={() => void deleteOrder()}
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
