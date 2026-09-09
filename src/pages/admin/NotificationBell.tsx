import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight, Bell, BellOff, CalendarCheck, Car, CheckCheck, CheckCircle2,
  Clock3, Loader2, Package, PackageCheck, RotateCcw, ShoppingCart, Sparkles,
  Truck, XCircle,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { enUS, fr } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { apiErrorMessage, notificationsApi, type NotificationItem } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { useNotificationStream } from '../../hooks/useNotificationStream'

/**
 * The admin header bell: a live feed of order events.
 *
 * ## How it stays current
 *
 * Two mechanisms, deliberately overlapping:
 *
 * 1. **A push** over SSE (`useNotificationStream`) prepends the new line and
 *    bumps the badge with no round-trip, so the bell reacts the moment a
 *    customer checks out.
 * 2. **Polling** through TanStack Query reconciles the cache. This is not
 *    redundancy for its own sake — a laptop that slept, a proxy that dropped an
 *    idle connection or a backend restart all lose pushes silently, and a
 *    notification centre that is *sometimes* wrong is worse than one that is
 *    merely a few seconds late. The interval relaxes to two minutes while the
 *    stream is up and tightens to twenty-five seconds when it is not.
 *
 * ## What it does not do
 *
 * Opening the panel does **not** mark everything read. The badge is the only
 * signal that work arrived while nobody was looking, and clearing it on a glance
 * would throw that away — the user marks lines read by opening them, or with the
 * explicit "Tout marquer comme lu".
 *
 * Read state lives server-side *per account*, so one colleague clearing their
 * badge leaves everyone else's untouched.
 */

// The feed and the counter are cached separately: the counter is tiny and needed
// on every admin page, the feed is only rendered when the panel is open.
const FEED_KEY = ['notifications', 'feed']
const UNREAD_KEY = ['notifications', 'unread']

/** How many lines to keep client-side. The server page is 20; pushes add to it. */
const FEED_LIMIT = 30

/**
 * Mirrors `AccessRules.NOTIFICATION_READ` on the backend. The bell names
 * customers and quotes order totals, so it is hidden from staff who are not
 * entitled to order data — and hiding it also stops us firing requests that
 * would only come back 403.
 */
const BELL_ROLES = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'MANAGER', 'ACCOUNTANT', 'RECEPTIONIST', 'MECHANIC']
const BELL_PERMISSIONS = [
  'ORDER_VIEW', 'ORDER_MANAGE', 'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE',
  'APPOINTMENT_UPDATE', 'APPOINTMENT_DELETE',
]

/** Icon per event, so the list is scannable without reading every title. */
const TYPE_ICONS: Record<string, typeof Bell> = {
  ORDER_CREATED: ShoppingCart,
  ORDER_CONFIRMED: CheckCircle2,
  ORDER_PROCESSING: Package,
  ORDER_SHIPPED: Truck,
  ORDER_DELIVERED: PackageCheck,
  ORDER_CANCELLED: XCircle,
  ORDER_REFUNDED: RotateCcw,
  ORDER_UPDATED: Bell,
  APPOINTMENT_REQUESTED: CalendarCheck,
  APPOINTMENT_CONFIRMED: CalendarCheck,
  APPOINTMENT_CHECKED_IN: Car,
  APPOINTMENT_IN_PROGRESS: Sparkles,
  APPOINTMENT_COMPLETED: CheckCircle2,
  APPOINTMENT_CANCELLED: XCircle,
  APPOINTMENT_NO_SHOW: Clock3,
  APPOINTMENT_UPDATED: CalendarCheck,
}

/**
 * Icon chip colours, keyed by the tone the **server** picked. Same palette as
 * `StatusPill` in `_ui.tsx` — the tone is decided once, backend-side, so the
 * client never has to keep a parallel "is this good or bad news" table.
 */
const TONE_CHIP: Record<string, string> = {
  gold:  'bg-gold-50 text-gold-700 ring-gold-200',
  green: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  red:   'bg-red-50 text-red-600 ring-red-200',
  amber: 'bg-amber-50 text-amber-600 ring-amber-200',
  blue:  'bg-blue-50 text-blue-600 ring-blue-200',
  gray:  'bg-gray-100 text-ink-500 ring-ink-100',
}

/**
 * `LocalDateTime` comes back without a zone (`2026-01-14T09:41:07`), and the
 * backend runs on `Africa/Tunis` like the browsers that use it, so the default
 * "parse as local time" behaviour is the correct reading here.
 */
function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "il y a 5 minutes". Future timestamps are clamped: a server clock a second
 *  ahead must not produce "dans moins d'une minute" for something that happened. */
function relativeTime(iso: string, locale: typeof fr): string {
  const d = parseDate(iso)
  if (!d) return ''
  return formatDistanceToNow(new Date(Math.min(d.getTime(), Date.now())), {
    addSuffix: true,
    locale,
  })
}

/** Exact timestamp, shown on hover so the relative text is never the only truth. */
function absoluteTime(iso: string, locale: typeof fr, language: string): string {
  const d = parseDate(iso)
  return d ? format(d, language.startsWith('en') ? "MMMM d, yyyy 'at' HH:mm" : "d MMMM yyyy 'à' HH:mm", { locale }) : ''
}

const money = (n: number) => `${Number(n).toFixed(2)} TND`

export default function NotificationBell() {
  const { t, i18n } = useTranslation()
  const { hasRole, hasPermission } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const reduceMotion = useReducedMotion()
  const dateLocale = i18n.language.startsWith('en') ? enUS : fr

  const canSee = hasRole(...BELL_ROLES) || hasPermission(...BELL_PERMISSIONS)

  const [open, setOpen] = useState(false)
  /** Bumped on every arrival; used as a React `key` to replay the one-shot shake. */
  const [ringKey, setRingKey] = useState(0)
  /** Ids that just landed, highlighted for a moment so the eye finds them. */
  const [freshIds, setFreshIds] = useState<number[]>([])
  /** Forces the relative timestamps to re-render while the panel is open. */
  const [, setClockTick] = useState(0)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const freshTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // ── Data ────────────────────────────────────────────────────────────────
  const unreadQuery = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => {
      const { data } = await notificationsApi.unreadCount()
      return Number(data?.data?.count ?? 0)
    },
    enabled: canSee,
  })

  const feedQuery = useQuery({
    queryKey: FEED_KEY,
    queryFn: async () => {
      const { data } = await notificationsApi.list({ page: 0, size: 20 })
      return (data?.data?.content ?? []) as NotificationItem[]
    },
    enabled: canSee,
  })

  const unread = unreadQuery.data ?? 0
  const items = feedQuery.data ?? []

  // ── Live stream ─────────────────────────────────────────────────────────
  const onNotification = useCallback(
    (item: NotificationItem) => {
      // Merge into the cache rather than refetching: the payload is already the
      // whole line, so a round-trip would only add latency.
      qc.setQueryData<NotificationItem[]>(FEED_KEY, (old) => {
        const rest = (old ?? []).filter((n) => n.id !== item.id)
        return [item, ...rest].slice(0, FEED_LIMIT)
      })
      if (!item.read) qc.setQueryData<number>(UNREAD_KEY, (n) => (n ?? 0) + 1)

      setRingKey((k) => k + 1)
      setFreshIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]))
      const timer = setTimeout(
        () => setFreshIds((ids) => ids.filter((id) => id !== item.id)),
        2200,
      )
      freshTimers.current.push(timer)

      // A toast only when the panel is shut — otherwise it repeats a line the
      // user is already looking at.
      if (!open) {
        toast.success(item.actorName ? `${item.title} · ${item.actorName}` : item.title, {
          description: [item.reference, item.amount != null ? money(item.amount) : null]
            .filter(Boolean)
            .join(' · ') || undefined,
        })
      }
    },
    [open, qc],
  )

  const { live, status } = useNotificationStream({ enabled: canSee, onNotification })

  // Poll as a safety net, faster when the push channel is down. `refetchInterval`
  // ignores `staleTime`, so this holds even with the global 5-minute default.
  const pollMs = live ? 120_000 : 25_000
  useEffect(() => {
    if (!canSee) return
    const id = setInterval(() => {
      void qc.invalidateQueries({ queryKey: UNREAD_KEY })
      void qc.invalidateQueries({ queryKey: FEED_KEY })
    }, pollMs)
    return () => clearInterval(id)
  }, [canSee, pollMs, qc])

  useEffect(() => () => freshTimers.current.forEach(clearTimeout), [])

  // ── Mutations ───────────────────────────────────────────────────────────
  // Both endpoints answer with the remaining unread count, so the badge is
  // corrected from the same response instead of needing a follow-up request.
  const markRead = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await notificationsApi.markRead(id)
      return { id, count: Number(data?.data?.count ?? 0) }
    },
    onSuccess: ({ id, count }) => {
      qc.setQueryData<number>(UNREAD_KEY, count)
      qc.setQueryData<NotificationItem[]>(FEED_KEY, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('adminShared.notifications.markFailed'))),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data } = await notificationsApi.markAllRead()
      return Number(data?.data?.count ?? 0)
    },
    onSuccess: (count) => {
      qc.setQueryData<number>(UNREAD_KEY, count)
      qc.setQueryData<NotificationItem[]>(FEED_KEY, (old) =>
        (old ?? []).map((n) => ({ ...n, read: true })),
      )
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('adminShared.notifications.markAllFailed'))),
  })

  // ── Panel plumbing ──────────────────────────────────────────────────────
  // Escape + outside click rather than a full-screen click-catcher: the header
  // uses `backdrop-blur`, which makes it the containing block for fixed-position
  // children, so an `inset-0` overlay would only cover the header strip.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  // Relative times go stale on their own; refresh them while they are visible.
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setClockTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [open])

  // Opening is a good moment to reconcile, in case a push was missed.
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && canSee) {
      void qc.invalidateQueries({ queryKey: FEED_KEY })
      void qc.invalidateQueries({ queryKey: UNREAD_KEY })
    }
  }

  const openItem = (item: NotificationItem) => {
    if (!item.read) markRead.mutate(item.id)
    setOpen(false)
    navigate(item.link || '/admin/orders')
  }

  const badge = useMemo(() => (unread > 9 ? '9+' : String(unread)), [unread])
  const stagger = reduceMotion ? 0 : 0.035

  if (!canSee) return null

  return (
    <div ref={rootRef} className="relative">
      {/* ── Trigger ───────────────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        aria-label={unread > 0 ? t('adminShared.notifications.unread', { count: unread }) : t('adminShared.notifications.title')}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`ba-press group relative rounded-xl p-2 transition-colors ${
          open ? 'bg-gold-50 text-gold-700' : 'text-ink-500 hover:bg-gold-50 hover:text-gold-700'
        }`}
      >
        {/* `key` remounts the icon on each arrival, which is what replays the
            one-shot shake — a CSS animation does not restart on its own. */}
        <Bell
          key={ringKey}
          size={18}
          className={`transition-transform duration-300 ease-out-back group-hover:-rotate-12 ${
            ringKey > 0 ? 'ba-bell-ring' : ''
          }`}
        />

        <AnimatePresence initial={false}>
          {unread > 0 && (
            <motion.span
              key={badge}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 26 }}
              className="ba-nums pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white"
            >
              {badge}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Expanding ring under the badge, so an unread count is visible in
            peripheral vision. Only while the panel is closed. */}
        {unread > 0 && !open && (
          <span
            aria-hidden
            className="ba-pulse-dot pointer-events-none absolute right-1 top-1 h-2.5 w-2.5 rounded-full text-red-500"
          />
        )}
      </button>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t('adminShared.notifications.title')}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            /* Full-width card under the header on a phone, anchored dropdown from
               `sm` up — a 24rem panel hanging off this button would overflow a
               390px screen. */
            className="fixed inset-x-3 top-[4.5rem] z-20 origin-top overflow-hidden rounded-2xl border border-ink-100 bg-white/95 shadow-elev-4 backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem] sm:origin-top-right"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-ink-900">{t('adminShared.notifications.title')}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      live ? 'ba-pulse-dot bg-emerald-500 text-emerald-500' : 'bg-ink-300'
                    }`}
                  />
                  {live
                    ? t('adminShared.notifications.live')
                    : status === 'denied'
                      ? t('adminShared.notifications.periodic')
                      : t('adminShared.notifications.reconnecting')}
                  {unread > 0 && <span className="text-gold-700">· {t('adminShared.notifications.unreadCount', { count: unread })}</span>}
                </p>
              </div>
              <button
                onClick={() => markAllRead.mutate()}
                disabled={unread === 0 || markAllRead.isPending}
                className="ba-press inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-ink-500 transition-colors hover:bg-gold-50 hover:text-gold-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500"
              >
                {markAllRead.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <CheckCheck size={13} />}
                {t('adminShared.notifications.markAll')}
              </button>
            </div>

            {/* List */}
            <div className="max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain">
              {feedQuery.isLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 rounded-xl p-2">
                      <div className="ba-skeleton h-9 w-9 shrink-0 rounded-xl" />
                      <div className="flex-1 space-y-2 py-0.5">
                        <div className="ba-skeleton h-3 w-1/2 rounded" />
                        <div className="ba-skeleton h-3 w-3/4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : feedQuery.isError ? (
                <div className="px-6 py-12 text-center">
                  <BellOff size={38} className="mx-auto mb-3 text-ink-200" />
                  <p className="text-sm font-bold text-ink-700">{t('adminShared.notifications.unavailable')}</p>
                  <p className="mt-1 text-xs font-medium text-ink-400">
                    {apiErrorMessage(feedQuery.error, t('adminShared.notifications.serverUnavailable'))}
                  </p>
                  <button
                    onClick={() => void feedQuery.refetch()}
                    className="ba-press mt-4 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-700"
                  >
                    {t('adminShared.retry')}
                  </button>
                </div>
              ) : items.length === 0 ? (
                // A compact empty state: `EmptyState` from `_ui.tsx` is sized for
                // a full page and its `py-16` would double this panel's height.
                <div className="px-6 py-12 text-center">
                  <Bell size={38} className="mx-auto mb-3 animate-bob text-ink-200" />
                  <p className="text-sm font-bold text-ink-700">{t('adminShared.notifications.empty')}</p>
                  <p className="mt-1 text-xs font-medium text-ink-400">
                    {t('adminShared.notifications.emptyHint')}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-50">
                  {items.map((item, i) => {
                    const Icon = TYPE_ICONS[item.type] ?? Bell
                    const chip = TONE_CHIP[item.tone] ?? TONE_CHIP.gray
                    const isFresh = freshIds.includes(item.id)
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: Math.min(i, 8) * stagger, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <button
                          onClick={() => openItem(item)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gold-50/60 ${
                            isFresh ? 'ba-flash-gold' : ''
                          } ${item.read ? '' : 'bg-gold-50/35'}`}
                        >
                          <span
                            aria-hidden
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${chip}`}
                          >
                            <Icon size={16} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[13px] font-black text-ink-900">{item.title}</span>
                              <time
                                dateTime={item.createdAt}
                                title={absoluteTime(item.createdAt, dateLocale, i18n.language)}
                                className="shrink-0 text-[10px] font-semibold text-ink-300"
                              >
                                {relativeTime(item.createdAt, dateLocale)}
                              </time>
                            </span>

                            {/* The name the user actually scans for. */}
                            {item.actorName && (
                              <span className="mt-0.5 block truncate text-xs font-bold text-ink-600">
                                {item.actorName}
                              </span>
                            )}

                            {(item.reference || item.amount != null) && (
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                {item.reference && (
                                  <span className="ba-nums rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-500">
                                    {item.reference}
                                  </span>
                                )}
                                {item.amount != null && (
                                  <span className="ba-nums text-[11px] font-black text-gold-700">
                                    {money(item.amount)}
                                  </span>
                                )}
                              </span>
                            )}

                            {item.message && (
                              <span className="mt-1 block truncate text-[11px] font-medium text-ink-400">
                                {item.message}
                              </span>
                            )}
                          </span>

                          {!item.read && (
                            <span
                              aria-label={t('adminShared.notifications.unreadLabel')}
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500 ring-2 ring-gold-100"
                            />
                          )}
                        </button>
                      </motion.li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-ink-100 p-2">
              <button
                onClick={() => { setOpen(false); navigate('/admin/orders') }}
                className="ba-press group flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-ink-600 transition-colors hover:bg-gold-50 hover:text-gold-700"
              >
                {t('adminShared.notifications.viewOrders')}
                <ArrowRight size={13} className="transition-transform duration-300 ease-out-back group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
