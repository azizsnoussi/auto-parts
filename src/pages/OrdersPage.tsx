import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { ShoppingBag, Package, Clock, ChevronDown, ChevronUp, ListChecks } from 'lucide-react'
import { ordersApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const statusColors: Record<string, string> = {
  PENDING:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  CONFIRMED:  'bg-sky-500/20 text-sky-400 border-sky-500/20',
  PROCESSING: 'bg-violet-500/20 text-violet-400 border-violet-500/20',
  SHIPPED:    'bg-blue-500/20 text-blue-400 border-blue-500/20',
  DELIVERED:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
  CANCELLED:  'bg-red-500/20 text-red-400 border-red-500/20',
}

export default function OrdersPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [expanded, setExpanded] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    // Orders hang off the CRM row, not the user account — these are different ids.
    queryKey: ['orders-customer', user?.customerId, page],
    queryFn: () => ordersApi.byCustomer(user!.customerId!, { page, size: 10 }),
    enabled: !!user?.customerId,
  })
  const orders = data?.data?.data?.content ?? []
  const totalPages = data?.data?.data?.totalPages ?? 0

  return (
    <div className="customer-portal min-h-screen bg-[#0a0a0f]">
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Mes Commandes</h1>
        <p className="mt-1 text-sm text-white/40">{data?.data?.data?.totalElements ?? 0} commande(s)</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-white/30">
          <ShoppingBag size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-bold">Aucune commande</p>
          <p className="text-sm mt-1">Vos commandes apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any, i: number) => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              {/* Order header */}
              <div className="flex w-full flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <button className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  aria-expanded={expanded === order.id}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                    <Package size={18} className="text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">{order.orderNumber}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />{order.createdAt && format(new Date(order.createdAt), 'dd MMM yyyy', { locale })}
                      </span>
                      <span>{order.items?.length ?? 0} article(s)</span>
                    </div>
                  </div>
                </button>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
                  <p className="text-base font-black text-white">{order.totalAmount} TND</p>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusColors[order.status] ?? 'bg-white/10 text-white/40 border-white/10'}`}>
                    {order.status}
                  </span>
                  <Link to={`/orders/${order.id}`}
                    aria-label={`Voir les détails de la commande ${order.orderNumber}`}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-gold-300 bg-gold-50 px-3 py-1.5 text-xs font-extrabold text-gold-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gold-400 hover:bg-gold-100 hover:shadow-gold-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">
                    <ListChecks size={14} /> Détails
                  </Link>
                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    aria-label={expanded === order.id ? 'Masquer les articles' : 'Afficher les articles'}
                    aria-expanded={expanded === order.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white">
                    {expanded === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Order items (expanded) */}
              {expanded === order.id && order.items?.length > 0 && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }}
                  className="border-t border-white/8 px-4 pb-4 pt-3">
                  <div className="space-y-2">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center">
                          <Package size={13} className="text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {i18n.language === 'fr' ? item.product?.nameFr : item.product?.name}
                          </p>
                          <p className="text-[10px] text-white/40">x{item.quantity} × {item.unitPrice} TND</p>
                        </div>
                        <p className="text-xs font-bold text-white shrink-0">{item.lineTotal} TND</p>
                      </div>
                    ))}
                  </div>
                  {order.shippingAddress && (
                    <div className="mt-3 rounded-xl bg-white/5 px-3 py-2.5">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Livraison</p>
                      <p className="text-xs text-white/60 mt-0.5">{order.shippingAddress}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 transition hover:border-white/20">
            {t('common.previous')}
          </button>
          <span className="text-sm text-white/40">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 transition hover:border-white/20">
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
    </div>
  )
}
