import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import {
  Calendar, Car, ShoppingBag, Star, ArrowRight, Plus,
  Clock, CheckCircle, AlertCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { appointmentsApi, vehiclesApi, ordersApi, loyaltyApi } from '../lib/api'

const statusColors: Record<string, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-400',
  CONFIRMED: 'bg-sky-500/20 text-sky-400',
  CHECKED_IN: 'bg-cyan-500/20 text-cyan-400',
  PROCESSING: 'bg-violet-500/20 text-violet-400',
  IN_PROGRESS: 'bg-violet-500/20 text-violet-400',
  SHIPPED: 'bg-blue-500/20 text-blue-400',
  DELIVERED: 'bg-emerald-500/20 text-emerald-400',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
  REFUNDED: 'bg-orange-500/20 text-orange-400',
  NO_SHOW: 'bg-gray-500/20 text-gray-400',
}

const UPCOMING_APPOINTMENT_STATUSES = new Set(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'])

export default function CustomerDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS

  // Customer-scoped endpoints key off the `customers` row, which has its own id.
  const customerId = user?.customerId

  const { data: apptData } = useQuery({
    queryKey: ['appts-customer', customerId],
    queryFn: () => appointmentsApi.byCustomer(customerId!),
    enabled: !!customerId,
  })
  const appointments = apptData?.data?.data ?? []
  const upcoming = appointments.filter((a: any) => UPCOMING_APPOINTMENT_STATUSES.has(a.status)).slice(0, 3)

  const { data: vehicleData } = useQuery({
    queryKey: ['vehicles-customer', customerId],
    queryFn: () => vehiclesApi.mine(),
    enabled: !!customerId,
  })
  const vehicles = vehicleData?.data?.data ?? []

  const { data: orderData } = useQuery({
    queryKey: ['orders-customer', customerId],
    queryFn: () => ordersApi.byCustomer(customerId!),
    enabled: !!customerId,
  })
  const orders = orderData?.data?.data?.content ?? []
  const recentOrders = orders.slice(0, 3)

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty', customerId],
    queryFn: () => loyaltyApi.mine(),
    enabled: !!customerId,
  })
  const loyalty = loyaltyData?.data?.data

  const statCards = [
    { label: t('dashboard.loyaltyPoints'), value: loyalty?.currentPoints ?? 0,
      icon: Star, color: 'from-[#d4af37]/20 to-[#d4af37]/5 border-[#d4af37]/20', iconColor: 'text-[#d4af37]' },
    { label: t('dashboard.totalOrders'), value: orders.length,
      icon: ShoppingBag, color: 'from-violet-500/20 to-violet-500/5 border-violet-500/20', iconColor: 'text-violet-400' },
    { label: t('dashboard.vehicles'), value: vehicles.length,
      icon: Car, color: 'from-sky-500/20 to-sky-500/5 border-sky-500/20', iconColor: 'text-sky-400' },
    { label: 'Rendez-vous', value: upcoming.length,
      icon: Calendar, color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20', iconColor: 'text-emerald-400' },
  ]

  return (
    <div className="customer-portal min-h-screen bg-[#0a0a0f]">
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="text-sm text-white/40">{t('dashboard.welcome')},</p>
        <h1 className="text-3xl font-black text-white">{user?.firstName} {user?.lastName} 👋</h1>
      </motion.div>

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color, iconColor }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`rounded-2xl border bg-gradient-to-br ${color} p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/40">{label}</p>
                <p className="mt-1 text-3xl font-black text-white">{value}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                <Icon size={18} className={iconColor} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming appointments */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-white">{t('dashboard.nextAppt')}</h2>
            <Link to="/appointments" className="flex items-center gap-1 text-xs font-semibold text-[#d4af37] hover:text-[#f0d060] transition">
              {t('dashboard.bookNow')} <Plus size={12} />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-white/30">
              <Calendar size={36} className="mb-3 opacity-50" />
              <p className="text-sm">{t('dashboard.noAppt')}</p>
              <Link to="/appointments"
                className="mt-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] px-5 py-2 text-xs font-bold text-black">
                {t('dashboard.bookNow')}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((appt: any) => (
                <div key={appt.id} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/5 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d4af37]/10">
                    <Calendar size={18} className="text-[#d4af37]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {i18n.language === 'fr' ? appt.service?.nameFr : appt.service?.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                      <span className="flex items-center gap-1"><Clock size={10} />
                        {appt.startTime?.slice(0,5)}
                      </span>
                      <span>{appt.appointmentDate && format(new Date(appt.appointmentDate), 'dd MMM', { locale })}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusColors[appt.status] ?? 'bg-white/10 text-white/40'}`}>
                    {t(`adminShared.appointmentStatus.${appt.status}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loyalty card */}
        <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-br from-[#d4af37]/15 via-[#d4af37]/5 to-transparent p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star size={18} className="text-[#d4af37]" />
            <h2 className="font-black text-white">Programme Fidélité</h2>
          </div>
          <div className="text-center py-4">
            <p className="text-5xl font-black text-[#d4af37]">{loyalty?.currentPoints ?? 0}</p>
            <p className="text-sm text-white/40 mt-1">points disponibles</p>
          </div>
          <div className="mt-2 rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/40">{t('dashboard.currentTier')}</p>
            <p className="mt-0.5 text-sm font-black text-white">
              {t(`dashboard.tiers.${loyalty?.tier ?? 'BRONZE'}`)}
            </p>
          </div>
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/40">{t('dashboard.totalPointsEarned')}</p>
            <p className="mt-0.5 text-sm font-bold text-white">{loyalty?.totalPointsEarned ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Vehicles */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-white">{t('dashboard.vehicles')}</h2>
          <Link to="/vehicles" className="flex items-center gap-1 text-xs font-semibold text-[#d4af37] hover:text-[#f0d060] transition">
            Gérer <ArrowRight size={12} />
          </Link>
        </div>
        {vehicles.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-white/30">
            <Car size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Aucun véhicule enregistré</p>
            <Link to="/vehicles"
              className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:border-white/20">
              Ajouter un véhicule
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v: any) => (
              <div key={v.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                  <Car size={18} className="text-sky-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{v.brand} {v.model}</p>
                  <p className="text-xs text-white/40">{v.year} • {v.licensePlate}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-white">{t('dashboard.totalOrders')}</h2>
            <Link to="/orders" className="text-xs font-semibold text-[#d4af37] hover:text-[#f0d060] transition">
              {t('dashboard.viewHistory')}
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((o: any) => (
              <div key={o.id} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/5 px-4 py-3">
                <ShoppingBag size={16} className="text-white/40" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{o.orderNumber}</p>
                  <p className="text-xs text-white/40">{o.createdAt && format(new Date(o.createdAt), 'dd MMM yyyy', { locale })}</p>
                </div>
                <p className="text-sm font-black text-white">{o.totalAmount} TND</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[o.status] ?? 'bg-white/10 text-white/40'}`}>
                  {t(`adminShared.orderStatus.${o.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
