import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Search, SlidersHorizontal, ShoppingCart, Star, PackageSearch } from 'lucide-react'
import { productsApi, categoriesApi } from '../lib/api'
import { useAppDispatch } from '../store/hooks'
import { addToCart, CartProduct } from '../store/slices/cartSlice'
import { toast } from 'sonner'
import WishlistButton from '../components/WishlistButton'

// The backend may omit any of the optional fields, so nothing below is assumed
// to be present — the card reserves space for each slot instead.
interface Product {
  id: number; name: string; nameFr?: string; brand?: string; price?: number
  discountedPrice?: number; stockQuantity?: number; imageUrl?: string; oemReference?: string
  averageRating?: number; reviewCount?: number
}

const SORT_OPTIONS = [
  { key: 'relevance', label: 'Par Pertinence',      sortBy: 'name',  sortDir: 'asc'  },
  { key: 'priceAsc',  label: 'Du - cher au + cher', sortBy: 'price', sortDir: 'asc'  },
  { key: 'priceDesc', label: 'Du + cher au - cher', sortBy: 'price', sortDir: 'desc' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['key']

export default function Shop() {
  const { t, i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const [search, setSearch]         = useState('')
  const [brand, setBrand]           = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [minPrice, setMinPrice]     = useState('')
  const [maxPrice, setMaxPrice]     = useState('')
  const [inStock, setInStock]       = useState(false)
  const [sort, setSort]             = useState<SortKey>('relevance')
  const [page, setPage]             = useState(0)
  // Only drives the panel below `lg`; from `lg` up the sidebar is always
  // rendered, so the filters are active without the user opening anything.
  const [showFilters, setShowFilters] = useState(false)

  const activeSort = SORT_OPTIONS.find(o => o.key === sort) ?? SORT_OPTIONS[0]

  const getName = (p: Product) => (i18n.language === 'fr' ? p.nameFr || p.name : p.name) || ''

  const handleAddToCart = (product: Product) => {
    const item: CartProduct = {
      id: product.id,
      name: product.name,
      nameFr: product.nameFr,
      brand: product.brand ?? '',
      price: Number(product.discountedPrice ?? product.price ?? 0),
      discountedPrice: product.discountedPrice,
      imageUrl: product.imageUrl,
      stockQuantity: product.stockQuantity ?? 0,
    }
    dispatch(addToCart(item))
    toast.success(`${getName(product)} ajouté au panier`)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, brand, categoryId, minPrice, maxPrice, inStock, sort, page],
    queryFn: () => productsApi.list({ search: search || undefined, brand: brand || undefined,
      categoryId: categoryId || undefined, minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined, inStock: inStock || undefined,
      sortBy: activeSort.sortBy, sortDir: activeSort.sortDir, page, size: 20 }),
  })

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })

  const products: Product[] = data?.data?.data?.content ?? []
  const totalPages: number  = data?.data?.data?.totalPages ?? 0
  const categories           = catData?.data?.data ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink-900">{t('shop.title')}</h1>
          <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
          <p className="mt-2 text-sm text-ink-400">
            <span className="ba-nums font-semibold text-ink-600">{data?.data?.data?.totalElements ?? 0}</span> produits disponibles
          </p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="ba-press flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-600 shadow-elev-1 transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-gold-400 hover:text-gold-600 hover:shadow-gold-sm lg:hidden">
          <SlidersHorizontal size={15} className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />Filtres
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar filters — always on from `lg`, toggled below it */}
        <motion.aside initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`w-full shrink-0 lg:block lg:w-60 ${showFilters ? 'block' : 'hidden'}`}>
          <div className="rounded-2xl border border-ink-100 bg-white p-5 space-y-5 shadow-elev-2 lg:sticky lg:top-40">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-900">Filtrer | Trier</h3>
              <button onClick={() => { setBrand(''); setCategoryId(null); setMinPrice(''); setMaxPrice(''); setInStock(false); setSort('relevance'); setPage(0) }}
                className="text-xs text-ink-300 hover:text-gold-600 transition-colors">Réinitialiser</button>
            </div>

            {/* Sort */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-300">Trier par</p>
              <div className="space-y-1">
                {SORT_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sort" className="accent-gold-500"
                      checked={sort === opt.key}
                      onChange={() => { setSort(opt.key); setPage(0) }} />
                    <span className={`text-xs ${sort === opt.key ? 'font-bold text-gold-700' : 'font-medium text-ink-600'}`}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-300">{t('shop.filterCategory')}</p>
              <div className="space-y-1">
                {[{ id: null, name: t('common.all'), nameFr: t('common.all') }, ...categories].map((cat: any) => (
                  <button key={cat.id ?? 'all'} onClick={() => { setCategoryId(cat.id); setPage(0) }}
                    className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors ${categoryId === cat.id ? 'bg-gold-50 text-gold-700 font-bold' : 'text-ink-600 hover:bg-gray-50 hover:text-gold-600'}`}>
                    {i18n.language === 'fr' ? cat.nameFr || cat.name : cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-300">Prix (TND)</p>
              <div className="flex gap-2">
                <input value={minPrice} onChange={e => { setMinPrice(e.target.value); setPage(0) }} placeholder="Min"
                  className="ba-nums w-full rounded-lg border border-ink-100 bg-gray-50 px-2 py-1.5 text-xs text-ink-700 outline-none transition-colors focus:border-gold-500 focus:bg-white" />
                <input value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setPage(0) }} placeholder="Max"
                  className="ba-nums w-full rounded-lg border border-ink-100 bg-gray-50 px-2 py-1.5 text-xs text-ink-700 outline-none transition-colors focus:border-gold-500 focus:bg-white" />
              </div>
            </div>

            {/* In stock */}
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={inStock} onChange={e => { setInStock(e.target.checked); setPage(0) }}
                className="h-4 w-4 rounded accent-gold-500" />
              <span className="text-xs font-medium text-ink-600">{t('shop.inStock')}</span>
            </label>
          </div>
        </motion.aside>

        {/* Product grid */}
        <div className="flex-1">
          {/* Search bar */}
          <div className="mb-6 relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 transition-colors group-focus-within:text-gold-600" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder={t('shop.search')}
              className="w-full rounded-xl border-2 border-ink-100 bg-white py-3 pl-10 pr-4 text-sm text-ink-700 placeholder-ink-300 outline-none shadow-elev-1 transition-all duration-300 ease-out-expo focus:border-gold-500 focus:shadow-gold-sm" />
          </div>

          {isLoading ? (
            <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-elev-1">
                  <div className="ba-skeleton h-44 w-full" />
                  <div className="space-y-2.5 p-4">
                    <div className="ba-skeleton h-4 w-1/3 rounded" />
                    <div className="ba-skeleton h-10 w-4/5 rounded" />
                    <div className="ba-skeleton h-4 w-2/3 rounded" />
                    <div className="ba-skeleton h-4 w-1/2 rounded" />
                    <div className="ba-skeleton h-11 w-1/2 rounded" />
                    <div className="ba-skeleton h-9 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-ink-300">
              <PackageSearch size={44} className="mb-3 animate-bob opacity-50" />
              <p className="font-semibold text-ink-500">Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product, i) => {
                // Every optional field gets a defined fallback so the card body
                // keeps identical slot heights whatever the API returns.
                const price    = Number(product.price ?? 0)
                const discount = product.discountedPrice != null && price > 0 && Number(product.discountedPrice) < price
                  ? Number(product.discountedPrice)
                  : null
                const stock    = product.stockQuantity ?? 0
                const reviews  = product.reviewCount ?? 0
                const rating   = Number(product.averageRating ?? 0)

                return (
                <motion.div key={product.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="ba-lift group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-elev-1 transition-colors hover:border-gold-300">
                  {/* Image */}
                  <div className="relative h-44 shrink-0 overflow-hidden bg-gradient-to-br from-gray-50 to-gold-50/40 flex items-center justify-center">
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt={getName(product)} loading="lazy"
                          className="h-full w-full object-contain p-4 transition-transform duration-500 ease-out-expo group-hover:scale-105" />
                      : <PackageSearch size={40} className="text-ink-200" />
                    }
                    <WishlistButton
                      productId={product.id}
                      iconSize={14}
                      className="ba-press absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-ink-100 bg-white/90 text-ink-300 shadow-elev-1 backdrop-blur transition-all duration-300 ease-out-expo hover:border-red-200 hover:text-red-500"
                    />
                    {stock === 0 && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-900/45 backdrop-blur-[1px]">
                        <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-elev-2">{t('shop.outOfStock')}</span>
                      </div>
                    )}
                    {discount !== null && (
                      <div className="absolute left-2 top-2 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-black text-ink-900 shadow-gold-sm">
                        -{Math.round((1 - discount / price) * 100)}%
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    {/* Brand — fixed height so a missing brand does not shift the name up */}
                    <p className={`h-4 truncate text-xs font-black italic ${product.brand ? 'text-ink-500' : 'text-ink-200'}`}>
                      {product.brand || '—'}
                    </p>
                    {/* Name — always two lines tall */}
                    <h3 className="mt-0.5 min-h-[2.25rem] text-sm font-semibold text-ink-800 line-clamp-2 leading-snug transition-colors group-hover:text-gold-700">
                      {getName(product) || '—'}
                    </h3>
                    {/* Reference */}
                    <p className={`ba-nums mt-1 h-4 truncate text-[10px] font-bold ${product.oemReference ? 'text-gold-600' : 'text-ink-200'}`}>
                      Réf : {product.oemReference || '—'}
                    </p>
                    {/* Stock */}
                    <p className="mt-1 flex h-4 items-center gap-1.5 text-[10px] font-bold">
                      <span className={`h-1.5 w-1.5 rounded-full ${stock > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={stock > 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {stock > 0 ? 'En Stock' : 'Rupture'}
                      </span>
                    </p>

                    {/* Rating — the row is always present, only its content changes */}
                    <div className="mt-1.5 flex h-4 items-center gap-1">
                      <Star size={11} className={reviews > 0 ? 'fill-gold-500 text-gold-500' : 'text-ink-200'} />
                      {reviews > 0 ? (
                        <>
                          <span className="ba-nums text-[11px] font-semibold text-ink-600">{rating.toFixed(1)}</span>
                          <span className="ba-nums text-[10px] text-ink-300">({reviews})</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold text-ink-200">Pas d’avis</span>
                      )}
                    </div>

                    {/* Price — reserves the strike-through line even without a discount */}
                    <div className="mt-3 h-11">
                      <p className="ba-nums text-lg font-black text-ink-900">
                        {(discount ?? price).toFixed(2)} TND <span className="text-[10px] font-semibold text-ink-300">TTC</span>
                      </p>
                      <p className={`ba-nums text-xs text-ink-300 ${discount !== null ? 'line-through' : 'invisible'}`}>
                        {price.toFixed(2)} TND
                      </p>
                    </div>

                    {/* Actions pinned to the bottom of every card */}
                    <div className="mt-auto flex gap-2 pt-3">
                      <Link to={`/shop/${product.id}`}
                        className="ba-press flex-1 flex items-center justify-center gap-1 rounded-full border-2 border-ink-100 py-2 text-xs font-bold text-ink-600 transition-colors hover:border-gold-400 hover:text-gold-600">
                        Voir
                      </Link>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={stock <= 0}
                        className="ba-press ba-shine relative flex-1 flex items-center justify-center gap-1.5 overflow-hidden rounded-full bg-gold-500 py-2 text-xs font-bold text-ink-900 shadow-gold-sm transition-colors hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                        <ShoppingCart size={13} /> Ajouter
                      </button>
                    </div>
                  </div>
                </motion.div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} aria-label="Page précédente"
                className="ba-press flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink-100 bg-white text-sm font-bold text-ink-600 transition-colors hover:border-gold-400 hover:text-gold-600 disabled:opacity-40">
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`ba-press ba-nums flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ease-out-expo ${page === i ? 'border-gold-500 bg-gold-500 text-ink-900 shadow-gold-sm' : 'border-ink-100 bg-white text-ink-600 hover:border-gold-400 hover:text-gold-600'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label="Page suivante"
                className="ba-press flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink-100 bg-white text-sm font-bold text-ink-600 transition-colors hover:border-gold-400 hover:text-gold-600 disabled:opacity-40">
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
