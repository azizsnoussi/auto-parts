import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Loader2, Lock, ShoppingCart, ArrowLeft, Package, MapPin, Phone, Mail, User, CreditCard, Truck } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { clearCart } from '../store/slices/cartSlice'
import { useAuth } from '../contexts/AuthContext'
import { ordersApi, apiErrorMessage } from '../lib/api'
import { sanitizeCustomerPayload } from '../lib/customerSegment'
import { toast } from 'sonner'

const INPUT = 'w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-[#1a1a1a] placeholder-gray-400 focus:border-[#c8a415] focus:bg-white focus:outline-none transition'

export default function CheckoutPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const items = useAppSelector((s) => s.cart.items)

  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    // Prefilled from the customer's CRM row when known.
    address: user?.address ?? '',
    city: user?.city ?? '',
    zipCode: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState<any>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const shipping = subtotal >= 200 || subtotal === 0 ? 0 : 9
  const tax = subtotal * 0.19
  const total = subtotal + tax + shipping

  // ── Not logged in ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-5">
          <Lock size={32} className="text-gray-300" />
        </div>
        <h2 className="text-2xl font-black text-[#1a1a1a]">Connexion requise</h2>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-xs">Connectez-vous pour finaliser votre commande</p>
        {/* state.from is what Login reads to come back here instead of dropping
            the customer on the dashboard with a full basket. */}
        <Link to="/login" state={{ from: '/checkout' }} className="mt-6 rounded-full bg-[#c8a415] px-6 py-3 text-sm font-bold text-black hover:bg-[#b89210] transition shadow-md">
          Se connecter
        </Link>
      </div>
    )
  }

  // ── Empty cart ─────────────────────────────────────────────────────────
  if (items.length === 0 && !orderResult) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20">
        <ShoppingCart size={48} className="text-gray-300 mb-4" />
        <h2 className="text-2xl font-black text-[#1a1a1a]">Panier vide</h2>
        <Link to="/shop" className="mt-6 rounded-full bg-[#c8a415] px-6 py-3 text-sm font-bold text-black hover:bg-[#b89210] transition shadow-md">
          Parcourir la boutique
        </Link>
      </div>
    )
  }

  // ── Order success ─────────────────────────────────────────────────────
  if (orderResult) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 mb-6">
          <Check size={48} className="text-emerald-600" />
        </motion.div>
        <h2 className="text-3xl font-black text-[#1a1a1a]">Commande confirmée !</h2>
        <p className="mt-2 text-sm text-gray-500 font-medium">
          Commande #{orderResult.orderNumber ?? orderResult.id} — Merci pour votre achat !
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Montant total : <span className="font-black text-[#c8a415]">{total.toFixed(2)} TND</span>
        </p>
        <div className="mt-8 flex gap-3">
          <Link to="/orders" className="rounded-full border-2 border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-600 hover:border-[#c8a415] hover:text-[#c8a415] transition">
            Mes commandes
          </Link>
          <Link to="/shop" className="rounded-full bg-[#c8a415] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#b89210] transition shadow-md">
            Continuer mes achats
          </Link>
        </div>
      </div>
    )
  }

  // ── Submit order ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedPhone = form.phone.trim()
    const normalizedAddress = form.address.trim()
    const normalizedCity = form.city.trim()

    if (!normalizedPhone || !normalizedAddress || !normalizedCity) {
      toast.error('Veuillez remplir les champs obligatoires : téléphone, adresse et ville')
      return
    }

    if (items.length === 0) {
      toast.error('Votre panier est vide')
      return
    }

    setSubmitting(true)
    try {
      const orderPayload = sanitizeCustomerPayload({
        items: items.map(i => ({
          productId: i.id,
          quantity: i.quantity,
          unitPrice: Number(i.price.toFixed(2)),
        })),
        shippingAddress: normalizedAddress,
        shippingCity: normalizedCity,
        shippingZipCode: form.zipCode.trim(),
        phone: normalizedPhone,
        notes: form.notes.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      })
      // The backend resolves the CRM row from the authenticated account, so no
      // customer id is sent: passing the *users* id here used to attach orders
      // to the wrong customer (or fail outright).
      const res = await ordersApi.create(orderPayload)
      const order = res.data?.data ?? res.data
      setOrderResult(order)
      dispatch(clearCart())
      toast.success('Commande passée avec succès !')
    } catch (err: any) {
      // `error` before `message`: the backend puts the human text in `error` and
      // a machine code in `message`. apiErrorMessage also covers the
      // no-response cases (timeout, offline), which used to fall through to the
      // generic string and tell the user nothing.
      toast.error(apiErrorMessage(err, 'Erreur lors de la commande'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/cart" className="mb-6 flex items-center gap-2 text-sm text-gray-400 hover:text-[#c8a415] transition font-medium">
        <ArrowLeft size={14} /> Retour au panier
      </Link>

      <h1 className="text-3xl font-black text-[#1a1a1a] mb-8">Finaliser la commande</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping info */}
            <div className="rounded-2xl border-2 border-gray-100 bg-white p-6">
              <div className="flex items-center gap-2 mb-5">
                <Truck size={18} className="text-[#c8a415]" />
                <h2 className="text-lg font-black text-[#1a1a1a]">Informations de livraison</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Prénom</label>
                  <input className={INPUT} value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Votre prénom" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Nom</label>
                  <input className={INPUT} value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Votre nom" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Téléphone *</label>
                  <input className={INPUT} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+216 XX XXX XXX" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Email</label>
                  <input className={INPUT} value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Adresse *</label>
                  <input className={INPUT} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rue, numéro, quartier..." required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Ville *</label>
                  <input className={INPUT} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Tunis, Sfax, Sousse..." required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Code postal</label>
                  <input className={INPUT} value={form.zipCode} onChange={e => set('zipCode', e.target.value)} placeholder="1000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Notes (optionnel)</label>
                  <textarea className={INPUT + ' resize-none'} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Instructions de livraison..." />
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border-2 border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black text-[#1a1a1a] mb-4">Votre commande</h3>

              {/* Items */}
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain p-1" />
                        : <Package size={16} className="text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1a1a1a] truncate">{item.nameFr || item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.quantity} × {item.price.toFixed(2)} TND</p>
                    </div>
                    <span className="text-xs font-black text-[#1a1a1a]">{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <hr className="border-gray-100 mb-4" />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span className="font-bold">{subtotal.toFixed(2)} TND</span></div>
                <div className="flex justify-between"><span className="text-gray-500">TVA (19%)</span><span className="font-bold">{tax.toFixed(2)} TND</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Livraison</span><span className="font-bold">{shipping === 0 ? 'Gratuite' : `${shipping.toFixed(2)} TND`}</span></div>
                <hr className="border-gray-100" />
                <div className="flex justify-between text-lg"><span className="font-black">Total</span><span className="font-black text-[#c8a415]">{total.toFixed(2)} TND</span></div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#c8a415] py-3.5 text-sm font-bold text-black shadow-lg shadow-[#c8a415]/20 hover:bg-[#b89210] transition disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {submitting ? 'Envoi en cours...' : 'Confirmer la commande'}
              </button>

              <p className="mt-3 text-[10px] text-gray-400 text-center">
                🔒 Paiement sécurisé · Livraison sous 24-48h
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
