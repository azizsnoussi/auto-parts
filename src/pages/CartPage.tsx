import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft, ArrowRight, Package, Truck } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { updateQuantity, removeItem, clearCart } from '../store/slices/cartSlice'
import { useTranslation } from 'react-i18next'

export default function CartPage() {
  const { i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const items = useAppSelector((s) => s.cart.items)

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const shipping = subtotal >= 200 || subtotal === 0 ? 0 : 9
  const tax = subtotal * 0.19
  const total = subtotal + tax + shipping

  const getName = (item: any) => i18n.language === 'fr' && item.nameFr ? item.nameFr : item.name

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gold-50 shadow-elev-1">
          <ShoppingCart size={40} className="animate-bob text-gold-500" />
        </div>
        <h2 className="text-2xl font-black text-ink-900">Votre panier est vide</h2>
        <p className="mt-2 text-sm font-medium text-ink-400">Découvrez nos pièces auto et ajoutez-les à votre panier</p>
        <Link to="/shop" className="ba-press ba-shine relative mt-6 flex items-center gap-2 overflow-hidden rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-ink-900 shadow-gold-md transition-colors hover:bg-gold-600">
          <ArrowLeft size={14} /> Parcourir la boutique
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-ink-900">Mon Panier</h1>
          <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="ba-nums mt-2 text-sm font-medium text-ink-400">{items.length} article{items.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => dispatch(clearCart())}
          className="ba-press text-xs font-bold text-red-500 transition-colors hover:text-red-700">
          Vider le panier
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="group flex gap-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-elev-1 transition-all duration-300 ease-out-expo hover:border-gold-300 hover:shadow-elev-2"
              >
                {/* Image */}
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gold-50/50">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={getName(item)} className="h-full w-full object-contain p-2 transition-transform duration-500 ease-out-expo group-hover:scale-105" />
                  ) : (
                    <Package size={28} className="text-ink-200" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-gold-600">{item.brand}</p>
                  <h3 className="truncate font-bold text-ink-900">{getName(item)}</h3>
                  <p className="ba-nums mt-1 text-lg font-black text-ink-900">{item.price.toFixed(2)} TND</p>

                  {/* Quantity controls */}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center overflow-hidden rounded-full border-2 border-ink-100">
                      <button
                        onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}
                        aria-label="Diminuer la quantité"
                        className="ba-press flex h-8 w-8 items-center justify-center text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-600"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="ba-nums w-10 text-center text-sm font-bold text-ink-900">{item.quantity}</span>
                      <button
                        onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                        aria-label="Augmenter la quantité"
                        className="ba-press flex h-8 w-8 items-center justify-center text-ink-400 transition-colors hover:bg-gold-50 hover:text-gold-600"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => dispatch(removeItem(item.id))}
                      aria-label="Retirer l'article"
                      className="ba-press flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className="ba-nums ml-auto text-sm font-black text-ink-900">
                      {(item.price * item.quantity).toFixed(2)} TND
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-40 rounded-2xl border border-ink-100 bg-white p-6 shadow-elev-2">
            <h3 className="mb-5 text-lg font-black text-ink-900">Résumé</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-400">Sous-total</span>
                <span className="ba-nums font-bold text-ink-900">{subtotal.toFixed(2)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">TVA (19%)</span>
                <span className="ba-nums font-bold text-ink-900">{tax.toFixed(2)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Livraison</span>
                <span className="ba-nums font-bold text-ink-900">{shipping === 0 ? 'Gratuite' : `${shipping.toFixed(2)} TND`}</span>
              </div>
              {shipping > 0 && (
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                  <Truck size={12} className="shrink-0" /> Livraison gratuite dès 200 TND
                </p>
              )}
              <hr className="border-ink-100" />
              <div className="flex justify-between text-lg">
                <span className="font-black text-ink-900">Total TTC</span>
                <span className="ba-nums font-black text-gold-600">{total.toFixed(2)} TND</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/checkout')}
              className="ba-press ba-shine relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gold-500 py-3.5 text-sm font-bold text-ink-900 shadow-gold-md transition-colors hover:bg-gold-600"
            >
              Passer la commande <ArrowRight size={16} />
            </button>
            <Link to="/shop" className="group mt-3 flex w-full items-center justify-center gap-2 text-xs font-bold text-ink-400 transition-colors hover:text-gold-600">
              <ArrowLeft size={12} className="transition-transform duration-300 ease-out-expo group-hover:-translate-x-1" /> Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
