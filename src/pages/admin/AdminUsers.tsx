import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Users, Shield, Lock, Unlock, X, Mail, Building2, Clock, CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { usersApi } from '../../lib/api'
import {
  CARD, INPUT, TH_ROW, TABLE_MIN,
  PageHeader, RefreshButton, SearchBar, FilterChip, StatusPill, TableSkeleton, EmptyState,
  DateRangeFilter, FilterBar, EMPTY_RANGE, isDateRangeActive, type DateRange,
} from './_ui'

// ── Role metadata ───────────────────────────────────────────────────────────
const ROLES = [
  'SUPER_ADMIN', 'BRANCH_ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC',
  'CAR_WASH_EMPLOYEE', 'STOCK_MANAGER', 'ACCOUNTANT', 'FLEET_MANAGER', 'CUSTOMER',
] as const

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-50 text-red-600 border-red-200',
  BRANCH_ADMIN: 'bg-orange-50 text-orange-600 border-orange-200',
  MANAGER: 'bg-violet-50 text-violet-600 border-violet-200',
  RECEPTIONIST: 'bg-sky-50 text-sky-600 border-sky-200',
  MECHANIC: 'bg-blue-50 text-blue-600 border-blue-200',
  CAR_WASH_EMPLOYEE: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  STOCK_MANAGER: 'bg-amber-50 text-amber-600 border-amber-200',
  ACCOUNTANT: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  FLEET_MANAGER: 'bg-teal-50 text-teal-600 border-teal-200',
  CUSTOMER: 'bg-ink-50 text-ink-500 border-ink-100',
}

// ── Permission groups ───────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
  { key: 'appointments', perms: ['APPOINTMENT_CREATE','APPOINTMENT_UPDATE','APPOINTMENT_DELETE','APPOINTMENT_VIEW'] },
  { key: 'products', perms: ['PRODUCT_CREATE','PRODUCT_UPDATE','PRODUCT_DELETE','PRODUCT_VIEW'] },
  { key: 'inventory', perms: ['INVENTORY_MANAGE','INVENTORY_VIEW','STOCK_TRANSFER','PURCHASE_ORDER_CREATE'] },
  { key: 'reports', perms: ['REPORT_VIEW','ANALYTICS_VIEW'] },
  { key: 'users', perms: ['USER_MANAGE','USER_VIEW'] },
  { key: 'customers', perms: ['CUSTOMER_MANAGE','CUSTOMER_VIEW'] },
  { key: 'orders', perms: ['ORDER_MANAGE','ORDER_VIEW','REFUND_PROCESS'] },
  { key: 'workshop', perms: ['WORK_ORDER_MANAGE','INSPECTION_CREATE','ESTIMATE_CREATE','ESTIMATE_APPROVE'] },
  { key: 'services', perms: ['SERVICE_MANAGE','SERVICE_VIEW'] },
  { key: 'fleet', perms: ['FLEET_MANAGE','FLEET_VIEW'] },
  { key: 'branches', perms: ['BRANCH_MANAGE','BRANCH_VIEW'] },
  { key: 'crm', perms: ['CRM_VIEW','LOYALTY_MANAGE','MARKETING_MANAGE'] },
  { key: 'payments', perms: ['PAYMENT_VIEW','PAYMENT_PROCESS'] },
  { key: 'administration', perms: ['ADMIN_PANEL','SUPER_ADMIN_PANEL','AUDIT_LOG_VIEW'] },
]

// ── Identifier plumbing ─────────────────────────────────────────────────────
/**
 * Every `/users/{publicId}/…` endpoint is keyed by the account's public UUID.
 * When that field is missing, template interpolation used to produce the literal
 * URL `/users/null/permissions`, which the server answered with a bare 404 and no
 * clue as to the cause. Fail in the client instead, with a message that names the
 * problem.
 */
const UNUSABLE_IDS = new Set(['null', 'undefined', 'nan', '0'])

function hasUsableId(u: any): boolean {
  const id = u?.publicId
  return typeof id === 'string' && id.trim() !== '' && !UNUSABLE_IDS.has(id.trim().toLowerCase())
}

/** Returns the UUID or throws — the throw is caught by the mutation's `onError`. */
function requireId(u: any, fallback: string): string {
  if (!hasUsableId(u)) {
    throw new Error(fallback)
  }
  return u.publicId as string
}

/** Prefers the API's own wording over a generic fallback. */
function apiMessage(e: any, fallback: string): string {
  return e?.response?.data?.error || e?.response?.data?.message || e?.message || fallback
}

export default function AdminUsers() {
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const isFr = i18n.language.startsWith('fr')
  const locale = isFr ? 'fr-TN' : 'en-TN'
  const roleLabel = (role: string) => t(`adminUsers.role.${role}`, { defaultValue: role })
  const branchName = (branch: any) => (isFr ? branch?.nameFr : branch?.name) || branch?.nameFr || branch?.name || '—'
  const idError = t('adminUsers.uuid.actionError')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [lockedFilter, setLockedFilter] = useState<'' | 'true' | 'false'>('')
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [page, setPage] = useState(0)
  /**
   * Permissions shown while a toggle is in flight. Without it, two quick clicks
   * both read the same server state and the second request silently reverts the
   * first.
   */
  const [pendingPerms, setPendingPerms] = useState<string[] | null>(null)

  // ── Fetch users ───────────────────────────────────────────────────────────
  // `isFetching` (not `isLoading`) drives the refresh button: in Query v5
  // `isLoading` is only true on the first fetch of an empty cache, so a manual
  // refetch left the button inert.
  //
  // Every filter goes to the API. The list is paginated server-side, so
  // narrowing the fetched page would hide matches on the other pages — and the
  // role and the search term now combine instead of overriding each other.
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-users', search, roleFilter, lockedFilter, dateRange.from, dateRange.to, page],
    queryFn: () => usersApi.list({
      search: search || undefined,
      role: roleFilter || undefined,
      locked: lockedFilter || undefined,
      createdFrom: dateRange.from || undefined,
      createdTo: dateRange.to || undefined,
      page,
      size: 15,
    }),
    staleTime: 30_000,
  })
  const users: any[] = data?.data?.data?.content ?? []
  const totalPages = data?.data?.data?.totalPages ?? 0
  const totalElements = data?.data?.data?.totalElements ?? 0

  /** Legacy rows the startup backfill has not reached yet. */
  const missingIds = users.filter(u => !hasUsableId(u)).length

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (roleFilter ? 1 : 0) +
    (lockedFilter ? 1 : 0) +
    (isDateRangeActive(dateRange) ? 1 : 0)

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('')
    setLockedFilter('')
    setDateRange(EMPTY_RANGE)
    setPage(0)
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  // `id` is the account's public UUID; the backend no longer exposes the
  // sequential database key.
  const roleMut = useMutation({
    mutationFn: ({ user, role }: { user: any; role: string }) =>
      usersApi.updateRole(requireId(user, idError), role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      // Changing a role revokes that user's sessions server-side, so they must
      // sign in again before the new role applies.
      toast.success(t('adminUsers.toast.roleUpdated'))
    },
    onError: (e) => toast.error(apiMessage(e, t('adminUsers.toast.roleFailed'))),
  })

  const permMut = useMutation({
    mutationFn: ({ user, permissions }: { user: any; permissions: string[] }) =>
      usersApi.updatePermissions(requireId(user, idError), permissions),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setSelectedUser(res.data?.data ?? selectedUser)
      toast.success(t('adminUsers.toast.permissionsUpdated'))
    },
    onError: (e) => toast.error(apiMessage(e, t('adminUsers.toast.updateFailed'))),
    // Drop the optimistic overlay either way: on success the server response is
    // authoritative, on failure the previous state is.
    onSettled: () => setPendingPerms(null),
  })

  const lockMut = useMutation({
    mutationFn: ({ user, locked }: { user: any; locked: boolean }) =>
      usersApi.toggleLock(requireId(user, idError), locked),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success(t('adminUsers.toast.statusUpdated')) },
    onError: (e) => toast.error(apiMessage(e, t('adminShared.unknownError'))),
  })

  // ── Permission toggle handler ─────────────────────────────────────────────
  /** Permissions to render: the in-flight set if there is one, else the server's. */
  const visiblePerms: string[] = pendingPerms ?? selectedUser?.additionalPermissions ?? []

  const togglePerm = (perm: string) => {
    if (!selectedUser) return
    const updated = visiblePerms.includes(perm)
      ? visiblePerms.filter((p: string) => p !== perm)
      : [...visiblePerms, perm]
    setPendingPerms(updated)
    permMut.mutate({ user: selectedUser, permissions: updated })
  }

  const closeDrawer = () => { setSelectedUser(null); setPendingPerms(null) }

  /** Stable colour derived from the UUID string — ids are no longer numeric. */
  const avatarColor = (id: string) => {
    const c = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-orange-500','bg-rose-500','bg-cyan-500','bg-amber-500','bg-pink-500']
    let hash = 0
    for (let i = 0; i < (id ?? '').length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 9973
    return c[hash % c.length]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('adminUsers.title')}
        subtitle={t('adminUsers.subtitle', { count: totalElements })}
      >
        <RefreshButton onClick={() => refetch()} busy={isFetching} />
      </PageHeader>

      {/*
        Legacy rows created before `publicId` existed. `UserPublicIdBackfill` fills
        them on startup, so the only way to see this banner is a backend that has
        not been restarted since the column was added.
      */}
      {missingIds > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-xs font-semibold leading-relaxed text-amber-800">
            <p className="font-black">
              {t('adminUsers.uuid.title', { count: missingIds })}
            </p>
            <p className="mt-1 font-medium">
              {t('adminUsers.uuid.message')}
            </p>
          </div>
        </div>
      )}

      {/* Role filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={!roleFilter} onClick={() => { setRoleFilter(''); setPage(0) }}>
          {t('adminUsers.allRoles')}
        </FilterChip>
        {ROLES.filter(r => r !== 'CUSTOMER').map(r => (
          <FilterChip
            key={r}
            active={roleFilter === r}
            onClick={() => { setRoleFilter(roleFilter === r ? '' : r); setPage(0) }}
          >
            {roleLabel(r)}
          </FilterChip>
        ))}
      </div>

      {/* Search, status & signup period */}
      <div className={`overflow-hidden ${CARD}`}>
        <FilterBar
          activeCount={activeFilters}
          onReset={clearFilters}
          right={
            <span className="ba-nums whitespace-nowrap text-xs font-bold text-ink-400">
              {t('adminUsers.count', { count: totalElements })}
              {activeFilters > 0 ? ` ${t('adminUsers.found')}` : ''}
            </span>
          }
        >
          <SearchBar
            value={search}
            onChange={(v) => { setSearch(v); setPage(0) }}
            placeholder={t('adminUsers.search')}
            className="w-full sm:w-72"
          />
          <select
            value={lockedFilter}
            onChange={(e) => { setLockedFilter(e.target.value as '' | 'true' | 'false'); setPage(0) }}
            aria-label={t('adminUsers.filterStatus')}
            className={`${INPUT} sm:w-44`}
          >
            <option value="">{t('adminUsers.allStatuses')}</option>
            <option value="false">{t('adminUsers.activeAccounts')}</option>
            <option value="true">{t('adminUsers.lockedAccounts')}</option>
          </select>
          <DateRangeFilter
            value={dateRange}
            onChange={(r) => { setDateRange(r); setPage(0) }}
          />
        </FilterBar>
      </div>

      {/* Users Table */}
      <div className={`overflow-hidden ${CARD}`}>
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-left text-sm text-ink-900 ${TABLE_MIN}`}>
            <thead>
              <tr className={TH_ROW}>
                <th className="px-5 py-4">{t('adminUsers.columns.user')}</th>
                <th className="px-5 py-4">{t('adminUsers.columns.email')}</th>
                <th className="px-5 py-4">{t('adminUsers.columns.role')}</th>
                <th className="px-5 py-4">{t('adminUsers.columns.branch')}</th>
                <th className="px-5 py-4">{t('adminUsers.columns.status')}</th>
                <th className="px-5 py-4">{t('adminUsers.columns.lastLogin')}</th>
                <th className="px-5 py-4 text-center">{t('adminUsers.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-semibold text-ink-800">
              {isLoading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      Icon={Users}
                      title={t('adminUsers.empty.title')}
                      hint={activeFilters > 0 ? t('adminUsers.empty.hint') : undefined}
                    />
                  </td>
                </tr>
              ) : users.map((u: any) => {
                const usable = hasUsableId(u)
                return (
                <tr key={u.publicId ?? u.email} className="transition-colors hover:bg-gold-50/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${avatarColor(u.publicId)}`}>
                        {(u.firstName?.[0] ?? '').toUpperCase()}{(u.lastName?.[0] ?? '').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-ink-900">{u.firstName} {u.lastName}</p>
                        {usable ? (
                          <span className="ba-nums text-[10px] text-ink-400" title={u.publicId}>
                            {(u.publicId ?? '').slice(0, 8)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600"
                            title={t('adminUsers.uuid.missingHint')}>
                            <AlertTriangle size={9} /> {t('adminUsers.uuid.missing')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium text-ink-500">
                    <span className="flex items-center gap-1.5"><Mail size={12} className="text-ink-300" />{u.email}</span>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={u.role}
                      onChange={e => roleMut.mutate({ user: u, role: e.target.value })}
                      disabled={roleMut.isPending || !usable}
                      aria-label={t('adminUsers.a11y.roleOf', { name: `${u.firstName} ${u.lastName}` })}
                      className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-bold outline-none focus:ring-2 focus:ring-gold-500/30 disabled:cursor-not-allowed disabled:opacity-60 ${ROLE_COLORS[u.role] ?? 'bg-ink-50 text-ink-500 border-ink-100'}`}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-ink-500">
                    {u.branch ? <span className="flex items-center gap-1"><Building2 size={11} />{branchName(u.branch)}</span> : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {u.accountLocked ? (
                      <StatusPill tone="red"><Lock size={10} /> {t('adminUsers.status.locked')}</StatusPill>
                    ) : u.deleted ? (
                      <StatusPill tone="gray">{t('adminUsers.status.disabled')}</StatusPill>
                    ) : (
                      <StatusPill tone="green"><CheckCircle size={10} /> {t('adminUsers.status.active')}</StatusPill>
                    )}
                  </td>
                  <td className="ba-nums px-5 py-4 text-xs font-medium text-ink-400">
                    {u.lastLoginAt ? <span className="flex items-center gap-1"><Clock size={10} />{new Date(u.lastLoginAt).toLocaleDateString(locale)}</span> : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => { setPendingPerms(null); setSelectedUser(u) }}
                        disabled={!usable}
                        aria-label={t('adminUsers.a11y.permissionsOf', { name: `${u.firstName} ${u.lastName}` })}
                        title={usable ? undefined : t('adminUsers.uuid.missingHint')}
                        className="ba-press flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-bold text-violet-600 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Shield size={11} /> {t('adminUsers.permissions')}
                      </button>
                      <button
                        onClick={() => lockMut.mutate({ user: u, locked: !u.accountLocked })}
                        disabled={lockMut.isPending || !usable}
                        aria-label={t(u.accountLocked ? 'adminUsers.a11y.unlock' : 'adminUsers.a11y.lock', { email: u.email })}
                        title={usable ? undefined : t('adminUsers.uuid.missingHint')}
                        className={`ba-press rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${u.accountLocked ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                      >
                        {u.accountLocked ? <Unlock size={11} /> : <Lock size={11} />}
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col items-start gap-3 border-t border-ink-100 p-4 text-xs font-bold text-ink-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="ba-nums">{t('adminUsers.pagination.range', { start: page * 15 + 1, end: Math.min((page + 1) * 15, totalElements), total: totalElements })}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                aria-label={t('adminUsers.pagination.previous')}
                className="ba-press rounded-lg border border-ink-100 p-1.5 transition-colors hover:bg-gray-50 disabled:opacity-50">&lt;</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                aria-label={t('adminUsers.pagination.next')}
                className="ba-press rounded-lg border border-ink-100 p-1.5 transition-colors hover:bg-gray-50 disabled:opacity-50">&gt;</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Permissions Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink-900/55 backdrop-blur-sm" onClick={closeDrawer} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label={t('adminUsers.a11y.permissionsOf', { name: `${selectedUser.firstName} ${selectedUser.lastName}` })}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-elev-4">

              {/* Drawer header */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white ${avatarColor(selectedUser.publicId)}`}>
                    {(selectedUser.firstName?.[0] ?? '').toUpperCase()}{(selectedUser.lastName?.[0] ?? '').toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink-900">{selectedUser.firstName} {selectedUser.lastName}</h3>
                    <p className="text-xs text-ink-400">{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={closeDrawer} aria-label={t('common.close')}
                  className="ba-press rounded-xl p-2 text-ink-400 transition-colors hover:bg-gray-50 hover:text-ink-700">
                  <X size={18} />
                </button>
              </div>

              {/* User info */}
              <div className="border-b border-ink-100 px-6 py-4">
                <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-ink-400">{t('adminUsers.columns.role')}</p>
                    <p className="mt-0.5 text-sm font-black text-ink-900">{roleLabel(selectedUser.role)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-ink-400">{t('adminUsers.columns.status')}</p>
                    <p className="mt-0.5 text-sm font-black text-ink-900">
                      {selectedUser.accountLocked ? `🔒 ${t('adminUsers.status.locked')}` : selectedUser.deleted ? `⛔ ${t('adminUsers.status.disabled')}` : `✅ ${t('adminUsers.status.active')}`}
                    </p>
                  </div>
                  {selectedUser.phone && (
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[10px] font-bold uppercase text-ink-400">{t('adminUsers.phone')}</p>
                      <p className="ba-nums mt-0.5 text-sm font-bold text-ink-900">{selectedUser.phone}</p>
                    </div>
                  )}
                  {selectedUser.branch && (
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[10px] font-bold uppercase text-ink-400">{t('adminUsers.columns.branch')}</p>
                      <p className="mt-0.5 text-sm font-bold text-ink-900">{branchName(selectedUser.branch)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Permissions */}
              <div className="px-6 py-5">
                <h4 className="mb-4 flex items-center gap-2 text-sm font-black text-ink-900">
                  <Shield size={16} className="text-gold-600" /> {t('adminUsers.additionalPermissions')}
                  <span className="ml-auto rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-black text-gold-700">
                    {visiblePerms.length}
                  </span>
                </h4>
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map(group => {
                    return (
                      <div key={group.key} className="rounded-xl border border-ink-100 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-ink-400">{t(`adminUsers.permissionGroup.${group.key}`)}</p>
                        <div className="grid grid-cols-1 gap-1.5 xs:grid-cols-2">
                          {group.perms.map(perm => {
                            const active = visiblePerms.includes(perm)
                            return (
                              <button key={perm} onClick={() => togglePerm(perm)}
                                disabled={permMut.isPending}
                                role="switch"
                                aria-checked={active}
                                className={`ba-press flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold transition-colors ${
                                  active
                                    ? 'border border-gold-300 bg-gold-50 text-gold-700'
                                    : 'border border-ink-100 bg-gray-50 text-ink-400 hover:bg-ink-50'
                                }`}>
                                <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border-2 transition-colors ${
                                  active ? 'border-gold-500 bg-gold-500' : 'border-ink-200'
                                }`}>
                                  {active && <CheckCircle size={8} className="text-white" />}
                                </span>
                                {t(`adminUsers.permission.${perm}`, { defaultValue: perm })}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
