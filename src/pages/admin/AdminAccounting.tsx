import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  ListTree,
  NotebookPen,
  Scale,
  Library,
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
} from './_ui';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminResource, createAdminResource, ERP_ENDPOINTS } from '../../api';

/* -------------------------------------------------------------------------- */
/*  Comptabilité (Accounting) — Plan comptable tunisien (SCE 1997)             */
/*  Self-contained module with local data. Tabs: plan comptable, journaux,     */
/*  écritures, grand livre, balance.                                            */
/* -------------------------------------------------------------------------- */

type AccountingTab = 'accounts' | 'journals' | 'entries' | 'ledger' | 'balance';

/* — Plan comptable (extrait du SCE tunisien) — */
interface Account {
  code: string;
  label: string;
  classNo: number; // classe 1..7
}

const MOCK_ACCOUNTS: Account[] = [
  { code: '101', label: 'Capital social', classNo: 1 },
  { code: '106', label: 'Réserves', classNo: 1 },
  { code: '164', label: 'Emprunts auprès des établissements de crédit', classNo: 1 },
  { code: '218', label: 'Autres immobilisations corporelles', classNo: 2 },
  { code: '224', label: 'Matériel de transport', classNo: 2 },
  { code: '281', label: 'Amortissements des immobilisations corporelles', classNo: 2 },
  { code: '31', label: 'Matières premières et fournitures', classNo: 3 },
  { code: '37', label: 'Stocks de marchandises', classNo: 3 },
  { code: '401', label: 'Fournisseurs d’exploitation', classNo: 4 },
  { code: '411', label: 'Clients', classNo: 4 },
  { code: '4366', label: 'TVA sur autres biens et services', classNo: 4 },
  { code: '4367', label: 'TVA collectée', classNo: 4 },
  { code: '532', label: 'Banques', classNo: 5 },
  { code: '54', label: 'Caisse', classNo: 5 },
  { code: '607', label: 'Achats de marchandises', classNo: 6 },
  { code: '625', label: 'Déplacements, missions et réceptions', classNo: 6 },
  { code: '707', label: 'Ventes de marchandises', classNo: 7 },
  { code: '736', label: 'Prestations de services', classNo: 7 },
];

const CLASS_LABELS: Record<number, { key: string; fallback: string }> = {
  1: { key: 'adminAccounting.class.1', fallback: 'Comptes de capitaux' },
  2: { key: 'adminAccounting.class.2', fallback: 'Comptes d’immobilisations' },
  3: { key: 'adminAccounting.class.3', fallback: 'Comptes de stocks' },
  4: { key: 'adminAccounting.class.4', fallback: 'Comptes de tiers' },
  5: { key: 'adminAccounting.class.5', fallback: 'Comptes financiers' },
  6: { key: 'adminAccounting.class.6', fallback: 'Comptes de charges' },
  7: { key: 'adminAccounting.class.7', fallback: 'Comptes de produits' },
};

/* — Journaux — */
interface Journal {
  code: string;
  label: string;
  entryCount: number;
}
const MOCK_JOURNALS: Journal[] = [
  { code: 'VE', label: 'Journal des ventes', entryCount: 128 },
  { code: 'AC', label: 'Journal des achats', entryCount: 96 },
  { code: 'BQ', label: 'Journal de banque', entryCount: 210 },
  { code: 'CA', label: 'Journal de caisse', entryCount: 74 },
  { code: 'OD', label: 'Opérations diverses', entryCount: 41 },
];

/* — Écritures comptables — */
interface EntryLine {
  account: string;
  label: string;
  debit: number;
  credit: number;
}
interface JournalEntry {
  id: string;
  date: string; // ISO
  journal: string;
  piece: string;
  lines: EntryLine[];
}
const MOCK_ENTRIES: JournalEntry[] = [
  {
    id: 'e1', date: '2025-02-16', journal: 'VE', piece: 'FAC-2025-0203',
    lines: [
      { account: '411', label: 'Clients — Sté Méditerranée', debit: 5738.0, credit: 0 },
      { account: '707', label: 'Ventes de marchandises', debit: 0, credit: 4821.0 },
      { account: '4367', label: 'TVA collectée', debit: 0, credit: 916.0 },
      { account: '532', label: 'Timbre fiscal', debit: 0, credit: 1.0 },
    ],
  },
  {
    id: 'e2', date: '2025-02-14', journal: 'AC', piece: 'BC-2025-0042',
    lines: [
      { account: '607', label: 'Achats — Bosch Tunisie', debit: 8420.0, credit: 0 },
      { account: '4366', label: 'TVA déductible', debit: 1599.8, credit: 0 },
      { account: '401', label: 'Fournisseurs', debit: 0, credit: 10019.8 },
    ],
  },
  {
    id: 'e3', date: '2025-02-16', journal: 'BQ', piece: 'REG-2025-0121',
    lines: [
      { account: '532', label: 'Banque — encaissement', debit: 5738.0, credit: 0 },
      { account: '411', label: 'Clients', debit: 0, credit: 5738.0 },
    ],
  },
  {
    id: 'e4', date: '2025-02-13', journal: 'CA', piece: 'REG-2025-0118',
    lines: [
      { account: '54', label: 'Caisse', debit: 376.8, credit: 0 },
      { account: '411', label: 'Clients — M. Trabelsi', debit: 0, credit: 376.8 },
    ],
  },
];

const TABS: { key: AccountingTab; labelKey: string; fallback: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'accounts', labelKey: 'adminAccounting.tabs.accounts', fallback: 'Plan comptable', Icon: ListTree },
  { key: 'journals', labelKey: 'adminAccounting.tabs.journals', fallback: 'Journaux', Icon: Library },
  { key: 'entries', labelKey: 'adminAccounting.tabs.entries', fallback: 'Écritures', Icon: NotebookPen },
  { key: 'ledger', labelKey: 'adminAccounting.tabs.ledger', fallback: 'Grand livre', Icon: BookOpen },
  { key: 'balance', labelKey: 'adminAccounting.tabs.balance', fallback: 'Balance', Icon: Scale },
];

export default function AdminAccounting() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const locale = i18n.language.startsWith('fr') ? 'fr-TN' : 'en-TN';

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    [locale],
  );
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale],
  );

  const [tab, setTab] = useState<AccountingTab>('accounts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [live, setLive] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = {
    journal: 'VE',
    piece: '',
    debitAccount: '',
    creditAccount: '',
    label: '',
    amount: '',
  };
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acc, jou, ent] = await Promise.all([
        getAdminResource<Account>(ERP_ENDPOINTS.accounts, token ?? '', MOCK_ACCOUNTS),
        getAdminResource<Journal>(ERP_ENDPOINTS.journals, token ?? '', MOCK_JOURNALS),
        getAdminResource<JournalEntry>(ERP_ENDPOINTS.entries, token ?? '', MOCK_ENTRIES),
      ]);
      setAccounts(acc.items);
      setJournals(jou.items);
      setEntries(ent.items);
      setLive(acc.live && jou.live && ent.live);
    } catch {
      setError(t('adminAccounting.error', 'Impossible de charger la comptabilité.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Create a balanced journal entry (one debit line + one credit line).
  // Persists to backend when available, else appends an optimistic local row.
  const submitCreate = useCallback(async () => {
    if (!form.piece.trim()) {
      toast.error(t('adminAccounting.form.pieceRequired', 'La pièce est requise.'));
      return;
    }
    const amount = Number(form.amount) || 0;
    if (amount <= 0) {
      toast.error(t('adminAccounting.form.amountRequired', 'Le montant doit être supérieur à 0.'));
      return;
    }
    if (!form.debitAccount.trim() || !form.creditAccount.trim()) {
      toast.error(t('adminAccounting.form.accountsRequired', 'Les comptes débit et crédit sont requis.'));
      return;
    }
    setSaving(true);
    const lines: EntryLine[] = [
      { account: form.debitAccount.trim(), label: form.label.trim(), debit: amount, credit: 0 },
      { account: form.creditAccount.trim(), label: form.label.trim(), debit: 0, credit: amount },
    ];
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      journal: form.journal,
      piece: form.piece.trim(),
      lines,
    };
    const created = await createAdminResource<JournalEntry>(ERP_ENDPOINTS.entries, token ?? '', payload);
    const row: JournalEntry =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
      };
    setEntries((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    setTab('entries');
    toast.success(
      created
        ? t('adminAccounting.toast.created', 'Écriture créée')
        : t('adminAccounting.toast.createdLocal', 'Écriture créée (mode démo)'),
    );
  }, [form, t, token]);

  /* Grand livre: flatten entries into per-account movements. */
  const ledger = useMemo(() => {
    const map = new Map<string, { account: string; debit: number; credit: number; count: number }>();
    for (const e of entries) {
      for (const l of e.lines) {
        const cur = map.get(l.account) ?? { account: l.account, debit: 0, credit: 0, count: 0 };
        cur.debit += l.debit;
        cur.credit += l.credit;
        cur.count += 1;
        map.set(l.account, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.account.localeCompare(b.account));
  }, [entries]);

  /* Balance = grand livre with balance (solde). */
  const balance = useMemo(
    () =>
      ledger.map((r) => ({
        ...r,
        balanceDebit: Math.max(0, r.debit - r.credit),
        balanceCredit: Math.max(0, r.credit - r.debit),
      })),
    [ledger],
  );

  const balanceTotals = useMemo(() => {
    return balance.reduce(
      (acc, r) => ({
        debit: acc.debit + r.debit,
        credit: acc.credit + r.credit,
        balanceDebit: acc.balanceDebit + r.balanceDebit,
        balanceCredit: acc.balanceCredit + r.balanceCredit,
      }),
      { debit: 0, credit: 0, balanceDebit: 0, balanceCredit: 0 },
    );
  }, [balance]);

  const term = search.trim().toLowerCase();
  const filteredAccounts = accounts.filter(
    (a) => !term || a.code.includes(term) || a.label.toLowerCase().includes(term),
  );
  const filteredEntries = entries.filter((e) => inDateRange(e.date, dateRange));

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-1 text-xs font-medium text-ink-400">
            {t('adminLayout.sections.comptabilite', 'Comptabilité')}
            <span className="mx-1.5">/</span>
            <span className="text-ink-600">{t(TABS.find((x) => x.key === tab)!.labelKey, TABS.find((x) => x.key === tab)!.fallback)}</span>
          </nav>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            {t('adminAccounting.title', 'Comptabilité')}
            {!loading && !live && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-[11px] font-bold text-amber-700">
                {t('common.demoData', 'Données démo')}
              </span>
            )}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminAccounting.subtitle', 'Plan comptable tunisien (SCE), journaux, écritures, grand livre et balance.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => void fetchData()} busy={loading} />
          <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t('adminAccounting.newEntry', 'Nouvelle écriture')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`ba-press inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                active ? 'bg-ink-900 text-white shadow-elev-1' : 'bg-white text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50'
              }`}
            >
              <tb.Icon className="h-4 w-4" />
              {t(tb.labelKey, tb.fallback)}
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Plan comptable */}
      {tab === 'accounts' && (
        <div className={CARD}>
          <div className="border-b border-ink-100 p-4">
            <div className="relative min-w-[220px] max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className={`${INPUT} pl-9`}
                placeholder={t('adminAccounting.searchAccount', 'Rechercher un compte…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminAccounting.col.code', 'Compte')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminAccounting.col.label', 'Intitulé')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminAccounting.col.class', 'Classe')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={8} cols={3} />
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState Icon={ListTree} title={t('adminAccounting.empty.accounts', 'Aucun compte')} />
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((a) => (
                    <tr key={a.code} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 ba-nums font-semibold text-ink-900">{a.code}</td>
                      <td className="px-4 py-3 text-ink-700">{a.label}</td>
                      <td className="px-4 py-3 text-ink-500">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="ba-nums rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600">{a.classNo}</span>
                          {t(CLASS_LABELS[a.classNo].key, CLASS_LABELS[a.classNo].fallback)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Journaux */}
      {tab === 'journals' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${CARD} ba-skeleton h-28`} />)
            : journals.map((j) => (
                <div key={j.code} className={`${CARD} p-5`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-sm font-black text-gold-700">
                      {j.code}
                    </span>
                    <div>
                      <div className="font-semibold text-ink-900">{j.label}</div>
                      <div className="text-xs text-ink-400">
                        {t('adminAccounting.entriesCount', '{{count}} écriture(s)', { count: j.entryCount })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      )}

      {/* Écritures */}
      {tab === 'entries' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
          {loading ? (
            <div className={`${CARD} ba-skeleton h-48`} />
          ) : filteredEntries.length === 0 ? (
            <div className={CARD}>
              <EmptyState Icon={NotebookPen} title={t('adminAccounting.empty.entries', 'Aucune écriture')} />
            </div>
          ) : (
            filteredEntries.map((e) => {
              const totDebit = e.lines.reduce((s, l) => s + l.debit, 0);
              const totCredit = e.lines.reduce((s, l) => s + l.credit, 0);
              const balanced = Math.abs(totDebit - totCredit) < 0.001;
              return (
                <div key={e.id} className={CARD}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 p-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-black text-white">{e.journal}</span>
                      <span className="font-semibold text-ink-900">{e.piece}</span>
                      <span className="text-sm text-ink-400">{dateFmt.format(new Date(e.date))}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                        balanced ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
                      }`}
                    >
                      {balanced ? t('adminAccounting.balanced', 'Équilibrée') : t('adminAccounting.unbalanced', 'Déséquilibrée')}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={TH_ROW}>
                          <th className="px-4 py-2.5 text-left font-semibold">{t('adminAccounting.col.account', 'Compte')}</th>
                          <th className="px-4 py-2.5 text-left font-semibold">{t('adminAccounting.col.label', 'Libellé')}</th>
                          <th className="px-4 py-2.5 text-right font-semibold">{t('adminAccounting.col.debit', 'Débit')}</th>
                          <th className="px-4 py-2.5 text-right font-semibold">{t('adminAccounting.col.credit', 'Crédit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.lines.map((l, i) => (
                          <tr key={i} className="border-t border-ink-50">
                            <td className="whitespace-nowrap px-4 py-2.5 ba-nums font-semibold text-ink-800">{l.account}</td>
                            <td className="px-4 py-2.5 text-ink-600">{l.label}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right ba-nums text-ink-700">{l.debit ? money.format(l.debit) : '—'}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right ba-nums text-ink-700">{l.credit ? money.format(l.credit) : '—'}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-ink-100 bg-gray-50 font-bold">
                          <td className="px-4 py-2.5" colSpan={2}>{t('adminAccounting.totals', 'Totaux')}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right ba-nums text-ink-900">{money.format(totDebit)}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right ba-nums text-ink-900">{money.format(totCredit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Grand livre */}
      {tab === 'ledger' && (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminAccounting.col.account', 'Compte')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.movements', 'Mouvements')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.debit', 'Débit')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.credit', 'Crédit')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.balance', 'Solde')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : (
                  ledger.map((r) => {
                    const solde = r.debit - r.credit;
                    return (
                      <tr key={r.account} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                        <td className="whitespace-nowrap px-4 py-3 ba-nums font-semibold text-ink-900">{r.account}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-500">{r.count}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{money.format(r.debit)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{money.format(r.credit)}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold ${solde >= 0 ? 'text-ink-900' : 'text-red-600'}`}>
                          {money.format(solde)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Balance */}
      {tab === 'balance' && (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminAccounting.col.account', 'Compte')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.debit', 'Mvt débit')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.credit', 'Mvt crédit')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.balanceDebit', 'Solde débiteur')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminAccounting.col.balanceCredit', 'Solde créditeur')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : (
                  <>
                    {balance.map((r) => (
                      <tr key={r.account} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                        <td className="whitespace-nowrap px-4 py-3 ba-nums font-semibold text-ink-900">{r.account}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{money.format(r.debit)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{money.format(r.credit)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{r.balanceDebit ? money.format(r.balanceDebit) : '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{r.balanceCredit ? money.format(r.balanceCredit) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-ink-200 bg-gray-50 font-bold">
                      <td className="px-4 py-3 text-ink-900">{t('adminAccounting.totals', 'Totaux')}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-900">{money.format(balanceTotals.debit)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-900">{money.format(balanceTotals.credit)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-900">{money.format(balanceTotals.balanceDebit)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-900">{money.format(balanceTotals.balanceCredit)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create entry modal */}
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
                  {t('adminAccounting.newEntry', 'Nouvelle écriture')}
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
                      {t('adminAccounting.col.journal', 'Journal')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.journal}
                      onChange={(e) => setForm((f) => ({ ...f, journal: e.target.value }))}
                    >
                      {(journals.length ? journals : MOCK_JOURNALS).map((j) => (
                        <option key={j.code} value={j.code}>
                          {j.code} — {j.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminAccounting.col.piece', 'Pièce')} *
                    </label>
                    <input
                      className={INPUT}
                      value={form.piece}
                      onChange={(e) => setForm((f) => ({ ...f, piece: e.target.value }))}
                      placeholder="FAC-2025-0204"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminAccounting.col.label', 'Libellé')}
                  </label>
                  <input
                    className={INPUT}
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Vente de marchandises"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminAccounting.col.debitAccount', 'Compte débit')} *
                    </label>
                    <input
                      className={INPUT}
                      value={form.debitAccount}
                      onChange={(e) => setForm((f) => ({ ...f, debitAccount: e.target.value }))}
                      placeholder="411"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminAccounting.col.creditAccount', 'Compte crédit')} *
                    </label>
                    <input
                      className={INPUT}
                      value={form.creditAccount}
                      onChange={(e) => setForm((f) => ({ ...f, creditAccount: e.target.value }))}
                      placeholder="707"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminAccounting.col.amount', 'Montant')} *
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
                  <p className="mt-1.5 text-xs text-ink-400">
                    {t('adminAccounting.form.balancedHint', 'Écriture équilibrée : débit = crédit = montant.')}
                  </p>
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
