import Image from "next/image"
import { Heart } from "lucide-react"

const products = [
  {
    id: 1,
    name: "Huile moteur Mobil Super 3000 Formula V 5W-30 - 5 Litres",
    ref: "154447",
    brand: "MOBIL",
    price: 130.0,
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mobil-oil-5l-yNGxWvHGJ5k5GpFUJ8jgIEGvs8Dhj3.png",
    inStock: true,
  },
  {
    id: 2,
    name: "Huile moteur Mobil 1 ESP 5W-30 - 5 Litres",
    ref: "157257",
    brand: "MOBIL",
    price: 217.8,
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mobil-oil-5l-yNGxWvHGJ5k5GpFUJ8jgIEGvs8Dhj3.png",
    inStock: true,
  },
  {
    id: 3,
    name: "Huile moteur Mobil Super 3000 Formula V 5W-30 - 1 Litre",
    ref: "152356",
    brand: "MOBIL",
    price: 40.0,
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mobil-oil-1l-4RIG58MEdfu1gW68baf0npQRxCacb6.png",
    inStock: true,
  },
  {
    id: 4,
    name: "Huile moteur Mobil Super 3000 Formula V 5W-30 - 5 Litres",
    ref: "154447",
    brand: "MOBIL",
    price: 130.0,
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mobil-oil-5l-yNGxWvHGJ5k5GpFUJ8jgIEGvs8Dhj3.png",
    inStock: true,
  },
]

export function ProductGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {products.map((product) => (
        <div key={product.id} className="bg-white p-6 rounded-lg shadow-sm relative">
          <button className="absolute top-4 right-4">
            <Heart className="h-6 w-6 text-gray-400 hover:text-[#F3B233]" />
          </button>
          <div className="flex items-center justify-center mb-4">
            <Image
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              width={200}
              height={200}
              className="object-contain"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{product.brand}</span>
              <span className="text-sm text-gray-500">- Réf : {product.ref}</span>
            </div>
            <h3 className="font-medium">{product.name}</h3>
            {product.inStock ? (
              <span className="text-green-500 text-sm">En Stock</span>
            ) : (
              <span className="text-red-500 text-sm">Rupture de stock</span>
            )}
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-2xl font-bold">{product.price.toFixed(2)} TND</p>
                <p className="text-xs text-gray-500">Prix par litre {(product.price / 5).toFixed(2)} TND</p>
              </div>
              <button className="bg-[#F3B233] text-white px-4 py-2 rounded hover:bg-[#E5A82F] transition-colors">
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

