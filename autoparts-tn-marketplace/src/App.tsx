import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  BadgeCheck,
  BatteryCharging,
  Bell,
  Boxes,
  Car,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Gauge,
  Heart,
  LayoutDashboard,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Truck,
  UserRound,
  Wrench,
  X,
  Zap,
} from "lucide-react"
import { API_BASE, api, type BackendCart, type BackendOffer } from "./api"

type Page = "home" | "catalog" | "product" | "cart" | "admin"
type Category = "Freinage" | "Filtres" | "Batteries" | "Suspension" | "Eclairage" | "Moteur"
type Stock = "En stock" | "Stock bas" | "Sur commande"
type Sort = "popular" | "priceAsc" | "priceDesc"

type Product = {
  id: number
  name: string
  brand: string
  category: Category
  price: number
  oldPrice?: number
  rating: number
  reviews: number
  stock: number
  status: Stock
  image: string
  sku: string
  promo?: string
  compatible: string[]
  description: string
}

type CartItem = Product & { qty: number }

const fallbackProducts: Product[] = [
  {
    id: 1,
    name: "Kit disques + plaquettes avant",
    brand: "Brembo",
    category: "Freinage",
    price: 286,
    oldPrice: 340,
    rating: 4.9,
    reviews: 184,
    stock: 18,
    status: "En stock",
    image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=85",
    sku: "BRM-FR-208-1842",
    promo: "-16%",
    compatible: ["Peugeot 208 2018-2024", "Renault Clio 4", "Volkswagen Golf 7"],
    description: "Pack freinage complet avec disques ventiles, plaquettes ceramique et controle de compatibilite avant expedition.",
  },
  {
    id: 2,
    name: "Batterie AGM 70Ah Start-Stop",
    brand: "Varta",
    category: "Batteries",
    price: 455,
    oldPrice: 510,
    rating: 4.8,
    reviews: 96,
    stock: 9,
    status: "Stock bas",
    image: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=85",
    sku: "VAR-BAT-AGM70",
    promo: "Garantie 24 mois",
    compatible: ["Kia Sportage 2017-2023", "Hyundai Tucson", "Toyota Corolla 2020"],
    description: "Batterie haute endurance pour vehicules recents, testee avant livraison et prete a installer.",
  },
  {
    id: 3,
    name: "Pack filtres entretien diesel",
    brand: "Mann Filter",
    category: "Filtres",
    price: 118,
    oldPrice: 149,
    rating: 4.7,
    reviews: 221,
    stock: 34,
    status: "En stock",
    image: "https://images.unsplash.com/photo-1632823469850-1b7b1e9b7b6f?auto=format&fit=crop&w=1200&q=85",
    sku: "MNF-FLT-DIESEL",
    promo: "Top vente",
    compatible: ["Renault Symbol 2016-2021", "Peugeot Partner", "Volkswagen Polo"],
    description: "Filtres air, huile, carburant et habitacle pour revision complete avec correspondance OEM.",
  },
  {
    id: 4,
    name: "Amortisseurs avant renforces",
    brand: "Monroe",
    category: "Suspension",
    price: 236,
    rating: 4.6,
    reviews: 73,
    stock: 12,
    status: "En stock",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=85",
    sku: "MON-SUS-AVR22",
    compatible: ["Toyota Yaris 2015-2022", "Hyundai i20", "Renault Clio 5"],
    description: "Amortisseurs calibres pour routes tunisiennes avec confort stable et montage standard.",
  },
  {
    id: 5,
    name: "Optiques LED H7 homologuees",
    brand: "Philips",
    category: "Eclairage",
    price: 96,
    oldPrice: 128,
    rating: 4.5,
    reviews: 138,
    stock: 6,
    status: "Stock bas",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85",
    sku: "PHI-LED-H7TN",
    promo: "-25%",
    compatible: ["Peugeot 301", "Renault Megane", "Volkswagen Passat"],
    description: "Kit eclairage LED blanc froid avec dissipation thermique compacte pour meilleure visibilite.",
  },
  {
    id: 6,
    name: "Kit distribution + pompe a eau",
    brand: "Gates",
    category: "Moteur",
    price: 312,
    rating: 4.8,
    reviews: 112,
    stock: 0,
    status: "Sur commande",
    image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1200&q=85",
    sku: "GAT-MOT-KITDW",
    promo: "OEM match",
    compatible: ["Kia Rio 2018", "Hyundai Accent", "Toyota Corolla D4D"],
    description: "Kit distribution complet avec pompe a eau, galets et courroie, prepare apres validation VIN.",
  },
]

const categories: Category[] = ["Freinage", "Filtres", "Batteries", "Suspension", "Eclairage", "Moteur"]
const marques = ["Peugeot", "Renault", "Volkswagen", "Toyota", "Kia", "Hyundai"]
const models = ["208", "Clio", "Golf 7", "Yaris", "Sportage", "Tucson"]
const years = ["2024", "2023", "2022", "2021", "2020", "2019", "2018"]
const offerImages = fallbackProducts.map((product) => product.image)

function inferCategory(textValue: string): Category {
  const text = textValue.toLowerCase()
  if (text.includes("brake") || text.includes("frein") || text.includes("disc")) return "Freinage"
  if (text.includes("filter") || text.includes("filtre")) return "Filtres"
  if (text.includes("battery") || text.includes("batter")) return "Batteries"
  if (text.includes("shock") || text.includes("amort") || text.includes("susp")) return "Suspension"
  if (text.includes("lamp") || text.includes("led") || text.includes("light")) return "Eclairage"
  return "Moteur"
}

function mapOffer(offer: BackendOffer, index: number): Product {
  const description = offer.articleDescription || `Article ${offer.articleNumber}`
  return {
    id: offer.id,
    name: description,
    brand: offer.sellerName || `Supplier ${offer.supplierId}`,
    category: inferCategory(description),
    price: Number(offer.price),
    rating: 4.4 + (index % 5) / 10,
    reviews: 30 + index * 7,
    stock: offer.stockQuantity,
    status: offer.stockQuantity > 10 ? "En stock" : offer.stockQuantity > 0 ? "Stock bas" : "Sur commande",
    image: offerImages[index % offerImages.length],
    sku: `${offer.supplierId}-${offer.articleNumber}`,
    promo: offer.active ? "Spring live" : "Inactive",
    compatible: ["Validation VIN disponible", "Compatibilite TecDoc", "Livraison Tunisie"],
    description: `Offre TecDoc ${offer.articleNumber} vendue par ${offer.sellerName}. Prix et stock charges depuis Spring Boot.`,
  }
}

function cartFromBackend(cart: BackendCart): CartItem[] {
  return cart.items.map((item, index) => ({
    id: item.offerId,
    name: item.articleDescription,
    brand: `Supplier ${item.supplierId}`,
    category: inferCategory(item.articleDescription),
    price: Number(item.unitPrice),
    rating: 4.7,
    reviews: 1,
    stock: 1,
    status: "En stock",
    image: offerImages[index % offerImages.length],
    sku: `${item.supplierId}-${item.articleNumber}`,
    compatible: ["Panier backend", "Compatibilite TecDoc", "Tunisie"],
    description: item.articleDescription,
    qty: item.quantity,
  }))
}

export default function App() {
  const [page, setPage] = useState<Page>("home")
  const [products, setProducts] = useState<Product[]>(fallbackProducts)
  const [selected, setSelected] = useState(fallbackProducts[0])
  const [cart, setCart] = useState<CartItem[]>([])
  const [q, setQ] = useState("")
  const [brand, setBrand] = useState("Peugeot")
  const [model, setModel] = useState("208")
  const [year, setYear] = useState("2021")
  const [category, setCategory] = useState<Category | "Toutes">("Toutes")
  const [stock, setStock] = useState<Stock | "Toutes">("Toutes")
  const [sort, setSort] = useState<Sort>("popular")
  const [liked, setLiked] = useState<number[]>([1, 3])
  const [menu, setMenu] = useState(false)
  // ── Cookie helpers (inline for this standalone app) ──
  const getCookie = (name: string) => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
    return match ? decodeURIComponent(match[1]) : ''
  }
  const setCookieVal = (name: string, value: string, maxAge = 900) => {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
  }
  const delCookie = (name: string) => {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
  }

  // Migrate old localStorage token → cookie, then clean up
  const legacyToken = localStorage.getItem('autoparts_token')
  if (legacyToken) {
    if (!getCookie('autoparts_token')) setCookieVal('autoparts_token', legacyToken, 900)
    localStorage.removeItem('autoparts_token')
  }

  const [token, setToken] = useState(() => getCookie('autoparts_token'))
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("Admin12345")
  const [apiMessage, setApiMessage] = useState("Connecting to Spring Boot...")

  useEffect(() => {
    api
      .offers()
      .then((pageData) => {
        const mapped = pageData.content.map(mapOffer)
        if (mapped.length) {
          setProducts(mapped)
          setSelected(mapped[0])
        }
        setApiMessage(`Connected to ${API_BASE} - ${pageData.totalElements} offers`)
      })
      .catch((error: Error) => setApiMessage(`Backend offline, demo data active: ${error.message.slice(0, 90)}`))
  }, [])

  useEffect(() => {
    if (!token) return
    api
      .cart(token)
      .then((backendCart) => setCart(cartFromBackend(backendCart)))
      .catch(() => undefined)
  }, [token])

  const filtered = useMemo(() => {
    const text = q.toLowerCase().trim()
    return products
      .filter((product) => {
        const textOk =
          !text ||
          `${product.name} ${product.brand} ${product.sku} ${product.category} ${product.compatible.join(" ")}`.toLowerCase().includes(text)
        const catOk = category === "Toutes" || product.category === category
        const stockOk = stock === "Toutes" || product.status === stock
        return textOk && catOk && stockOk
      })
      .sort((a, b) => {
        if (sort === "priceAsc") return a.price - b.price
        if (sort === "priceDesc") return b.price - a.price
        return b.rating * b.reviews - a.rating * a.reviews
      })
  }, [category, products, q, sort, stock])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const delivery = subtotal === 0 || subtotal >= 150 ? 0 : 10
  const total = subtotal + delivery
  const count = cart.reduce((sum, item) => sum + item.qty, 0)

  const go = (next: Page) => {
    setPage(next)
    setMenu(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const openProduct = (product: Product) => {
    setSelected(product)
    go("product")
  }

  const add = async (product: Product) => {
    if (token) {
      try {
        const backendCart = await api.addToCart(token, product.id, 1)
        setCart(cartFromBackend(backendCart))
        setApiMessage("Cart synced with Spring Boot")
        return
      } catch (error) {
        setApiMessage(`Backend cart failed, local cart used: ${(error as Error).message.slice(0, 80)}`)
      }
    }
    setCart((items) => {
      const found = items.find((item) => item.id === product.id)
      if (found) return items.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item))
      return [...items, { ...product, qty: 1 }]
    })
  }

  const like = (id: number) => setLiked((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]))

  const login = async () => {
    const auth = await api.login(username, password)
    const expiry = auth.expiresIn || 900
    setCookieVal('autoparts_token', auth.accessToken, expiry)
    setToken(auth.accessToken)
    setApiMessage(`Logged in to Spring Boot as ${username}`)
  }

  const logout = () => {
    delCookie('autoparts_token')
    setToken('')
    setApiMessage('Logged out')
  }

  // Auto-disconnect when cookie expires (check every 30s)
  useEffect(() => {
    if (!token) return
    const timer = setInterval(() => {
      if (!getCookie('autoparts_token')) {
        setToken('')
        setApiMessage('Session expirée, veuillez vous reconnecter')
      }
    }, 30_000)
    return () => clearInterval(timer)
  }, [token])

  const checkout = async () => {
    if (!token) {
      setApiMessage("Login required before checkout")
      return
    }
    await api.checkout(token, {
      delivery: {
        recipientName: "Client Tunisie",
        phone: "+21671000000",
        addressLine1: "Avenue Habib Bourguiba",
        city: "Tunis",
        country: "Tunisia",
        method: "HOME_DELIVERY",
      },
    })
    setApiMessage("Checkout created in Spring Boot")
    setCart([])
  }

  return (
    <div>
      <Header page={page} go={go} count={count} menu={menu} setMenu={setMenu} apiMessage={apiMessage} />
      <AnimatePresence mode="wait">
        <motion.main key={page} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
          {page === "home" && (
            <Home
              go={go}
              q={q}
              setQ={setQ}
              brand={brand}
              setBrand={setBrand}
              model={model}
              setModel={setModel}
              year={year}
              setYear={setYear}
              openProduct={openProduct}
              add={add}
              liked={liked}
              like={like}
              products={products}
            />
          )}
          {page === "catalog" && (
            <Catalog
              products={filtered}
              q={q}
              setQ={setQ}
              category={category}
              setCategory={setCategory}
              stock={stock}
              setStock={setStock}
              sort={sort}
              setSort={setSort}
              openProduct={openProduct}
              add={add}
              liked={liked}
              like={like}
            />
          )}
          {page === "product" && <ProductDetail product={selected} go={go} add={add} liked={liked} like={like} />}
          {page === "cart" && (
            <Cart
              cart={cart}
              setCart={setCart}
              subtotal={subtotal}
              delivery={delivery}
              total={total}
              go={go}
              token={token}
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              login={login}
              logout={logout}
              checkout={checkout}
              apiMessage={apiMessage}
            />
          )}
          {page === "admin" && <Admin products={products} apiMessage={apiMessage} />}
        </motion.main>
      </AnimatePresence>
      <footer className="footer">
        <strong>AutoParts TN</strong>
        <span>Pieces auto Tunisie - Prix TTC en TND - Livraison nationale - Paiement a la livraison</span>
      </footer>
    </div>
  )
}

function Header({ page, go, count, menu, setMenu, apiMessage }: { page: Page; go: (page: Page) => void; count: number; menu: boolean; setMenu: (value: boolean) => void; apiMessage: string }) {
  const links: { label: string; page: Page }[] = [
    { label: "Accueil", page: "home" },
    { label: "Catalogue", page: "catalog" },
    { label: "Panier", page: "cart" },
    { label: "Admin", page: "admin" },
  ]
  return (
    <header className="header">
      <div className="strip">
        <span>API: {apiMessage}</span>
        <span>Paiement a la livraison + carte</span>
        <span>Support: +216 71 000 000</span>
      </div>
      <div className="bar">
        <button className="brand" onClick={() => go("home")}>
          <span><Wrench size={22} /></span>
          <strong>AutoParts TN</strong>
        </button>
        <nav className="nav">
          {links.map((link) => (
            <button key={link.page} className={page === link.page ? "active" : ""} onClick={() => go(link.page)}>
              {link.label}
            </button>
          ))}
        </nav>
        <div className="actions">
          <button><Bell size={19} /></button>
          <button className="cart" onClick={() => go("cart")}><ShoppingCart size={19} />{count > 0 && <i>{count}</i>}</button>
          <button className="hamb" onClick={() => setMenu(!menu)}>{menu ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </div>
      {menu && <nav className="mobile">{links.map((link) => <button key={link.page} onClick={() => go(link.page)}>{link.label}</button>)}</nav>}
    </header>
  )
}

function Home(props: {
  go: (page: Page) => void
  q: string
  setQ: (value: string) => void
  brand: string
  setBrand: (value: string) => void
  model: string
  setModel: (value: string) => void
  year: string
  setYear: (value: string) => void
  openProduct: (product: Product) => void
  add: (product: Product) => void
  liked: number[]
  like: (id: number) => void
  products: Product[]
}) {
  return (
    <>
      <section className="hero">
        <div className="heroInner">
          <div>
            <span className="pill">Marketplace automobile Tunisie</span>
            <h1>Rechercher, comparer et acheter vos pieces auto en quelques secondes.</h1>
            <p>Freins, filtres, batteries, amortisseurs, eclairage et moteur pour Peugeot, Renault, Volkswagen, Toyota, Kia et Hyundai.</p>
            <div className="heroBtns">
              <button className="primary" onClick={() => props.go("catalog")}>Explorer le catalogue <ChevronRight size={18} /></button>
              <button className="ghost">بحث بالعربية</button>
            </div>
          </div>
          <motion.div className="scanCard" animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5 }}>
            <div />
            <Car size={98} />
            <strong>Matching vehicule/piece</strong>
            <span>VIN, immatriculation ou selection manuelle</span>
          </motion.div>
        </div>
      </section>
      <section className="searchWrap"><VehicleSearch {...props} /></section>
      <section className="section">
        <Title small="Categories" big="Pieces par famille" />
        <div className="categoryGrid">
          {categories.map((cat) => (
            <button key={cat} className="cat" onClick={() => props.go("catalog")}>
              {catIcon(cat)}
              <strong>{cat}</strong>
              <span>{props.products.filter((product) => product.category === cat).length} references</span>
            </button>
          ))}
        </div>
      </section>
      <section className="section split">
        <div>
          <Title small="Populaire" big="Demandes cette semaine" />
          <ProductGrid products={props.products.slice(0, 3)} openProduct={props.openProduct} add={props.add} liked={props.liked} like={props.like} />
        </div>
        <aside className="promo">
          <span>Promotions</span>
          <h2>Jusqu'a -25% sur freinage, filtres et LED.</h2>
          <p>Stock synchronise, prix TTC en TND et livraison 24-72h selon gouvernorat.</p>
          <button className="primary" onClick={() => props.go("catalog")}>Voir les offres</button>
        </aside>
      </section>
      <section className="trust">
        <Trust icon={<ShieldCheck />} title="Compatibilite validee" text="Controle VIN avant expedition." />
        <Trust icon={<Truck />} title="Tunisie entiere" text="Tunis, Sfax, Sousse, Gabes." />
        <Trust icon={<CreditCard />} title="Paiement flexible" text="Livraison ou carte securisee." />
        <Trust icon={<PackageCheck />} title="Stock temps reel" text="Alertes rupture et stock bas." />
      </section>
    </>
  )
}

function VehicleSearch({ q, setQ, brand, setBrand, model, setModel, year, setYear, go }: {
  q: string; setQ: (value: string) => void; brand: string; setBrand: (value: string) => void; model: string; setModel: (value: string) => void; year: string; setYear: (value: string) => void; go: (page: Page) => void
}) {
  return (
    <div className="vehicleSearch">
      <label><Search size={20} /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Piece, OEM, VIN ou immatriculation..." /></label>
      <select value={brand} onChange={(event) => setBrand(event.target.value)}>{marques.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={year} onChange={(event) => setYear(event.target.value)}>{years.map((value) => <option key={value}>{value}</option>)}</select>
      <button className="primary" onClick={() => go("catalog")}>Trouver</button>
    </div>
  )
}

function Catalog(props: {
  products: Product[]; q: string; setQ: (value: string) => void; category: Category | "Toutes"; setCategory: (value: Category | "Toutes") => void; stock: Stock | "Toutes"; setStock: (value: Stock | "Toutes") => void; sort: Sort; setSort: (value: Sort) => void; openProduct: (product: Product) => void; add: (product: Product) => void; liked: number[]; like: (id: number) => void
}) {
  return (
    <section className="page">
      <Title small="Catalogue produits" big="Filtrer, comparer, commander" />
      <div className="catalog">
        <aside className="filters">
          <strong><SlidersHorizontal size={18} /> Filtres intelligents</strong>
          <input value={props.q} onChange={(event) => props.setQ(event.target.value)} placeholder="Batterie, Clio, H7, SKU..." />
          <select value={props.category} onChange={(event) => props.setCategory(event.target.value as Category | "Toutes")}><option>Toutes</option>{categories.map((cat) => <option key={cat}>{cat}</option>)}</select>
          <select value={props.stock} onChange={(event) => props.setStock(event.target.value as Stock | "Toutes")}><option>Toutes</option><option>En stock</option><option>Stock bas</option><option>Sur commande</option></select>
          <select value={props.sort} onChange={(event) => props.setSort(event.target.value as Sort)}><option value="popular">Popularite</option><option value="priceAsc">Prix croissant</option><option value="priceDesc">Prix decroissant</option></select>
          <p>Le matching privilegie les references compatibles avec le vehicule choisi.</p>
        </aside>
        <div>
          <div className="toolbar"><span>{props.products.length} produits</span><span>Prix TTC en TND</span></div>
          <ProductGrid {...props} />
        </div>
      </div>
    </section>
  )
}

function ProductGrid({ products, openProduct, add, liked, like }: { products: Product[]; openProduct: (product: Product) => void; add: (product: Product) => void; liked: number[]; like: (id: number) => void }) {
  return (
    <div className="products">
      {products.map((product) => (
        <article className="product" key={product.id}>
          <button className="media" onClick={() => openProduct(product)}><img src={product.image} alt={product.name} />{product.promo && <span>{product.promo}</span>}</button>
          <div className="body">
            <div className="meta"><strong>{product.brand}</strong><span><Star size={14} fill="currentColor" /> {product.rating.toFixed(1)}</span></div>
            <button className="title" onClick={() => openProduct(product)}>{product.name}</button>
            <p>{product.compatible[0]}</p>
            <Status product={product} />
            <div className="bottom">
              <div><strong>{product.price.toFixed(3)} TND</strong>{product.oldPrice && <small>{product.oldPrice.toFixed(3)} TND</small>}</div>
              <div className="miniActions">
                <button className={liked.includes(product.id) ? "round liked" : "round"} onClick={() => like(product.id)}><Heart size={18} fill={liked.includes(product.id) ? "currentColor" : "none"} /></button>
                <button className="round blue" onClick={() => add(product)}><Plus size={18} /></button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function ProductDetail({ product, go, add, liked, like }: { product: Product; go: (page: Page) => void; add: (product: Product) => void; liked: number[]; like: (id: number) => void }) {
  return (
    <section className="page">
      <button className="crumb" onClick={() => go("catalog")}>Catalogue / {product.category}</button>
      <div className="detail">
        <div className="gallery"><img src={product.image} alt={product.name} /><div><span /><span /><span /></div></div>
        <div className="info">
          <div className="meta"><strong>{product.brand}</strong><span><Star size={15} fill="currentColor" /> {product.rating.toFixed(1)} ({product.reviews})</span></div>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <Status product={product} />
          <div className="price"><strong>{product.price.toFixed(3)} TND TTC</strong>{product.oldPrice && <small>{product.oldPrice.toFixed(3)} TND</small>}</div>
          <div className="heroBtns"><button className="primary" onClick={() => add(product)}><ShoppingCart size={18} /> Ajouter au panier</button><button className="secondary" onClick={() => like(product.id)}><Heart size={18} /> {liked.includes(product.id) ? "Favori" : "Ajouter favori"}</button></div>
          <h2>Compatibilite vehicules</h2>
          <div className="compat">{product.compatible.map((item) => <span key={item}><BadgeCheck size={16} /> {item}</span>)}</div>
          <div className="specs"><Spec k="SKU" v={product.sku} /><Spec k="Stock" v={`${product.stock} disponible(s)`} /><Spec k="Livraison" v="24-72h Tunisie" /><Spec k="Paiement" v="A la livraison / carte" /></div>
        </div>
      </div>
    </section>
  )
}

function Cart({
  cart,
  setCart,
  subtotal,
  delivery,
  total,
  go,
  token,
  username,
  setUsername,
  password,
  setPassword,
  login,
  logout,
  checkout,
  apiMessage,
}: {
  cart: CartItem[]
  setCart: (items: CartItem[]) => void
  subtotal: number
  delivery: number
  total: number
  go: (page: Page) => void
  token: string
  username: string
  setUsername: (value: string) => void
  password: string
  setPassword: (value: string) => void
  login: () => Promise<void>
  logout: () => void
  checkout: () => Promise<void>
  apiMessage: string
}) {
  const qty = (id: number, next: number) => next > 0 && setCart(cart.map((item) => (item.id === id ? { ...item, qty: next } : item)))
  return (
    <section className="page">
      <Title small="Panier & commande" big="Finaliser la livraison" />
      <div className="checkout">
        <div className="cartPanel">
          {cart.length === 0 ? <div className="empty"><ShoppingCart size={44} /><strong>Panier vide</strong><button className="primary" onClick={() => go("catalog")}>Voir catalogue</button></div> : cart.map((item) => (
            <div className="cartLine" key={item.id}><img src={item.image} alt={item.name} /><div><strong>{item.name}</strong><span>{item.price.toFixed(3)} TND</span></div><div className="qty"><button onClick={() => qty(item.id, item.qty - 1)}><Minus size={15} /></button><b>{item.qty}</b><button onClick={() => qty(item.id, item.qty + 1)}><Plus size={15} /></button></div><button onClick={() => setCart(cart.filter((line) => line.id !== item.id))}><X size={16} /></button></div>
          ))}
        </div>
        <aside className="order">
          <h2>Resume commande</h2>
          <p className="apiNote">{apiMessage}</p>
          {!token ? (
            <>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Backend username" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Backend password" type="password" />
              <button className="secondary" onClick={login}>Login Spring JWT</button>
            </>
          ) : (
            <button className="secondary" onClick={logout}>Logout backend</button>
          )}
          <Line k="Sous-total" v={`${subtotal.toFixed(3)} TND`} />
          <Line k="Livraison" v={delivery === 0 ? "Gratuite" : `${delivery.toFixed(3)} TND`} />
          <Line k="Total TTC" v={`${total.toFixed(3)} TND`} strong />
          <input placeholder="Nom complet" defaultValue="Client Tunisie" /><input placeholder="Telephone +216" defaultValue="+21671000000" /><input placeholder="Ville / Gouvernorat" defaultValue="Tunis" /><textarea placeholder="Adresse complete" rows={3} defaultValue="Avenue Habib Bourguiba" />
          <select defaultValue="cod"><option value="cod">Paiement a la livraison</option><option value="card">Paiement en ligne</option></select>
          <button className="primary full" disabled={!cart.length || !token} onClick={checkout}>Confirmer dans Spring Boot</button>
        </aside>
      </div>
    </section>
  )
}

function Admin({ products, apiMessage }: { products: Product[]; apiMessage: string }) {
  return (
    <section className="page">
      <Title small="Admin dashboard" big="Pilotage e-commerce" />
      <div className="kpis">
        <Kpi icon={<CircleDollarSign />} k="CA jour" v="4 820 TND" />
        <Kpi icon={<Boxes />} k="Stock bas" v={`${products.filter((product) => product.stock <= 10).length} alertes`} />
        <Kpi icon={<ClipboardList />} k="Commandes" v="38 ouvertes" />
        <Kpi icon={<UserRound />} k="Clients" v="12 460" />
      </div>
      <div className="adminGrid">
        <div className="adminCard"><h2>Gestion produits</h2>{products.map((product) => <div className="adminRow" key={product.id}><span>{product.sku}</span><strong>{product.name}</strong><em>{product.stock} stock</em></div>)}</div>
        <div className="adminCard dark"><LayoutDashboard /><h2>Spring Boot connected</h2><p>{apiMessage}</p><span><Zap size={16} /> GET /api/shop/offers</span><span><Bell size={16} /> JWT cart + checkout</span></div>
      </div>
    </section>
  )
}

function Title({ small, big }: { small: string; big: string }) { return <div className="sectionTitle"><span>{small}</span><h2>{big}</h2></div> }
function Status({ product }: { product: Product }) { return <span className={`status ${product.status === "En stock" ? "ok" : product.status === "Stock bas" ? "warn" : "order"}`}>{product.status} - {product.stock} unites</span> }
function Trust({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div>{icon}<strong>{title}</strong><span>{text}</span></div> }
function Spec({ k, v }: { k: string; v: string }) { return <div><span>{k}</span><strong>{v}</strong></div> }
function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) { return <div className={strong ? "line strong" : "line"}><span>{k}</span><strong>{v}</strong></div> }
function Kpi({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) { return <div className="kpi">{icon}<span>{k}</span><strong>{v}</strong></div> }
function catIcon(category: Category) {
  return { Freinage: <Gauge />, Filtres: <SlidersHorizontal />, Batteries: <BatteryCharging />, Suspension: <Car />, Eclairage: <Zap />, Moteur: <Wrench /> }[category]
}
