import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  Eye,
  X,
  FileText,
  CalendarDays,
  CalendarCheck,
  Wallet,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
/*  RH & Paie (HR & Payroll) — Tunisian rules                                  */
/*  Self-contained module with local data. Tabs: employés, congés, paie.       */
/*                                                                             */
/*  Cotisations sociales tunisiennes (régime général) :                        */
/*   - CNSS part salariale : 9,18 %                                            */
/*   - CNSS part patronale : 16,57 %                                           */
/*  IRPP : barème progressif par tranches annuelles (approximation).           */
/* -------------------------------------------------------------------------- */

const CNSS_EMPLOYEE = 0.0918; // part salariale
const CNSS_EMPLOYER = 0.1657; // part patronale

/** Barème IRPP annuel tunisien (tranches indicatives en TND). */
const IRPP_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 5000, rate: 0 },
  { upTo: 20000, rate: 0.26 },
  { upTo: 30000, rate: 0.28 },
  { upTo: 50000, rate: 0.32 },
  { upTo: Infinity, rate: 0.35 },
];

/** Compute annual IRPP from an annual taxable base using the progressive scale. */
function computeAnnualIrpp(annualBase: number): number {
  let tax = 0;
  let lower = 0;
  for (const b of IRPP_BRACKETS) {
    if (annualBase <= lower) break;
    const taxable = Math.min(annualBase, b.upTo) - lower;
    if (taxable > 0) tax += taxable * b.rate;
    lower = b.upTo;
  }
  return tax;
}

type HrTab = 'employees' | 'leaves' | 'payroll';

/* — Employés — */
interface Employee {
  id: string;
  matricule: string;
  name: string;
  role: string;
  cin: string;
  contract: 'CDI' | 'CDD' | 'SIVP' | 'Stage';
  hireDate: string; // ISO
  grossMonthly: number; // salaire brut mensuel TND
  active: boolean;
}
const MOCK_EMPLOYEES: Employee[] = [
  { id: 'e1', matricule: 'EMP-001', name: 'Slim Ben Yahia', role: 'Chef d’atelier', cin: '08123456', contract: 'CDI', hireDate: '2019-03-01', grossMonthly: 2400, active: true },
  { id: 'e2', matricule: 'EMP-002', name: 'Nadia Jlassi', role: 'Comptable', cin: '09234567', contract: 'CDI', hireDate: '2020-06-15', grossMonthly: 1950, active: true },
  { id: 'e3', matricule: 'EMP-003', name: 'Hatem Gharbi', role: 'Mécanicien', cin: '10345678', contract: 'CDI', hireDate: '2021-01-10', grossMonthly: 1350, active: true },
  { id: 'e4', matricule: 'EMP-004', name: 'Rania Khelifi', role: 'Vendeuse comptoir', cin: '11456789', contract: 'CDD', hireDate: '2023-09-01', grossMonthly: 1100, active: true },
  { id: 'e5', matricule: 'EMP-005', name: 'Wassim Trabelsi', role: 'Magasinier', cin: '12567890', contract: 'CDI', hireDate: '2018-11-20', grossMonthly: 1250, active: true },
  { id: 'e6', matricule: 'EMP-006', name: 'Ines Sassi', role: 'Assistante RH', cin: '13678901', contract: 'SIVP', hireDate: '2024-02-01', grossMonthly: 900, active: true },
  { id: 'e7', matricule: 'EMP-007', name: 'Karim Bouzid', role: 'Mécanicien', cin: '14789012', contract: 'CDI', hireDate: '2017-05-05', grossMonthly: 1400, active: false },
];

/* — Congés — */
type LeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity';
type LeaveStatus = 'pending' | 'approved' | 'rejected';
interface Leave {
  id: string;
  employee: string;
  type: LeaveType;
  from: string; // ISO
  to: string; // ISO
  days: number;
  status: LeaveStatus;
}
const MOCK_LEAVES: Leave[] = [
  { id: 'l1', employee: 'Hatem Gharbi', type: 'annual', from: '2025-03-03', to: '2025-03-07', days: 5, status: 'pending' },
  { id: 'l2', employee: 'Nadia Jlassi', type: 'sick', from: '2025-02-10', to: '2025-02-12', days: 3, status: 'approved' },
  { id: 'l3', employee: 'Rania Khelifi', type: 'annual', from: '2025-02-24', to: '2025-02-28', days: 5, status: 'approved' },
  { id: 'l4', employee: 'Wassim Trabelsi', type: 'unpaid', from: '2025-03-17', to: '2025-03-21', days: 5, status: 'pending' },
  { id: 'l5', employee: 'Ines Sassi', type: 'maternity', from: '2025-04-01', to: '2025-06-30', days: 60, status: 'approved' },
];

const LEAVE_TYPE: Record<LeaveType, { key: string; fallback: string }> = {
  annual: { key: 'adminHr.leaveType.annual', fallback: 'Congé annuel' },
  sick: { key: 'adminHr.leaveType.sick', fallback: 'Congé maladie' },
  unpaid: { key: 'adminHr.leaveType.unpaid', fallback: 'Sans solde' },
  maternity: { key: 'adminHr.leaveType.maternity', fallback: 'Maternité' },
};
const LEAVE_STATUS: Record<LeaveStatus, { key: string; fallback: string; className: string }> = {
  pending: { key: 'adminHr.leaveStatus.pending', fallback: 'En attente', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  approved: { key: 'adminHr.leaveStatus.approved', fallback: 'Approuvé', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { key: 'adminHr.leaveStatus.rejected', fallback: 'Refusé', className: 'bg-red-50 text-red-700 ring-red-200' },
};

const CONTRACT_LABELS: Record<Employee['contract'], string> = {
  CDI: 'CDI', CDD: 'CDD', SIVP: 'SIVP', Stage: 'Stage',
};

const TABS: { key: HrTab; labelKey: string; fallback: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'employees', labelKey: 'adminHr.tabs.employees', fallback: 'Employés', Icon: Users },
  { key: 'leaves', labelKey: 'adminHr.tabs.leaves', fallback: 'Congés', Icon: CalendarDays },
  { key: 'payroll', labelKey: 'adminHr.tabs.payroll', fallback: 'Paie', Icon: Wallet },
];

interface PayslipBreakdown {
  gross: number;
  cnssEmployee: number;
  taxableBase: number;
  irppMonthly: number;
  net: number;
  cnssEmployer: number;
  employerCost: number;
}

function buildPayslip(gross: number): PayslipBreakdown {
  const cnssEmployee = gross * CNSS_EMPLOYEE;
  const taxableBase = gross - cnssEmployee;
  const irppMonthly = computeAnnualIrpp(taxableBase * 12) / 12;
  const net = taxableBase - irppMonthly;
  const cnssEmployer = gross * CNSS_EMPLOYER;
  return {
    gross,
    cnssEmployee,
    taxableBase,
    irppMonthly,
    net,
    cnssEmployer,
    employerCost: gross + cnssEmployer,
  };
}

export default function AdminHr() {
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

  const [tab, setTab] = useState<HrTab>('employees');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [empRange, setEmpRange] = useState<DateRange>(EMPTY_RANGE);
  const [leaveRange, setLeaveRange] = useState<DateRange>(EMPTY_RANGE);
  const [payslipFor, setPayslipFor] = useState<Employee | null>(null);
  const [live, setLive] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = { matricule: '', name: '', role: '', cin: '', contract: 'CDI' as Employee['contract'], grossMonthly: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emp, lea] = await Promise.all([
        getAdminResource<Employee>(ERP_ENDPOINTS.employees, token ?? '', MOCK_EMPLOYEES),
        getAdminResource<Leave>(ERP_ENDPOINTS.leaves, token ?? '', MOCK_LEAVES),
      ]);
      setEmployees(emp.items);
      setLeaves(lea.items);
      setLive(emp.live && lea.live);
    } catch {
      setError(t('adminHr.error', 'Impossible de charger les données RH.'));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Create a new employee. Persists to backend when available, else appends an
  // optimistic local row (demo mode).
  const submitCreate = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error(t('adminHr.form.nameRequired', 'Le nom est requis.'));
      return;
    }
    setSaving(true);
    const payload = {
      matricule: form.matricule.trim(),
      name: form.name.trim(),
      role: form.role.trim(),
      cin: form.cin.trim(),
      contract: form.contract,
      hireDate: new Date().toISOString().slice(0, 10),
      grossMonthly: Number(form.grossMonthly) || 0,
      active: true,
    };
    const created = await createAdminResource<Employee>(ERP_ENDPOINTS.employees, token ?? '', payload);
    const row: Employee =
      created ?? {
        ...payload,
        id: `local-${Date.now()}`,
        matricule: payload.matricule || `EMP-${String(Math.floor(Math.random() * 900) + 100)}`,
      };
    setEmployees((prev) => [row, ...prev]);
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
    setTab('employees');
    toast.success(
      created
        ? t('adminHr.toast.created', 'Employé créé')
        : t('adminHr.toast.createdLocal', 'Employé créé (mode démo)'),
    );
  }, [form, t, token]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.active);
    const grossPayroll = active.reduce((s, e) => s + e.grossMonthly, 0);
    const employerCost = active.reduce((s, e) => s + buildPayslip(e.grossMonthly).employerCost, 0);
    const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
    return {
      headcount: active.length,
      grossPayroll,
      employerCost,
      pendingLeaves,
    };
  }, [employees, leaves]);

  const term = search.trim().toLowerCase();
  const filteredEmployees = employees.filter(
    (e) =>
      inDateRange(e.hireDate, empRange) &&
      (!term || e.name.toLowerCase().includes(term) || e.matricule.toLowerCase().includes(term) || e.role.toLowerCase().includes(term)),
  );

  // A leave overlaps the window if it starts on/before the window end and ends
  // on/after the window start — a leave straddling the boundary still counts.
  const filteredLeaves = leaves.filter(
    (l) => inDateRange(l.from, leaveRange) || inDateRange(l.to, leaveRange),
  );

  const payslip = payslipFor ? buildPayslip(payslipFor.grossMonthly) : null;

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-1 text-xs font-medium text-ink-400">
            {t('adminLayout.sections.rh', 'RH & Paie')}
            <span className="mx-1.5">/</span>
            <span className="text-ink-600">{t(TABS.find((x) => x.key === tab)!.labelKey, TABS.find((x) => x.key === tab)!.fallback)}</span>
          </nav>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            {t('adminHr.title', 'RH & Paie')}
            {!loading && !live && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-[11px] font-bold text-amber-700">
                {t('common.demoData', 'Données démo')}
              </span>
            )}
          </h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {t('adminHr.subtitle', 'Employés, contrats, congés et bulletins de paie (CNSS 9,18 % / 16,57 %, IRPP progressif).')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={() => void fetchData()} busy={loading} />
          <button type="button" className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t('adminHr.newEmployee', 'Nouvel employé')}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('adminHr.stats.headcount', 'Effectif actif')} value={String(stats.headcount)} Icon={UserCheck} />
        <StatTile label={t('adminHr.stats.grossPayroll', 'Masse salariale brute')} value={money.format(stats.grossPayroll)} Icon={Wallet} tone="gold" />
        <StatTile label={t('adminHr.stats.employerCost', 'Coût employeur')} value={money.format(stats.employerCost)} Icon={Briefcase} />
        <StatTile label={t('adminHr.stats.pendingLeaves', 'Congés en attente')} value={String(stats.pendingLeaves)} Icon={CalendarCheck} />
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
          <X className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Employees */}
      {tab === 'employees' && (
        <div className={CARD}>
          <div className="border-b border-ink-100 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  className={`${INPUT} pl-9`}
                  placeholder={t('adminHr.searchEmployee', 'Rechercher un employé…')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DateRangeFilter value={empRange} onChange={setEmpRange} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.matricule', 'Matricule')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.name', 'Nom')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.contract', 'Contrat')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.hireDate', 'Embauche')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.gross', 'Salaire brut')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.status', 'Statut')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={7} cols={7} />
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState Icon={Users} title={t('adminHr.empty.employees', 'Aucun employé')} />
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((e) => (
                    <tr key={e.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 ba-nums font-semibold text-ink-900">{e.matricule}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-800">{e.name}</div>
                        <div className="text-xs text-ink-400">{e.role}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600">{CONTRACT_LABELS[e.contract]}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(e.hireDate))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold text-ink-900">{money.format(e.grossMonthly)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                            e.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-ink-100 text-ink-500 ring-ink-200'
                          }`}
                        >
                          {e.active ? t('adminHr.active', 'Actif') : t('adminHr.inactive', 'Inactif')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPayslipFor(e)}
                          className="ba-press inline-flex h-8 items-center gap-1.5 rounded-lg bg-gold-500/10 px-2.5 text-xs font-semibold text-gold-700 transition hover:bg-gold-500/20"
                          title={t('adminHr.action.payslip', 'Bulletin de paie')}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {t('adminHr.action.payslipShort', 'Bulletin')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leaves */}
      {tab === 'leaves' && (
        <div className={CARD}>
          <div className="border-b border-ink-100 p-4">
            <DateRangeFilter value={leaveRange} onChange={setLeaveRange} />
          </div>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.employee', 'Employé')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.leaveType', 'Type')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.from', 'Du')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.to', 'Au')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.days', 'Jours')}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.status', 'Statut')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={5} cols={6} />
                ) : filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState Icon={CalendarDays} title={t('adminHr.empty.leaves', 'Aucune demande de congé')} />
                    </td>
                  </tr>
                ) : (
                  filteredLeaves.map((l) => {
                    const type = LEAVE_TYPE[l.type];
                    const st = LEAVE_STATUS[l.status];
                    return (
                      <tr key={l.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                        <td className="px-4 py-3 font-medium text-ink-800">{l.employee}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-600">{t(type.key, type.fallback)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(l.from))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-600">{dateFmt.format(new Date(l.to))}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold text-ink-900">{l.days}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${st.className}`}>
                            {t(st.key, st.fallback)}
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

      {/* Payroll */}
      {tab === 'payroll' && (
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${TABLE_MIN_WIDE}`}>
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-left font-semibold">{t('adminHr.col.name', 'Employé')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.gross', 'Brut')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.cnss', 'CNSS (9,18 %)')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.irpp', 'IRPP')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.net', 'Net à payer')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.employerCost', 'Coût employeur')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('adminHr.col.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={7} cols={7} />
                ) : (
                  employees
                    .filter((e) => e.active)
                    .map((e) => {
                      const ps = buildPayslip(e.grossMonthly);
                      return (
                        <tr key={e.id} className="border-t border-ink-100 transition hover:bg-ink-50/60">
                          <td className="px-4 py-3 font-medium text-ink-800">{e.name}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-700">{money.format(ps.gross)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-red-600">−{money.format(ps.cnssEmployee)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-red-600">−{money.format(ps.irppMonthly)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right ba-nums font-semibold text-emerald-700">{money.format(ps.net)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right ba-nums text-ink-500">{money.format(ps.employerCost)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setPayslipFor(e)}
                              className="ba-press inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
                              title={t('adminHr.action.payslip', 'Bulletin de paie')}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
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

      {/* Payslip drawer */}
      <AnimatePresence>
        {payslipFor && payslip && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPayslipFor(null)}
            />
            <motion.aside
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between border-b border-ink-100 p-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t('adminHr.payslip.title', 'Bulletin de paie')}</div>
                  <div className="text-lg font-black text-ink-900">{payslipFor.name}</div>
                  <div className="text-xs text-ink-400">{payslipFor.matricule} · {payslipFor.role}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayslipFor(null)}
                  className="ba-press inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-5">
                <Line label={t('adminHr.payslip.gross', 'Salaire brut')} value={money.format(payslip.gross)} />
                <Line label={t('adminHr.payslip.cnssEmployee', 'CNSS part salariale (9,18 %)')} value={`−${money.format(payslip.cnssEmployee)}`} negative />
                <Line label={t('adminHr.payslip.taxableBase', 'Base imposable')} value={money.format(payslip.taxableBase)} muted />
                <Line label={t('adminHr.payslip.irpp', 'IRPP (barème progressif)')} value={`−${money.format(payslip.irppMonthly)}`} negative />
                <div className="my-3 h-px bg-ink-100" />
                <Line label={t('adminHr.payslip.net', 'Net à payer')} value={money.format(payslip.net)} strong />
                <div className="my-3 h-px bg-ink-100" />
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t('adminHr.payslip.employerSection', 'Charges patronales')}</div>
                <Line label={t('adminHr.payslip.cnssEmployer', 'CNSS part patronale (16,57 %)')} value={money.format(payslip.cnssEmployer)} muted />
                <Line label={t('adminHr.payslip.employerCost', 'Coût total employeur')} value={money.format(payslip.employerCost)} strong />
              </div>
              <div className="border-t border-ink-100 p-5">
                <button type="button" className={`${BTN_PRIMARY} w-full`}>
                  <FileText className="h-4 w-4" />
                  {t('adminHr.payslip.download', 'Télécharger le bulletin')}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Create employee modal */}
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
                  {t('adminHr.newEmployee', 'Nouvel employé')}
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
                    {t('adminHr.col.name', 'Nom complet')} *
                  </label>
                  <input
                    className={INPUT}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Slim Ben Yahia"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminHr.col.matricule', 'Matricule')}
                    </label>
                    <input
                      className={INPUT}
                      value={form.matricule}
                      onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
                      placeholder="EMP-008"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminHr.col.cin', 'CIN')}
                    </label>
                    <input
                      className={INPUT}
                      value={form.cin}
                      onChange={(e) => setForm((f) => ({ ...f, cin: e.target.value }))}
                      placeholder="08123456"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminHr.col.role', 'Poste')}
                    </label>
                    <input
                      className={INPUT}
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      placeholder="Mécanicien"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {t('adminHr.col.contract', 'Contrat')}
                    </label>
                    <select
                      className={INPUT}
                      value={form.contract}
                      onChange={(e) => setForm((f) => ({ ...f, contract: e.target.value as Employee['contract'] }))}
                    >
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="SIVP">SIVP</option>
                      <option value="Stage">Stage</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t('adminHr.col.grossMonthly', 'Salaire brut mensuel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className={INPUT}
                    value={form.grossMonthly}
                    onChange={(e) => setForm((f) => ({ ...f, grossMonthly: e.target.value }))}
                    placeholder="0.000"
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

function Line({
  label,
  value,
  negative,
  strong,
  muted,
}: {
  label: string;
  value: string;
  negative?: boolean;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${muted ? 'text-ink-400' : 'text-ink-600'} ${strong ? 'font-bold text-ink-900' : ''}`}>{label}</span>
      <span
        className={`ba-nums text-sm ${
          strong ? 'text-lg font-black text-ink-900' : negative ? 'font-semibold text-red-600' : 'font-semibold text-ink-800'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
