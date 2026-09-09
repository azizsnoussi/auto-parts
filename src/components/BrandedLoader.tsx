import { useTranslation } from 'react-i18next'

/**
 * Full-screen branded loader used for route suspense and auth revalidation.
 *
 * Replaces the bare `<div>Chargement...</div>` fallbacks. The spinner is a
 * rotating conic gradient rather than a border trick, which stays smooth at any
 * size, and the brand mark counter-rotates so the wordmark stays upright.
 */
export default function BrandedLoader({ label }: { label?: string }) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-screen flex-col items-center justify-center gap-6 bg-ink-900"
    >
      <div className="relative h-20 w-20">
        {/* Rotating gold arc. */}
        <div
          className="animate-spin-slow absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, #c8a415 300deg, #e6d374 360deg)',
            // Punch out the middle so the gradient reads as a ring.
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)',
          }}
        />
        {/* Static faint track behind it. */}
        <div className="absolute inset-0 rounded-full border-[3px] border-white/[0.07]" />
        {/* Brand mark. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="animate-bob text-lg font-black tracking-tighter text-gold-500">BA</span>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
        {label ?? t('common.loading')}
      </p>
    </div>
  )
}

/**
 * Inline variant for panels and cards, where a full-screen takeover would be
 * disproportionate.
 */
export function InlineLoader({ label }: { label?: string }) {
  const { t } = useTranslation()

  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-12">
      <span
        className="animate-spin-slow h-6 w-6 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, #c8a415 300deg, #e6d374 360deg)',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 0)',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 0)',
        }}
      />
      <span className="text-sm font-semibold text-ink-400">{label ?? t('common.loading')}</span>
    </div>
  )
}
