import { configureStore } from "@reduxjs/toolkit"
import uiReducer from "./slices/uiSlice"
import vehicleReducer from "./slices/vehicleSlice"
import productsReducer from "./slices/productsSlice"
import cartReducer from "./slices/cartSlice"
import wishlistReducer from "./slices/wishlistSlice"
import authReducer from "./slices/authSlice"

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    vehicle: vehicleReducer,
    products: productsReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    auth: authReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
