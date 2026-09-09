"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

const brands = ["MOBIL", "SHELL", "TotalEnergies", "Bolk", "Elf"]

export function Filter() {
  const [sortBy, setSortBy] = useState("relevance")
  const [selectedBrands, setSelectedBrands] = useState(["MOBIL"])
  const [isHuileExpanded, setIsHuileExpanded] = useState(true)

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filtrer | Trier</span>
          <span className="text-sm text-gray-500">4 Produits</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="inline-flex items-center">
            <input
              type="radio"
              checked={sortBy === "relevance"}
              onChange={() => setSortBy("relevance")}
              className="form-radio text-[#F3B233]"
            />
            <span className="ml-2">Par Pertinence</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              checked={sortBy === "price-asc"}
              onChange={() => setSortBy("price-asc")}
              className="form-radio text-[#F3B233]"
            />
            <span className="ml-2">Du - cher au + cher</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              checked={sortBy === "price-desc"}
              onChange={() => setSortBy("price-desc")}
              className="form-radio text-[#F3B233]"
            />
            <span className="ml-2">Du + cher au - cher</span>
          </label>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-bold mb-4">Caractéristiques techniques</h3>
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setIsHuileExpanded(!isHuileExpanded)}
          >
            <span>Huile</span>
            {isHuileExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {isHuileExpanded && (
            <div className="mt-4 space-y-2">
              {brands.map((brand) => (
                <label key={brand} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brand)}
                    onChange={() => {
                      if (selectedBrands.includes(brand)) {
                        setSelectedBrands(selectedBrands.filter((b) => b !== brand))
                      } else {
                        setSelectedBrands([...selectedBrands, brand])
                      }
                    }}
                    className="form-checkbox text-[#F3B233]"
                  />
                  <span className="ml-2">{brand}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

