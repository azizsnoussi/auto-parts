import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface WishlistState {
  liked: number[]
}

const STORAGE_KEY = "ba_wishlist"

const loadLiked = (): number[] => {
  if (typeof window === "undefined") return []
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id > 0) : []
  } catch {
    return []
  }
}

const persistLiked = (liked: number[]) => {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(liked))
}

const initialState: WishlistState = {
  liked: loadLiked(),
}

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    toggleLike: (state, action: PayloadAction<number>) => {
      const id = action.payload
      if (state.liked.includes(id)) {
        state.liked = state.liked.filter((item) => item !== id)
      } else {
        state.liked.push(id)
      }
      persistLiked(state.liked)
    },
  },
})

export const { toggleLike } = wishlistSlice.actions
export default wishlistSlice.reducer
