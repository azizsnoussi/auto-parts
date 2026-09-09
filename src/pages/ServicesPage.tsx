import type { ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Calendar, Clock, ChevronRight, Wrench } from 'lucide-react'
import { servicesApi } from '../lib/api'
import {
  OilChangeIcon, CarWashIcon, BrakeServiceIcon, DiagnosticIcon,
  AirConIcon, ElectricalIcon, BatteryIcon, EngineIcon, type IconProps,
} from '../components/icons/AutoIcons'
import { useReveal } from '../hooks/useAnimations'

/**
 * Backend `category` enum → in-house vector icon. Falls back to a wrench for
 * categories the backend adds later.
 */
const categoryIcons: Record<string, ComponentType<IconProps>> = {
  OIL_CHANGE: OilChangeIcon,
  CAR_WASH: CarWashIcon,
  ENGINE_WASH: EngineIcon,
  BRAKES: BrakeServiceIcon,
  BATTERY: BatteryIcon,
  DIAGNOSTIC: DiagnosticIcon,
  AIR_CONDITIONING: AirConIcon,
  MAINTENANCE: ElectricalIcon,
}

/** Icon-tile gradients, keyed to the same enum. */
const categoryColors: Record<string, string> = {
  OIL_CHANGE: 'from-amber-400 to-orange-500',
  CAR_WASH: 'from-sky-400 to-blue-500',
  ENGINE_WASH: 'from-emerald-400 to-green-500',
  BRAKES: 'from-red-400 to-rose-500',
  BATTERY: 'from-yellow-400 to-amber-500',
  DIAGNOSTIC: 'from-violet-400 to-purple-500',
  AIR_CONDITIONING: 'from-cyan-400 to-sky-500',
  MAINTENANCE: 'from-ink-400 to-ink-600',
}

/** One service card. Module scope because `useReveal` cannot run inside `.map`. */
function ServiceCard({
  Icon, gradient, name, desc, price, duration, bookable, to, delay,
}: {
  Icon: ComponentType<IconProps>
  gradient: string
  name: string
  desc?: string
  price: number
  duration: number
  bookable?: boolean
  to: string
  delay: number
}) {
  const ref = useReveal<HTMLDivElement>({ delay })
  return (
    <div
      ref={ref}
      className="ba-reveal ba-lift group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white p-6 shadow-elev-1 transition-colors hover:border-gold-300"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-elev-2 transition-transform duration-500 ease-out-back group-hover:scale-110 group-hover:-rotate-6`}>
          <Icon size={28} strokeWidth={1.8} />
        </div>
        {bookable && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
            <span className="ba-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> En ligne
          </span>
        )}
      </div>

      <h3 className="text-base font-black text-ink-900 transition-colors group-hover:text-gold-700">{name}</h3>
      {desc && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-400">{desc}</p>}

      <div className="mt-5 flex items-end justify-between pt-2">
        <div>
          <p className="ba-nums text-xl font-black text-ink-900">{price} TND</p>
          <div className="mt-0.5 flex items-center gap-1 text-ink-400">
            <Clock size={11} />
            <span className="ba-nums text-[11px]">{duration} min</span>
          </div>
        </div>
        <Link
          to={to}
          className="ba-press flex items-center gap-1.5 rounded-xl bg-gold-50 px-4 py-2 text-xs font-bold text-gold-700 transition-colors hover:bg-gold-500 hover:text-ink-900"
        >
          <Calendar size={13} /> Réserver
        </Link>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const { t, i18n } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  })
  const services = data?.data?.data ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-14">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14 text-center"
      >
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gold-600">Bouslama Auto</p>
        <h1 className="text-4xl font-black text-ink-900 md:text-5xl">{t('services.title')}</h1>
        <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
        <p className="mx-auto mt-4 max-w-xl text-ink-400">{t('services.subtitle')}</p>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-elev-1">
              <div className="ba-skeleton mb-4 h-14 w-14 rounded-2xl" />
              <div className="ba-skeleton h-4 w-2/3 rounded" />
              <div className="ba-skeleton mt-2 h-3 w-full rounded" />
              <div className="ba-skeleton mt-5 h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-ink-300">
          <Wrench size={44} className="mb-3 animate-bob opacity-50" />
          <p className="font-semibold text-ink-500">Aucun service disponible</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service: any, i: number) => (
            <ServiceCard
              key={service.id}
              Icon={categoryIcons[service.category] ?? ElectricalIcon}
              gradient={categoryColors[service.category] ?? 'from-ink-400 to-ink-600'}
              name={i18n.language.startsWith('fr') ? service.nameFr : service.name}
              desc={i18n.language.startsWith('fr') ? service.descriptionFr : service.description}
              price={service.price}
              duration={service.durationMinutes}
              bookable={service.bookableOnline}
              to={`/appointments?serviceId=${service.id}`}
              delay={Math.min(i, 8) * 60}
            />
          ))}
        </div>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-gold-600 via-gold-400 to-gold-600 p-10 text-center shadow-elev-3"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 ba-grid-bg opacity-40" />
          <div className="ba-blob left-[-6%] top-[-30%] h-64 w-64 bg-white/25" style={{ ['--ba-blob-dur' as string]: '24s' }} />
        </div>
        <div className="relative">
          <h2 className="text-2xl font-black text-ink-900 md:text-3xl">Besoin d'un service personnalisé ?</h2>
          <p className="mt-2 text-ink-800/80">Contactez-nous pour un devis gratuit adapté à votre véhicule.</p>
          <Link
            to="/appointments"
            className="ba-press ba-shine relative mt-6 inline-flex items-center gap-2 overflow-hidden rounded-xl bg-ink-900 px-7 py-3.5 text-sm font-bold text-white shadow-elev-3 transition-colors hover:bg-ink-800"
          >
            <Calendar size={17} /> {t('hero.bookBtn')} <ChevronRight size={16} />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
