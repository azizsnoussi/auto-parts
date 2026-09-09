"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SearchSection } from "@/components/search-section"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface OrderFormData {
  billingName: string
  deliveryAddress: string
  city: string
  phone: string
  alternatePhone: string
  matricule: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<OrderFormData>({
    billingName: "",
    deliveryAddress: "",
    city: "",
    phone: "",
    alternatePhone: "",
    matricule: "",
  })
  const [paymentMethod, setPaymentMethod] = useState("card")

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Order submitted:", { formData, paymentMethod })
    router.push("/commande/success")
  }

  return (
    <main className="min-h-screen flex flex-col overflow-y-auto pt-[110px] bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-1"></div> {/* Espace vide à gauche */}

          <div className="container mx-auto px-4 py-8 space-y-12 md:col-span-10">
            <section>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Colonne gauche - Infos commande */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-bold mb-6">Information de la commande</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="billingName">
                        Nom de facturation<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="billingName"
                        name="billingName"
                        value={formData.billingName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="deliveryAddress">
                        Adresse du livraison<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="deliveryAddress"
                        name="deliveryAddress"
                        value={formData.deliveryAddress}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">
                          Ville<span className="text-red-500">*</span>
                        </Label>
                        <Input id="city" name="city" value={formData.city} onChange={handleInputChange} required />
                      </div>
                      <div>
                        <Label htmlFor="matricule">Matricule</Label>
                        <Input id="matricule" name="matricule" value={formData.matricule} onChange={handleInputChange} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">
                          Tel<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="alternatePhone">Autre Tel</Label>
                        <Input
                          id="alternatePhone"
                          name="alternatePhone"
                          type="tel"
                          value={formData.alternatePhone}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </form>
                </div>

                {/* Colonne droite - Récapitulatif commande */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-bold mb-6">Votre commande</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sous-total (HT):</span>
                      <span>109.20 TND</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taxe total (TVA):</span>
                      <span>20.80 TND</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Frais de livraison:</span>
                      <span>8.00 TND</span>
                    </div>
                    <div className="flex justify-between text-base font-medium pt-4 border-t">
                      <span>Total:</span>
                      <span>138.00 TND</span>
                    </div>

                    <div className="pt-6">
                      <h3 className="font-medium mb-4">Mode de paiement:</h3>
                      <RadioGroup defaultValue="card" onValueChange={setPaymentMethod} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="card" id="card" />
                          <Label htmlFor="card">Paiement par carte bancaire</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="delivery" id="delivery" />
                          <Label htmlFor="delivery">Paiement à la livraison</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="points" id="points" />
                          <Label htmlFor="points">Point de relais</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <button
                      type="submit"
                      onClick={handleSubmit}
                      className="w-full bg-[#F3B233] text-white py-3 px-4 rounded hover:bg-[#E5A82F] transition-colors mt-6"
                    >
                      Confirmer la commande
                    </button>
                  </div>
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
