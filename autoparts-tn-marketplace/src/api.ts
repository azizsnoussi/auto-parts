export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://192.168.1.20:8089"

export type BackendOffer = {
  id: number
  supplierId: number
  articleNumber: string
  articleDescription: string
  sellerName: string
  price: number
  currency: string
  stockQuantity: number
  active: boolean
}

export type BackendPage<T> = {
  content: T[]
  totalElements: number
}

export type AuthResponse = {
  tokenType: string
  accessToken: string
  expiresIn: number
}

export type BackendCart = {
  cartId: number
  status: string
  subtotal: number
  items: {
    itemId: number
    offerId: number
    supplierId: number
    articleNumber: string
    articleDescription: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }[]
}

export type CheckoutPayload = {
  delivery: {
    recipientName: string
    phone: string
    addressLine1: string
    addressLine2?: string
    city: string
    postalCode?: string
    country: string
    method: "HOME_DELIVERY" | "PICKUP_POINT" | "EXPRESS"
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `API error ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  offers: () => request<BackendPage<BackendOffer>>("/api/shop/offers?size=48&sort=id,desc"),
  login: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  cart: (token: string) => request<BackendCart>("/api/shop/cart", {}, token),
  addToCart: (token: string, offerId: number, quantity = 1) =>
    request<BackendCart>(
      "/api/shop/cart/items",
      {
        method: "POST",
        body: JSON.stringify({ offerId, quantity }),
      },
      token,
    ),
  checkout: (token: string, payload: CheckoutPayload) =>
    request<unknown>(
      "/api/shop/orders/checkout",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    ),
}
