import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import {
  Landmark,
  Search,
  Plus,
  Eye,
  Download,
  Percent,
  ReceiptText,
  FileClock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
  DateRangeFilter,
  EMPTY_RANGE,
  inDateRange,
  type DateRange,
  ROW_ACTIONS_CELL,
  ROW_ACTIONS,
  rowActionBtn,
} from './_ui';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminResource, createAdminResource, ERP_ENDPOINTS } from '../../api';

/* -------------------------------------------------------------------------- */
/*  Fiscalité tunisienne — Déclarations & taxes                                */
/*  Self-contained module with local data. Covers TVA, retenue à la source,    */
/*  FODEC, timbre fiscal, IS/IRPP, TEJ.                                         */
/* -------------------------------------------------------------------------- */

type DeclType = 'tva' | 'retenue' | 'fodec' | 'timbre' | 'is_irpp' | 'tej';
type DeclStatus = 'draft' | 'to_file' | 'filed' | 'paid' | 'overdue';

interface Declaration {
  id: string;
  reference: string;
  type: DeclType;
  period: string; // ex. "2025-01" ou "2024"
  dueDate: string; // ISO
  base: number; // assiette TND
  rate: number; // taux appliqué (0..1) — indicatif
  amount: number; // montant dû TND
  status: DeclStatus;
}

/* Taux indicatifs tunisiens. */
const RATE_TVA = 0.19;
const RATE_FODEC = 0.01;
const RATE_RETENUE = 0.015;
const RATE_TEJ = 0.002;

const MOCK_DECLARATIONS: Declaration[] = [
  { id: 'f1', reference: 'TVA-2025-01', type: 'tva', period: '2025-01', dueDate: '2025-02-28', base: 84200.0, rate: RATE_TVA, amount: 15998.0, status: 'to_file' },
  { id: 'f2', reference: 'RS-2025-01', type: 'retenue', period: '2025-01', dueDate: '2025-02-28', base: 42600.0, rate: RATE_RETENUE, amount: 639.0, status: 'to_file' },
  { id: 'f3', reference: 'FODEC-2025-01', type: 'fodec', period: '2025-01', dueDate: '2025-02-28', base: 84200.0, rate: RATE_FODEC, amount: 842.0, status: 'draft' },
  { id: 'f4', reference: 'TIMBRE-2025-01', type: 'timbre', period: '2025-01', dueDate: '2025-02-28', base: 210.0, rate: 0, amount: 210.0, status: 'draft' },
  { id: 'f5', reference: 'TVA-2024-12', type: 'tva', period: '2024-12', dueDate: '2025-01-28', base: 96450.0, rate: RATE_TVA, amount: 18325.5, status: 'paid' },
  { id: 'f6', reference: 'RS-2024-12', type: 'retenue', period: '2024-12', dueDate: '2025-01-28', base: 38900.0, rate: RATE_RETENUE, amount: 583.5, status: 'filed' },
  { id: 'f7', reference: 'TEJ-2024', type: 'tej', period: '2024', dueDate: '2025-03-25', base: 1240000.0, rate: RATE_TEJ, amount: 2480.0, status: 'draft' },
  { id: 'f8', reference: 'IS-2024', type: 'is_irpp', period: '2024', dueDate: '2025-03-25', base: 312000.0, rate: 0.15, amount: 46800.0, status: 'draft' },
  { id: 'f9', reference: 'TVA-2024-11', type: 'tva', period: '2024-11', dueDate: '2024-12-28', base: 78200.0, rate: RATE_TVA, amount: 14858.0, status: 'overdue' },
  { id: 'f10', reference: 'FODEC-2024-12', type: 'fodec', period: '2024-12', dueDate: '2025-01-28', base: 96450.0, rate: RATE_FODEC, amount: 964.5, status: 'paid' },
];

const TYPE_CONFIG: Record<
  DeclType,
  { key: string; fallback: string; Icon: ComponentType<{ className?: string }> }
> = {
  tva: { key: 'adminTax.type.tva', fallback: 'TVA', Icon: Percent },
  retenue: { key: 'adminTax.type.retenue', fallback: 'Retenue à la source', Icon: ReceiptText },
  fodec: { key: 'adminTax.type.fodec', fallback: 'FODEC', Icon: Landmark },
  timbre: { key: 'adminTax.type.timbre', fallback: 'Timbre fiscal', Icon: ReceiptText },
  is_irpp: { key: 'adminTax.type.is_irpp', fallback: 'IS / IRPP', Icon: Landmark },
  tej: { key: 'adminTax.type.tej', fallback: 'TEJ', Icon: FileClock },
};

const STATUS_CONFIG: Record<
  DeclStatus,
  { key: string; fallback: string; Icon: ComponentType<{ className?: string }>; className: string }
> = {
  draft: { key: 'adminTax.status.draft', fallback: 'Brouillon', Icon: FileClock, className: 'bg-ink-100 text-ink-600 ring-ink-200' },
  to_file: { key: 'adminTax.status.to_file', fallback: 'À déclarer', Icon: Clock, className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  filed: { key: 'adminTax.status.filed', fallback: 'Déclarée', Icon: CheckCircle2, className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  paid: { key: 'adminTax.status.paid', fallback: 'Payée', Icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  overdue: { key: 'adminTax.status.overdue', fallback: 'En retard', Icon: AlertTriangle, className: 'bg-red-50 text-red-700 ring-red-200' },
};

const TYPE_ORDER: DeclType[] = ['tva', 'retenue', 'fodec', 'timbre', 'is_irpp', 'tej'];
const ROWS_PER_PAGE = 8;

export default function AdminTax() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN';

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

  const [rows, setRows] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DeclType | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<Declaration | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = { type: 'tva' as DeclType, period: '', base: '', amount: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchDeclarations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminResource<Declaration>(
        ERP_ENDPOINTS.taxDeclarations,
        token ?? '',
        MOCK_DECLARATIONS,
      );
      setRows(res.items);
      setLive(res.live);
    } catch {
      setError(t('adminTax.error', 'Impossible de charger les déclarations.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchDeclarations();
  }, [fetchDeclarations]);

  const exportDeclaration = useCallback(
    (d: Declaration) => {
      const lines = [
        `${t('adminTax.export.reference', 'Référence')};${d.reference}`,
        `${t('adminTax.export.type', 'Type')};${d.type}`,
        `${t('adminTax.export.period', 'Période')};${d.period}`,
        `${t('adminTax.export.dueDate', 'Échéance')};${d.dueDate}`,
        `${t('adminTax.export.base', 'Base')};${d.base}`,
        `${t('adminTax.export.rate', 'Taux')};${d.rate}`,
        `${t('adminTax.export.amount', 'Montant')};${d.amount}`,
        `${t('adminTax.export.status', 'Statut')};${d.status}`,
      ];
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d.reference}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('adminTax.toast.exported', 'Déclaration exportée : {{ref}}', { ref: d.reference }));
    },
    [t],
  );

  // Create a new tax declaration. Persists to backend when available, else
  // appends an optimistic local row (demo mode).
  const submitCreate = useCallback(async () => {
    if (!form.period.trim()) {
      toast.error(t('adminTax.form.periodRequired', 'La période est requise.'));
      return;
    }
    setSaving(true);
    const rateMap: Record<DeclType, number> = {
      tva: RATE_TVA,
      retenue: RATE_RETENUE,
      fodec: RATE_FODEC,
      timbre: 0,
      is_irpp: 0.15,
      tej: RATE_TEJ,
    };
    const rate = rateMap[form.type];
    const base = Number(form.base) || 0;
    const amount = Number(form.amount) || Number((base * rate).toFixed(3));
    const payload = {
      type: form.type,
      period: form.period.trim(),
      dueDate: new Date().toISOString().slice(0, 10),
      base,
      rate,
      amount,
      status: 'draft' as DeclStatus,
    };
    const created = await createAdminResource<Declaration>(ERP_ENDPOINTS.taxDeclarations, token ?? '', payload);
    const row: Declaration =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
        reference: `${form.type.toUpperCase()}-${form.period.trim()}`,
      };
    setRows((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    toast.success(
      created
        ? t('adminTax.toast.created', 'Déclaration créée')
        : t('adminTax.toast.createdLocal', 'Déclaration créée (mode démo)'),
    );
  }, [form, t, token]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((d) => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (!inDateRange(d.dueDate, dateRange)) return false;
      if (!term) return true;
      return d.reference.toLowerCase().includes(term) || d.period.toLowerCase().includes(term);
    });
  }, [rows, search, typeFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE),
    [filtered, currentPage],
  );

  const stats = useMemo(() => {
    const toDeclare = rows.filter((d) => d.status === 'to_file' || d.status === 'draft');
    const overdue = rows.filter((d) => d.status === 'overdue');
    const dueTotal = rows
      .filter((d) => d.status === 'to_file' || d.status === 'overdue')
      .reduce((s, d) => s + d.amount, 0);
    const vatCollected = rows
      .filter((d) => d.type === 'tva')
      .reduce((s, d) => s + d.amount, 0);
    return {
      toDeclare: toDeclare.length,
      overdue: overdue.length,
      dueTotal,
      vatCollected,
    };
  }, [rows]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const ty of TYPE_ORDER) counts[ty] = 0;
    for (const d of rows) counts[d.type] = (counts[d.type] ?? 0) + 1;
    return counts;
  }, [rows]);

  const resetToFirstPage = () => setPage(1);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-1 text-xs font-medium text-ink-400">
            {t('adminLayout.sections.fiscalite', 'Fiscalité')}
            <span className="mx-1.5">/</span>
            <span className="text-ink-600">{t('adminTax.declarations', 'Déclarations')}</span>
          </nav>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            {t('adminTax.title', 'Fiscalité tunisienne')}
            {!loading && !live && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-[11px] font-bold text-amber-700">
                {t('common.demoData', 'Données démo')}
              </span>
            )}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminTax.subtitle', 'TVA, retenue à la source, FODEC, timbre, IS/IRPP et TEJ — échéances et déclarations.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => void fetchDeclarations()} busy={loading} />
          <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t('adminTax.new', 'Nouvelle déclaration')}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('adminTax.stats.toDeclare', 'À déclarer')} value={String(stats.toDeclare)} Icon={Clock} />
        <StatTile label={t('adminTax.stats.overdue', 'En retard')} value={String(stats.overdue)} Icon={AlertTriangle} tone="red" />
        <StatTile label={t('adminTax.stats.dueTotal', 'Montant dû')} value={money.format(stats.dueTotal)} Icon={Landmark} tone="gold" />
        <StatTile label={t('adminTax.stats.vat', 'TVA collectée')} value={money.format(stats.vatCollected)} Icon={Percent} />
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
              placeholder={t('adminTax.searchPlaceholder', 'Rechercher par référence ou période…')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetToFirstPage();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill
              active={typeFilter === 'all'}
              label={t('adminTax.filter.all', 'Toutes')}
              count={typeCounts.all}
              onClick={() => {
                setTypeFilter('all');
                resetToFirstPage();
              }}
            />
            {TYPE_ORDER.map((ty) => (
              <FilterPill
                key={ty}
                active={typeFilter === ty}
                label={t(TYPE_CONFIG[ty].key, TYPE_CONFIG[ty].fallback)}
                count={typeCounts[ty]}
                onClick={() => {
                  setTypeFilter(ty);
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
                <th className="px-4 py-3 text-left font-semibold">{t('adminTax.col.reference', 'Référence')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminTax.col.type', 'Type')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminTax.col.period', 'Période')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminTax.col.due', 'Échéance')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminTax.col.base', 'Assiette')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminTax.col.amount', 'Montant dû')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('adminTax.col.status', 'Statut')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('adminTax.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={ROWS_PER_PAGE} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      Icon={Landmark}
                      title={t('adminTax.empty.title', 'Aucune déclaration')}
                      hint={t('adminTax.empty.hint', 'Aucune déclaration ne correspond à votre recherche.')}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((d) => {
                  const cfg = STATUS_CONFIG[d.status];
                  const type = TYPE_CONFIG[d.type];
                  return (
                    <tr key={d.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">{d.reference}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-ink-700">
                          <type.Icon className="h-3.5 w-3.5 text-ink-400" />
                          {t(type.key, type.fallback)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 ba-nums text-ink-600">{d.period}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(d.dueDate))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-500">{money.format(d.base)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold text-ink-900">{money.format(d.amount)}</td>
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
                            onClick={() => setSelected(d)}
                            className={rowActionBtn('neutral')}
                            title={t('adminTax.action.view', 'Consulter')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => exportDeclaration(d)}
                            className={rowActionBtn('neutral')}
                            title={t('adminTax.action.export', 'Exporter')}
                          >
                            <Download className="h-4 w-4" />
                          </button>
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
              {t('adminTax.pagination.summary', '{{shown}} sur {{total}} déclarations', {
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
                {t('adminTax.pagination.prev', 'Précédent')}
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
                {t('adminTax.pagination.next', 'Suivant')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* e-Facture note */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-800">
        <FileClock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t('adminTax.efactureNote', 'E-facture / TTC (TEIF) via la plateforme TTN : intégration à prévoir pour la télédéclaration et la facturation électronique.')}</p>
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <motion.aside
              className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-elev-3"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const type = TYPE_CONFIG[selected.type];
                const cfg = STATUS_CONFIG[selected.status];
                return (
                  <>
                    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                          <type.Icon className="h-3.5 w-3.5" />
                          {t(type.key, type.fallback)}
                        </div>
                        <h2 className="mt-1 text-lg font-black text-ink-900">{selected.reference}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="ba-press inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex-1 space-y-4 px-5 py-5">
                      <div className="rounded-xl bg-ink-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                          {t('adminTax.detail.amount', 'Montant dû')}
                        </div>
                        <div className="mt-1 ba-nums text-2xl font-black text-ink-900">{money.format(selected.amount)}</div>
                      </div>

                      <dl className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <dt className="text-ink-500">{t('adminTax.detail.period', 'Période')}</dt>
                          <dd className="ba-nums font-semibold text-ink-900">{selected.period}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-ink-500">{t('adminTax.detail.dueDate', 'Échéance')}</dt>
                          <dd className="font-semibold text-ink-900">{dateFmt.format(new Date(selected.dueDate))}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-ink-500">{t('adminTax.detail.base', 'Assiette')}</dt>
                          <dd className="ba-nums font-semibold text-ink-900">{money.format(selected.base)}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-ink-500">{t('adminTax.detail.rate', 'Taux')}</dt>
                          <dd className="ba-nums font-semibold text-ink-900">
                            {selected.rate ? `${(selected.rate * 100).toFixed(2)} %` : '—'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-ink-500">{t('adminTax.detail.status', 'Statut')}</dt>
                          <dd>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.className}`}>
                              <cfg.Icon className="h-3.5 w-3.5" />
                              {t(cfg.key, cfg.fallback)}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="border-t border-ink-100 px-5 py-4">
                      <button
                        type="button"
                        onClick={() => exportDeclaration(selected)}
                        className={`${BTN_PRIMARY} w-full justify-center`}
                      >
                        <Download className="h-4 w-4" />
                        {t('adminTax.action.export', 'Exporter')}
                      </button>
                    </div>
                  </>
                );
              })()}
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
                  {t('adminTax.new', 'Nouvelle déclaration')}
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
                      {t('adminTax.col.type', 'Type')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DeclType }))}
                    >
                      {TYPE_ORDER.map((ty) => (
                        <option key={ty} value={ty}>
                          {t(TYPE_CONFIG[ty].key, TYPE_CONFIG[ty].fallback)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTax.col.period', 'Période')} *
                    </label>
                    <input
                      className={INPUT}
                      value={form.period}
                      onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                      placeholder="2025-01"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTax.col.base', 'Base (assiette)')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className={INPUT}
                      value={form.base}
                      onChange={(e) => setForm((f) => ({ ...f, base: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTax.col.amount', 'Montant (auto si vide)')}
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local presentational helpers                                               */
/* -------------------------------------------------------------------------- */

const TONE_ICON: Record<string, string> = {
  gold: 'text-gold-500',
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
  tone?: 'gold' | 'red' | 'ink';
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
