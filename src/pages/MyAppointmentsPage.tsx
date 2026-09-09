import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, fr } from 'date-fns/locale'
import {
  AlertCircle, CalendarDays, CalendarPlus, Car, CheckCircle2,
  ChevronLeft, ChevronRight, Clock3, Loader2, MapPin, RefreshCw, Wrench, XCircle,
} from 'lucide-react'
import { appointmentsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

type AppointmentFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-sky-200 bg-sky-50 text-sky-700',
  CHECKED_IN: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  IN_PROGRESS: 'border-violet-200 bg-violet-50 text-violet-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
  NO_SHOW: 'border-slate-200 bg-slate-50 text-slate-600',
}

const PAGE_SIZE = 8

const STATUS_ICONS: Record<string, typeof CalendarDays> = {
  PENDING: Clock3,
  CONFIRMED: CheckCircle2,
  CHECKED_IN: Car,
  IN_PROGRESS: Wrench,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  NO_SHOW: AlertCircle,
}

function appointmentTimestamp(appointment: any): number {
  const date = appointment.appointmentDate
  if (!date) return 0
  return new Date(`${date}T${appointment.startTime ?? '00:00:00'}`).getTime()
}

export default function MyAppointmentsPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState<AppointmentFilter>('ALL')
  const [page, setPage] = useState(0)
  const locale = i18n.language === 'fr' ? fr : enUS

  const query = useQuery({
    queryKey: ['appts-customer', user?.customerId],
    queryFn: () => appointmentsApi.byCustomer(user!.customerId!),
    enabled: !!user?.customerId,
  })

  const appointments: any[] = query.data?.data?.data ?? []
  const sortedAppointments = useMemo(() => {
    const matches = appointments.filter((appointment) => {
      if (filter === 'UPCOMING') return !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)
      if (filter === 'COMPLETED') return appointment.status === 'COMPLETED'
      if (filter === 'CANCELLED') return ['CANCELLED', 'NO_SHOW'].includes(appointment.status)
      return true
    })
    return [...matches].sort((a, b) => appointmentTimestamp(b) - appointmentTimestamp(a))
  }, [appointments, filter])

  const filters: { key: AppointmentFilter; label: string }[] = [
    { key: 'ALL', label: t('appointments.filters.all') },
    { key: 'UPCOMING', label: t('appointments.filters.upcoming') },
    { key: 'COMPLETED', label: t('appointments.filters.completed') },
    { key: 'CANCELLED', label: t('appointments.filters.cancelled') },
  ]
  const highlightedId = Number(searchParams.get('appointmentId')) || null
  const totalPages = Math.ceil(sortedAppointments.length / PAGE_SIZE)
  const visibleAppointments = sortedAppointments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    if (!highlightedId) return
    const targetIndex = sortedAppointments.findIndex((appointment) => appointment.id === highlightedId)
    if (targetIndex >= 0) setPage(Math.floor(targetIndex / PAGE_SIZE))
  }, [highlightedId, sortedAppointments])

  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1)
  }, [page, totalPages])

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-50 to-white">
      <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
        >
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#d4af37]">
              {t('appointments.eyebrow')}
            </p>
            <h1 className="text-3xl font-black text-ink-900 sm:text-4xl">{t('appointments.title')}</h1>
            <p className="mt-2 text-sm text-ink-400">{t('appointments.subtitle')}</p>
          </div>
          <Link
            to="/appointments"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] px-5 py-3 text-sm font-black text-black shadow-lg shadow-[#d4af37]/10 transition hover:-translate-y-0.5 hover:shadow-[#d4af37]/20"
          >
            <CalendarPlus size={17} /> {t('appointments.book')}
          </Link>
        </motion.header>

        <div className="mb-6 flex flex-wrap gap-2">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(0) }}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                filter === key
                  ? 'border-gold-300 bg-gold-50 text-gold-700 shadow-sm'
                  : 'border-ink-100 bg-white text-ink-500 hover:border-gold-200 hover:text-gold-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!user?.customerId ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-16 text-center">
            <AlertCircle size={42} className="mx-auto mb-4 text-amber-500" />
            <h2 className="font-black text-ink-900">{t('appointments.noCustomerTitle')}</h2>
            <p className="mt-2 text-sm text-ink-400">{t('appointments.noCustomer')}</p>
          </div>
        ) : query.isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 size={30} className="animate-spin text-[#d4af37]" />
          </div>
        ) : query.isError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-16 text-center">
            <AlertCircle size={42} className="mx-auto mb-4 text-red-500" />
            <h2 className="font-black text-ink-900">{t('appointments.errorTitle')}</h2>
            <p className="mt-2 text-sm text-ink-400">{t('appointments.error')}</p>
            <button
              onClick={() => void query.refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-4 py-2 text-xs font-black text-ink-700 transition hover:border-gold-200"
            >
              <RefreshCw size={14} /> {t('common.retry')}
            </button>
          </div>
        ) : sortedAppointments.length === 0 ? (
          <div className="rounded-3xl border border-ink-100 bg-white px-6 py-20 text-center shadow-elev-1">
            <CalendarDays size={48} className="mx-auto mb-4 text-ink-200" />
            <h2 className="text-lg font-black text-ink-900">{t('appointments.emptyTitle')}</h2>
            <p className="mt-2 text-sm text-ink-400">{t('appointments.empty')}</p>
            <Link to="/appointments" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#d4af37] hover:text-[#f0d060]">
              <CalendarPlus size={16} /> {t('appointments.book')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAppointments.map((appointment, index) => {
              const StatusIcon = STATUS_ICONS[appointment.status] ?? CalendarDays
              const serviceName = i18n.language === 'fr'
                ? appointment.service?.nameFr ?? appointment.service?.name
                : appointment.service?.name ?? appointment.service?.nameFr

              return (
                <motion.article
                  key={appointment.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.045 }}
                  className={`group rounded-2xl border p-4 transition sm:p-5 ${
                    highlightedId === appointment.id
                      ? 'border-gold-300 bg-gold-50 shadow-elev-2 ring-2 ring-gold-100'
                      : 'border-ink-100 bg-white shadow-elev-1 hover:border-gold-200 hover:shadow-elev-2'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#d4af37]/10 text-[#d4af37] ring-1 ring-[#d4af37]/15">
                      <StatusIcon size={21} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-black text-ink-900">{serviceName || t('appointments.serviceFallback')}</h2>
                          {appointment.confirmationCode && (
                            <p className="mt-0.5 text-[11px] font-bold tracking-wider text-ink-300">
                              #{appointment.confirmationCode}
                            </p>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLES[appointment.status] ?? 'border-ink-100 bg-ink-50 text-ink-500'}`}>
                          <StatusIcon size={11} /> {t(`status.${appointment.status}`, { defaultValue: appointment.status })}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-ink-500 sm:grid-cols-3">
                        <span className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-[#d4af37]" />
                          {appointment.appointmentDate
                            ? format(new Date(`${appointment.appointmentDate}T00:00:00`), 'EEEE d MMMM yyyy', { locale })
                            : '—'}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock3 size={14} className="text-[#d4af37]" />
                          {appointment.startTime?.slice(0, 5) ?? '—'}
                          {appointment.endTime ? ` – ${appointment.endTime.slice(0, 5)}` : ''}
                        </span>
                        <span className="flex items-center gap-2">
                          <MapPin size={14} className="text-[#d4af37]" />
                          {appointment.branch?.nameFr ?? appointment.branch?.name ?? '—'}
                        </span>
                      </div>

                      {appointment.vehicle && (
                        <div className="mt-3 flex items-center gap-2 border-t border-ink-50 pt-3 text-xs text-ink-400">
                          <Car size={13} />
                          <span>{appointment.vehicle.brand} {appointment.vehicle.model}</span>
                          {appointment.vehicle.licensePlate && <span>• {appointment.vehicle.licensePlate}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.article>
              )
            })}
            {totalPages > 1 && (
              <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3 text-xs font-bold text-ink-500 shadow-elev-1">
                <span>{sortedAppointments.length} {t('appointments.title').toLocaleLowerCase(i18n.language)}</span>
                <div className="flex items-center gap-3">
                  <button disabled={page === 0} onClick={() => setPage((value) => value - 1)} aria-label={t('common.previous')}
                    className="rounded-lg border border-ink-100 p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <span>{page + 1} / {totalPages}</span>
                  <button disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)} aria-label={t('common.next')}
                    className="rounded-lg border border-ink-100 p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}