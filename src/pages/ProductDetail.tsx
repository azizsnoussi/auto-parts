import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Star, Package, PackageSearch, ArrowLeft, ShoppingCart, ShieldCheck, Weight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '../lib/api'
import { useAppDispatch } from '../store/hooks'
import { addToCart, CartProduct } from '../store/slices/cartSlice'
import { toast } from 'sonner'
import WishlistButton from '../components/WishlistButton'

export default function ProductDetail() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  // Simplified product detail — reads product ID from URL
  const id = parseInt(window.location.pathname.split('/').pop() ?? '0')

  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id),
    enabled: !!id,
  })
  const p = data?.data?.data

  if (isLoading) return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="ba-skeleton h-80 rounded-3xl" />
        <div className="space-y-4">
          <div className="ba-skeleton h-3 w-24 rounded" />
          <div className="ba-skeleton h-9 w-4/5 rounded" />
          <div className="ba-skeleton h-4 w-1/3 rounded" />
          <div className="ba-skeleton h-12 w-2/5 rounded" />
          <div className="ba-skeleton h-24 w-full rounded-xl" />
          <div className="ba-skeleton h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )

  if (!p) return (
    <div className="flex flex-col items-center justify-center py-28 text-ink-300">
      <PackageSearch size={48} className="mb-4 animate-bob opacity-50" />
      <p className="text-lg font-bold text-ink-600">Produit introuvable</p>
      <Link to="/shop" className="ba-underline mt-4 text-sm font-semibold text-gold-600">
        Retour à la boutique
      </Link>
    </div>
  )

  const name = i18n.language === 'fr' ? p.nameFr : p.name
  const desc = i18n.language === 'fr' ? p.descriptionFr : p.description

  const toCartItem = (): CartProduct => ({
    id: p.id, name: p.name, nameFr: p.nameFr,
    brand: p.brand, price: p.discountedPrice ?? p.price,
    discountedPrice: p.discountedPrice, imageUrl: p.imageUrl,
    stockQuantity: p.stockQuantity,
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <Link
        to="/shop"
        className="group mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-400 transition-colors hover:text-gold-600"
      >
        <ArrowLeft size={15} className="transition-transform duration-300 ease-out-expo group-hover:-translate-x-1" />
        Retour à la boutique
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="ba-shine group relative flex h-80 items-center justify-center overflow-hidden rounded-3xl border border-ink-100 bg-gradient-to-br from-gray-50 to-gold-50/50 shadow-elev-2"
        >
          {p.imageUrl
            ? <img
                src={p.imageUrl}
                alt={name}
                className="max-h-64 object-contain p-6 transition-transform duration-500 ease-out-expo group-hover:scale-105"
              />
            : <Package size={80} className="text-ink-200" />
          }
          {p.discountedPrice && (
            <span className="absolute left-4 top-4 rounded-full bg-gold-500 px-3 py-1 text-xs font-black text-ink-900 shadow-gold-sm">
              -{Math.round((1 - p.discountedPrice / p.price) * 100)}%
            </span>
          )}
          <WishlistButton
            productId={p.id}
            className="ba-press absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-ink-100 bg-white/90 text-ink-300 shadow-elev-1 backdrop-blur transition-colors hover:border-red-200 hover:text-red-500"
          />
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-gold-600">{p.brand}</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-ink-900">{name}</h1>
          <div className="mt-3 h-1 w-14 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />

          {p.oemReference && (
            <p className="ba-nums mt-3 font-mono text-sm text-ink-400">OEM: {p.oemReference}</p>
          )}

          <div className="mt-3 flex items-center gap-2" aria-label={t('wishlist.ratingOutOfFive', { rating: Number(p.averageRating ?? 0).toFixed(1) })}>
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < Math.round(p.averageRating ?? 0) ? 'fill-gold-500 text-gold-500' : 'text-ink-200'} />
                ))}
              </div>
              <span className="ba-nums text-sm text-ink-400">
                {(p.reviewCount ?? 0) > 0
                  ? t('wishlist.reviewSummary', { rating: Number(p.averageRating ?? 0).toFixed(1), count: p.reviewCount })
                  : t('wishlist.noReviews')}
              </span>
          </div>

          <div className="mt-5 flex items-end gap-3">
            {p.discountedPrice ? (
              <>
                <span className="ba-nums text-4xl font-black text-gold-600">{p.discountedPrice.toFixed(2)} TND</span>
                <span className="ba-nums mb-1 text-xl text-ink-300 line-through">{p.price.toFixed(2)}</span>
              </>
            ) : (
              <span className="ba-nums text-4xl font-black text-ink-900">{p.price.toFixed(2)} TND</span>
            )}
          </div>

          {/* Stock */}
          <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${p.stockQuantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${p.stockQuantity > 0 ? 'bg-emerald-500 ba-pulse-dot' : 'bg-red-500'}`} />
            {p.stockQuantity > 0 ? `${p.stockQuantity} en stock` : 'Rupture de stock'}
          </div>

          {desc && <p className="mt-5 text-sm leading-relaxed text-ink-500">{desc}</p>}

          {/* Specs */}
          {(p.weight || p.warrantyMonths) && (
            <div className="mt-6 rounded-2xl border border-ink-100 bg-gold-50/60 p-4 shadow-elev-1">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Spécifications</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {p.weight && (
                  <div className="flex items-center gap-2 text-sm">
                    <Weight size={15} className="shrink-0 text-gold-600" />
                    <span className="text-ink-400">Poids:</span>
                    <span className="ba-nums font-semibold text-ink-800">{p.weight} kg</span>
                  </div>
                )}
                {p.warrantyMonths && (
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck size={15} className="shrink-0 text-gold-600" />
                    <span className="text-ink-400">Garantie:</span>
                    <span className="ba-nums font-semibold text-ink-800">{p.warrantyMonths} mois</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            disabled={p.stockQuantity === 0}
            onClick={() => {
              dispatch(addToCart(toCartItem()))
              toast.success(`${name} ajouté au panier`)
            }}
            className="ba-press ba-shine relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gold-500 py-4 text-sm font-bold text-ink-900 shadow-gold-md transition-colors hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <ShoppingCart size={18} /> Ajouter au panier
          </button>
          <button
            onClick={() => {
              dispatch(addToCart(toCartItem()))
              navigate('/cart')
            }}
            disabled={p.stockQuantity === 0}
            className="ba-press mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink-200 py-3 text-sm font-bold text-ink-600 transition-colors hover:border-gold-500 hover:text-gold-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Acheter maintenant
          </button>
        </motion.div>
      </div>
    </div>
  )
}
