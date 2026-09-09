import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export interface CartProduct {
  id: number
  name: string
  nameFr?: string
  brand: string
  price: number
  discountedPrice?: number
  imageUrl?: string
  stockQuantity: number
}

export interface CartItem extends CartProduct {
  quantity: number
}

interface CartState {
  items: CartItem[]
}

// Load from localStorage
function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem('ba_cart')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem('ba_cart', JSON.stringify(items))
}

const initialState: CartState = {
  items: loadCart(),
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartProduct>) => {
      const product = action.payload
      if (product.stockQuantity <= 0) return
      const existing = state.items.find((item) => item.id === product.id)
      if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, product.stockQuantity)
      } else {
        state.items.push({ ...product, quantity: 1 })
      }
      saveCart(state.items)
    },
    updateQuantity: (state, action: PayloadAction<{ id: number; quantity: number }>) => {
      const { id, quantity } = action.payload
      if (quantity < 1) {
        state.items = state.items.filter((item) => item.id !== id)
      } else {
        const item = state.items.find((item) => item.id === id)
        if (item) item.quantity = quantity
      }
      saveCart(state.items)
    },
    removeItem: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter((item) => item.id !== action.payload)
      saveCart(state.items)
    },
    clearCart: (state) => {
      state.items = []
      saveCart(state.items)
    },
  },
})

export const { addToCart, updateQuantity, removeItem, clearCart } = cartSlice.actions
export default cartSlice.reducer
