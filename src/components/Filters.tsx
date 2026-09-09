import { useAppDispatch, useAppSelector } from "../store/hooks"
import { setCategory, setStockFilter } from "../store/slices/productsSlice"
import VehicleSelector from "./VehicleSelector"
import SearchPanel from "./SearchPanel"

const categories = ["Tous", "Filtration", "Freinage", "Batteries", "Suspension", "Huiles", "Moteur"]
const stockFilters = ["Tous", "En stock", "Epuisée", "Par commande"] as const

export default function Filters() {
  const dispatch = useAppDispatch()
  const category = useAppSelector((state) => state.products.category)
  const stockFilter = useAppSelector((state) => state.products.stockFilter)

  return (
    <div className="search-panel">
      <VehicleSelector />
      <SearchPanel />
      <div className="filter-groups">
        <div>
          <h3>Famille produit</h3>
          <div className="category-row">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "category active" : "category"}
                onClick={() => dispatch(setCategory(item))}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3>Disponibilite</h3>
          <div className="category-row">
            {stockFilters.map((item) => (
              <button
                key={item}
                className={stockFilter === item ? "category active" : "category"}
                onClick={() => dispatch(setStockFilter(item))}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
