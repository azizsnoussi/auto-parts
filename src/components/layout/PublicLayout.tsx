import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../Navbar'
import Footer from '../Footer'
import { ScrollProgress, ScrollToTop } from '../ScrollUX'

export default function PublicLayout() {
  const { pathname } = useLocation()

  // React Router keeps the scroll position across navigations, which lands the
  // user mid-page on a brand-new route. Reset it on every path change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-800">
      <ScrollProgress />
      <Navbar />
      {/* `key` remounts the wrapper per route, which restarts the enter
          animation. Cheaper and more predictable than AnimatePresence here,
          since there is no exit animation to wait for. */}
      <main key={pathname} className="ba-page-in flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  )
}

