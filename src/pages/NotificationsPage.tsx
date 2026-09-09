import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Bell, BellOff, CalendarCheck, Car, CheckCheck, CheckCircle2, Clock3,
  Filter, Loader2, Package, PackageCheck, RotateCcw, ShoppingBag, Sparkles,
  Truck, XCircle,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { apiErrorMessage, notificationsApi, type NotificationItem } from '../lib/api'
import { useNotificationStream } from '../hooks/useNotificationStream'

const PAGE_SIZE = 12
const UNREAD_KEY = ['notifications', 'personal', 'unread']

type FilterKind = 'ALL' | 'UNREAD' | 'ORDER' | 'SERVICE' | 'WORKSHOP'

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'UNREAD', label: 'Non lues' },
  { key: 'ORDER', label: 'Commandes' },
  { key: 'SERVICE', label: 'Services & lavage' },
  { key: 'WORKSHOP', label: 'Atelier' },
]

const TYPE_ICONS: Record<string, typeof Bell> = {
  ORDER_CONFIRMED: CheckCircle2,
  ORDER_PROCESSING: Package,
  ORDER_SHIPPED: Truck,
  ORDER_DELIVERED: PackageCheck,
  ORDER_CANCELLED: XCircle,
  ORDER_REFUNDED: RotateCcw,
  ORDER_UPDATED: ShoppingBag,
  APPOINTMENT_REQUESTED: CalendarCheck,
  APPOINTMENT_CONFIRMED: CalendarCheck,
  APPOINTMENT_CHECKED_IN: Car,
  APPOINTMENT_IN_PROGRESS: Sparkles,
  APPOINTMENT_COMPLETED: CheckCircle2,
  APPOINTMENT_CANCELLED: XCircle,
  APPOINTMENT_NO_SHOW: Clock3,
  APPOINTMENT_UPDATED: CalendarCheck,
  WORKSHOP_SCHEDULED: CalendarCheck,
  WORKSHOP_CHECKED_IN: Car,
  WORKSHOP_INSPECTION: Sparkles,
  WORKSHOP_ESTIMATE: ShoppingBag,
  WORKSHOP_APPROVAL_REQUIRED: Clock3,
  WORKSHOP_IN_PROGRESS: Sparkles,
  WORKSHOP_QUALITY_CONTROL: CheckCircle2,
  WORKSHOP_READY: Car,
  WORKSHOP_DELIVERED: CheckCircle2,
}

const TONE_CHIP: Record<string, string> = {
  gold: 'border-gold-200 bg-gold-50 text-gold-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  red: 'border-red-200 bg-red-50 text-red-600',
  amber: 'border-amber-200 bg-amber-50 text-amber-600',
  blue: 'border-blue-200 bg-blue-50 text-blue-600',
  gray: 'border-ink-100 bg-ink-50 text-ink-500',
}

function dateOf(iso: string): Date | null {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function relativeTime(iso: string): string {
  const date = dateOf(iso)
  if (!date) return ''
  return formatDistanceToNow(new Date(Math.min(date.getTime(), Date.now())), {
    addSuffix: true,
    locale: fr,
  })
}

function exactTime(iso: string): string {
  const date = dateOf(iso)
  return date ? format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr }) : ''
}

function matchesFilter(item: NotificationItem, filter: FilterKind): boolean {
  if (filter === 'ALL') return true
  if (filter === 'UNREAD') return !item.read
  if (filter === 'ORDER') return item.entityType === 'ORDER'
  if (filter === 'SERVICE') return item.entityType === 'APPOINTMENT'
  return item.entityType === 'WORK_ORDER'
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<FilterKind>('ALL')
  const feedKey = ['notifications', 'personal', 'page', page]

  const feedQuery = useQuery({
    queryKey: feedKey,
    queryFn: async () => {
      const { data } = await notificationsApi.personalList({ page, size: PAGE_SIZE })
      return data.data as {
        content: NotificationItem[]
        totalElements: number
        totalPages: number
        first: boolean
        last: boolean
      }
    },
  })

  const unreadQuery = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => {
      const { data } = await notificationsApi.personalUnreadCount()
      return Number(data?.data?.count ?? 0)
    },
  })

  const pageData = feedQuery.data
  const items = useMemo(
    () => (pageData?.content ?? []).filter((item) => matchesFilter(item, filter)),
    [filter, pageData?.content],
  )
  const unread = unreadQuery.data ?? 0

  const onNotification = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['notifications', 'personal'] })
  }, [qc])

  const { live } = useNotificationStream({
    onNotification,
    streamPath: '/notifications/me/stream',
  })

  useEffect(() => {
    const id = setInterval(() => {
      void qc.invalidateQueries({ queryKey: ['notifications', 'personal'] })
    }, live ? 120_000 : 25_000)
    return () => clearInterval(id)
  }, [live, qc])

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await notificationsApi.markPersonalRead(id)
      return { id, count: Number(data?.data?.count ?? 0) }
    },
    onSuccess: ({ id, count }) => {
      qc.setQueryData(UNREAD_KEY, count)
      qc.setQueryData<typeof pageData>(feedKey, (old) => old ? {
        ...old,
        content: old.content.map((item) => item.id === id ? { ...item, read: true } : item),
      } : old)
      void qc.invalidateQueries({ queryKey: ['notifications', 'personal', 'feed'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Impossible de marquer comme lu')),
  })

  const markAll = useMutation({
    mutationFn: async () => {
      const { data } = await notificationsApi.markAllPersonalRead()
      return Number(data?.data?.count ?? 0)
    },
    onSuccess: (count) => {
      qc.setQueryData(UNREAD_KEY, count)
      qc.setQueriesData<{ content?: NotificationItem[] }>(
        { queryKey: ['notifications', 'personal'] },
        (old) => old?.content ? {
          ...old,
          content: old.content.map((item) => ({ ...item, read: true })),
        } : old,
      )
      void qc.invalidateQueries({ queryKey: ['notifications', 'personal'] })
      toast.success('Toutes les notifications sont marquées comme lues')
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Impossible de tout marquer comme lu')),
  })

  const openItem = (item: NotificationItem) => {
    if (!item.read) markRead.mutate(item.id)
    navigate(item.link || '/dashboard')
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-ink-50 to-white">
      <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-elev-2">
          <header className="relative overflow-hidden border-b border-ink-100 px-5 py-6 sm:px-8">
            <div className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full bg-gold-100/60 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-50 text-gold-700 ring-1 ring-gold-200">
                  <Bell size={23} />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold-600">Centre personnel</p>
                  <h1 className="mt-1 text-2xl font-black text-ink-900 sm:text-3xl">Mes notifications</h1>
                  <p className="mt-1 text-sm font-medium text-ink-400">
                    Suivez vos commandes, lavages, vidanges et interventions atelier.
                  </p>
                </div>
              </div>
              <button
                onClick={() => markAll.mutate()}
                disabled={!unread || markAll.isPending}
                className="ba-press inline-flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs font-black text-ink-600 shadow-elev-1 transition hover:border-gold-200 hover:bg-gold-50 hover:text-gold-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {markAll.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                Tout marquer comme lu
              </button>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-ink-50/50 px-4 py-3 sm:px-8">
            <Filter size={14} className="mr-1 text-ink-300" />
            {FILTERS.map((entry) => (
              <button
                key={entry.key}
                onClick={() => setFilter(entry.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  filter === entry.key
                    ? 'bg-ink-900 text-white shadow-elev-1'
                    : 'bg-white text-ink-500 ring-1 ring-ink-100 hover:text-gold-700'
                }`}
              >
                {entry.label}{entry.key === 'UNREAD' && unread > 0 ? ` (${unread})` : ''}
              </button>
            ))}
          </div>

          {feedQuery.isLoading ? (
            <div className="space-y-3 p-5 sm:p-8">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="flex gap-4 rounded-2xl border border-ink-50 p-4">
                  <div className="ba-skeleton h-11 w-11 shrink-0 rounded-2xl" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="ba-skeleton h-3 w-1/3 rounded" />
                    <div className="ba-skeleton h-3 w-3/4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : feedQuery.isError ? (
            <div className="px-6 py-20 text-center">
              <BellOff size={44} className="mx-auto mb-4 text-ink-200" />
              <h2 className="font-black text-ink-800">Notifications indisponibles</h2>
              <p className="mt-1 text-sm text-ink-400">Le serveur ne répond pas pour le moment.</p>
              <button onClick={() => void feedQuery.refetch()} className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-xs font-black text-white">Réessayer</button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <Bell size={44} className="mx-auto mb-4 text-ink-200" />
              <h2 className="font-black text-ink-800">Aucune notification</h2>
              <p className="mt-1 text-sm text-ink-400">
                {filter === 'ALL' ? 'Vos prochaines mises à jour apparaîtront ici.' : 'Aucune notification ne correspond à ce filtre.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-50">
              {items.map((item, index) => {
                const Icon = TYPE_ICONS[item.type] ?? Bell
                return (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.035 }}
                  >
                    <button
                      onClick={() => openItem(item)}
                      className={`group flex w-full items-start gap-4 px-5 py-5 text-left transition sm:px-8 ${
                        item.read ? 'hover:bg-ink-50/60' : 'bg-gold-50/35 hover:bg-gold-50/70'
                      }`}
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${TONE_CHIP[item.tone] ?? TONE_CHIP.gray}`}>
                        <Icon size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <span className="font-black text-ink-900 group-hover:text-gold-700">{item.title}</span>
                          <time dateTime={item.createdAt} title={exactTime(item.createdAt)} className="shrink-0 text-[11px] font-bold text-ink-300">
                            {relativeTime(item.createdAt)}
                          </time>
                        </span>
                        {item.actorName && <span className="mt-0.5 block text-sm font-bold text-ink-600">{item.actorName}</span>}
                        {item.message && <span className="mt-1 block text-sm leading-5 text-ink-400">{item.message}</span>}
                        <span className="mt-2 flex flex-wrap items-center gap-2">
                          {item.reference && <span className="rounded-md bg-ink-50 px-2 py-1 text-[10px] font-black text-ink-500">{item.reference}</span>}
                          {item.amount != null && <span className="text-xs font-black text-gold-700">{Number(item.amount).toFixed(2)} TND</span>}
                          <span className="text-[10px] font-bold text-ink-300">{exactTime(item.createdAt)}</span>
                        </span>
                      </span>
                      {!item.read && <span aria-label="Non lue" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gold-500 ring-4 ring-gold-100" />}
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          )}

          {(pageData?.totalPages ?? 0) > 1 && (
            <footer className="flex items-center justify-between border-t border-ink-100 bg-ink-50/50 px-5 py-4 sm:px-8">
              <p className="text-xs font-bold text-ink-400">{pageData?.totalElements ?? 0} notification(s)</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={pageData?.first}
                  className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs font-bold text-ink-600 disabled:opacity-40"
                >
                  Précédent
                </button>
                <span className="min-w-14 text-center text-xs font-black text-ink-500">{page + 1} / {pageData?.totalPages}</span>
                <button
                  onClick={() => setPage((value) => value + 1)}
                  disabled={pageData?.last}
                  className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs font-bold text-ink-600 disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </footer>
          )}
        </div>
      </section>
    </div>
  )
}
