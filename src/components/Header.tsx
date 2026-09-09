import {
  Heart,
  Menu,
  Phone,
  Settings,
  ShoppingCart,
  ShieldCheck,
  User,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { setMenuOpen, setCartOpen } from "../store/slices/uiSlice"
import { useAppNavigate } from "../hooks/useNavigate"
import { Route } from "../types"

export default function Header() {
  const dispatch = useAppDispatch()
  const navigate = useAppNavigate()

  const route = useAppSelector((state) => state.ui.route)
  const menuOpen = useAppSelector((state) => state.ui.menuOpen)
  const cart = useAppSelector((state) => state.cart.items)
  const liked = useAppSelector((state) => state.wishlist.liked)
  const isLoggedIn = useAppSelector((state) => state.auth.isLoggedIn)

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const likeCount = liked.length

  const links: { label: string; route: Route }[] = [
    { label: "Accueil", route: "/" },
    { label: "Boutique", route: "/shop" },
    { label: "Filtration", route: "/filtration" },
    { label: "Livraison", route: "/livraison" },
    { label: "Commande", route: "/checkout" },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur-xl">
      <div className="bg-[#d4af37] px-4 py-2 text-sm font-medium text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span>Livraison gratuite a partir de 120 TND</span>
          <span className="hidden items-center gap-2 sm:flex">
            <Phone size={16} /> (+216) 25 199 188
          </span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <button className="logo-button" onClick={() => navigate("/")}>
          <img src="/images/bouslamaauto.png" alt="Bouslama Auto" className="h-11 w-auto" />
          <span>Auto parts shop</span>
        </button>
        <nav className="hidden items-center gap-2 lg:flex">
          {links.map((link) => (
            <button
              key={link.route}
              className={route === link.route ? "nav-link active" : "nav-link"}
              onClick={() => navigate(link.route)}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            className={route === "/admin" ? "icon-button active" : "icon-button"}
            onClick={() => navigate("/admin")}
            aria-label="Back office"
          >
            <ShieldCheck size={20} />
          </button>
          <button
            className="icon-button relative"
            onClick={() => navigate("/likes")}
            aria-label="Favoris"
          >
            <Heart size={20} />
            <Counter value={likeCount} />
          </button>
          <button
            className="icon-button"
            onClick={() => navigate(isLoggedIn ? "/profile" : "/login")}
            aria-label="Compte client"
          >
            {isLoggedIn ? <Settings size={20} /> : <User size={20} />}
          </button>
          <button
            className="icon-button relative"
            onClick={() => dispatch(setCartOpen(true))}
            aria-label="Panier"
          >
            <ShoppingCart size={20} />
            <Counter value={cartCount} />
          </button>
          <button
            className="icon-button lg:hidden"
            onClick={() => dispatch(setMenuOpen(!menuOpen))}
            aria-label="Menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="mobile-nav"
          >
            {links.map((link) => (
              <button
                key={link.route}
                className={route === link.route ? "nav-link active" : "nav-link"}
                onClick={() => navigate(link.route)}
              >
                {link.label}
              </button>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

function Counter({ value }: { value: number }) {
  if (!value) return null
  return <span className="counter">{value}</span>
}
