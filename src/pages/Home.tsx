import { useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useDispatch } from 'react-redux'
import {
  Search, ArrowRight, ShoppingCart, Star, Phone, Calendar,
  Loader2, Package, Car, ChevronDown, Truck, ShieldCheck, Boxes,
} from 'lucide-react'
import { productsApi, brandsApi } from '../lib/api'
import { addToCart } from '../store/slices/cartSlice'
import {
  PART_FAMILY_ICONS, SERVICE_ICONS,
  type IconProps, type PartFamilyKey, type ServiceKey,
} from '../components/icons/AutoIcons'
import { useReveal, useSpotlight, useCountUp, useTilt } from '../hooks/useAnimations'
import WishlistButton from '../components/WishlistButton'

// ── Part families ────────────────────────────────────────────────────────
// `key` maps into the i18n `partFamilies.*` namespace and into
// PART_FAMILY_ICONS; `cat` is the shop filter slug.
//
// Icons are local inline SVG (see AutoIcons.tsx). The previous CDN PNGs mixed
// flat-fill and outline art from different authors, went blurry above ~32px and
// depended on an external host staying up.
const PART_FAMILIES: { key: PartFamilyKey; cat: string }[] = [
  { key: 'engine',      cat: 'moteur' },
  { key: 'suspension',  cat: 'suspension' },
  { key: 'filtration',  cat: 'filtration' },
  { key: 'braking',     cat: 'freinage' },
  { key: 'clutch',      cat: 'embrayage' },
  { key: 'thermal',     cat: 'clim' },
  { key: 'starting',    cat: 'demarrage' },
  { key: 'bodywork',    cat: 'carrosserie' },
  { key: 'interior',    cat: 'habitacle' },
  { key: 'wipers',      cat: 'essuie' },
  { key: 'rearWipers',  cat: 'essuie-ar' },
  { key: 'exhaust',     cat: 'echappement' },
]

// Each service keeps a two-stop gradient for its icon tile so the row reads as
// six distinct services at a glance instead of six identical gold squares.
const SERVICES: { key: ServiceKey; gradient: string }[] = [
  { key: 'oilChange',  gradient: 'from-amber-400 to-orange-500' },
  { key: 'wash',       gradient: 'from-sky-400 to-blue-600' },
  { key: 'brakes',     gradient: 'from-red-400 to-rose-600' },
  { key: 'diagnostic', gradient: 'from-violet-400 to-purple-600' },
  { key: 'ac',         gradient: 'from-cyan-400 to-teal-600' },
  { key: 'electrical', gradient: 'from-yellow-400 to-amber-600' },
]

/** Animated statistic. Counting starts when the element scrolls into view. */
function Stat({ target, suffix = '', label, delay }: { target: number; suffix?: string; label: string; delay: number }) {
  const { ref, value } = useCountUp(target)
  const revealRef = useReveal<HTMLDivElement>({ delay })

  return (
    <div ref={revealRef} className="ba-reveal">
      <p className="ba-nums text-3xl font-black text-gold-500 sm:text-4xl">
        <span ref={ref}>{value.toLocaleString('fr-TN')}</span>{suffix}
      </p>
      <p className="mt-1.5 text-xs font-semibold text-ink-500 sm:text-sm">{label}</p>
    </div>
  )
}

/** Section heading with a gold rule, revealed on scroll. */
function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const ref = useReveal<HTMLDivElement>()

  return (
    <div ref={ref} className="ba-reveal mb-10 text-center">
      <h2 className="text-2xl font-black uppercase tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
      <span className="mx-auto mt-3 block h-[3px] w-16 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
      {subtitle && <p className="mx-auto mt-3 max-w-xl text-sm text-ink-400">{subtitle}</p>}
    </div>
  )
}

/**
 * Part-family tile. A separate component because the 3D tilt needs one hook
 * instance per card, and hooks cannot be called inside a `.map` callback.
 */
function PartFamilyCard({ to, label, Icon, delay }: {
  to: string
  label: string
  Icon: ComponentType<IconProps>
  delay: number
}) {
  const revealRef = useReveal<HTMLDivElement>({ delay })
  const { ref: tiltRef, transform } = useTilt<HTMLAnchorElement>(9)

  return (
    <div ref={revealRef} className="ba-reveal h-full">
      <Link
        ref={tiltRef}
        to={to}
        style={{ transform }}
        className="ba-lift ba-spotlight group flex h-full flex-col items-center gap-3 rounded-2xl border border-ink-100 bg-white p-5 text-center shadow-elev-1 hover:border-gold-300 hover:shadow-elev-3"
      >
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-50 to-ink-100 text-ink-500 transition-all duration-500 group-hover:from-gold-100 group-hover:to-gold-200 group-hover:text-gold-600">
          <Icon size={38} strokeWidth={1.6} />
        </span>
        <p className="text-xs font-bold leading-tight text-ink-700 transition-colors group-hover:text-gold-600">
          {label}
        </p>
      </Link>
    </div>
  )
}

/** Service tile. Same one-hook-per-card reason as `PartFamilyCard`. */
function ServiceCard({ label, Icon, gradient, delay }: {
  label: string
  Icon: ComponentType<IconProps>
  gradient: string
  delay: number
}) {
  const ref = useReveal<HTMLDivElement>({ delay })

  return (
    <div ref={ref} className="ba-reveal ba-reveal-zoom h-full">
      <Link
        to="/services"
        className="ba-lift group flex h-full flex-col items-center gap-3 rounded-2xl border border-ink-100 bg-white p-5 text-center shadow-elev-1 hover:border-gold-300 hover:shadow-elev-3"
      >
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-elev-2 transition-all duration-500 group-hover:-rotate-6 group-hover:scale-110 group-hover:shadow-elev-4`}
        >
          <Icon size={30} strokeWidth={1.8} />
        </span>
        <p className="text-xs font-bold text-ink-700 transition-colors group-hover:text-gold-600">{label}</p>
      </Link>
    </div>
  )
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const [selectedBrand, setSelectedBrand] = useState('')
  const heroSpotlight = useSpotlight<HTMLElement>()

  // Fetch popular products from DB
  const { data: popularData, isLoading: loadingPopular } = useQuery({
    queryKey: ['popular-products'],
    queryFn: () => productsApi.popular(8),
    staleTime: 1000 * 60 * 10,
  })
  const popularProducts: any[] = popularData?.data?.data ?? []

  // Brands are entered by an administrator (name + logo) rather than hardcoded,
  // so the carousel is driven entirely by the database.
  const { data: brandsData, isLoading: loadingBrands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.list(true),
    staleTime: 1000 * 60 * 5,
  })
  const brands: any[] = brandsData?.data?.data ?? []

  return (
    <div className="bg-white">

      {/* ══ Hero ═════════════════════════════════════════════════════════
          A dark stage so the gold reads as premium instead of washed out.
          Depth is built from three cheap layers rather than a hero photo:
          drifting blurred blobs, a faint engineering grid, and a spotlight
          that tracks the cursor. All three are transform/opacity only. */}
      <section
        ref={heroSpotlight}
        className="ba-spotlight relative isolate overflow-hidden bg-ink-900 px-4 pb-20 pt-16 sm:pb-28 sm:pt-24"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="ba-grid-bg absolute inset-0 opacity-60" />
          <div className="ba-blob left-[-10%] top-[-15%] h-72 w-72 bg-gold-500/25 sm:h-96 sm:w-96"
               style={{ ['--ba-blob-dur' as any]: '22s' }} />
          <div className="ba-blob right-[-8%] top-[20%] h-64 w-64 bg-amber-300/15 sm:h-80 sm:w-80"
               style={{ ['--ba-blob-dur' as any]: '28s' }} />
          {/* Fades into the white section below so the seam is invisible. */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-300 backdrop-blur-sm sm:text-xs"
          >
            <span className="relative flex h-1.5 w-1.5 text-gold-400">
              <span className="ba-pulse-dot absolute inset-0 rounded-full" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-gold-400" />
            </span>
            {t('home.heroBadge')}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            {t('home.heroTitleLine1')}
            <br />
            <span className="ba-gold-text">{t('home.heroTitleGold')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base"
          >
            {t('home.heroSubtitle')}
          </motion.p>

          {/* Primary action on the page. */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-9 flex max-w-2xl items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] p-1.5 backdrop-blur-md transition-colors focus-within:border-gold-500/60 hover:border-white/25 sm:gap-3 sm:p-2"
          >
            <Search size={18} className="ml-3 shrink-0 text-white/40" />
            <input
              type="text"
              aria-label={t('home.searchPlaceholder')}
              placeholder={t('home.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/35 focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') window.location.href = '/shop' }}
            />
            <Link
              to="/shop"
              className="ba-press ba-shine shrink-0 rounded-full bg-gold-500 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-ink-900 shadow-gold-md hover:bg-gold-400 sm:px-7 sm:text-sm"
            >
              {t('common.search')}
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/appointments"
              className="ba-press inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-xs font-bold text-white hover:border-gold-500/50 hover:bg-white/5 sm:text-sm"
            >
              <Calendar size={16} /> {t('home.heroCtaBook')}
            </Link>
            <Link
              to="/shop"
              className="ba-press group inline-flex items-center gap-2 rounded-full px-4 py-3 text-xs font-bold text-gold-300 hover:text-gold-200 sm:text-sm"
            >
              {t('home.heroCtaShop')}
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.44 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[11px] font-semibold text-white/45 sm:text-xs"
          >
            {[
              { Icon: Boxes, label: t('home.heroTrustParts') },
              { Icon: Truck, label: t('home.heroTrustDelivery') },
              { Icon: ShieldCheck, label: t('home.heroTrustWarranty') },
            ].map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon size={16} className="text-gold-500/70" />
                {label}
              </li>
            ))}
          </motion.ul>

          <ChevronDown aria-hidden size={20} className="ba-scroll-hint mx-auto mt-10 hidden text-white/25 sm:block" />
        </div>
      </section>


      {/* ── Brand carousel ─────────────────────────────────────────────── */}
      <section className="overflow-hidden bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeading title={t('home.brandsTitle')} subtitle={t('home.brandsSubtitle')} />

          {loadingBrands ? (
            <div className="flex items-center justify-center gap-4 rounded-3xl bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 px-3 py-12">
              <Loader2 size={20} className="animate-spin text-white" />
              <span className="text-sm font-bold text-white">{t('common.loading')}</span>
            </div>
          ) : brands.length === 0 ? (
            /* No brands configured yet — an administrator adds them from the panel. */
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-gold-200 bg-gold-50 px-4 py-14 text-center">
              <Car size={34} className="animate-bob text-gold-500 opacity-70" />
              <p className="text-sm font-bold text-ink-500">{t('home.brandsEmpty')}</p>
            </div>
          ) : (
            <div className="relative rounded-3xl bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 px-3 py-7 shadow-elev-3 sm:px-6 sm:py-9">
              {/* Inner highlight — reads as a raised surface rather than a flat fill. */}
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl shadow-inner-hi" />
              {/* Auto-scrolling marquee (pure CSS). The list is rendered twice so
                  the -50% translation loops seamlessly. */}
              <div className="ba-marquee" style={{ ['--ba-marquee-duration' as any]: '40s' }}>
                <div className="ba-marquee-track">
                  {[...brands, ...brands].map((brand, i) => (
                    <button
                      key={`${brand.id}-${i}`}
                      type="button"
                      onClick={() => setSelectedBrand(brand.name)}
                      aria-label={t('home.filterByBrand', { brand: brand.name })}
                      // The duplicated half is decorative — hide it from screen readers.
                      aria-hidden={i >= brands.length}
                      tabIndex={i >= brands.length ? -1 : 0}
                      className={`ba-marquee-item ba-press flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 px-2 py-4 transition-all duration-300 hover:-translate-y-1.5 sm:px-3 sm:py-5 ${
                        selectedBrand === brand.name
                          ? 'border-white bg-white shadow-elev-3'
                          : 'border-transparent bg-white/15 backdrop-blur-sm hover:bg-white/25'
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-elev-1 sm:h-16 sm:w-16">
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl}
                            alt={brand.name}
                            className="h-9 w-9 object-contain sm:h-12 sm:w-12"
                            loading="lazy"
                            // A dead logo URL would otherwise leave a broken-image
                            // icon on the storefront; fall back to initials.
                            onError={(e) => { (e.currentTarget.style.display = 'none') }}
                          />
                        ) : (
                          <span className="text-xs font-black text-gold-500 sm:text-sm">
                            {(brand.name ?? '?').slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className={`text-center text-[11px] font-bold leading-tight sm:text-xs ${
                        selectedBrand === brand.name ? 'text-gold-600' : 'text-white'
                      }`}>
                        {brand.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <section className="ba-grid-bg-light border-y border-gold-200/60 bg-gold-50 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              { target: 5000,  suffix: '+',                   label: t('home.statsClients') },
              { target: 12000, suffix: '+',                   label: t('home.statsServices') },
              { target: 15,    suffix: ' ' + t('home.years'), label: t('home.statsExperience') },
              { target: 48,    suffix: 'h',                   label: t('home.statsDelivery') },
            ].map((s, i) => (
              <Stat key={s.label} {...s} delay={i * 90} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Part families grid ─────────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeading title={t('home.partFamiliesTitle')} subtitle={t('home.partFamiliesSubtitle')} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {PART_FAMILIES.map(({ key, cat }, i) => (
              <PartFamilyCard
                key={key}
                to={`/shop?cat=${cat}`}
                label={t(`partFamilies.${key}`)}
                Icon={PART_FAMILY_ICONS[key]}
                delay={i * 45}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Services section ─────────────────────────────────────────────── */}
      <section className="ba-grid-bg-light bg-gold-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeading title={t('services.title')} subtitle={t('home.servicesSubtitle')} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SERVICES.map(({ key, gradient }, i) => (
              <ServiceCard
                key={key}
                label={t(`homeServices.${key}`)}
                Icon={SERVICE_ICONS[key]}
                gradient={gradient}
                delay={i * 60}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/appointments"
              className="ba-press ba-shine inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-600 to-gold-400 px-8 py-3.5 text-sm font-bold text-ink-900 shadow-gold-md hover:shadow-gold-lg"
            >
              <Calendar size={17} /> {t('hero.bookBtn')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured products strip ──────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-ink-900 sm:text-3xl">
                {t('home.popularTitle')}
              </h2>
              <span className="mt-3 block h-[3px] w-16 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
              <p className="mt-3 text-sm text-ink-400">{t('home.popularSubtitle')}</p>
            </div>
            <Link
              to="/shop"
              className="ba-underline group flex items-center gap-1.5 pb-1 text-sm font-bold text-gold-600 hover:text-gold-700"
            >
              {t('home.viewAll')}
              <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid auto-rows-fr grid-cols-2 gap-5 lg:grid-cols-4">
            {loadingPopular ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-elev-1">
                  <div className="ba-skeleton mb-3 h-40 rounded-xl" />
                  <div className="ba-skeleton mb-2 h-3 w-3/4 rounded" />
                  <div className="ba-skeleton mb-2 h-3 w-1/2 rounded" />
                  <div className="ba-skeleton mt-3 h-5 w-1/3 rounded" />
                  <div className="ba-skeleton mt-3 h-10 w-full rounded-full" />
                </div>
              ))
            ) : popularProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center py-14 text-ink-300">
                <Package size={40} className="mb-3 opacity-50" />
                <p className="text-sm font-bold">{t('home.noPopular')}</p>
              </div>
            ) : (
              popularProducts.map((product: any, i: number) => {
                const displayName = i18n.language.startsWith('fr') ? (product.nameFr || product.name) : product.name
                const hasDiscount = product.discountedPrice && product.discountedPrice < product.price
                const displayPrice = hasDiscount ? product.discountedPrice : product.price
                const inStock = (product.stockQuantity ?? 0) > 0
                const imageUrl = product.imageUrl || (product.imageUrls?.length > 0 ? product.imageUrls[0] : null)

                return (
                  <motion.article
                    key={product.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                    className="ba-lift group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-4 shadow-elev-1 hover:border-gold-300 hover:shadow-elev-4"
                  >
                    {/* Product image */}
                    <div className="relative mb-3 shrink-0">
                      <Link to={`/shop/${product.id}`} className="ba-shine block rounded-xl">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={displayName}
                            loading="lazy"
                            className="h-40 w-full rounded-xl bg-ink-50 object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-xl bg-ink-50">
                            <Package size={40} className="text-ink-200" />
                          </div>
                        )}
                      </Link>
                      {product.promoLabel && (
                        <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-black text-white shadow-elev-2">
                          {product.promoLabel}
                        </span>
                      )}
                      <WishlistButton
                        productId={product.id}
                        iconSize={14}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-ink-100 bg-white text-ink-300 shadow-elev-1 transition-all duration-300 hover:scale-110 hover:border-red-200 hover:text-red-500"
                      />
                    </div>

                    {/* Brand */}
                    <span className={`h-4 truncate text-xs font-black italic tracking-tight ${product.brand ? 'text-blue-900' : 'text-ink-200'}`}>
                      {product.brand || '—'}
                    </span>
                    <Link
                      to={`/shop/${product.id}`}
                      className="mt-1 min-h-[2.25rem] text-xs font-semibold leading-snug text-ink-800 line-clamp-2 transition-colors hover:text-gold-600"
                    >
                      {displayName || '—'}
                    </Link>
                    <p className={`mt-1 h-4 truncate text-[10px] font-bold ${product.sku ? 'text-gold-600' : 'text-ink-200'}`}>
                      {t('home.ref')} : {product.sku || '—'}
                    </p>
                    <p className={`mt-1 flex h-4 items-center gap-1.5 text-[10px] font-bold ${inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {inStock ? t('shop.inStock') : t('shop.outOfStock')}
                    </p>
                    <div className="mt-1.5 flex h-4 items-center gap-1">
                      <Star size={11} className={(product.reviewCount ?? 0) > 0 ? 'fill-gold-500 text-gold-500' : 'text-ink-200'} />
                      <span className="ba-nums text-[10px] font-semibold text-ink-400">
                        {(product.reviewCount ?? 0) > 0
                          ? t('wishlist.reviewSummary', { rating: Number(product.averageRating ?? 0).toFixed(1), count: product.reviewCount })
                          : t('wishlist.noReviews')}
                      </span>
                    </div>

                    <div className="mt-3 flex h-7 items-baseline gap-2">
                      <p className="ba-nums text-lg font-black text-ink-900">
                        {Number(displayPrice ?? 0).toFixed(2)} TND
                        <span className="ml-1 text-[10px] font-semibold text-ink-300">TTC</span>
                      </p>
                      <p className={`ba-nums text-xs text-ink-300 ${hasDiscount ? 'line-through' : 'invisible'}`}>
                        {Number(product.price ?? 0).toFixed(2)} TND
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!inStock}
                      onClick={() => dispatch(addToCart({
                        id: product.id,
                        name: product.name,
                        nameFr: product.nameFr,
                        brand: product.brand ?? '',
                        price: Number(product.price ?? 0),
                        discountedPrice: product.discountedPrice ? Number(product.discountedPrice) : undefined,
                        imageUrl: imageUrl ?? undefined,
                        stockQuantity: product.stockQuantity ?? 0,
                      }))}
                      className="ba-press mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 py-2.5 text-sm font-bold text-ink-900 shadow-gold-sm hover:bg-gold-400 hover:shadow-gold-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                      <ShoppingCart size={15} /> {t('shop.addToCart')}
                    </button>
                  </motion.article>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-gradient-to-r from-gold-600 via-gold-400 to-gold-500 py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="ba-grid-bg absolute inset-0 opacity-40" />
          <div className="ba-blob left-[12%] top-[-30%] h-64 w-64 bg-white/25"
               style={{ ['--ba-blob-dur' as any]: '24s' }} />
          <div className="ba-blob bottom-[-40%] right-[8%] h-72 w-72 bg-ink-900/10"
               style={{ ['--ba-blob-dur' as any]: '30s' }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-black tracking-tight text-ink-900 md:text-5xl"
          >
            {t('home.ctaTitle')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-4 max-w-xl font-medium text-ink-900/70"
          >
            {t('home.ctaSubtitle')}
          </motion.p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link
              to="/shop"
              className="ba-press ba-shine flex items-center gap-2 rounded-full bg-ink-900 px-8 py-3.5 text-sm font-bold text-white shadow-elev-3 hover:bg-ink-800"
            >
              <ShoppingCart size={17} /> {t('home.ctaShop')}
            </Link>
            <a
              href="tel:+21625199188"
              className="ba-press flex items-center gap-2 rounded-full border-2 border-ink-900 px-8 py-3.5 text-sm font-bold text-ink-900 hover:bg-ink-900/10"
            >
              <Phone size={17} /> {t('home.ctaCall')}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
