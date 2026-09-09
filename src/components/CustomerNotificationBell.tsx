import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bell, BellOff, CalendarCheck, Car, CheckCheck, CheckCircle2, Clock3,
  Loader2, Package, PackageCheck, RotateCcw, ShoppingBag, Sparkles, Truck, XCircle,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { apiErrorMessage, notificationsApi, type NotificationItem } from '../lib/api'
import { useNotificationStream } from '../hooks/useNotificationStream'

const FEED_KEY = ['notifications', 'personal', 'feed']
const UNREAD_KEY = ['notifications', 'personal', 'unread']
const FEED_LIMIT = 30

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
  gold: 'bg-gold-50 text-gold-700 ring-gold-200',
  green: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  red: 'bg-red-50 text-red-600 ring-red-200',
  amber: 'bg-amber-50 text-amber-600 ring-amber-200',
  blue: 'bg-blue-50 text-blue-600 ring-blue-200',
  gray: 'bg-gray-100 text-ink-500 ring-ink-100',
}

function parsedDate(iso: string): Date | null {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function relativeTime(iso: string): string {
  const date = parsedDate(iso)
  if (!date) return ''
  return formatDistanceToNow(new Date(Math.min(date.getTime(), Date.now())), {
    addSuffix: true,
    locale: fr,
  })
}

function absoluteTime(iso: string): string {
  const date = parsedDate(iso)
  return date ? format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr }) : ''
}

const money = (amount: number) => `${Number(amount).toFixed(2)} TND`

/** Private order, service/car-wash and workshop notifications for the customer. */
export default function CustomerNotificationBell() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [ringKey, setRingKey] = useState(0)
  const [freshIds, setFreshIds] = useState<number[]>([])
  const [, setClockTick] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const freshTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const unreadQuery = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => {
      const { data } = await notificationsApi.personalUnreadCount()
      return Number(data?.data?.count ?? 0)
    },
  })

  const feedQuery = useQuery({
    queryKey: FEED_KEY,
    queryFn: async () => {
      const { data } = await notificationsApi.personalList({ page: 0, size: 20 })
      return (data?.data?.content ?? []) as NotificationItem[]
    },
  })

  const unread = unreadQuery.data ?? 0
  const items = feedQuery.data ?? []

  const onNotification = useCallback((item: NotificationItem) => {
    qc.setQueryData<NotificationItem[]>(FEED_KEY, (old) => {
      const rest = (old ?? []).filter((line) => line.id !== item.id)
      return [item, ...rest].slice(0, FEED_LIMIT)
    })
    if (!item.read) qc.setQueryData<number>(UNREAD_KEY, (count) => (count ?? 0) + 1)
    setRingKey((key) => key + 1)
    setFreshIds((ids) => ids.includes(item.id) ? ids : [...ids, item.id])
    const timer = setTimeout(
      () => setFreshIds((ids) => ids.filter((id) => id !== item.id)),
      2200,
    )
    freshTimers.current.push(timer)
    if (!open) {
      toast.success(item.title, {
        description: item.message || item.reference || undefined,
        action: item.link ? { label: 'Voir', onClick: () => navigate(item.link!) } : undefined,
      })
    }
  }, [navigate, open, qc])

  const { live, status } = useNotificationStream({
    onNotification,
    streamPath: '/notifications/me/stream',
  })

  useEffect(() => {
    const id = setInterval(() => {
      void qc.invalidateQueries({ queryKey: UNREAD_KEY })
      void qc.invalidateQueries({ queryKey: FEED_KEY })
    }, live ? 120_000 : 25_000)
    return () => clearInterval(id)
  }, [live, qc])

  useEffect(() => () => freshTimers.current.forEach(clearTimeout), [])

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await notificationsApi.markPersonalRead(id)
      return { id, count: Number(data?.data?.count ?? 0) }
    },
    onSuccess: ({ id, count }) => {
      qc.setQueryData<number>(UNREAD_KEY, count)
      qc.setQueryData<NotificationItem[]>(FEED_KEY, (old) =>
        (old ?? []).map((item) => item.id === id ? { ...item, read: true } : item),
      )
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Impossible de marquer comme lu')),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data } = await notificationsApi.markAllPersonalRead()
      return Number(data?.data?.count ?? 0)
    },
    onSuccess: (count) => {
      qc.setQueryData<number>(UNREAD_KEY, count)
      qc.setQueryData<NotificationItem[]>(FEED_KEY, (old) =>
        (old ?? []).map((item) => ({ ...item, read: true })),
      )
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Impossible de tout marquer comme lu')),
  })

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setClockTick((tick) => tick + 1), 30_000)
    return () => clearInterval(id)
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      void qc.invalidateQueries({ queryKey: FEED_KEY })
      void qc.invalidateQueries({ queryKey: UNREAD_KEY })
    }
  }

  const openItem = (item: NotificationItem) => {
    if (!item.read) markRead.mutate(item.id)
    setOpen(false)
    navigate(item.link || '/dashboard')
  }

  const badge = useMemo(() => unread > 9 ? '9+' : String(unread), [unread])
  const stagger = reduceMotion ? 0 : 0.035

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications (${unread} non lues)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`group relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 sm:px-2 md:px-3 transition ${
          open ? 'bg-gold-50 text-gold-700' : 'text-gray-600 hover:bg-gold-50 hover:text-gold-600'
        }`}
      >
        <Bell
          key={ringKey}
          size={22}
          strokeWidth={1.8}
          className={`${ringKey ? 'ba-bell-ring' : ''} transition-transform group-hover:-rotate-12`}
        />
        <AnimatePresence initial={false}>
          {unread > 0 && (
            <motion.span
              key={badge}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white"
            >
              {badge}
            </motion.span>
          )}
        </AnimatePresence>
        {unread > 0 && !open && (
          <span aria-hidden className="ba-pulse-dot absolute right-1 top-1 h-2.5 w-2.5 rounded-full text-red-500" />
        )}
        <span className="hidden text-[10px] font-semibold whitespace-nowrap md:block">Notifications</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Mes notifications"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-3 top-[4.5rem] z-[70] origin-top overflow-hidden rounded-2xl border border-ink-100 bg-white/95 shadow-elev-4 backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem] sm:origin-top-right"
          >
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
              <div>
                <p className="text-sm font-black text-ink-900">Mes notifications</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${live ? 'ba-pulse-dot bg-emerald-500 text-emerald-500' : 'bg-ink-300'}`} />
                  {live ? 'En direct' : status === 'denied' ? 'Mise à jour périodique' : 'Reconnexion…'}
                  {unread > 0 && <span className="text-gold-700">· {unread} non lue{unread > 1 ? 's' : ''}</span>}
                </p>
              </div>
              <button
                onClick={() => markAllRead.mutate()}
                disabled={!unread || markAllRead.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-ink-500 hover:bg-gold-50 hover:text-gold-700 disabled:opacity-40"
              >
                {markAllRead.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
                Tout lire
              </button>
            </div>

            <div className="max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain">
              {feedQuery.isLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex gap-3 rounded-xl p-2">
                      <div className="ba-skeleton h-9 w-9 shrink-0 rounded-xl" />
                      <div className="flex-1 space-y-2 py-0.5">
                        <div className="ba-skeleton h-3 w-1/2 rounded" />
                        <div className="ba-skeleton h-3 w-3/4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : feedQuery.isError ? (
                <div className="px-6 py-10 text-center">
                  <BellOff size={36} className="mx-auto mb-3 text-ink-200" />
                  <p className="text-sm font-bold text-ink-700">Notifications indisponibles</p>
                  <button onClick={() => void feedQuery.refetch()} className="mt-3 text-xs font-bold text-gold-700">Réessayer</button>
                </div>
              ) : items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Bell size={36} className="mx-auto mb-3 animate-bob text-ink-200" />
                  <p className="text-sm font-bold text-ink-700">Aucune notification</p>
                  <p className="mt-1 text-xs text-ink-400">Le suivi de vos commandes et services apparaîtra ici.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-50">
                  {items.map((item, index) => {
                    const Icon = TYPE_ICONS[item.type] ?? Bell
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: Math.min(index, 8) * stagger }}
                      >
                        <button
                          onClick={() => openItem(item)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gold-50/60 ${
                            freshIds.includes(item.id) ? 'ba-flash-gold' : ''
                          } ${item.read ? '' : 'bg-gold-50/35'}`}
                        >
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${TONE_CHIP[item.tone] ?? TONE_CHIP.gray}`}>
                            <Icon size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[13px] font-black text-ink-900">{item.title}</span>
                              <time dateTime={item.createdAt} title={absoluteTime(item.createdAt)} className="shrink-0 text-[10px] font-semibold text-ink-300">
                                {relativeTime(item.createdAt)}
                              </time>
                            </span>
                            {item.actorName && <span className="mt-0.5 block truncate text-xs font-bold text-ink-600">{item.actorName}</span>}
                            {item.message && <span className="mt-1 block text-[11px] font-medium leading-4 text-ink-400">{item.message}</span>}
                            {(item.reference || item.amount != null) && (
                              <span className="mt-1 flex flex-wrap items-center gap-2">
                                {item.reference && <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-500">{item.reference}</span>}
                                {item.amount != null && <span className="text-[11px] font-black text-gold-700">{money(item.amount)}</span>}
                              </span>
                            )}
                          </span>
                          {!item.read && <span aria-label="Non lue" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500 ring-2 ring-gold-100" />}
                        </button>
                      </motion.li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-ink-100 p-2">
              <button
                onClick={() => { setOpen(false); navigate('/notifications') }}
                className="flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs font-black text-ink-600 hover:bg-gold-50 hover:text-gold-700"
              >
                Accéder à mes notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
