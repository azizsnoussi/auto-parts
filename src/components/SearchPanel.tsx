import { Search } from "lucide-react"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { setQuery, loadPieces } from "../store/slices/productsSlice"

export default function SearchPanel() {
  const dispatch = useAppDispatch()
  const query = useAppSelector((state) => state.products.query)

  const handleSearch = () => {
    dispatch(loadPieces(query))
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
      <label className="search-input">
        <Search size={20} />
        <input
          value={query}
          onChange={(event) => dispatch(setQuery(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSearch()
          }}
          placeholder="Chercher une piece: filtre, plaquette, huile, reference..."
        />
      </label>
      <button className="filter-button" onClick={handleSearch}>
        <Search size={18} /> Rechercher les pieces
      </button>
    </div>
  )
}
