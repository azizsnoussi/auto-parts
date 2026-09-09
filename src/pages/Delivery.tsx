import { motion } from "framer-motion"
import { PackageCheck, Wrench, Truck, CreditCard } from "lucide-react"
import PageShell from "../components/PageShell"

export default function Delivery() {
  const steps = [
    { title: "Commande validee", text: "Controle compatibilite pieces et vehicule.", icon: PackageCheck },
    { title: "Preparation express", text: "Emballage securise depuis notre stock.", icon: Wrench },
    { title: "Livraison suivie", text: "Tunis 24h, regions 24-72h.", icon: Truck },
    { title: "Paiement flexible", text: "Carte, virement ou paiement a la livraison.", icon: CreditCard },
  ]

  return (
    <PageShell eyebrow="Module livraison" title="Suivi commande de bout en bout">
      <div className="delivery-grid">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="delivery-card light"
            >
              <Icon className="h-9 w-9 text-[#d4af37]" />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </motion.div>
          )
        })}
      </div>
    </PageShell>
  )
}
