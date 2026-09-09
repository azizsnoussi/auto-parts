import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Car, Plus, Clock, Fuel, Palette, ChevronRight, Trash2, X, Loader2, History } from 'lucide-react'
import { vehiclesApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const fuelTypes = ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG']
const transmissions = ['MANUAL', 'AUTOMATIC', 'CVT']

export default function VehiclesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [form, setForm] = useState({ brand: '', model: '', year: '', licensePlate: '', vin: '', color: '', fuel: 'GASOLINE', transmission: 'MANUAL', mileage: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles-customer', user?.customerId],
    queryFn: () => vehiclesApi.mine(),
    enabled: !!user?.customerId,
  })
  const vehicles = data?.data?.data ?? []

  const { data: historyData } = useQuery({
    queryKey: ['vehicle-history', selectedVehicle?.id],
    queryFn: () => vehiclesApi.getHistory(selectedVehicle.id),
    enabled: !!selectedVehicle,
  })
  const history = historyData?.data?.data ?? []

  const createMut = useMutation({
    mutationFn: (d: any) => vehiclesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles-customer'] })
      toast.success('Véhicule ajouté!')
      setShowForm(false)
      setForm({ brand: '', model: '', year: '', licensePlate: '', vin: '', color: '', fuel: 'GASOLINE', transmission: 'MANUAL', mileage: '' })
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de l\'ajout'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => vehiclesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles-customer'] }); toast.success('Véhicule supprimé') },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMut.mutate({
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: parseInt(form.year, 10),
      licensePlate: form.licensePlate.trim().toUpperCase(),
      vin: form.vin?.trim() || null,
      color: form.color?.trim() || null,
      fuelType: form.fuel,
      transmission: form.transmission,
      mileage: parseInt(form.mileage, 10) || 0,
    })
  }

  return (
    <div className="customer-portal min-h-screen bg-[#0a0a0f]">
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">{t('vehicle.history')}</h1>
          <p className="mt-1 text-sm text-white/40">{vehicles.length} véhicule(s) enregistré(s)</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#d4af37]/20 transition hover:shadow-[#d4af37]/40">
          <Plus size={16} /> {t('vehicle.addVehicle')}
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-white/30">
          <Car size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-bold">Aucun véhicule enregistré</p>
          <p className="text-sm mt-1">Ajoutez votre premier véhicule pour commencer</p>
          <button onClick={() => setShowForm(true)}
            className="mt-6 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] px-6 py-3 text-sm font-bold text-black">
            {t('vehicle.addVehicle')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v: any, i: number) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#d4af37]/30">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10">
                  <Car size={22} className="text-sky-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => setSelectedVehicle(v)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition">
                    <History size={13} />
                  </button>
                  <button onClick={() => deleteMut.mutate(v.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <h3 className="text-base font-black text-white">{v.brand} {v.model}</h3>
              <p className="text-xs text-white/40 mt-0.5">{v.year}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/50">
                <span className="flex items-center gap-1"><Fuel size={11} />{v.fuel}</span>
                <span className="flex items-center gap-1"><Palette size={11} />{v.color || '—'}</span>
                <span className="flex items-center gap-1"><Clock size={11} />{v.mileage?.toLocaleString()} km</span>
                <span className="font-mono font-semibold text-white/60">{v.licensePlate}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add vehicle modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0e0e18] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white">{t('vehicle.addVehicle')}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'brand', label: t('vehicle.brand'), placeholder: 'Toyota' },
                  { key: 'model', label: t('vehicle.model'), placeholder: 'Corolla' },
                  { key: 'year',  label: t('vehicle.year'),  placeholder: '2020', type: 'number' },
                  { key: 'color', label: t('vehicle.color'), placeholder: 'Blanc' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-white/40">{label}</label>
                    <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      type={type ?? 'text'} placeholder={placeholder} required={key !== 'color'}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4af37]/50" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/40">{t('vehicle.licensePlate')}</label>
                  <input value={form.licensePlate} onChange={e => setForm(f => ({ ...f, licensePlate: e.target.value }))}
                    placeholder="123TU456" required
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4af37]/50 font-mono uppercase" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/40">{t('vehicle.mileage')}</label>
                  <input value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))}
                    type="number" placeholder="50000"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4af37]/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/40">{t('vehicle.fuel')}</label>
                  <select value={form.fuel} onChange={e => setForm(f => ({ ...f, fuel: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]/50">
                    {fuelTypes.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/40">{t('vehicle.transmission')}</label>
                  <select value={form.transmission} onChange={e => setForm(f => ({ ...f, transmission: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#0e0e18] px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]/50">
                    {transmissions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={createMut.isPending}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952e] py-3 text-sm font-bold text-black disabled:opacity-60">
                {createMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Ajouter le véhicule
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Service history modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0e0e18] p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-white">{t('vehicle.timeline')}</h2>
                <p className="text-sm text-white/40">{selectedVehicle.brand} {selectedVehicle.model}</p>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="text-white/40 hover:text-white transition"><X size={20} /></button>
            </div>
            {history.length === 0 ? (
              <p className="text-center py-8 text-white/30 text-sm">Aucun historique disponible</p>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-white/10" />
                {history.map((h: any, i: number) => (
                  <div key={i} className="relative mb-5 pl-4">
                    <div className="absolute -left-3.5 top-1 h-3 w-3 rounded-full bg-[#d4af37] border-2 border-[#0e0e18]" />
                    <p className="text-xs text-white/40 mb-0.5">{h.serviceDate}</p>
                    <p className="text-sm font-bold text-white">{h.serviceType}</p>
                    <p className="text-xs text-white/50 mt-0.5">{h.description}</p>
                    {h.mileageAtService && <p className="text-xs text-white/30 mt-0.5">{h.mileageAtService.toLocaleString()} km</p>}
                    {h.cost && <p className="text-xs font-semibold text-[#d4af37] mt-0.5">{h.cost} TND</p>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
    </div>
  )
}
