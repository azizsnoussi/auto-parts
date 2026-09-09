import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import {
  ArrowLeft, Package, Clock, Truck, CheckCircle2, ShoppingBag,
  MapPin, AlertTriangle, Loader2, Box, CircleDot
} from 'lucide-react'
import { ordersApi } from '../lib/api'

/* ────────────────────────────────────────────────────────── */
/*  Order status pipeline                                     */
/* ────────────────────────────────────────────────────────── */
const ORDER_STEPS = [
  { key: 'PENDING',    label: 'En attente',     icon: Clock,        color: 'amber'   },
  { key: 'CONFIRMED',  label: 'Confirmée',      icon: CheckCircle2, color: 'sky'     },
  { key: 'PROCESSING', label: 'En traitement',  icon: Box,          color: 'violet'  },
  { key: 'SHIPPED',    label: 'Expédiée',       icon: Truck,        color: 'blue'    },
  { key: 'DELIVERED',  label: 'Livrée',         icon: CheckCircle2, color: 'emerald' },
] as const

function getStepIndex(status: string): number {
  const idx = ORDER_STEPS.findIndex(s => s.key === status)
  return idx === -1 ? -1 : idx
}

function productLabel(item: any, language: string, index: number): string {
  const product = item.product ?? {}
  if (language === 'fr') {
    return item.productNameFr ?? product.nameFr ?? item.productName ?? product.name ?? `Article #${index + 1}`
  }
  return item.productName ?? product.name ?? item.productNameFr ?? product.nameFr ?? `Item #${index + 1}`
}

function itemTotal(item: any): number {
  const explicit = item.lineTotal ?? item.totalPrice
  return Number(explicit ?? Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0))
}

function productImage(item: any): string {
  return item.product?.imageUrl ?? item.imageUrl ?? item.product?.imageUrls?.[0] ?? '/images/placeholder.png'
}

/* ────────────────────────────────────────────────────────── */
/*  Component                                                 */
/* ────────────────────────────────────────────────────────── */
export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>()
  const { i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => ordersApi.getById(Number(id)),
    enabled: !!id,
  })

  const order = data?.data?.data ?? data?.data

  if (isLoading) {
    return (
      <div className="customer-portal min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#d4af37]" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="customer-portal min-h-screen bg-[#0a0a0f]">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-400 opacity-60" />
          <h2 className="text-xl font-black text-white">Commande introuvable</h2>
          <p className="mt-2 text-sm text-white/40">Impossible de charger les détails de cette commande.</p>
          <Link to="/orders"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white hover:border-white/20 transition">
            <ArrowLeft size={15} /> Retour aux commandes
          </Link>
        </div>
      </div>
    )
  }

  const isCancelled = order.status === 'CANCELLED'
  const currentIdx = getStepIndex(order.status)

  return (
    <div className="customer-portal min-h-screen bg-[#0a0a0f]">
      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* Back link */}
        <Link to="/orders"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-white/40 hover:text-white/70 transition">
          <ArrowLeft size={15} /> Retour aux commandes
        </Link>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10">
              <Package size={20} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{order.orderNumber ?? `Commande #${order.id}`}</h1>
              <p className="text-xs text-white/40">
                {order.createdAt && `Passée le ${format(new Date(order.createdAt), 'dd MMMM yyyy à HH:mm', { locale })}`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Cancelled Alert ────────────────────────────────── */}
        {isCancelled && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="mb-8 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <AlertTriangle size={22} className="text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-black text-red-400">Commande Annulée</p>
              <p className="text-xs text-white/40 mt-0.5">Cette commande a été annulée et ne sera pas traitée.</p>
            </div>
          </motion.div>
        )}

        {/* ── Visual Stepper ────────────────────────────────── */}
        {!isCancelled && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <h2 className="text-sm font-black text-white/60 uppercase tracking-widest mb-6">Suivi de commande</h2>

            {/* Desktop stepper */}
            <div className="hidden sm:flex items-start justify-between relative">
              {/* Progress bar background */}
              <div className="absolute top-5 left-[10%] right-[10%] h-1 rounded-full bg-white/8" />
              {/* Progress bar fill */}
              <motion.div
                className="absolute top-5 left-[10%] h-1 rounded-full bg-gradient-to-r from-[#d4af37] to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: currentIdx >= 0 ? `${(currentIdx / (ORDER_STEPS.length - 1)) * 80}%` : '0%' }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />

              {ORDER_STEPS.map((step, i) => {
                const StepIcon = step.icon
                const isCompleted = currentIdx >= 0 && i < currentIdx
                const isCurrent = i === currentIdx
                const isUpcoming = currentIdx >= 0 ? i > currentIdx : true

                return (
                  <div key={step.key} className="relative z-10 flex flex-col items-center" style={{ width: '20%' }}>
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                        isCompleted
                          ? 'border-emerald-400 bg-emerald-500/20'
                          : isCurrent
                            ? 'border-[#d4af37] bg-[#d4af37]/20 shadow-lg shadow-[#d4af37]/20'
                            : 'border-white/15 bg-white/5'
                      }`}
                    >
                      <StepIcon size={18} className={
                        isCompleted ? 'text-emerald-400' :
                        isCurrent ? 'text-[#d4af37]' :
                        'text-white/25'
                      } />
                    </motion.div>

                    {/* Pulse ring for current step */}
                    {isCurrent && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2">
                        <span className="absolute inline-flex h-10 w-10 rounded-full bg-[#d4af37]/30 animate-ping" />
                      </div>
                    )}

                    <p className={`mt-3 text-center text-xs font-bold ${
                      isCompleted ? 'text-emerald-400' :
                      isCurrent ? 'text-[#d4af37]' :
                      'text-white/30'
                    }`}>
                      {step.label}
                    </p>

                    {isCompleted && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mt-0.5 text-[10px] text-emerald-400/60">✓ Complété</motion.p>
                    )}
                    {isCurrent && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mt-0.5 text-[10px] text-[#d4af37]/70">En cours</motion.p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Mobile stepper (vertical) */}
            <div className="sm:hidden space-y-1">
              {ORDER_STEPS.map((step, i) => {
                const StepIcon = step.icon
                const isCompleted = currentIdx >= 0 && i < currentIdx
                const isCurrent = i === currentIdx

                return (
                  <motion.div key={step.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                        isCompleted
                          ? 'border-emerald-400 bg-emerald-500/20'
                          : isCurrent
                            ? 'border-[#d4af37] bg-[#d4af37]/20'
                            : 'border-white/15 bg-white/5'
                      }`}>
                        <StepIcon size={15} className={
                          isCompleted ? 'text-emerald-400' :
                          isCurrent ? 'text-[#d4af37]' :
                          'text-white/25'
                        } />
                      </div>
                      {i < ORDER_STEPS.length - 1 && (
                        <div className={`w-0.5 h-6 ${
                          isCompleted ? 'bg-emerald-400/40' : 'bg-white/8'
                        }`} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`text-sm font-bold ${
                        isCompleted ? 'text-emerald-400' :
                        isCurrent ? 'text-[#d4af37]' :
                        'text-white/30'
                      }`}>
                        {step.label}
                      </p>
                      {isCurrent && <span className="text-[10px] text-[#d4af37]/70">⬤ Étape actuelle</span>}
                      {isCompleted && <span className="text-[10px] text-emerald-400/60">✓ Complété</span>}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Order Summary Card ──────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <h2 className="text-sm font-black text-white/60 uppercase tracking-widest mb-4">Détails de la commande</h2>

          <div className="grid gap-4 sm:grid-cols-3 mb-5">
            <div className="rounded-xl bg-white/5 p-3.5">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Numéro</p>
              <p className="mt-1 text-sm font-black text-white">{order.orderNumber ?? `#${order.id}`}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3.5">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Date</p>
              <p className="mt-1 text-sm font-black text-white">
                {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy', { locale }) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3.5">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Total</p>
              <p className="mt-1 text-sm font-black text-[#d4af37]">{order.totalAmount} TND</p>
            </div>
          </div>

          {/* Items */}
          {Array.isArray(order.items) && order.items.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-white/40 mb-2">Articles ({order.items.length})</p>
              {order.items.map((item: any, index: number) => (
                <div key={item.id ?? `${item.product?.id ?? item.productId ?? 'item'}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white sm:h-20 sm:w-20">
                    <img
                      src={productImage(item)}
                      alt={productLabel(item, i18n.language, index)}
                      loading="lazy"
                      className="h-full w-full object-contain p-1.5"
                      onError={(event) => {
                        event.currentTarget.onerror = null
                        event.currentTarget.src = '/images/placeholder.png'
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-white break-words sm:text-base">
                      {productLabel(item, i18n.language, index)}
                    </p>
                    {item.product?.brand && <p className="mt-0.5 text-xs font-semibold text-white/40">{item.product.brand}</p>}
                    <p className="mt-1 text-xs text-white/40">Quantité : {item.quantity} × {Number(item.unitPrice ?? 0).toFixed(2)} TND</p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-white sm:text-base">{itemTotal(item).toFixed(2)} TND</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center">
              <p className="text-sm font-semibold text-white/40">Aucun article disponible pour cette commande.</p>
            </div>
          )}
        </motion.div>

        {/* ── Shipping Address ───────────────────────────── */}
        {order.shippingAddress && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-[#d4af37]" />
              <h2 className="text-sm font-black text-white/60 uppercase tracking-widest">Adresse de livraison</h2>
            </div>
            <p className="text-sm text-white/60">{order.shippingAddress}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
