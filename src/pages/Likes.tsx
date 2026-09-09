import { Heart, PackageSearch, ShoppingCart, Star } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import { useAppSelector } from "../store/hooks"
import { productsApi } from "../lib/api"
import WishlistButton from "../components/WishlistButton"

export default function Likes() {
  const { t, i18n } = useTranslation()
  const liked = useAppSelector((state) => state.wishlist.liked)
  const { data, isLoading } = useQuery({
    queryKey: ['wishlist-products', liked],
    queryFn: async () => Promise.all(liked.map(async (id) => {
      try { return (await productsApi.getById(id)).data?.data }
      catch { return null }
    })),
    enabled: liked.length > 0,
  })
  const products = (data ?? []).filter(Boolean)

  return (
    <main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-12">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[.2em] text-gold-600">{t('wishlist.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black text-ink-900">{t('wishlist.title')}</h1>
        <p className="mt-2 text-sm text-ink-400">{t('wishlist.subtitle')}</p>
      </div>
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{liked.map(id => <div key={id} className="ba-skeleton h-80 rounded-2xl" />)}</div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-20 text-center">
          <Heart size={46} className="mb-4 text-ink-200" />
          <h2 className="text-lg font-black text-ink-700">{t('wishlist.emptyTitle')}</h2>
          <p className="mt-2 max-w-md text-sm text-ink-400">{t('wishlist.empty')}</p>
          <Link to="/shop" className="ba-press mt-6 rounded-full bg-gold-500 px-6 py-3 text-sm font-black text-ink-900 shadow-gold-sm hover:bg-gold-600">
            {t('wishlist.browse')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product: any, index) => {
            const name = i18n.language.startsWith('fr') ? product.nameFr || product.name : product.name
            const price = Number(product.discountedPrice ?? product.price ?? 0)
            return <motion.article key={product.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-elev-1 hover:border-gold-300">
              <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-gray-50 to-gold-50/40">
                {product.imageUrl ? <img src={product.imageUrl} alt={name} className="h-full w-full object-contain p-4" /> : <PackageSearch size={40} className="text-ink-200" />}
                <WishlistButton productId={product.id} iconSize={14} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-black italic text-ink-400">{product.brand || '—'}</p>
                <Link to={`/shop/${product.id}`} className="mt-1 min-h-10 text-sm font-bold text-ink-800 line-clamp-2 hover:text-gold-600">{name}</Link>
                <div className="mt-2 flex items-center gap-1 text-xs text-ink-400"><Star size={12} className={(product.reviewCount ?? 0) > 0 ? 'fill-gold-500 text-gold-500' : 'text-ink-200'} />{(product.reviewCount ?? 0) > 0 ? t('wishlist.reviewSummary', { rating: Number(product.averageRating ?? 0).toFixed(1), count: product.reviewCount }) : t('wishlist.noReviews')}</div>
                <p className="ba-nums mt-4 text-lg font-black text-ink-900">{price.toFixed(2)} TND</p>
                <Link to={`/shop/${product.id}`} className="ba-press mt-auto flex items-center justify-center gap-2 rounded-full bg-gold-500 px-4 py-2.5 text-xs font-black text-ink-900 hover:bg-gold-600"><ShoppingCart size={14} /> {t('wishlist.viewProduct')}</Link>
              </div>
            </motion.article>
          })}
        </div>
      )}
    </main>
  )
}
