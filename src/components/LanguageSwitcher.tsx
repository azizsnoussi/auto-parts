import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import i18n, { setLanguage, type AppLanguage } from '../i18n'

const LANGS: { code: AppLanguage; label: string; short: string }[] = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English',  short: 'EN' },
]

/**
 * Two-state language toggle. The choice is persisted in localStorage by
 * `setLanguage`, so it survives reloads and applies to the whole site.
 *
 * `variant="compact"` renders a single icon button (used inside the mobile
 * drawer and the admin topbar); the default renders the FR / EN pill.
 */
export default function LanguageSwitcher({
  variant = 'default',
  className = '',
}: {
  variant?: 'default' | 'compact'
  className?: string
}) {
  const { t } = useTranslation()
  // `i18n.language` can be a region tag such as "en-GB" — normalise it so the
  // active pill highlights correctly.
  const current: AppLanguage = i18n.language?.startsWith('en') ? 'en' : 'fr'

  if (variant === 'compact') {
    const next = current === 'fr' ? 'en' : 'fr'
    const nextLabel = next === 'fr' ? t('language.french') : t('language.english')
    return (
      <button
        type="button"
        onClick={() => setLanguage(next)}
        aria-label={t('language.switchTo', { lang: nextLabel })}
        title={t('language.switchTo', { lang: nextLabel })}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-100 hover:text-[#c8a415] ${className}`}
      >
        <Globe size={16} />
        {current.toUpperCase()}
      </button>
    )
  }

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={`flex items-center gap-0.5 rounded-full border border-black/10 bg-white/60 p-0.5 ${className}`}
    >
      {LANGS.map((lang) => {
        const isActive = lang.code === current
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            aria-pressed={isActive}
            title={lang.label}
            className={`rounded-full px-2 py-0.5 text-[11px] font-black transition ${
              isActive
                ? 'bg-black text-[#c8a415] shadow-sm'
                : 'text-black/60 hover:text-black'
            }`}
          >
            {lang.short}
          </button>
        )
      })}
    </div>
  )
}
