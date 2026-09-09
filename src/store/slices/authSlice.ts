import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { Client } from "../../types"

interface AuthState {
  isLoggedIn: boolean
  client: Client
}

const initialState: AuthState = {
  isLoggedIn: false,
  client: {
    name: "Client Bouslama",
    phone: "+216 25 199 188",
    email: "client@bouslama-auto.tn",
    city: "Tunis",
    address: "Avenue principale, Tunis",
    car: "BMW Serie 3 - 2018 - Diesel",
  },
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setIsLoggedIn: (state, action: PayloadAction<boolean>) => {
      state.isLoggedIn = action.payload
    },
    setClient: (state, action: PayloadAction<Client>) => {
      state.client = action.payload
    },
  },
})

export const { setIsLoggedIn, setClient } = authSlice.actions
export default authSlice.reducer
