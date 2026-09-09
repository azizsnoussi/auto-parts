import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { Route } from "../../types"

export const routeTitles: Record<Route, string> = {
  "/": "Accueil",
  "/shop": "Boutique",
  "/filtration": "Filtration produits",
  "/livraison": "Livraison",
  "/checkout": "Commande",
  "/login": "Connexion",
  "/profile": "Profil client",
  "/likes": "Favoris",
  "/admin": "Back office admin",
  "/admin/clients": "Listes des clients",
  "/admin/commandes": "Listes des commandes",
  "/admin/produits": "Produits/Stock",
  "/admin/fournisseurs": "Fournisseurs",
  "/admin/rapports": "Rapports",
}

export function getRoute(): Route {
  const path = window.location.pathname as Route
  return Object.keys(routeTitles).includes(path) ? path : "/"
}

interface UIState {
  route: Route
  loading: boolean
  menuOpen: boolean
  cartOpen: boolean
  brandIndex: number
}

const initialState: UIState = {
  route: getRoute(),
  loading: false,
  menuOpen: false,
  cartOpen: false,
  brandIndex: 0,
}

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setRoute: (state, action: PayloadAction<Route>) => {
      state.route = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.menuOpen = action.payload
    },
    setCartOpen: (state, action: PayloadAction<boolean>) => {
      state.cartOpen = action.payload
    },
    setBrandIndex: (state, action: PayloadAction<number>) => {
      state.brandIndex = action.payload
    },
  },
})

export const { setRoute, setLoading, setMenuOpen, setCartOpen, setBrandIndex } = uiSlice.actions
export default uiSlice.reducer
