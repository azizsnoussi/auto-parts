import { emitForcedLogout, reasonFromErrorCode } from "./lib/authEvents"

export type Page<T> = {
  content?: T[]
  totalElements?: number
}

export type Manufacturer = {
  id: number
  description?: string
  fullDescription?: string
  matchcode?: string
}

export type CarModel = {
  id: number
  manufacturerId: number
  description?: string
  fullDescription?: string
  constructionInterval?: string
}

export type PassengerCar = {
  id: number
  modelId: number
  description?: string
  fullDescription?: string
  constructionInterval?: string
}

export type Supplier = {
  id: number
  description?: string
  fullDescription?: string
  matchcode?: string
}

export type TecDocArticle = {
  id?: {
    supplierId?: number
    dataSupplierArticleNumber?: string
  }
  supplierId?: number
  articleNumber?: string
  description?: string
  foundString?: string
  normalizedDescription?: string
  supplierName?: string
  productId?: number
  productDescription?: string
  productNormalizedDescription?: string
  assemblyGroupDescription?: string
  usageDescription?: string
  attributes?: string
  eans?: string
  oeNumbers?: string
  imageFileNames?: string
}

export type ShopOffer = {
  id: number
  supplierId: number
  articleNumber: string
  articleDescription?: string
  sellerName?: string
  price?: number
  currency?: string
  stockQuantity?: number
  active?: boolean
}

export type OfferPayload = {
  supplierId: number
  articleNumber: string
  sellerName: string
  price: number
  currency: string
  stockQuantity: number
  active: boolean
}

export type AuthResponse = {
  tokenType: string
  accessToken: string
  expiresIn: number
}

export type TecDocProduct = {
  id: number
  source: "ENGINE" | "PASSENGER_CAR" | string
  assemblyGroupDescription?: string
  description?: string
  normalizedDescription?: string
  usageDescription?: string
}

const API_BASE = "/api"

async function request<T>(path: string, params?: Record<string, string | number | undefined>, init?: RequestInit) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value))
  })

  const response = await fetch(url, init)

  if (!response.ok) {
    // The backend wraps errors as { success:false, error, message } where
    // `message` carries a stable code (TOKEN_EXPIRED, ACCOUNT_LOCKED, …).
    let detail = ""
    let code: unknown
    try {
      const body = await response.json()
      detail = body?.error || body?.message || ""
      code = body?.message
    } catch { /* empty or non-JSON body */ }

    if (response.status === 401 || response.status === 403) {
      // This layer has no axios interceptor, so we signal the AuthProvider
      // ourselves — otherwise admin pages would just show a red banner while
      // keeping a dead session alive.
      const reason = reasonFromErrorCode(code)
      if (response.status === 401 || reason) {
        emitForcedLogout(reason ?? 'unauthorized')
      }
      throw new Error(
        detail || "Accès refusé. Votre session a expiré ou votre rôle ne permet pas cette action.",
      )
    }
    throw new Error(detail || `API ${response.status}: ${path}`)
  }

  return response.json() as Promise<T>
}

function content<T>(page: Page<T> | T[]) {
  return Array.isArray(page) ? page : page.content || []
}

export async function getManufacturers(search = "") {
  const page = await request<Page<Manufacturer>>("/tecdoc/manufacturers", { size: 100, search })
  return content(page)
}

export async function getModels(manufacturerId: number) {
  const page = await request<Page<CarModel>>("/tecdoc/models", { size: 100, manufacturerId })
  return content(page)
}

export async function getPassengerCars(modelId: number) {
  const page = await request<Page<PassengerCar>>("/tecdoc/passenger-cars", { size: 100, modelId })
  return content(page)
}

export async function getSuppliers(search = "") {
  const page = await request<Page<Supplier>>("/tecdoc/suppliers", { size: 200, search })
  return content(page)
}

export async function searchOffers(search = "", supplierId?: number) {
  const page = await request<Page<ShopOffer>>("/shop/offers", { size: 100, articleNumber: search, supplierId })
  return content(page)
}

export async function loginAdmin(username: string, password: string) {
  return request<AuthResponse>(
    "/auth/login",
    undefined,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
  )
}

export async function createShopOffer(payload: OfferPayload, token: string) {
  return request<ShopOffer>(
    "/shop/offers",
    undefined,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  )
}

export async function updateShopOffer(id: number, payload: OfferPayload, token: string) {
  return request<ShopOffer>(
    `/shop/offers/${id}`,
    undefined,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  )
}

export async function getVehicleProducts(vehicleId: number, supplierId?: number, search = "") {
  const page = await request<Page<TecDocProduct>>(`/tecdoc/products/by-vehicle/${vehicleId}`, { size: 200, supplierId, search })
  return content(page)
}

export async function getEngineProducts(search = "") {
  const page = await request<Page<TecDocProduct>>("/tecdoc/products/engine", { size: 200, search })
  return content(page)
}

export async function searchArticles(search = "", supplierId?: number, vehicleId?: number, productId?: number) {
  const path = supplierId ? `/tecdoc/articles/by-supplier/${supplierId}` : "/tecdoc/articles"
  const page = await request<Page<TecDocArticle>>(path, { size: 100, search, vehicleId, productId })
  return content(page)
}

// ─── Admin Types ─────────────────────────────────────────────────────────────

export type OrderItem = {
  id?: number
  productName?: string
  productNameFr?: string
  product?: {
    id?: number
    name?: string
    nameFr?: string
    imageUrl?: string
    imageUrls?: string[]
  }
  quantity?: number
  unitPrice?: number
  totalPrice?: number
  lineTotal?: number
}

// Real Order shape from /orders endpoint
export type AdminOrder = {
  id: number
  orderNumber: string
  status: string
  subtotal: number
  discount: number
  taxAmount: number
  shippingCost: number
  totalAmount: number  // real field name in backend
  total: number        // alias for compatibility
  createdAt: string
  items: OrderItem[]
  customer?: {
    id: number
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  // aliases kept for existing UI components
  clientId?: number
  clientUsername?: string
  clientEmail?: string
  delivery?: {
    addressLine1?: string
    city?: string
    trackingNumber?: string
  }
}

// Real Customer shape from /customers endpoint.
// NOTE: the backend returns the raw `Customer` JPA entity (no DTO), so the
// fields below mirror Customer + BaseEntity exactly. There is no `active`
// field and no orders count — see getAdminClients for the mapping.
export type CustomerSegment = 'NEW' | 'REGULAR' | 'VIP' | 'INACTIVE' | 'FLEET'

export type AdminClient = {
  id: number
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  phone?: string
  city?: string
  address?: string
  createdAt?: string
  segment?: CustomerSegment
  totalVisits?: number
  totalSpent?: number
  // derived / aliases used by the UI
  username?: string
  enabled?: boolean
  ordersCount?: number
}

export type AdminStats = {
  totalOrders: number
  pendingOrders: number
  cancelledOrders: number
  totalRevenue: number
  totalClients: number
}

// ─── Status mapping: French UI ↔ English backend enum ───────────────────────
// Backend enum: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED

/** Map French display label → backend enum value */
export function frToStatus(fr: string): string {
  const map: Record<string, string> = {
    "En Attente":    "PENDING",
    "Confirmée":     "CONFIRMED",
    "En Traitement": "PROCESSING",
    "Expédiée":      "SHIPPED",
    "Livrée":        "DELIVERED",
    "Annulée":       "CANCELLED",
    "Remboursée":    "REFUNDED",
  }
  return map[fr] ?? fr.toUpperCase()
}

/** Map backend enum value → French display label */
export function statusToFr(status: string): string {
  const map: Record<string, string> = {
    PENDING:    "En Attente",
    CONFIRMED:  "Confirmée",
    PROCESSING: "En Traitement",
    SHIPPED:    "Expédiée",
    DELIVERED:  "Livrée",
    CANCELLED:  "Annulée",
    REFUNDED:   "Remboursée",
  }
  return map[status] ?? status
}

// ─── Admin API functions (using real /orders and /customers endpoints) ────────

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

/** Server-side filters accepted by GET /orders (all optional). */
export type AdminOrderFilters = {
  /** matches order number, customer name/email, shipping address or city */
  search?: string
  /** inclusive `yyyy-MM-dd` lower bound on the creation date */
  from?: string
  /** inclusive `yyyy-MM-dd` upper bound on the creation date */
  to?: string
  minTotal?: number
  maxTotal?: number
}

/**
 * GET /api/orders  — real backend orders endpoint
 * Backend returns: ApiResponse<PageResponse<Order>>
 *   { success, data: { content:[], page, size, totalElements } }
 *
 * Filtering happens on the server so the numbers match the books rather than
 * the current page: `status`, `search`, `from`/`to` (inclusive dates) and
 * `minTotal`/`maxTotal`.
 */
export async function getAdminOrders(
  token: string,
  status?: string,
  page = 0,
  size = 20,
  filters?: AdminOrderFilters,
): Promise<Page<AdminOrder>> {
  const raw = await request<any>("/orders", {
    ...(status ? { status } : {}),
    ...(filters?.search ? { search: filters.search } : {}),
    ...(filters?.from ? { from: filters.from } : {}),
    ...(filters?.to ? { to: filters.to } : {}),
    ...(Number.isFinite(filters?.minTotal) ? { minTotal: filters!.minTotal } : {}),
    ...(Number.isFinite(filters?.maxTotal) ? { maxTotal: filters!.maxTotal } : {}),
    page,
    size,
  }, { headers: authHeaders(token) })

  const pageData = raw?.data ?? raw
  const items: AdminOrder[] = (pageData?.content ?? []).map((o: any) => ({
    ...o,
    total: Number(o.totalAmount ?? o.total ?? 0),
    clientId: o.customer?.id,
    clientUsername: o.customer
      ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim() || o.customer.email
      : undefined,
    clientEmail: o.customer?.email,
    delivery: o.shippingAddress
      ? { addressLine1: o.shippingAddress, city: o.shippingCity }
      : undefined,
  }))
  return { content: items, totalElements: pageData?.totalElements ?? items.length }
}

/** GET /api/orders/{id} — direct notification/detail lookup for authorized staff. */
export async function getAdminOrder(id: number, token: string): Promise<AdminOrder> {
  const raw = await request<any>(`/orders/${id}`, {}, { headers: authHeaders(token) })
  const o = raw?.data ?? raw
  return {
    ...o,
    total: Number(o.totalAmount ?? o.total ?? 0),
    clientId: o.customer?.id,
    clientUsername: o.customer
      ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim() || o.customer.email
      : undefined,
    clientEmail: o.customer?.email,
    delivery: o.shippingAddress
      ? { addressLine1: o.shippingAddress, city: o.shippingCity }
      : undefined,
  }
}

/**
 * PATCH /api/orders/{id}/status?status=XXX  — update order status
 */
export async function updateOrderStatus(id: number, status: string, token: string): Promise<AdminOrder> {
  const raw = await request<any>(
    `/orders/${id}/status`,
    { status },
    { method: "PATCH", headers: authHeaders(token) },
  )
  const o = raw?.data ?? raw
  return { ...o, total: Number(o.totalAmount ?? o.total ?? 0) }
}

/**
 * GET /api/customers  — all customers (admin)
 *
 * Backend: ApiResponse<PageResponse<Customer>> → { data: { content, totalElements, ... } }
 * Accepted query params are ONLY: search, segment, createdFrom, createdTo,
 * page, size, sortBy, dir. Any other name is silently ignored by Spring, so
 * don't invent params here.
 *
 * The endpoint serializes the raw Customer entity: there is no `active` field
 * and no per-customer orders count. We derive `enabled` from the soft-delete
 * flag, and the caller can opt into a real orders count via `withOrderCounts`.
 */
export async function getAdminClients(
  token: string,
  search?: string,
  page = 0,
  size = 20,
  opts?: {
    segment?: CustomerSegment
    sortBy?: string
    dir?: 'asc' | 'desc'
    withOrderCounts?: boolean
    /** inclusive `yyyy-MM-dd` bounds on the signup date */
    createdFrom?: string
    createdTo?: string
  },
): Promise<Page<AdminClient>> {
  const raw = await request<any>("/customers", {
    ...(search ? { search } : {}),
    ...(opts?.segment ? { segment: opts.segment } : {}),
    ...(opts?.createdFrom ? { createdFrom: opts.createdFrom } : {}),
    ...(opts?.createdTo ? { createdTo: opts.createdTo } : {}),
    page,
    size,
    // `sortBy` must be a real Customer property or the backend answers 400
    ...(opts?.sortBy ? { sortBy: opts.sortBy } : { sortBy: 'createdAt' }),
    dir: opts?.dir ?? 'desc',
  }, { headers: authHeaders(token) })

  const pageData = raw?.data ?? raw
  const rows: any[] = pageData?.content ?? []

  const items: AdminClient[] = rows.map((c: any) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    city: c.city,
    address: c.address,
    createdAt: c.createdAt,
    segment: c.segment,
    totalVisits: c.totalVisits ?? 0,
    totalSpent: Number(c.totalSpent ?? 0),
    // display name — backend exposes a computed `fullName`
    username:
      (c.fullName && c.fullName.trim()) ||
      `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
      c.email ||
      `Client #${c.id}`,
    // there is no `active` column; only the soft-delete flag from BaseEntity
    enabled: c.deleted !== true,
    ordersCount: 0,
  }))

  if (opts?.withOrderCounts && items.length > 0) {
    const counts = await getOrderCountsByCustomer(token)
    for (const it of items) it.ordersCount = counts[it.id] ?? 0
  }

  return { content: items, totalElements: pageData?.totalElements ?? items.length }
}

/**
 * The backend exposes no per-customer order count, so we aggregate client-side
 * from a single admin /orders page instead of firing one request per customer.
 * Returns a map of customerId → order count. Best-effort: on failure returns {}.
 */
async function getOrderCountsByCustomer(token: string): Promise<Record<number, number>> {
  try {
    const raw = await request<any>("/orders", { page: 0, size: 500 }, { headers: authHeaders(token) })
    const pageData = raw?.data ?? raw
    const orders: any[] = pageData?.content ?? []
    return orders.reduce<Record<number, number>>((acc, o) => {
      const cid = o?.customer?.id
      if (typeof cid === 'number') acc[cid] = (acc[cid] ?? 0) + 1
      return acc
    }, {})
  } catch {
    return {}
  }
}

/**
 * DELETE /api/customers/{id} — soft delete (sets deleted=true).
 * Roles: SUPER_ADMIN, BRANCH_ADMIN, MANAGER. There is no restore endpoint.
 */
export async function deleteAdminClient(id: number, token: string): Promise<void> {
  await request<any>(`/customers/${id}`, undefined, {
    method: "DELETE",
    headers: authHeaders(token),
  })
}

/**
 * Admin KPI totals from `GET /analytics/kpis`.
 *
 * This used to reduce `/orders?page=0&size=200` client-side, so `totalRevenue`
 * silently only ever summed the first 200 orders and `pendingOrders` /
 * `cancelledOrders` only counted the ones that happened to land on that page.
 * The analytics endpoint aggregates in SQL over the whole window instead.
 *
 * `from`/`to` are inclusive ISO dates; both default to the trailing 30 days on
 * the backend. Failures still degrade to zeros so the dashboard stays usable.
 */
export async function getAdminStats(
  token: string,
  range?: { from: string; to: string },
): Promise<AdminStats> {
  try {
    const raw = await request<any>("/analytics/kpis", range, { headers: authHeaders(token) })
    const k = raw?.data ?? raw
    return {
      totalOrders:     Number(k?.totalOrders ?? 0),
      pendingOrders:   Number(k?.pendingOrders ?? 0),
      cancelledOrders: Number(k?.cancelledOrders ?? 0),
      totalRevenue:    Number(k?.totalRevenue ?? 0),
      totalClients:    Number(k?.totalCustomers ?? 0),
    }
  } catch {
    return { totalOrders: 0, pendingOrders: 0, cancelledOrders: 0, totalRevenue: 0, totalClients: 0 }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   ERP admin modules — purchase orders, delivery notes, payments, accounting,
   tax, treasury and HR.

   The Spring endpoints for these are still being built server-side, so every
   loader here degrades gracefully: when the endpoint is missing, forbidden or
   unreachable we resolve to the caller-supplied demo dataset and report
   `live:false` so the page can show a "demo data" badge instead of an error.

   These loaders deliberately DO NOT go through `request()` — that helper emits
   a forced logout on 401/403, which would kick a valid admin out the moment
   they open a page whose backend route does not exist yet. `silentGet` /
   `silentSend` swallow transport and authz errors instead.
   ══════════════════════════════════════════════════════════════════════════ */

export type AdminListResult<T> = {
  /** Rows to render — live API data when available, otherwise the demo fallback. */
  items: T[]
  /** True when the rows came from the backend; false when the demo fallback was used. */
  live: boolean
}

/** Pull an array out of the various envelope shapes the backend may return. */
function unwrapArray(raw: any): any[] | null {
  const data = raw?.data ?? raw
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  return null
}

async function silentGet(
  path: string,
  token: string,
  params?: Record<string, string | number | undefined>,
): Promise<any> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v))
  })
  const res = await fetch(url, { headers: authHeaders(token) })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

async function silentSend(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
  params?: Record<string, string | number | undefined>,
): Promise<any> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v))
  })
  const res = await fetch(url, {
    method: init.method ?? "POST",
    headers: authHeaders(token),
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json().catch(() => ({}))
}

/**
 * GET a list-style ERP resource. Never throws: on any failure it resolves to
 * the provided `fallback` with `live:false`, so pages render in demo mode.
 */
export async function getAdminResource<T>(
  path: string,
  token: string,
  fallback: T[],
  params?: Record<string, string | number | undefined>,
): Promise<AdminListResult<T>> {
  if (!token) return { items: fallback, live: false }
  try {
    const raw = await silentGet(path, token, params)
    const arr = unwrapArray(raw)
    if (!arr) return { items: fallback, live: false }
    return { items: arr as T[], live: true }
  } catch {
    return { items: fallback, live: false }
  }
}

/**
 * Send a mutation (POST/PATCH/DELETE) to an ERP resource. Returns `true` when
 * the API accepted it, `false` when the endpoint is unavailable — the caller
 * then applies the change optimistically to local state (demo mode).
 */
export async function mutateAdminResource(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
  params?: Record<string, string | number | undefined>,
): Promise<boolean> {
  if (!token) return false
  try {
    await silentSend(path, token, init, params)
    return true
  } catch {
    return false
  }
}

/**
 * Create an ERP resource (POST) and return the persisted row the backend sent
 * back (with its real id/number), or `null` when the endpoint is unavailable —
 * the caller then appends an optimistic local row instead (demo mode).
 */
export async function createAdminResource<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<T | null> {
  if (!token) return null
  try {
    const raw = await silentSend(path, token, { method: "POST", body })
    const data = (raw as any)?.data ?? raw
    return (data ?? null) as T | null
  } catch {
    return null
  }
}

/**
 * Lightweight name list for populating "select an existing entity" dropdowns in
 * ERP create modals (clients, suppliers). Never throws: returns `[]` on any
 * failure so the modal can still accept a free-typed name in demo mode.
 *
 * `kind` picks the source:
 *   - `clients`   → GET /customers  (uses the computed `fullName`)
 *   - `suppliers` → GET /inventory/suppliers  (uses `name`)
 */
export async function getAdminEntityNames(
  kind: "clients" | "suppliers",
  token: string,
): Promise<string[]> {
  if (!token) return []
  try {
    if (kind === "suppliers") {
      const raw = await silentGet("/inventory/suppliers", token, { activeOnly: "true" })
      const arr = unwrapArray(raw) ?? []
      return arr
        .map((s: any) => (s?.name ?? "").toString().trim())
        .filter(Boolean)
    }
    const raw = await silentGet("/customers", token, { size: 200, sortBy: "createdAt", dir: "desc" })
    const arr = unwrapArray(raw) ?? []
    return arr
      .map((c: any) => {
        const full = (c?.fullName && c.fullName.trim()) || `${c?.firstName ?? ""} ${c?.lastName ?? ""}`.trim()
        return (full || c?.email || "").toString().trim()
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * A pickable entity option: a stable id plus a human label (and, for clients,
 * the fiscal id when the backend exposes it). Used by the strict searchable
 * pickers in the ERP create/edit modals so the operator selects an existing
 * client / supplier instead of free-typing a name.
 */
export type AdminEntityOption = {
  id: number
  name: string
  /** Matricule fiscal / tax id when available (clients & suppliers). */
  taxId?: string
  /** City, shown as a secondary line in the picker when available. */
  city?: string
}

/**
 * Full option list (id + name + taxId) for the ERP entity pickers. Same sources
 * as {@link getAdminEntityNames} but keeps the id so a selection can be stored
 * as a foreign key. Never throws: returns `[]` on any failure.
 */
export async function getAdminEntityOptions(
  kind: "clients" | "suppliers",
  token: string,
): Promise<AdminEntityOption[]> {
  if (!token) return []
  try {
    if (kind === "suppliers") {
      const raw = await silentGet("/inventory/suppliers", token, { activeOnly: "true" })
      const arr = unwrapArray(raw) ?? []
      return arr
        .map((s: any): AdminEntityOption | null => {
          const id = Number(s?.id)
          const name = (s?.name ?? "").toString().trim()
          if (!Number.isFinite(id) || !name) return null
          return {
            id,
            name,
            taxId: (s?.taxId ?? "").toString().trim() || undefined,
            city: (s?.city ?? "").toString().trim() || undefined,
          }
        })
        .filter((o): o is AdminEntityOption => o !== null)
    }
    const raw = await silentGet("/customers", token, { size: 200, sortBy: "createdAt", dir: "desc" })
    const arr = unwrapArray(raw) ?? []
    return arr
      .map((c: any): AdminEntityOption | null => {
        const id = Number(c?.id)
        const full = (c?.fullName && c.fullName.trim()) || `${c?.firstName ?? ""} ${c?.lastName ?? ""}`.trim()
        const name = (full || c?.email || "").toString().trim()
        if (!Number.isFinite(id) || !name) return null
        return {
          id,
          name,
          taxId: (c?.taxId ?? c?.fiscalId ?? "").toString().trim() || undefined,
          city: (c?.city ?? "").toString().trim() || undefined,
        }
      })
      .filter((o): o is AdminEntityOption => o !== null)
  } catch {
    return []
  }
}

/** A pickable product for the ERP line-item picker. */
export type AdminProductOption = {
  id: number
  name: string
  price: number
  reference?: string
}

/**
 * Product catalogue options for the ERP line-item picker (delivery notes /
 * purchase orders). Reads the public `/products` list (localised name when the
 * UI runs in French). Never throws: returns `[]` on any failure.
 */
export async function getAdminProductOptions(
  token: string,
  isFr = false,
): Promise<AdminProductOption[]> {
  if (!token) return []
  try {
    const raw = await silentGet("/products", token, { size: 500 })
    const arr = unwrapArray(raw) ?? []
    return arr
      .map((p: any): AdminProductOption | null => {
        const id = Number(p?.id)
        const name = ((isFr ? p?.nameFr : p?.name) || p?.name || p?.nameFr || "").toString().trim()
        if (!Number.isFinite(id) || !name) return null
        const price = Number(p?.discountedPrice ?? p?.price ?? 0) || 0
        return {
          id,
          name,
          price,
          reference: (p?.reference ?? p?.sku ?? "").toString().trim() || undefined,
        }
      })
      .filter((o): o is AdminProductOption => o !== null)
  } catch {
    return []
  }
}

/** A pickable service for the ERP line-item picker. */
export type AdminServiceOption = {
  id: number
  name: string
  price: number
}

/**
 * Service catalogue options for the ERP line-item picker (quotes / invoices /
 * delivery notes). Reads the `/services` list (localised name when the UI runs
 * in French). Never throws: returns `[]` on any failure. Inactive services are
 * skipped so they can't be added to new documents.
 */
export async function getAdminServiceOptions(
  token: string,
  isFr = false,
): Promise<AdminServiceOption[]> {
  if (!token) return []
  try {
    const raw = await silentGet("/services", token, { size: 500 })
    const arr = unwrapArray(raw) ?? []
    return arr
      .map((s: any): AdminServiceOption | null => {
        const id = Number(s?.id)
        const name = ((isFr ? s?.nameFr : s?.name) || s?.name || s?.nameFr || "").toString().trim()
        if (!Number.isFinite(id) || !name) return null
        if (s?.active === false) return null
        const price = Number(s?.price ?? 0) || 0
        return { id, name, price }
      })
      .filter((o): o is AdminServiceOption => o !== null)
  } catch {
    return []
  }
}

// Endpoint paths, kept in one place so wiring the real backend later is a
// one-line change per module and the routes are documented together.
export const ERP_ENDPOINTS = {
  quotes:         "/quotes",
  invoices:       "/invoices",
  purchaseOrders: "/purchase-orders",
  deliveryNotes:  "/delivery-notes",
  payments:       "/payments",
  accounts:       "/accounting/accounts",
  journals:       "/accounting/journals",
  entries:        "/accounting/entries",
  taxDeclarations:"/tax/declarations",
  treasuryAccounts:   "/treasury/accounts",
  treasuryMovements:  "/treasury/movements",
  treasuryInstruments:"/treasury/instruments",
  employees:      "/hr/employees",
  leaves:         "/hr/leaves",
} as const
