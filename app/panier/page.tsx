"use client"

import { useState } from "react"
import Image from "next/image"
import { Minus, Plus, X } from "lucide-react"
import { SearchSection } from "@/components/search-section"
import { useRouter } from "next/navigation"

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  image: string
}

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: 1,
      name: "Huile moteur Mobil Super 3000 Formula V 5W-30 - 5 Litres",
      price: 130.0,
      quantity: 1,
      image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mobil-oil-5l-yNGxWvHGJ5k5GpFUJ8jgIEGvs8Dhj3.png",
    },
  ])

  const updateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity < 1) return
    setCartItems((items) => items.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)))
  }

  const removeItem = (id: number) => {
    setCartItems((items) => items.filter((item) => item.id !== id))
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.19 // 19% TVA
  const total = subtotal + tax

  return (
    <div className="min-h-screen bg-gray-50">
      <SearchSection />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-center mb-8">Mon Panier</h1>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Cart Headers */}
          <div className="hidden md:grid md:grid-cols-5 gap-4 pb-4 border-b text-sm font-medium text-gray-500">
            <div className="col-span-2">Produit</div>
            <div>Prix</div>
            <div>Quantité</div>
            <div>Total</div>
          </div>

          {/* Cart Items */}
          <div className="divide-y">
            {cartItems.map((item) => (
              <div key={item.id} className="grid md:grid-cols-5 gap-4 py-4 items-center">
                <div className="md:col-span-2 flex items-center gap-4">
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                    <X className="h-5 w-5" />
                  </button>
                  <div className="w-20 h-20 relative">
                    <Image src={item.image || "/placeholder.svg"} alt={item.name} fill className="object-contain" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">{item.name}</h3>
                  </div>
                </div>
                <div className="text-sm">{item.price.toFixed(2)} TND</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-sm font-medium">{(item.price * item.quantity).toFixed(2)} TND</div>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="mt-8 border-t pt-8">
            <div className="w-full max-w-sm ml-auto space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sous-total (HT):</span>
                <span>{subtotal.toFixed(2)} TND</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Taxe total (TVA):</span>
                <span>{tax.toFixed(2)} TND</span>
              </div>
              <div className="flex justify-between text-base font-medium">
                <span>Total</span>
                <span>{total.toFixed(2)} TND</span>
              </div>
              <button
                onClick={() => router.push("/commande")}
                className="w-full bg-[#F3B233] text-white py-3 px-4 rounded hover:bg-[#E5A82F] transition-colors"
              >
                Confirmer la commande
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

