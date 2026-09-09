import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Calendar, Clock, MapPin, Car, ChevronRight, CheckCircle,
  ArrowLeft, Loader2, ChevronLeft
} from 'lucide-react'
import { branchesApi, servicesApi, appointmentsApi, vehiclesApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { format, addDays } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { buildBranchSlots, getBusinessDates, getInitialBookingDate } from '../lib/appointmentSlots'

const STEP_LABELS = ['Branch', 'Service', 'Vehicle', 'Date & Heure', 'Confirmation']

export default function AppointmentsPage() {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated } = useAuth()
  const [params] = useSearchParams()
  const locale = i18n.language === 'fr' ? fr : enUS

  const [step, setStep]             = useState(0)
  const [branchId, setBranchId]     = useState<number | null>(null)
  const [serviceId, setServiceId]   = useState<number | null>(params.get('serviceId') ? Number(params.get('serviceId')) : null)
  const [vehicleId, setVehicleId]   = useState<number | null>(null)
  const [selectedDate, setDate]     = useState<Date>(getInitialBookingDate())
  const [selectedSlot, setSlot]     = useState<string | null>(null)
  const [booked, setBooked]         = useState<any>(null)
  const [note, setNote]             = useState('')

  const { data: branchData } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const branches = branchData?.data?.data ?? []

  const { data: svcData } = useQuery({ queryKey: ['services'], queryFn: servicesApi.list })
  const services = svcData?.data?.data ?? []
  const selectedService = services.find((s: any) => s.id === serviceId)
  const selectedBranch = branches.find((b: any) => b.id === branchId)

  const { data: vehicleData } = useQuery({
    queryKey: ['vehicles-customer', user?.customerId],
    // Customer-scoped /vehicles/{customerId} is intentionally staff-only.
    // The self endpoint derives ownership from the authenticated account and
    // therefore loads existing vehicles without exposing another customer.
    queryFn: () => vehiclesApi.mine(),
    enabled: !!user?.customerId,
  })
  const vehicles = vehicleData?.data?.data ?? []

  const { data: slotsData, isFetching: loadingSlots } = useQuery({
    queryKey: ['slots', branchId, serviceId, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => appointmentsApi.getSlots({
      branchId, serviceId, date: format(selectedDate, 'yyyy-MM-dd'),
      durationMinutes: selectedService?.durationMinutes ?? 60,
    }),
    enabled: !!branchId && !!serviceId && step === 3,
  })
  const slots: string[] = buildBranchSlots(
    slotsData?.data?.data ?? [],
    selectedBranch,
    selectedService?.durationMinutes ?? 60,
  )

  const book = useMutation({
    mutationFn: (data: any) => appointmentsApi.book(data),
    onSuccess: (res) => { setBooked(res.data.data); setStep(4) },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur de réservation'),
  })

  const calDates = getBusinessDates(new Date())

  const handleBook = () => {
    if (!branchId || !serviceId || !selectedSlot || !user?.customerId || !vehicleId) return
    const [h, m] = selectedSlot.split(':').map(Number)
    const startTime = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`
    const dur = selectedService?.durationMinutes ?? 60
    const endH = Math.floor((h * 60 + m + dur) / 60)
    const endM = (h * 60 + m + dur) % 60
    const endTime = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00`
    book.mutate({
      customer: { id: user.customerId },
      branch: { id: branchId },
      service: { id: serviceId },
      vehicle: { id: vehicleId },
      appointmentDate: format(selectedDate, 'yyyy-MM-dd'),
      startTime, endTime,
      notes: note,
      status: 'PENDING',
    })
  }

  const canNext = () => {
    if (step === 0) return !!branchId
    if (step === 1) return !!serviceId
    if (step === 2) return !!vehicleId
    if (step === 3) return !!selectedSlot
    return false
  }

  if (booked) {
    return (
      <div className="customer-portal min-h-screen bg-[#0a0a0f]">
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10 text-center">
          <CheckCircle size={56} className="mx-auto mb-4 text-emerald-400" />
          <h2 className="text-2xl font-black text-white">{t('booking.success')}</h2>
          <p className="mt-2 text-white/50">Votre rendez-vous est confirmé</p>
          <div className="mt-6 rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-white/40">{t('booking.code')}</p>
            <p className="mt-1 text-2xl font-black tracking-widest text-[#d4af37]">{booked.confirmationCode}</p>
          </div>
          <div className="mt-4 space-y-2 text-sm text-white/60">
            <p>📅 {format(selectedDate, 'EEEE dd MMMM yyyy', { locale })}</p>
            <p>⏰ {selectedSlot}</p>
            <p>🔧 {i18n.language === 'fr' ? selectedService?.nameFr : selectedService?.name}</p>
          </div>
          <Link to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] px-6 py-3 text-sm font-bold text-black">
            Voir mes rendez-vous
          </Link>
        </motion.div>
      </div>
      </div>
    )
  }

  return (
    <div className="customer-portal min-h-screen bg-[#0a0a0f]">
    <div className="mx-auto max-w-2xl px-4 py-14">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#d4af37]">Réservation en ligne</p>
        <h1 className="text-3xl font-black text-white">{t('booking.title')}</h1>
      </motion.div>

      {/* Step bar */}
      <div className="mb-8 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition
              ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white/30'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded transition ${i < step ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">

        {/* STEP 0 — Branch */}
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-black text-white mb-4">{t('booking.selectBranch')}</h2>
            {branches.map((b: any) => (
              <button key={b.id} onClick={() => setBranchId(b.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${branchId === b.id ? 'border-[#d4af37]/50 bg-[#d4af37]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                <div className="flex items-start gap-3">
                  <MapPin size={18} className={branchId === b.id ? 'text-[#d4af37] mt-0.5' : 'text-white/30 mt-0.5'} />
                  <div>
                    <p className="font-bold text-white">{i18n.language === 'fr' ? b.nameFr : b.name}</p>
                    <p className="text-sm text-white/40">{b.address}, {b.city}</p>
                    <p className="text-xs text-white/30 mt-1">{b.openingTime?.slice(0,5)} – {b.closingTime?.slice(0,5)}</p>
                  </div>
                  {branchId === b.id && <CheckCircle size={18} className="ml-auto text-[#d4af37] shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP 1 — Service */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-black text-white mb-4">{t('booking.selectService')}</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {services.map((s: any) => (
                <button key={s.id} onClick={() => setServiceId(s.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${serviceId === s.id ? 'border-[#d4af37]/50 bg-[#d4af37]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-sm">{i18n.language === 'fr' ? s.nameFr : s.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span className="flex items-center gap-1"><Clock size={11} />{s.durationMinutes} min</span>
                        <span className="font-semibold text-white/60">{s.price} TND</span>
                      </div>
                    </div>
                    {serviceId === s.id && <CheckCircle size={16} className="text-[#d4af37] shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — Vehicle */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-black text-white mb-1">{t('booking.selectVehicle')}</h2>
            <p className="text-sm text-white/40 mb-4">Sélection requise pour confirmer le rendez-vous</p>
            <div className="space-y-2">
              {vehicles.map((v: any) => (
                <button key={v.id} onClick={() => setVehicleId(v.id)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${vehicleId === v.id ? 'border-[#d4af37]/50 bg-[#d4af37]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <div className="flex items-center gap-3">
                    <Car size={18} className="text-white/40" />
                    <div>
                      <p className="text-sm font-bold text-white">{v.brand} {v.model} ({v.year})</p>
                      <p className="text-xs text-white/40">{v.licensePlate}</p>
                    </div>
                    {vehicleId === v.id && <CheckCircle size={16} className="ml-auto text-[#d4af37]" />}
                  </div>
                </button>
              ))}
              {!isAuthenticated && (
                <p className="text-xs text-white/30 text-center pt-2">
                  <Link to="/login" state={{ from: '/appointments' }} className="text-[#d4af37] underline">Connectez-vous</Link> pour sélectionner un véhicule
                </p>
              )}
              {isAuthenticated && vehicles.length === 0 && (
                <p className="text-xs text-white/40 text-center pt-2">
                  Aucun véhicule disponible. Ajoutez un véhicule dans votre compte avant de réserver.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — Date & Time */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-black text-white mb-4">{t('booking.selectDate')}</h2>
            {/* Date picker */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
              {calDates.map(d => {
                const active = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                return (
                  <button key={d.toISOString()} onClick={() => { setDate(d); setSlot(null) }}
                    className={`shrink-0 flex flex-col items-center rounded-xl border p-3 w-14 transition ${active ? 'border-[#d4af37]/50 bg-[#d4af37]/15' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <span className={`text-[10px] font-bold uppercase ${active ? 'text-[#d4af37]' : 'text-white/40'}`}>
                      {format(d, 'EEE', { locale })}
                    </span>
                    <span className={`text-lg font-black ${active ? 'text-[#d4af37]' : 'text-white'}`}>
                      {format(d, 'd')}
                    </span>
                    <span className={`text-[10px] ${active ? 'text-[#d4af37]/70' : 'text-white/30'}`}>
                      {format(d, 'MMM', { locale })}
                    </span>
                  </button>
                )
              })}
            </div>

            <h3 className="text-sm font-bold text-white mb-3">{t('booking.selectTime')}</h3>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#d4af37]" />
              </div>
            ) : slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">{t('booking.noSlots')}</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((time: string) => (
                  <button key={time} onClick={() => setSlot(time)}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition ${selectedSlot === time ? 'border-[#d4af37]/50 bg-[#d4af37]/20 text-[#d4af37]' : 'border-white/10 bg-white/5 text-white hover:border-white/20'}`}>
                    {time}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs font-semibold text-white/40">Notes (optionnel)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Décrivez le problème ou votre demande..."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4af37]/50" />
            </div>
          </div>
        )}
      </motion.div>

      {/* Navigation */}
      <div className="mt-5 flex items-center justify-between">
        <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-30 transition hover:border-white/20">
          <ArrowLeft size={15} /> {t('common.previous')}
        </button>

        {step < 3 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] px-6 py-2.5 text-sm font-bold text-black disabled:opacity-40 transition hover:shadow-lg hover:shadow-[#d4af37]/20">
            {t('common.next')} <ChevronRight size={15} />
          </button>
        ) : (
          <button onClick={handleBook} disabled={!selectedSlot || book.isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] px-6 py-2.5 text-sm font-bold text-black disabled:opacity-40 transition hover:shadow-lg hover:shadow-[#d4af37]/20">
            {book.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            {t('booking.confirmBook')}
          </button>
        )}
      </div>
    </div>
    </div>
  )
}
