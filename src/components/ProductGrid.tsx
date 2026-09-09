import { AnimatePresence, motion } from "framer-motion"
import { Heart, Plus, Star } from "lucide-react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { toggleLike } from "../store/slices/wishlistSlice"
import { addToCart } from "../store/slices/cartSlice"
import { Product } from "../types"
import StockBadge from "./StockBadge"

type ProductGridProps = {
  products: Product[]
}

export default function ProductGrid({ products }: ProductGridProps) {
  const dispatch = useAppDispatch()
  const liked = useAppSelector((state) => state.wishlist.liked)

  return (
    <motion.div layout className="product-grid">
      <AnimatePresence>
        {products.map((product, index) => (
          <motion.article
            layout
            key={product.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.04 }}
            className="product-card"
          >
            <div className="product-media">
              <img src={product.image} alt={product.name} />
              <span>{product.badge}</span>
              <button
                className={liked.includes(product.id) ? "like-button active" : "like-button"}
                onClick={() => dispatch(toggleLike(product.id))}
                aria-label="Favori"
              >
                <Heart size={19} fill={liked.includes(product.id) ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <strong>{product.brand}</strong>
                <span className="flex items-center gap-1 text-[#a47f14]">
                  <Star size={15} fill="currentColor" /> {product.rating}
                </span>
              </div>
              <h3 className="mt-3 min-h-14 text-lg font-black">{product.name}</h3>
              <p className="mt-2 text-sm text-zinc-500">
                {product.car} · {product.category}
              </p>
              {(product.productType || product.usage || product.eans || product.oeNumbers) && (
                <div className="product-tecdoc">
                  {product.productType && <p><strong>Type:</strong> {product.productType}</p>}
                  {product.usage && <p><strong>Usage:</strong> {product.usage}</p>}
                  {product.eans && <p><strong>EAN:</strong> {product.eans}</p>}
                  {product.oeNumbers && <p><strong>OE:</strong> {product.oeNumbers}</p>}
                </div>
              )}
              {product.attributes && <p className="product-attrs">{product.attributes}</p>}
              <StockBadge product={product} />
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-black">{product.price.toFixed(2)} TND</p>
                  {product.oldPrice && <p className="text-sm text-zinc-400 line-through">{product.oldPrice.toFixed(2)} TND</p>}
                </div>
                <button
                  className="cart-button"
                  onClick={() => dispatch(addToCart({
                    id: product.id, name: product.name, brand: product.brand,
                    price: product.price, imageUrl: product.image,
                    stockQuantity: product.stock ?? (product.status === 'Epuisée' ? 0 : 10),
                  }))}
                  disabled={product.status === "Epuisée"}
                >
                  <Plus size={18} /> {product.status === "Par commande" ? "Commander" : "Ajouter"}
                </button>
              </div>
            </div>
          </motion.article>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
