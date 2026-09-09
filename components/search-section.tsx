"use client"

import { useState } from "react"
import { Search } from "lucide-react"

export function SearchSection() {
  const [selectedModel, setSelectedModel] = useState({
    brand: "BMW",
    model: "3 Coupé (E36)",
    engine: "Essence M3 3.0",
  })

  return (
    <div className="bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-center text-[#F3B233] mb-8">Trouvez vos pièces auto</h2>
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div>
          <h3 className="font-bold mb-4">RECHERCHER PAR MODÈLE</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={selectedModel.brand}
              className="px-4 py-2 border rounded flex-1"
              placeholder="Marque"
            />
            <input
              type="text"
              value={selectedModel.model}
              className="px-4 py-2 border rounded flex-1"
              placeholder="Modèle"
            />
            <input
              type="text"
              value={selectedModel.engine}
              className="px-4 py-2 border rounded flex-1"
              placeholder="Motorisation"
            />
          </div>
        </div>
        <div>
          <h3 className="font-bold mb-4">RECHERCHER UNE PIÈCE</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="EX : ABC123, Plaquette de Frein"
              className="w-full px-4 py-2 border rounded pr-12"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2">
              <Search className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

