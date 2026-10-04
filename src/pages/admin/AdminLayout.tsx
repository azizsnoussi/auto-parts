import React, { useState, useEffect } from "react"
import { Outlet, useNavigate, useLocation, Navigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart3, Building2, CalendarDays, Car, ChevronDown,
  ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Package,
  Receipt, Search, Settings, ShoppingCart, Store, Tag, Truck, Users,
  Warehouse, Wrench, X,
  BookOpen, Landmark, Wallet, UserCog, PackageCheck,
} from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../../components/LanguageSwitcher"
import BrandedLoader from "../../components/BrandedLoader"
import NotificationBell from "./NotificationBell"

// ── Types ──────────────────────────────────────────────────────────────────
interface NavItem {
  labelKey: string
  path: string
  icon: React.ElementType
  roles?: string[]
  /**
   * Extra permissions that also unlock this entry, mirroring the backend's
   * `AccessRules` constants. The API accepts a request when the role *or* one
   * of these matches, so the menu has to use the same rule — otherwise a
   * permission granted in Utilisateurs would be authorised server-side yet
   * have no link to reach it.
   */
  permissions?: string[]
  exact?: boolean
}
interface NavSection {
  labelKey: string
  roles: string[]
  permissions?: string[]
  items: NavItem[]
}

// ── Permission groups (kept in sync with backend AccessRules) ──────────────
const P_ANALYTICS  = ['ANALYTICS_VIEW', 'REPORT_VIEW']
const P_ORDERS     = ['ORDER_VIEW', 'ORDER_MANAGE', 'REFUND_PROCESS']
const P_CUSTOMERS  = ['CUSTOMER_VIEW', 'CUSTOMER_MANAGE', 'CRM_VIEW']
const P_APPOINTS   = ['APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_UPDATE', 'APPOINTMENT_DELETE']
const P_WORKSHOP   = ['WORK_ORDER_MANAGE', 'INSPECTION_CREATE', 'ESTIMATE_CREATE', 'ESTIMATE_APPROVE']
const P_PRODUCTS   = ['PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE']
const P_CATALOG    = ['PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE']
const P_INVENTORY  = ['INVENTORY_VIEW', 'INVENTORY_MANAGE', 'STOCK_TRANSFER', 'PURCHASE_ORDER_CREATE']
const P_SERVICES   = ['SERVICE_VIEW', 'SERVICE_MANAGE']
const P_BRANCHES   = ['BRANCH_VIEW', 'BRANCH_MANAGE']
const P_USERS      = ['USER_VIEW', 'USER_MANAGE']
const P_QUOTES     = ['QUOTE_VIEW', 'QUOTE_MANAGE']
const P_INVOICES   = ['INVOICE_VIEW', 'INVOICE_MANAGE']
const P_PURCHASE   = ['PURCHASE_ORDER_VIEW', 'PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_MANAGE']
const P_DELIVERY   = ['DELIVERY_NOTE_VIEW', 'DELIVERY_NOTE_MANAGE']
const P_PAYMENTS   = ['PAYMENT_VIEW', 'PAYMENT_MANAGE']
const P_ACCOUNTING = ['ACCOUNTING_VIEW', 'ACCOUNTING_MANAGE', 'JOURNAL_VIEW', 'LEDGER_VIEW']
const P_TAX        = ['TAX_VIEW', 'TAX_MANAGE', 'TAX_DECLARE']
const P_TREASURY   = ['TREASURY_VIEW', 'TREASURY_MANAGE', 'CASH_MANAGE', 'BANK_MANAGE']
const P_HR         = ['HR_VIEW', 'HR_MANAGE', 'PAYROLL_VIEW', 'PAYROLL_MANAGE']

/** Union of every item permission, used as the section-level gate. */
const union = (...groups: string[][]) => Array.from(new Set(groups.flat()))

// ── Role-based nav definitions ─────────────────────────────────────────────
const ALL_NAV: NavSection[] = [
  {
    labelKey: "overview",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','ACCOUNTANT','FLEET_MANAGER'],
    permissions: P_ANALYTICS,
    items: [
      { labelKey: "dashboard", path: "/admin", icon: LayoutDashboard, exact: true,
        roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','ACCOUNTANT','FLEET_MANAGER'],
        permissions: P_ANALYTICS },
    ],
  },
  {
    labelKey: "operations",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','RECEPTIONIST','MECHANIC','CAR_WASH_EMPLOYEE'],
    permissions: union(P_ORDERS, P_CUSTOMERS, P_APPOINTS, P_WORKSHOP),
    items: [
      { labelKey: "orders",       path: "/admin/orders",       icon: ShoppingCart, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER'], permissions: P_ORDERS },
      { labelKey: "customers",    path: "/admin/clients",      icon: Users, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','RECEPTIONIST'], permissions: P_CUSTOMERS },
      { labelKey: "appointments", path: "/admin/appointments", icon: CalendarDays, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','RECEPTIONIST','MECHANIC','CAR_WASH_EMPLOYEE'], permissions: P_APPOINTS },
      { labelKey: "workshop",     path: "/admin/workshop",     icon: Wrench, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','MECHANIC'], permissions: P_WORKSHOP },
    ],
  },
  {
    labelKey: "catalogStock",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','STOCK_MANAGER'],
    permissions: union(P_PRODUCTS, P_INVENTORY, P_SERVICES),
    items: [
      { labelKey: "products",   path: "/admin/products",   icon: Package, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','STOCK_MANAGER'], permissions: P_PRODUCTS },
      { labelKey: "categories", path: "/admin/categories", icon: Tag, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER'], permissions: P_CATALOG },
      { labelKey: "brands",     path: "/admin/brands",     icon: Car, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER'], permissions: P_CATALOG },
      { labelKey: "inventory",  path: "/admin/inventory",  icon: Warehouse, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','STOCK_MANAGER'], permissions: P_INVENTORY },
      { labelKey: "suppliers",  path: "/admin/suppliers",  icon: Truck, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','STOCK_MANAGER'], permissions: P_INVENTORY },
      { labelKey: "services",   path: "/admin/services",   icon: ClipboardList, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER'], permissions: P_SERVICES },
    ],
  },
  {
    labelKey: "gestionCommerciale",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','ACCOUNTANT'],
    permissions: union(P_QUOTES, P_INVOICES, P_PURCHASE, P_DELIVERY, P_PAYMENTS),
    items: [
      { labelKey: "quotes",         path: "/admin/quotes",          icon: FileText, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','ACCOUNTANT'], permissions: P_QUOTES },
      { labelKey: "invoices",       path: "/admin/invoices",        icon: Receipt, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','ACCOUNTANT'], permissions: P_INVOICES },
      { labelKey: "purchaseOrders", path: "/admin/purchase-orders", icon: ClipboardList, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','STOCK_MANAGER'], permissions: P_PURCHASE },
      { labelKey: "deliveryNotes",  path: "/admin/delivery-notes",  icon: PackageCheck, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','STOCK_MANAGER'], permissions: P_DELIVERY },
      { labelKey: "payments",       path: "/admin/payments",        icon: Wallet, roles: ['SUPER_ADMIN','BRANCH_ADMIN','MANAGER','ACCOUNTANT'], permissions: P_PAYMENTS },
    ],
  },
  {
    labelKey: "comptabiliteFiscalite",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'],
    permissions: union(P_ACCOUNTING, P_TAX),
    items: [
      { labelKey: "accounting", path: "/admin/accounting", icon: BookOpen, roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'], permissions: P_ACCOUNTING },
      { labelKey: "tax",        path: "/admin/tax",        icon: Landmark, roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'], permissions: P_TAX },
    ],
  },
  {
    labelKey: "tresorerie",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'],
    permissions: P_TREASURY,
    items: [
      { labelKey: "treasury", path: "/admin/treasury", icon: Wallet, roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'], permissions: P_TREASURY },
    ],
  },
  {
    labelKey: "rh",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'],
    permissions: P_HR,
    items: [
      { labelKey: "hr", path: "/admin/hr", icon: UserCog, roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'], permissions: P_HR },
    ],
  },
  {
    labelKey: "configuration",
    roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'],
    permissions: union(P_BRANCHES, P_USERS, P_ANALYTICS),
    items: [
      { labelKey: "branches", path: "/admin/branches", icon: Building2, roles: ['SUPER_ADMIN','BRANCH_ADMIN'], permissions: P_BRANCHES },
      { labelKey: "users",    path: "/admin/users",    icon: Users, roles: ['SUPER_ADMIN','BRANCH_ADMIN'], permissions: P_USERS },
      { labelKey: "reports",  path: "/admin/reports",  icon: BarChart3, roles: ['SUPER_ADMIN','BRANCH_ADMIN','ACCOUNTANT'], permissions: P_ANALYTICS },
    ],
  },
]


export default function AdminLayout() {
  const { t } = useTranslation()
  const { user, isAdmin, logout, loading, validateSession, hasPermission } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [sidebarOpen,       setSidebarOpen]       = useState(true)
  const [profileOpen,       setProfileOpen]        = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen]  = useState(false)

  // Every admin navigation re-validates the session server-side: a SUPER_ADMIN
  // locking this account must kick it out on the next click, not 15 minutes later.
  useEffect(() => {
    if (!loading && isAdmin) void validateSession()
  }, [location.pathname, loading, isAdmin, validateSession])

  // Wait for the session restore/refresh before deciding — otherwise a page
  // reload would bounce a valid admin to /login.
  if (loading) {
    return <BrandedLoader />
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  const role = user?.role ?? ''
  const roleLabel = t(`adminLayout.roles.${role}`, { defaultValue: role })

  // ── Filter sections and items by role OR granted permission ───────────────
  // Same rule as the backend: a match on either side is enough. Filtering on
  // the role alone is what made granted permissions look like they did nothing.
  const allowed = (roles?: string[], permissions?: string[]) =>
    (!!roles && roles.includes(role)) || (!!permissions?.length && hasPermission(...permissions))

  const navSections = ALL_NAV
    .filter(s => allowed(s.roles, s.permissions))
    .map(s => ({
      ...s,
      items: s.items.filter(i => !i.roles && !i.permissions ? true : allowed(i.roles, i.permissions)),
    }))
    .filter(s => s.items.length > 0)

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path
          : location.pathname === path || location.pathname.startsWith(path + '/')

  const handleNav = (path: string) => {
    navigate(path)
    setMobileSidebarOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex h-full flex-col bg-white">
      {/* Logo — hidden entirely when collapsed to keep the rail clean. */}
      <div className={`flex h-20 items-center gap-3 border-b border-ink-100 transition-all duration-300 ease-out-expo ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        {!collapsed && (
          <img
            src="/images/bouslamaauto.png"
            alt="Bouslama Auto"
            className="h-12 w-auto object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
      </div>

      {/* Role badge — hidden entirely when collapsed. */}
      {!collapsed && (
        <div className="border-b border-ink-100 px-5 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-[11px] font-bold text-gold-700">
            <span className="ba-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
            {roleLabel}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className={`flex-1 space-y-5 overflow-y-auto overflow-x-hidden py-4 transition-all duration-300 ease-out-expo ${collapsed ? 'px-2' : 'p-4'}`}>
        {navSections.map((section) => (
          <div key={section.labelKey}>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-2 block overflow-hidden whitespace-nowrap px-3 text-[10px] font-black uppercase tracking-widest text-ink-300"
                >
                  {t(`adminLayout.sections.${section.labelKey}`)}
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && <span aria-hidden className="mx-auto mb-2 block h-px w-6 rounded-full bg-ink-100" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon   = item.icon
                const active = isActive(item.path, !!item.exact)
                const label  = t(`adminLayout.nav.${item.labelKey}`)
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? label : undefined}
                    className={`group relative flex w-full items-center overflow-hidden rounded-xl py-2.5 text-sm font-bold transition-all duration-300 ease-out-expo ${
                      collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                    } ${
                      active
                        ? 'bg-gold-500 text-ink-900 shadow-gold-md'
                        : 'text-ink-500 hover:bg-gold-50 hover:text-gold-700 ' + (collapsed ? '' : 'hover:translate-x-0.5')
                    }`}
                  >
                    {/* Active rail — a subtle marker that reads even when the
                        gold fill is the only other cue. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-ink-900 transition-transform duration-300 ease-out-back ${
                        active ? 'scale-y-100' : 'scale-y-0'
                      }`}
                    />
                    <Icon
                      size={17}
                      className={`shrink-0 transition-transform duration-300 ease-out-back ${active ? '' : 'group-hover:scale-110'}`}
                    />
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: go to store */}
      <div className={`border-t border-ink-100 transition-all duration-300 ease-out-expo ${collapsed ? 'px-2 py-4' : 'p-4'}`}>
        <button
          onClick={() => navigate('/')}
          title={collapsed ? t('adminLayout.viewStore') : undefined}
          className={`group flex w-full items-center rounded-xl py-2.5 text-sm font-bold text-ink-500 transition-all duration-300 ease-out-expo hover:bg-gold-50 hover:text-gold-700 ${
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          }`}
        >
          <Store size={17} className="shrink-0 transition-transform duration-300 ease-out-back group-hover:scale-110" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden whitespace-nowrap"
              >
                {t('adminLayout.viewStore')}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50 text-ink-900">

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      {/* Collapsing shrinks the rail to icon-only (w-20) instead of hiding it,
          so the buttons stay reachable and their labels animate away. */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-ink-100 bg-white shadow-elev-1 transition-all duration-300 ease-out-expo lg:block ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <SidebarContent collapsed={!sidebarOpen} />
      </aside>

      {/* ── Mobile Sidebar Overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 z-50 w-72 bg-white shadow-elev-4"
            >
              <div className="absolute right-4 top-4 z-10">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label={t('adminLayout.closeMenu')}
                  className="ba-press rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-700"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ease-out-expo ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>

        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink-100 bg-white/85 px-3 shadow-elev-1 backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="ba-press rounded-xl p-2 text-ink-500 transition-colors hover:bg-gold-50 hover:text-gold-700 lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label={t('adminLayout.openMenu')}
            >
              <Menu size={20} />
            </button>
            {/* Desktop sidebar toggle */}
            <button
              className="ba-press hidden rounded-xl p-2 text-ink-500 transition-colors hover:bg-gold-50 hover:text-gold-700 lg:flex"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={t('adminLayout.toggleSidebar')}
              aria-expanded={sidebarOpen}
            >
              <Menu size={20} />
            </button>

            {/* Search */}
            <div className="hidden w-64 items-center gap-2 rounded-xl border border-ink-100 bg-gray-50 px-3 py-2 transition-all duration-300 ease-out-expo focus-within:border-gold-400 focus-within:bg-white focus-within:shadow-gold-sm sm:flex">
              <Search size={15} className="shrink-0 text-ink-300" />
              <input
                type="text"
                placeholder={t('adminLayout.searchPlaceholder')}
                className="w-full bg-transparent text-sm text-ink-800 placeholder-ink-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Right controls — the settings button is decorative for now, so it
              steps aside on the narrowest phones to leave room for the language
              toggle, the notification bell and the profile menu. The bell stays
              at every width: it is the only place a new order announces itself. */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language toggle — same persisted preference as the storefront */}
            <LanguageSwitcher variant="compact" />

            {/* Notification bell — live order feed (renders nothing for staff
                without order-read rights, mirroring the backend guard). */}
            <NotificationBell />

            {/* Settings */}
            <button className="ba-press group hidden rounded-xl p-2 text-ink-500 transition-colors hover:bg-gold-50 hover:text-gold-700 sm:block" aria-label={t('adminLayout.settings')}>
              <Settings size={18} className="transition-transform duration-500 ease-out-expo group-hover:rotate-90" />
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-gold-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-black text-ink-900 shadow-gold-sm">
                  {user?.firstName?.[0]?.toUpperCase() ?? 'A'}
                </div>
                <div className="hidden text-left md:block">
                  <p className="text-xs font-black leading-none text-ink-900">
                    {user?.firstName ?? 'Admin'} {user?.lastName ?? ''}
                  </p>
                  <span className="text-[10px] font-semibold text-ink-400">
                    {roleLabel}
                  </span>
                </div>
                <ChevronDown size={13} className={`text-ink-400 transition-transform duration-300 ease-out-expo ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full z-20 mt-2 w-52 origin-top-right rounded-2xl border border-ink-100 bg-white/95 p-1.5 shadow-elev-3 backdrop-blur-xl"
                    >
                      <div className="mb-1 border-b border-ink-100 px-3 py-2">
                        <p className="truncate text-xs font-black text-ink-900">
                          {user?.email ?? ''}
                        </p>
                        <span className="text-[10px] font-bold text-gold-700">{roleLabel}</span>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LogOut size={14} />
                        {t('adminLayout.logout')}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content — keyed on pathname so each admin page replays its
            enter animation instead of swapping in abruptly. */}
        <main key={location.pathname} className="ba-page-in flex-1 overflow-x-hidden p-4 sm:p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
