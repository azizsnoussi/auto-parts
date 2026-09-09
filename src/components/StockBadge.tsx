import { Product } from "../types"

export default function StockBadge({ product }: { product: Product }) {
  return (
    <span className={`stock-badge ${product.status.toLowerCase().replace("é", "e").replace(" ", "-")}`}>
      {product.status} · Stock {product.stock}
    </span>
  )
}
