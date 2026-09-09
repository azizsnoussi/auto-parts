import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, MapPin, Clock, Mail, Facebook, Instagram } from 'lucide-react'
import {
  DeliveryIcon, SupportIcon, BestPriceIcon, QualityIcon, type IconProps,
} from './icons/AutoIcons'
import { useReveal } from '../hooks/useAnimations'

/**
 * One trust cell. Extracted to module scope because `useReveal` is a hook and
 * cannot be called inside the `.map` below.
 */
function TrustItem({
  Icon, title, sub, link, delay,
}: {
  Icon: ComponentType<IconProps>
  title: string
  sub: string
  link?: string
  delay: number
}) {
  const ref = useReveal<HTMLDivElement>({ delay })
  return (
    <div
      ref={ref}
      className="ba-reveal group flex min-w-0 items-center justify-center gap-3 text-center sm:gap-4 md:justify-start md:text-left"
    >
      <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-gold-300 bg-white text-gold-600 shadow-elev-1 transition-all duration-300 ease-out-back group-hover:-translate-y-1 group-hover:border-gold-500 group-hover:text-gold-700 group-hover:shadow-gold-md">
        <Icon size={26} strokeWidth={1.7} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink-800">{title}</p>
        {link ? (
          <a href={link} className="ba-nums text-sm font-semibold text-gold-600 hover:text-gold-700 hover:underline break-words">
            {sub}
          </a>
        ) : (
          <p className="text-xs text-ink-400 break-words">{sub}</p>
        )}
      </div>
    </div>
  )
}

export default function Footer() {
  const { t } = useTranslation()

  return (
    <>
      {/* ── Trust strip ─────────────────────────────────────────────── */}
      <div className="ba-grid-bg-light border-t border-gold-200 bg-gold-50 py-10">
        <div className="mx-auto max-w-7xl px-4">
          {/* 1 column on very narrow phones — two columns of icon + text overflow
              below ~300px. */}
          <div className="grid grid-cols-1 gap-5 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4">
            {[
              {
                Icon: DeliveryIcon,
                title: t('footer.freeShipping'),
                sub: t('footer.freeShippingSub'),
              },
              {
                Icon: SupportIcon,
                title: t('footer.customerService'),
                sub: '(+216) 25199188',
                link: 'tel:+21625199188',
              },
              {
                Icon: BestPriceIcon,
                title: t('footer.bestPrices'),
                sub: t('footer.bestPricesSub'),
              },
              {
                Icon: QualityIcon,
                title: t('footer.bestQuality'),
                sub: t('footer.bestQualitySub'),
              },
            ].map((item, i) => (
              <TrustItem key={item.title} {...item} delay={i * 80} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Dark footer ─────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden bg-ink-900 text-ink-200 pt-14 pb-6">
        {/* Decorative depth: a faint grid plus a single gold seam at the top. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 ba-grid-bg opacity-60" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/70 to-transparent" />
          <div className="ba-blob left-[-10%] bottom-[-20%] h-72 w-72 bg-gold-500/10" style={{ ['--ba-blob-dur' as string]: '30s' }} />
        </div>
        <div className="relative mx-auto max-w-7xl px-4">
          {/* Everything is centred on phones/tablets and only switches to the
              left-aligned 4-column layout once there is room for it. */}
          <div className="grid gap-10 text-center md:grid-cols-4 md:text-left">

            {/* Contact */}
            <div>
              <h3 className="mb-4 text-base font-black text-gold-400">{t('footer.contactUs')}</h3>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start justify-center gap-2 md:justify-start">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-gold-500" />
                  Avenue Mohamed V, Sousse
                </li>
                <li className="flex items-center justify-center gap-2 md:justify-start">
                  <Mail size={14} className="shrink-0 text-gold-500" />
                  exemple@gmail.com
                </li>
                <li className="flex items-center justify-center gap-2 md:justify-start">
                  <Phone size={14} className="shrink-0 text-gold-500" />
                  <span className="ba-nums">TEL: (+216) 25199188</span>
                </li>
                <li className="flex items-start justify-center gap-2 md:justify-start">
                  <Clock size={14} className="mt-0.5 shrink-0 text-gold-500" />
                  <div className="text-center md:text-left">
                    {t('footer.hours')}:<br />
                    <span className="text-gold-500">-</span> {t('footer.monFri')}<br />
                    <span className="text-gold-500">-</span> {t('footer.saturday')}
                  </div>
                </li>
              </ul>
            </div>

            {/* Information */}
            <div>
              <h3 className="mb-4 text-base font-black text-gold-400">{t('footer.information')}</h3>
              <ul className="space-y-2.5 text-sm">
                {[
                  { to: '/', label: t('footer.aboutUs') },
                  { to: '/', label: t('footer.terms') },
                  { to: '/', label: t('footer.contactUs') },
                  { to: '/', label: t('footer.address') },
                ].map((item) => (
                  <li key={item.label} className="flex justify-center md:justify-start">
                    <Link to={item.to} className="ba-underline text-ink-200 hover:text-gold-400 transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mon Compte */}
            <div>
              <h3 className="mb-4 text-base font-black text-gold-400">{t('footer.myAccount')}</h3>
              <ul className="space-y-2.5 text-sm">
                {[
                  { to: '/profile', label: t('footer.editProfile') },
                  { to: '/orders',  label: t('footer.orderHistory') },
                  { to: '/likes', label: t('footer.favorites') },
                ].map((item) => (
                  <li key={item.label} className="flex justify-center md:justify-start">
                    <Link to={item.to} className="ba-underline text-ink-200 hover:text-gold-400 transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div>
              <h3 className="mb-4 text-base font-black text-gold-400">{t('footer.joinUs')}</h3>
              <div className="flex flex-row items-center justify-center gap-3 md:flex-col md:items-start md:justify-start">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="ba-press flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1877f2] text-white shadow-elev-2 transition-transform duration-300 ease-out-back hover:-translate-y-1 hover:rotate-3"
                >
                  <Facebook size={22} />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="ba-press flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-elev-2 transition-transform duration-300 ease-out-back hover:-translate-y-1 hover:rotate-3"
                >
                  <Instagram size={22} />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-ink-400">
            Copyright {new Date().getFullYear()} ©{' '}
            <span className="font-bold text-gold-400">BOUSLAMA AUTO</span>. {t('footer.copyright')}
          </div>
        </div>
      </footer>
    </>
  )
}
