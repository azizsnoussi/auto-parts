import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Search } from "lucide-react"

export function SearchBar() {
  return (
    <Card className="p-1 rounded-2xl shadow-md">
      <h1 className="text-xl font-bold text-center mb-4">Trouvez vos pièces auto</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section RECHERCHER PAR MODÈLE */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <h3 className="font-bold text-sm">RECHERCHER PAR MODÈLE</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-md">
            <input type="text" placeholder="Marque" className="px-2 py-1 border rounded-2xl w-full text-sm" />
            <input type="text" placeholder="Modèle" className="px-2 py-1 border rounded-2xl w-full text-sm" />
            <input type="text" placeholder="Motorisation" className="px-2 py-1 border rounded-2xl w-full text-sm" />
          </div>
        </div>

        {/* Section RECHERCHER UNE PIÈCE */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <h3 className="font-bold text-sm">RECHERCHER UNE PIÈCE</h3>
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="EX : ABC123, Plaquette de Frein"
              className="w-full px-2 py-1 border rounded-2xl text-sm"
            />
            <Button
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-xl p-1 bg-transparent border-none focus:outline-none active:outline-none hover:bg-transparent hover:text-black">
              <Search className="h-6 w-6 text-black" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}