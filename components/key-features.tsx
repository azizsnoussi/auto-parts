import { Truck, Phone, DollarSign, Award } from "lucide-react"

export function KeyFeatures() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div className="flex flex-col items-center gap-4">
        <Truck className="h-12 w-12 text-[#D4AF37]" />
        <div className="text-center">
          <h3 className="font-bold">Livraison Gratuite</h3>
          <p className="text-sm text-gray-600">À partir de 120dt</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4">
        <Phone className="h-12 w-12 text-[#D4AF37]" />
        <div className="text-center">
          <h3 className="font-bold">Service Client</h3>
          <p className="text-sm text-gray-600">(+216) 25199188</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4">
        <DollarSign className="h-12 w-12 text-[#D4AF37]" />
        <div className="text-center">
          <h3 className="font-bold">Les Meilleurs Prix</h3>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 md:col-start-4">
        <Award className="h-12 w-12 text-[#D4AF37]" />
        <div className="text-center">
          <h3 className="font-bold">La Meilleur Qualité</h3>
        </div>
      </div>
    </div>
  )
}
