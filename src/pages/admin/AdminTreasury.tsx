import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import {
  Wallet,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Banknote,
  Landmark,
  FileCheck,
  Coins,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
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
  ConfirmDialog,
  rowActionBtn,
  DateRangeFilter,
  EMPTY_RANGE,
  inDateRange,
  type DateRange,
} from './_ui';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAdminResource,
  createAdminResource,
  mutateAdminResource,
  ERP_ENDPOINTS,
} from '../../api';

/* -------------------------------------------------------------------------- */
/*  Trésorerie (Treasury) — Caisse, Banques, Chèques, Traites, Échéancier      */
/*  Self-contained module with local data.                                     */
/* -------------------------------------------------------------------------- */

type TreasuryTab = 'accounts' | 'movements' | 'instruments' | 'schedule';

/* — Comptes de trésorerie — */
interface CashAccount {
  id: string;
  name: string;
  kind: 'cash' | 'bank';
  bank?: string;
  rib?: string;
  balance: number;
}
const MOCK_ACCOUNTS: CashAccount[] = [
  { id: 'a1', name: 'Caisse principale', kind: 'cash', balance: 4820.6 },
  { id: 'a2', name: 'Caisse agence Sfax', kind: 'cash', balance: 1235.0 },
  { id: 'a3', name: 'Compte courant', kind: 'bank', bank: 'BIAT', rib: '08 123 0001234567 89', balance: 128450.35 },
  { id: 'a4', name: 'Compte devises', kind: 'bank', bank: 'Attijari', rib: '04 220 0009876543 21', balance: 42310.0 },
];

/* — Mouvements — */
type MoveKind = 'in' | 'out';
interface Movement {
  id: string;
  date: string; // ISO
  account: string; // account name
  label: string;
  kind: MoveKind;
  method: 'cash' | 'cheque' | 'transfer' | 'traite';
  amount: number;
}
const MOCK_MOVEMENTS: Movement[] = [
  { id: 'm1', date: '2025-02-16', account: 'Compte courant', label: 'Encaissement FAC-2025-0203', kind: 'in', method: 'transfer', amount: 5738.0 },
  { id: 'm2', date: '2025-02-15', account: 'Caisse principale', label: 'Vente comptoir', kind: 'in', method: 'cash', amount: 376.8 },
  { id: 'm3', date: '2025-02-14', account: 'Compte courant', label: 'Règlement Bosch BC-2025-0042', kind: 'out', method: 'transfer', amount: 10020.8 },
  { id: 'm4', date: '2025-02-12', account: 'Compte courant', label: 'Remise chèque client', kind: 'in', method: 'cheque', amount: 1476.2 },
  { id: 'm5', date: '2025-02-10', account: 'Caisse principale', label: 'Achat fournitures bureau', kind: 'out', method: 'cash', amount: 128.5 },
  { id: 'm6', date: '2025-02-08', account: 'Compte courant', label: 'Encaissement FAC-2025-0195', kind: 'in', method: 'transfer', amount: 10621.3 },
  { id: 'm7', date: '2025-02-06', account: 'Compte devises', label: 'Paiement Michelin', kind: 'out', method: 'transfer', amount: 14852.2 },
  { id: 'm8', date: '2025-02-04', account: 'Caisse agence Sfax', label: 'Vente comptoir', kind: 'in', method: 'cash', amount: 539.4 },
];

/* — Effets (chèques / traites) — */
type InstrumentKind = 'cheque' | 'traite';
type InstrumentStatus = 'portfolio' | 'deposited' | 'cashed' | 'bounced';
interface Instrument {
  id: string;
  number: string;
  kind: InstrumentKind;
  party: string;
  bank: string;
  dueDate: string; // ISO
  amount: number;
  status: InstrumentStatus;
}
const MOCK_INSTRUMENTS: Instrument[] = [
  { id: 'i1', number: 'CHQ-4582213', kind: 'cheque', party: 'Garage El Amine', bank: 'BIAT', dueDate: '2025-02-25', amount: 1476.2, status: 'portfolio' },
  { id: 'i2', number: 'TRA-000841', kind: 'traite', party: 'Transport Nabeul SARL', bank: 'STB', dueDate: '2025-03-15', amount: 8021.1, status: 'portfolio' },
  { id: 'i3', number: 'CHQ-4491002', kind: 'cheque', party: 'Auto Service Sfax', bank: 'Amen Bank', dueDate: '2025-02-20', amount: 2511.9, status: 'deposited' },
  { id: 'i4', number: 'TRA-000833', kind: 'traite', party: 'Sté Batteries Assad', bank: 'BNA', dueDate: '2025-02-28', amount: 6224.7, status: 'portfolio' },
  { id: 'i5', number: 'CHQ-4388771', kind: 'cheque', party: 'Flotte Taxi Ariana', bank: 'BIAT', dueDate: '2025-02-05', amount: 4236.4, status: 'cashed' },
  { id: 'i6', number: 'CHQ-4290551', kind: 'cheque', party: 'Valeo Distribution', bank: 'UIB', dueDate: '2025-02-11', amount: 3713.4, status: 'bounced' },
];

const INSTRUMENT_STATUS: Record<
  InstrumentStatus,
  { key: string; fallback: string; className: string }
> = {
  portfolio: { key: 'adminTreasury.instr.portfolio', fallback: 'En portefeuille', className: 'bg-ink-100 text-ink-600 ring-ink-200' },
  deposited: { key: 'adminTreasury.instr.deposited', fallback: 'Remis à l’encaissement', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  cashed: { key: 'adminTreasury.instr.cashed', fallback: 'Encaissé', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  bounced: { key: 'adminTreasury.instr.bounced', fallback: 'Impayé', className: 'bg-red-50 text-red-700 ring-red-200' },
};

const TABS: { key: TreasuryTab; labelKey: string; fallback: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'accounts', labelKey: 'adminTreasury.tabs.accounts', fallback: 'Comptes', Icon: Wallet },
  { key: 'movements', labelKey: 'adminTreasury.tabs.movements', fallback: 'Mouvements', Icon: Coins },
  { key: 'instruments', labelKey: 'adminTreasury.tabs.instruments', fallback: 'Chèques & traites', Icon: FileCheck },
  { key: 'schedule', labelKey: 'adminTreasury.tabs.schedule', fallback: 'Échéancier', Icon: Clock },
];

export default function AdminTreasury() {
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

  const [tab, setTab] = useState<TreasuryTab>('accounts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [live, setLive] = useState(false);

  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = { account: '', label: '', kind: 'in' as MoveKind, method: 'transfer' as Movement['method'], amount: '' };
  const [form, setForm] = useState(emptyForm);

  // — Account (compte) CRUD state —
  const emptyAccountForm = {
    name: '',
    kind: 'bank' as CashAccount['kind'],
    bank: '',
    rib: '',
    balance: '',
  };
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashAccount | null>(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<CashAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acc, mov, ins] = await Promise.all([
        getAdminResource<CashAccount>(ERP_ENDPOINTS.treasuryAccounts, token ?? '', MOCK_ACCOUNTS),
        getAdminResource<Movement>(ERP_ENDPOINTS.treasuryMovements, token ?? '', MOCK_MOVEMENTS),
        getAdminResource<Instrument>(ERP_ENDPOINTS.treasuryInstruments, token ?? '', MOCK_INSTRUMENTS),
      ]);
      setAccounts(acc.items);
      setMovements(mov.items);
      setInstruments(ins.items);
      setLive(acc.live && mov.live && ins.live);
    } catch {
      setError(t('adminTreasury.error', 'Impossible de charger la trésorerie.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Create a new treasury movement. Persists to backend when available, else
  // appends an optimistic local row (demo mode).
  const submitCreate = useCallback(async () => {
    if (!form.label.trim()) {
      toast.error(t('adminTreasury.form.labelRequired', 'Le libellé est requis.'));
      return;
    }
    setSaving(true);
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      account: form.account.trim() || (accounts[0]?.name ?? ''),
      label: form.label.trim(),
      kind: form.kind,
      method: form.method,
      amount: Number(form.amount) || 0,
    };
    const created = await createAdminResource<Movement>(ERP_ENDPOINTS.treasuryMovements, token ?? '', payload);
    const row: Movement =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
      };
    setMovements((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    setTab('movements');
    toast.success(
      created
        ? t('adminTreasury.toast.created', 'Mouvement créé')
        : t('adminTreasury.toast.createdLocal', 'Mouvement créé (mode démo)'),
    );
  }, [form, accounts, t, token]);

  /* ---- Account (compte) CRUD ---- */

  const openCreateAccount = useCallback(() => {
    setEditingAccount(null);
    setAccountForm(emptyAccountForm);
    setShowAccountModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEditAccount = useCallback((a: CashAccount) => {
    setEditingAccount(a);
    setAccountForm({
      name: a.name,
      kind: a.kind,
      bank: a.bank ?? '',
      rib: a.rib ?? '',
      balance: String(a.balance),
    });
    setShowAccountModal(true);
  }, []);

  // Create or update a treasury account. Persists to the backend when the
  // endpoint is live, otherwise mutates local state (demo mode).
  const submitAccount = useCallback(async () => {
    if (!accountForm.name.trim()) {
      toast.error(t('adminTreasury.form.nameRequired', 'Le nom du compte est requis.'));
      return;
    }
    setSavingAccount(true);
    const isBank = accountForm.kind === 'bank';
    const payload = {
      name: accountForm.name.trim(),
      kind: accountForm.kind,
      bank: isBank ? accountForm.bank.trim() || undefined : undefined,
      rib: isBank ? accountForm.rib.trim() || undefined : undefined,
      balance: Number(accountForm.balance) || 0,
    };
    if (editingAccount) {
      const ok = await mutateAdminResource(
        `${ERP_ENDPOINTS.treasuryAccounts}/${editingAccount.id}`,
        token ?? '',
        { method: 'PATCH', body: payload },
      );
      setAccounts((prev) =>
        prev.map((a) => (a.id === editingAccount.id ? { ...a, ...payload } : a)),
      );
      toast.success(
        ok
          ? t('adminTreasury.toast.accountUpdated', 'Compte mis à jour')
          : t('adminTreasury.toast.accountUpdatedLocal', 'Compte mis à jour (mode démo)'),
      );
    } else {
      const created = await createAdminResource<CashAccount>(
        ERP_ENDPOINTS.treasuryAccounts,
        token ?? '',
        payload,
      );
      const row: CashAccount = created ?? { ...payload, id: `local-${Date.now()}` };
      setAccounts((prev) => [row, ...prev]);
      toast.success(
        created
          ? t('adminTreasury.toast.accountCreated', 'Compte créé')
          : t('adminTreasury.toast.accountCreatedLocal', 'Compte créé (mode démo)'),
      );
    }
    setSavingAccount(false);
    setShowAccountModal(false);
    setEditingAccount(null);
    setAccountForm(emptyAccountForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountForm, editingAccount, t, token]);

  const confirmDeleteAccount = useCallback(async () => {
    if (!accountToDelete) return;
    setDeletingAccount(true);
    const ok = await mutateAdminResource(
      `${ERP_ENDPOINTS.treasuryAccounts}/${accountToDelete.id}`,
      token ?? '',
      { method: 'DELETE' },
    );
    setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id));
    setDeletingAccount(false);
    toast.success(
      ok
        ? t('adminTreasury.toast.accountDeleted', 'Compte supprimé')
        : t('adminTreasury.toast.accountDeletedLocal', 'Compte supprimé (mode démo)'),
    );
    setAccountToDelete(null);
  }, [accountToDelete, t, token]);

  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const cashBalance = accounts.filter((a) => a.kind === 'cash').reduce((s, a) => s + a.balance, 0);
    const bankBalance = accounts.filter((a) => a.kind === 'bank').reduce((s, a) => s + a.balance, 0);
    const portfolio = instruments
      .filter((i) => i.status === 'portfolio' || i.status === 'deposited')
      .reduce((s, i) => s + i.amount, 0);
    return { totalBalance, cashBalance, bankBalance, portfolio };
  }, [accounts, instruments]);

  const term = search.trim().toLowerCase();
  const filteredMovements = movements.filter(
    (m) =>
      inDateRange(m.date, dateRange) &&
      (!term || m.label.toLowerCase().includes(term) || m.account.toLowerCase().includes(term)),
  );
  const filteredInstruments = instruments.filter(
    (i) =>
      inDateRange(i.dueDate, dateRange) &&
      (!term || i.number.toLowerCase().includes(term) || i.party.toLowerCase().includes(term)),
  );

  /* Échéancier: sort upcoming instruments by due date. */
  const schedule = useMemo(
    () =>
      [...instruments]
        .filter((i) => i.status === 'portfolio' || i.status === 'deposited')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [instruments],
  );

  const methodLabel = (m: Movement['method']) => {
    const map: Record<Movement['method'], { key: string; fallback: string }> = {
      cash: { key: 'adminTreasury.method.cash', fallback: 'Espèces' },
      cheque: { key: 'adminTreasury.method.cheque', fallback: 'Chèque' },
      transfer: { key: 'adminTreasury.method.transfer', fallback: 'Virement' },
      traite: { key: 'adminTreasury.method.traite', fallback: 'Traite' },
    };
    return t(map[m].key, map[m].fallback);
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-1 text-xs font-medium text-ink-400">
            {t('adminLayout.sections.tresorerie', 'Trésorerie')}
            <span className="mx-1.5">/</span>
            <span className="text-ink-600">{t(TABS.find((x) => x.key === tab)!.labelKey, TABS.find((x) => x.key === tab)!.fallback)}</span>
          </nav>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            {t('adminTreasury.title', 'Trésorerie')}
            {!loading && !live && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-[11px] font-bold text-amber-700">
                {t('common.demoData', 'Données démo')}
              </span>
            )}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminTreasury.subtitle', 'Caisse, banques, chèques, traites et échéancier.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => void fetchData()} busy={loading} />
          {tab === 'accounts' ? (
            <button type="button" className={BTN_PRIMARY} onClick={openCreateAccount}>
              <Plus className="h-4 w-4" />
              {t('adminTreasury.newAccount', 'Nouveau compte')}
            </button>
          ) : (
            <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('adminTreasury.newMovement', 'Nouveau mouvement')}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('adminTreasury.stats.total', 'Trésorerie totale')} value={money.format(stats.totalBalance)} Icon={Wallet} tone="gold" />
        <StatTile label={t('adminTreasury.stats.cash', 'Caisse')} value={money.format(stats.cashBalance)} Icon={Banknote} />
        <StatTile label={t('adminTreasury.stats.bank', 'Banques')} value={money.format(stats.bankBalance)} Icon={Landmark} />
        <StatTile label={t('adminTreasury.stats.portfolio', 'Effets en portefeuille')} value={money.format(stats.portfolio)} Icon={FileCheck} />
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

      {/* Search + date filter (movements/instruments only) */}
      {(tab === 'movements' || tab === 'instruments') && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className={`${INPUT} pl-9`}
              placeholder={t('adminTreasury.searchPlaceholder', 'Rechercher…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      )}

      {/* Comptes */}
      {tab === 'accounts' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${CARD} ba-skeleton h-32`} />)
            : accounts.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className={CARD}>
                    <EmptyState Icon={Wallet} title={t('adminTreasury.empty.accounts', 'Aucun compte')} />
                  </div>
                </div>
              ) : (
                accounts.map((a) => (
                <div key={a.id} className={`${CARD} p-5`}>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-700">
                      {a.kind === 'cash' ? <Banknote className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                    </span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-500">
                      {a.kind === 'cash'
                        ? t('adminTreasury.kind.cash', 'Caisse')
                        : t('adminTreasury.kind.bank', 'Banque')}
                    </span>
                  </div>
                  <div className="mt-3 font-semibold text-ink-900">{a.name}</div>
                  {a.bank && <div className="text-xs text-ink-400">{a.bank} · {a.rib}</div>}
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="ba-nums text-xl font-black text-ink-900">{money.format(a.balance)}</div>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        className={rowActionBtn('blue')}
                        onClick={() => openEditAccount(a)}
                        title={t('common.edit', 'Modifier')}
                        aria-label={t('common.edit', 'Modifier')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={rowActionBtn('red')}
                        onClick={() => setAccountToDelete(a)}
                        title={t('common.delete', 'Supprimer')}
                        aria-label={t('common.delete', 'Supprimer')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                ))
              )}
        </div>
      )}

      {/* Mouvements */}
      {tab === 'movements' && (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.date', 'Date')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.label', 'Libellé')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.account', 'Compte')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.method', 'Mode')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminTreasury.col.amount', 'Montant')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState Icon={Coins} title={t('adminTreasury.empty.movements', 'Aucun mouvement')} />
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isIn = m.kind === 'in';
                    return (
                      <tr key={m.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                        <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(m.date))}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-ink-800">
                            {isIn ? <ArrowDownCircle className="h-4 w-4 text-emerald-500" /> : <ArrowUpCircle className="h-4 w-4 text-red-500" />}
                            {m.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-500">{m.account}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-500">{methodLabel(m.method)}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold ${isIn ? 'text-emerald-700' : 'text-red-600'}`}>
                          {isIn ? '+' : '−'}
                          {money.format(m.amount)}
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

      {/* Chèques & traites */}
      {tab === 'instruments' && (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.number', 'N°')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.type', 'Type')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.party', 'Tiers')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.bank', 'Banque')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.due', 'Échéance')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminTreasury.col.amount', 'Montant')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminTreasury.col.status', 'Statut')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={6} cols={7} />
                ) : filteredInstruments.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState Icon={FileCheck} title={t('adminTreasury.empty.instruments', 'Aucun effet')} />
                    </td>
                  </tr>
                ) : (
                  filteredInstruments.map((i) => {
                    const cfg = INSTRUMENT_STATUS[i.status];
                    return (
                      <tr key={i.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900">{i.number}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                          {i.kind === 'cheque'
                            ? t('adminTreasury.method.cheque', 'Chèque')
                            : t('adminTreasury.method.traite', 'Traite')}
                        </td>
                        <td className="px-4 py-3 text-ink-700">{i.party}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-500">{i.bank}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(i.dueDate))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold text-ink-900">{money.format(i.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.className}`}>
                            {t(cfg.key, cfg.fallback)}
                          </span>
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

      {/* Échéancier */}
      {tab === 'schedule' && (
        <div className={CARD}>
          {loading ? (
            <div className="p-6">
              <div className="ba-skeleton h-40 rounded-xl" />
            </div>
          ) : schedule.length === 0 ? (
            <EmptyState Icon={Clock} title={t('adminTreasury.empty.schedule', 'Aucune échéance à venir')} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {schedule.map((i) => {
                const overdue = new Date(i.dueDate).getTime() < Date.now();
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${overdue ? 'bg-red-50 text-red-600' : 'bg-gold-500/10 text-gold-700'}`}>
                        {overdue ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </span>
                      <div>
                        <div className="font-semibold text-ink-900">{i.number} — {i.party}</div>
                        <div className="text-xs text-ink-400">
                          {i.kind === 'cheque' ? t('adminTreasury.method.cheque', 'Chèque') : t('adminTreasury.method.traite', 'Traite')}
                          {' · '}
                          {i.bank}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="ba-nums font-semibold text-ink-900">{money.format(i.amount)}</div>
                      <div className={`text-xs ${overdue ? 'font-semibold text-red-600' : 'text-ink-400'}`}>{dateFmt.format(new Date(i.dueDate))}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Create movement modal */}
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
                  {t('adminTreasury.newMovement', 'Nouveau mouvement')}
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
                    {t('adminTreasury.col.label', 'Libellé')} *
                  </label>
                  <input
                    className={INPUT}
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Encaissement FAC-2025-0203"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminTreasury.col.account', 'Compte')}
                  </label>
                  <select
                    className={INPUT}
                    value={form.account}
                    onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
                  >
                    <option value="">{t('adminTreasury.form.selectAccount', '— Sélectionner —')}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTreasury.col.kind', 'Sens')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.kind}
                      onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as MoveKind }))}
                    >
                      <option value="in">{t('adminTreasury.kind.in', 'Entrée')}</option>
                      <option value="out">{t('adminTreasury.kind.out', 'Sortie')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTreasury.col.method', 'Mode')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.method}
                      onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as Movement['method'] }))}
                    >
                      <option value="cash">{t('adminTreasury.method.cash', 'Espèces')}</option>
                      <option value="cheque">{t('adminTreasury.method.cheque', 'Chèque')}</option>
                      <option value="transfer">{t('adminTreasury.method.transfer', 'Virement')}</option>
                      <option value="traite">{t('adminTreasury.method.traite', 'Traite')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTreasury.col.amount', 'Montant')}
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

      {/* Create / edit account modal */}
      <AnimatePresence>
        {showAccountModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !savingAccount && setShowAccountModal(false)}
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
                  {editingAccount
                    ? t('adminTreasury.editAccount', 'Modifier le compte')
                    : t('adminTreasury.newAccount', 'Nouveau compte')}
                </h2>
                <button
                  type="button"
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-50"
                  onClick={() => setShowAccountModal(false)}
                  disabled={savingAccount}
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminTreasury.form.accountName', 'Nom du compte')} *
                  </label>
                  <input
                    className={INPUT}
                    value={accountForm.name}
                    onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('adminTreasury.form.accountNamePh', 'Compte courant')}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTreasury.col.kind', 'Type')}
                    </label>
                    <select
                      className={INPUT}
                      value={accountForm.kind}
                      onChange={(e) =>
                        setAccountForm((f) => ({ ...f, kind: e.target.value as CashAccount['kind'] }))
                      }
                    >
                      <option value="cash">{t('adminTreasury.kind.cash', 'Caisse')}</option>
                      <option value="bank">{t('adminTreasury.kind.bank', 'Banque')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminTreasury.form.balance', 'Solde')}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      className={INPUT}
                      value={accountForm.balance}
                      onChange={(e) => setAccountForm((f) => ({ ...f, balance: e.target.value }))}
                      placeholder="0.000"
                    />
                  </div>
                </div>
                {accountForm.kind === 'bank' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                        {t('adminTreasury.col.bank', 'Banque')}
                      </label>
                      <input
                        className={INPUT}
                        value={accountForm.bank}
                        onChange={(e) => setAccountForm((f) => ({ ...f, bank: e.target.value }))}
                        placeholder="BIAT"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                        {t('adminTreasury.form.rib', 'RIB')}
                      </label>
                      <input
                        className={INPUT}
                        value={accountForm.rib}
                        onChange={(e) => setAccountForm((f) => ({ ...f, rib: e.target.value }))}
                        placeholder="08 123 0001234567 89"
                      />
                    </div>
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
                <button
                  type="button"
                  className={BTN_GHOST}
                  onClick={() => setShowAccountModal(false)}
                  disabled={savingAccount}
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  onClick={() => void submitAccount()}
                  disabled={savingAccount}
                >
                  {editingAccount ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editingAccount ? t('common.save', 'Enregistrer') : t('common.create', 'Créer')}
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete account confirmation */}
      <ConfirmDialog
        open={Boolean(accountToDelete)}
        onCancel={() => setAccountToDelete(null)}
        onConfirm={() => void confirmDeleteAccount()}
        pending={deletingAccount}
        Icon={Trash2}
        title={t('adminTreasury.deleteAccount.title', 'Supprimer le compte')}
        detail={accountToDelete?.name}
        message={t(
          'adminTreasury.deleteAccount.message',
          'Ce compte sera définitivement supprimé. Cette action est irréversible.',
        )}
        confirmLabel={t('common.delete', 'Supprimer')}
        cancelLabel={t('common.cancel', 'Annuler')}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local presentational helpers                                               */
/* -------------------------------------------------------------------------- */

const TONE_ICON: Record<string, string> = {
  gold: 'text-gold-500',
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
  tone?: 'gold' | 'ink';
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
