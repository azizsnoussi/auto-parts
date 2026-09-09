import { Card } from "@/components/ui/card"

const parts = [
  { name: "Pièces moteur", icon: "🔧" },
  { name: "Directions Suspension Train", icon: "🔩" },
  { name: "Filtration", icon: "🔄" },
  { name: "Freinage", icon: "🛑" },
  { name: "Embrayage et Boîte de vitesse", icon: "⚙️" },
  { name: "Pièces Thermiques et Climatisation", icon: "❄️" },
  { name: "Démarrage et Charge", icon: "⚡" },
  { name: "Carrosserie", icon: "🚗" },
  { name: "Pièces Habitacle", icon: "🎮" },
  { name: "Balai d'essuie-glace", icon: "🌧️" },
  { name: "Balai d'essuie-glace", icon: "💧" },
  { name: "Echappement", icon: "💨" },
]

export function PartsGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {parts.map((part) => (
        <Card
          key={part.name}
          className="p-6 flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow cursor-pointer"
        >
          <span className="text-4xl mb-4">{part.icon}</span>
          <h3 className="font-medium">{part.name}</h3>
        </Card>
      ))}
    </div>
  )
}

