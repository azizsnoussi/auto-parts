import { useMemo } from "react"
import { SlidersHorizontal } from "lucide-react"
import { useAppSelector } from "../store/hooks"
import PageShell from "../components/PageShell"
import Filters from "../components/Filters"
import ProductGrid from "../components/ProductGrid"

export default function Filtration() {
  const { products, query, category, stockFilter } = useAppSelector((state) => state.products)

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase()
    return products.filter((product) => {
      const categoryOk = category === "Tous" || product.category === category
      const stockOk = stockFilter === "Tous" || product.status === stockFilter
      const searchOk =
        text.length === 0 ||
        `${product.name} ${product.brand} ${product.car} ${product.category} ${product.status} ${product.productType || ""} ${product.attributes || ""} ${product.eans || ""} ${product.oeNumbers || ""}`
          .toLowerCase()
          .includes(text)
      return categoryOk && stockOk && searchOk
    })
  }, [products, category, query, stockFilter])

  return (
    <PageShell eyebrow="Filtration des produits" title="Recherche avancee par categorie, stock et commande">
      <div className="filter-info">
        <SlidersHorizontal />
        <p>Cette page sert a filtrer tous les produits: en stock, epuisee, par commande, par marque, voiture ou famille de piece.</p>
      </div>
      <Filters />
      <ProductGrid products={filteredProducts} />
    </PageShell>
  )
}
