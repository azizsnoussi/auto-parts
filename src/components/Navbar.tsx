import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ShoppingCart, Heart, User, Menu, X, Phone, LogOut,
  ChevronDown, Search, BarChart3, CalendarDays, UserRound, PackageCheck, LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAppSelector } from '../store/hooks'
import { useScrolled } from '../hooks/useAnimations'
import LanguageSwitcher from './LanguageSwitcher'
import CustomerNotificationBell from './CustomerNotificationBell'

// Labels are i18n keys resolved at render time so the menu follows the
// selected language instead of being frozen in French.
const NAV_LINKS = [
  { to: '/',            key: 'nav.home' },
  {
    key: 'navbar.autoParts',
    children: [
      { to: '/shop', key: 'navbar.allParts' },
      { to: '/shop?cat=moteur', key: 'navbar.engineParts' },
      { to: '/shop?cat=freinage', key: 'navbar.braking' },
      { to: '/shop?cat=filtration', key: 'navbar.filtration' },
    ],
  },
  {
    key: 'navbar.oilsAdditives',
    children: [
      { to: '/shop?cat=huiles', key: 'navbar.engineOils' },
      { to: '/shop?cat=additifs', key: 'navbar.additives' },
    ],
  },
  { to: '/services',     key: 'nav.services' },
  { to: '/appointments', key: 'nav.appointments' },
]

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileSection, setMobileSection] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  // Drives the compact header treatment: once the user has scrolled past the
  // top bar the header tightens up and gains a blur so content reads through it.
  const scrolled = useScrolled(40)

  // Cart count from Redux store (if available)
  const cartCount = useAppSelector((s: any) =>
    (s.cart?.items ?? s.cart?.cart ?? []).reduce((n: number, i: any) => n + (i.quantity ?? 1), 0)
  )
  const wishlistCount = useAppSelector((s) => s.wishlist.liked.length)

  // Close the mobile drawer on navigation — otherwise it stays open over the
  // new page after tapping a link.
  useEffect(() => {
    setMobileOpen(false)
    setMobileSection(null)
    setSearchOpen(false)
  }, [location.pathname, location.search])

  // Lock body scroll while the mobile drawer is open so the page behind it
  // doesn't scroll under the overlay.
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [mobileOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // Carried into /login so Login can send the user back where they were. The
  // cart is worth returning to, and /login itself never is.
  const loginState = { from: location.pathname === '/login' ? '/' : location.pathname + location.search }

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gold-500 bg-gold-sheen bg-[length:200%_100%] animate-sheen text-ink-900 text-[11px] sm:text-xs font-semibold py-2 px-3 sm:px-4">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:gap-6 text-center">
          <a href="tel:+21612345678" className="flex items-center gap-1.5 hover:opacity-80 transition">
            <Phone size={13} />
            <span className="hidden sm:inline">{t('navbar.contactUs')}</span> (+216) 12345678
          </a>
          <span className="hidden sm:inline opacity-40">–</span>
          <a href="tel:+216987654321" className="flex items-center gap-1.5 hover:opacity-80 transition">
            (+216) 987654321
          </a>
          {/* Language toggle lives here so it is reachable from every page. */}
          <LanguageSwitcher className="ml-auto sm:ml-0" />
        </div>
      </div>

      {/* ── Main header ──────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-200 ease-out ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-ink-100 shadow-elev-2'
            : 'bg-white border-gray-200 shadow-sm'
        }`}
      >
        <div
          className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4"
        >

          {/* Logo — the source image is very wide (3000x394), so cap its width
              per breakpoint or it eats the whole header row on small screens. */}
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <img
              src="/images/bouslamaauto.png"
              alt="Bouslama Auto"
              className="h-8 sm:h-10 w-auto max-w-[30vw] sm:max-w-[170px] md:max-w-[200px] lg:max-w-[240px] object-contain transition-transform duration-300 ease-out-expo group-hover:scale-[1.03]"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </Link>

          {/* Search bar — hidden below lg, replaced by a toggle button */}
          <div className="flex-1 hidden lg:flex items-center gap-2 rounded-full border-2 border-gray-200 hover:border-gold-400 focus-within:border-gold-500 focus-within:bg-white focus-within:shadow-gold-sm px-4 py-2.5 transition-all duration-300 ease-out-expo bg-gray-50 min-w-0">
            <input
              type="text"
              placeholder={t('navbar.searchPlaceholder')}
              className="flex-1 min-w-0 bg-transparent text-sm text-ink-700 placeholder-ink-300 focus:outline-none"
            />
            <button className="ba-press text-gold-600 hover:text-gold-700 transition shrink-0" aria-label={t('common.search')}>
              <Search size={20} />
            </button>
          </div>

          {/* Spacer so the icons stay right-aligned when the search bar is hidden */}
          <div className="flex-1 lg:hidden" />

          {/* Right icons */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Search toggle (below lg) */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t('navbar.openSearch')}
              aria-expanded={searchOpen}
              className="lg:hidden flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-[#c8a415] transition"
            >
              <Search size={22} strokeWidth={1.8} />
            </button>

            {/* Favourites — icon-only on mobile */}
            <Link
              to="/likes"
              className="group relative flex flex-col items-center gap-0.5 px-1.5 sm:px-2 md:px-3 py-1.5 rounded-lg hover:bg-gold-50 transition text-ink-500 hover:text-gold-600"
              aria-label={t('wishlist.title')}
            >
              <span className="relative">
                <Heart size={22} strokeWidth={1.8} className={`transition-transform duration-300 ease-out-back group-hover:scale-110 ${wishlistCount > 0 ? 'fill-red-500 text-red-500' : ''}`} />
              </span>
              <span className="hidden md:block text-[10px] font-semibold whitespace-nowrap">{t('footer.favorites')}</span>
            </Link>

            {/* Customer notifications remain a dedicated top-level control. */}
            {isAuthenticated && !isAdmin && <CustomerNotificationBell />}

            {/* Account is independent from notifications and cart. */}
            {isAuthenticated ? (
              <div className="relative group">
                <button
                  className="flex flex-col items-center gap-0.5 px-1.5 sm:px-2 md:px-3 py-1.5 rounded-lg hover:bg-gray-100 transition text-gray-600 hover:text-[#c8a415]"
                  aria-label={t('navbar.account')}
                >
                  <User size={22} strokeWidth={1.8} />
                  <span className="hidden md:block max-w-[80px] truncate text-[10px] font-semibold">
                    {user?.firstName ?? t('navbar.account')}
                  </span>
                </button>
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-gray-200 shadow-xl py-1.5 hidden group-hover:block z-50">
                  <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#c8a415]">
                    <UserRound size={14} /> {t('nav.profile')}
                  </Link>
                  <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#c8a415]">
                    <LayoutDashboard size={14} /> {t('navbar.mySpace')}
                  </Link>
                  {!isAdmin && (
                    <Link to="/my-appointments" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#c8a415]">
                      <CalendarDays size={14} /> {t('nav.myAppointments')}
                    </Link>
                  )}
                  {!isAdmin && (
                    <Link to="/orders" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#c8a415]">
                      <PackageCheck size={14} /> {t('nav.orders')}
                    </Link>
                  )}
                  {isAdmin && (
                    <Link to="/admin" className="block px-4 py-2 text-sm text-[#c8a415] font-bold hover:bg-yellow-50">
                      {t('navbar.adminSpace')}
                    </Link>
                  )}
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} /> {t('nav.logout')}
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                state={loginState}
                className="flex flex-col items-center gap-0.5 px-1.5 sm:px-2 md:px-3 py-1.5 rounded-lg hover:bg-gray-100 transition text-gray-600 hover:text-[#c8a415]"
              >
                <User size={22} strokeWidth={1.8} />
                <span className="hidden md:block text-[10px] font-semibold whitespace-nowrap">{t('auth.loginBtn')}</span>
              </Link>
            )}

            {/* Mobile / tablet menu toggle — the desktop nav row only appears at lg */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={t('navbar.menu')}
              aria-expanded={mobileOpen}
              className="lg:hidden ml-0.5 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Cart stays last among the header actions. */}
            <Link
              to="/cart"
              className="group relative flex flex-col items-center gap-0.5 px-1.5 sm:px-2 md:px-3 py-1.5 rounded-lg hover:bg-gold-50 transition text-ink-500 hover:text-gold-600"
              aria-label={t('cart.title')}
            >
              <div className="relative">
                <ShoppingCart size={22} strokeWidth={1.8} className="transition-transform duration-300 ease-out-back group-hover:-rotate-6" />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.2, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                      className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-black text-ink-900 shadow-gold-sm"
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span className="hidden md:block text-[10px] font-semibold whitespace-nowrap">{t('cart.title')}</span>
            </Link>
          </div>
        </div>

        {/* Collapsible search row for mobile / tablet */}
        <AnimatePresence initial={false}>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-gray-100 bg-white"
            >
              <div className="px-3 sm:px-4 py-3">
                <div className="flex items-center gap-2 rounded-full border-2 border-gray-200 focus-within:border-[#c8a415] bg-gray-50 px-4 py-2.5">
                  <input
                    autoFocus
                    type="text"
                    placeholder={t('navbar.searchPlaceholderShort')}
                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                  />
                  <Search size={18} className="text-[#c8a415] shrink-0" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nav menu (centered) ──────────────────────────────────────── */}
        <nav className="hidden lg:block border-t border-ink-100 bg-transparent">
          <div className="mx-auto max-w-7xl px-4 flex items-center justify-center flex-wrap">
            {NAV_LINKS.map((item) =>
              item.children ? (
                <div
                  key={item.key}
                  className="relative group"
                  onMouseEnter={() => setOpenDropdown(item.key)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button className="ba-underline flex items-center gap-1 px-3 xl:px-4 py-3 text-sm font-semibold text-ink-700 hover:text-gold-600 transition-colors whitespace-nowrap">
                    {t(item.key)}
                    <ChevronDown size={13} className="transition-transform duration-300 ease-out-expo group-hover:rotate-180" />
                  </button>
                  <AnimatePresence>
                    {openDropdown === item.key && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute top-full left-1/2 -translate-x-1/2 w-52 origin-top rounded-2xl bg-white/95 backdrop-blur-xl border border-ink-100 shadow-elev-3 p-1.5 z-50"
                      >
                        {item.children.map((child, ci) => (
                          <motion.div
                            key={child.to}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.04 + ci * 0.04, duration: 0.2 }}
                          >
                            <Link
                              to={child.to}
                              className="group/i flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-ink-600 hover:bg-gold-50 hover:text-gold-700 transition-colors"
                            >
                              {t(child.key)}
                              <span className="h-1 w-1 rounded-full bg-gold-400 opacity-0 transition-opacity group-hover/i:opacity-100" />
                            </Link>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={item.to}
                  to={item.to!}
                  className="ba-underline px-3 xl:px-4 py-3 text-sm font-semibold text-ink-700 hover:text-gold-600 transition-colors whitespace-nowrap"
                >
                  {t(item.key)}
                </Link>
              )
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="ba-underline px-3 xl:px-4 py-3 text-sm font-bold text-gold-600 hover:text-gold-700 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <BarChart3 size={14} /> {t('nav.admin')}
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* ── Mobile / tablet drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop: tapping outside closes the drawer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/40"
              aria-hidden
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="lg:hidden fixed right-0 top-0 z-50 flex h-[100dvh] w-[85vw] max-w-sm flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 shrink-0">
                <span className="text-sm font-black uppercase tracking-wide text-[#c8a415]">{t('navbar.menu')}</span>
                <div className="flex items-center gap-1">
                  <LanguageSwitcher variant="compact" />
                  <button
                    onClick={() => setMobileOpen(false)}
                    aria-label={t('common.close')}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Scrollable so long menus stay reachable on short screens */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                <div className="flex flex-col gap-1">
                  {NAV_LINKS.map((item) =>
                    item.children ? (
                      <div key={item.key}>
                        <button
                          onClick={() => setMobileSection((s) => (s === item.key ? null : item.key))}
                          aria-expanded={mobileSection === item.key}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#c8a415] transition"
                        >
                          {t(item.key)}
                          <ChevronDown
                            size={16}
                            className={`transition-transform duration-200 ${mobileSection === item.key ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {mobileSection === item.key && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-3 flex flex-col gap-0.5 border-l-2 border-yellow-100 pl-3 py-1">
                                {item.children.map((child) => (
                                  <Link
                                    key={child.to}
                                    to={child.to}
                                    onClick={() => setMobileOpen(false)}
                                    className="rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:bg-yellow-50 hover:text-[#c8a415] transition"
                                  >
                                    {t(child.key)}
                                  </Link>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link
                        key={item.to}
                        to={item.to!}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#c8a415] transition"
                      >
                        {t(item.key)}
                      </Link>
                    )
                  )}

                  <hr className="my-2 border-gray-100" />

                  <Link
                    to="/likes"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#c8a415] transition"
                  >
                    <Heart size={16} className={wishlistCount > 0 ? 'fill-red-500 text-red-500' : ''} /> {t('footer.favorites')}
                  </Link>
                  {isAuthenticated && (
                    <>
                      <Link
                        to="/profile"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#c8a415] transition"
                      >
                        <UserRound size={16} /> {t('nav.profile')}
                      </Link>
                      {!isAdmin && (
                        <Link
                          to="/my-appointments"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#c8a415] transition"
                        >
                          <CalendarDays size={16} /> {t('nav.myAppointments')}
                        </Link>
                      )}
                      {!isAdmin && (
                        <Link
                          to="/orders"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#c8a415] transition"
                        >
                          <PackageCheck size={16} /> {t('nav.orders')}
                        </Link>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-bold text-[#c8a415] hover:bg-yellow-50 transition"
                    >
                      <BarChart3 size={16} /> {t('navbar.adminSpace')}
                    </Link>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-gray-200 p-3">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-3 text-sm font-bold text-red-600 hover:bg-red-100 transition"
                  >
                    <LogOut size={16} /> {t('nav.logout')}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    state={loginState}
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#c8a415] px-3 py-3 text-sm font-bold text-white hover:bg-[#b8952e] transition"
                  >
                    <User size={16} /> {t('auth.loginBtn')}
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
