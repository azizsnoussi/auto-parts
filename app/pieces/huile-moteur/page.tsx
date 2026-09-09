import { Filter } from "@/components/filter"
import { ProductGrid } from "@/components/product-grid"
import { Breadcrumb } from "@/components/breadcrumb"
import { SearchSection } from "@/components/search-section"
import { SearchBar } from "@/components/search-bar"

export default function OilProductPage() {
  return (
    <main className="min-h-screen flex flex-col overflow-y-auto pt-[110px]">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-1"></div> {/* Espace vide à gauche */}

          <div className="container mx-auto px-4 py-8 space-y-12 md:col-span-10">
            <SearchBar />
            <section>
              <Breadcrumb
                items={[
                  { label: "Pièces auto", href: "/pieces" },
                  { label: "Huile moteur", href: "/pieces/huile-moteur" },
                  { label: "Huile moteur BMW", href: "/pieces/huile-moteur/bmw" },
                  { label: "Huile moteur BMW Série 3", href: "/pieces/huile-moteur/bmw/serie-3" },
                ]}
              />
              <h1 className="text-xl font-bold mt-6 mb-8">
                Huile moteur BMW 3 Compact E36 1.9 316 i (105Ch) 1999 - 2000
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <Filter />
                <div className="md:col-span-3">
                  <ProductGrid />
                </div>
              </div>
            </section>
          </div>

          <div className="md:col-span-1"></div> {/* Espace vide à droite */}
        </div>
      </div>
    </main>
  )
}
