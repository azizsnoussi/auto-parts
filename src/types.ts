export type Route =
  | "/"
  | "/shop"
  | "/filtration"
  | "/livraison"
  | "/checkout"
  | "/login"
  | "/profile"
  | "/likes"
  | "/admin"
  | "/admin/clients"
  | "/admin/commandes"
  | "/admin/produits"
  | "/admin/fournisseurs"
  | "/admin/rapports"

export type StockStatus = "En stock" | "Epuisée" | "Par commande"

export type Product = {
  id: number
  name: string
  brand: string
  category: string
  car: string
  price: number
  oldPrice?: number
  rating: number
  stock: number
  status: StockStatus
  image: string
  badge: string
  supplierId?: number
  articleNumber?: string
  productType?: string
  assemblyGroup?: string
  usage?: string
  attributes?: string
  eans?: string
  oeNumbers?: string
}

export type CartItem = Product & { quantity: number }

export type Client = {
  name: string
  phone: string
  email: string
  city: string
  address: string
  car: string
}
