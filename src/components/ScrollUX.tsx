import { useTranslation } from 'react-i18next'
import { ArrowUp } from 'lucide-react'
import { useScrollProgress } from '../hooks/useAnimations'

/**
 * Reading-progress bar pinned to the top of the viewport.
 *
 * Driven by a `scaleX` transform rather than a `width` change so it never
 * triggers layout while scrolling.
 */
export function ScrollProgress() {
  const progress = useScrollProgress()

  return (
    <div
      aria-hidden
      className="ba-progress"
      style={{ transform: `scaleX(${progress})`, opacity: progress > 0.01 ? 1 : 0 }}
    />
  )
}

/**
 * Back-to-top button. Appears past 60% of a viewport height of scrolling, which
 * is far enough that the user has committed to reading but not so far that the
 * button feels late.
 */
export function ScrollToTop() {
  const { t } = useTranslation()
  const progress = useScrollProgress()
  const visible = progress > 0.15

  return (
    <button
      type="button"
      aria-label={t('home.backToTop')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      // Kept mounted (rather than conditionally rendered) so the fade can play
      // in both directions; `pointer-events-none` stops it catching clicks while
      // it is invisible.
      className={`fixed bottom-6 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-ink-900 text-gold-400 shadow-elev-3 transition-all duration-300 hover:bg-ink-800 hover:text-gold-300 sm:bottom-8 sm:right-8 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <ArrowUp size={18} />
    </button>
  )
}
