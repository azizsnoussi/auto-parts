import { KeyFeatures } from "@/components/key-features"
import { PartsGrid } from "@/components/parts-grid"
import { SearchBar } from "@/components/search-bar"
import Link from "next/link"

const categories = [
  { name: "Huile", slug: "huile" },
  { name: "Batterie", slug: "batterie" },
  { name: "Pneus", slug: "pneus" },
  { name: "Freins", slug: "freins" },
  { name: "Marques", slug: "marques" },
  { name: "Véhicules", slug: "vehicules" },
]

export default function PiecesAutoPage() {
  return (
    <main className="min-h-screen flex flex-col overflow-y-auto pt-[110px]">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-1"></div> {/* Espace vide à gauche */}
    
              <div className="container mx-auto px-4 py-8 space-y-12 md:col-span-10">
                <SearchBar />
                <section>
                  <h2 className="text-2xl font-bold text-center mb-8">
                    FAMILLES DES PIÈCES
                  </h2>
                  <PartsGrid />
                </section>
                <KeyFeatures />
              </div>
            </div>
          </div>
        </main>
  )
}
