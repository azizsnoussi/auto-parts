import axios, { type AxiosResponse } from 'axios';
import {
  getAccessToken,
  saveAccessSession,
  clearAccessSession,
} from './cookies';
import { emitForcedLogout, reasonFromErrorCode, type AuthLogoutReason } from './authEvents';

const API = axios.create({
  // Same-origin in development: Vite proxies /api to Spring Boot. This avoids
  // fragile browser CORS/cookie behavior while still allowing an explicit URL
  // in deployed environments.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  // Required only for the API-issued HttpOnly refresh cookie. Access to every
  // business endpoint still uses the short-lived bearer token below.
  withCredentials: true,
  // Without this, axios waits forever. A checkout that hit a locked database row
  // used to leave "Envoi en cours..." spinning with no way out and no message.
  // 30s is well above any normal response here and still bounded.
  timeout: 30_000,
});

/**
 * Human-readable text for a request that never reached a response: a timeout,
 * a dropped connection, an offline browser. `err.response` is undefined in all
 * of those cases, so the usual `err.response.data.error` chain yields nothing
 * and callers would otherwise show a bare generic fallback — or, worse, nothing.
 */
export function networkErrorMessage(err: any): string | null {
  if (err?.response) return null;
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return "Le serveur n'a pas répondu à temps. Vérifiez votre connexion puis réessayez.";
  }
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.';
  }
  return null;
}

/** Best error text available on an axios failure, in decreasing specificity. */
export function apiErrorMessage(err: any, fallback = 'Une erreur est survenue'): string {
  return (
    networkErrorMessage(err) ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

// Attach JWT token from cookies to every request
API.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RefreshPayload {
  accessToken: string;
  expiresIn: number;
  user?: unknown;
}

type RefreshResponse = AxiosResponse<{ data: RefreshPayload }>;

/**
 * In-flight refresh shared by startup restoration, expiry checks and parallel
 * 401 retries. This is essential because refresh tokens rotate on every call:
 * two requests carrying the same cookie would otherwise race and one would be
 * rejected as a replay (or lose an optimistic-lock update with HTTP 409).
 */
let refreshPromise: Promise<RefreshResponse> | null = null;

function runRefresh(): Promise<RefreshResponse> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API.defaults.baseURL}/auth/refresh`, undefined, {
        withCredentials: true,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      .then((response: RefreshResponse) => {
        const { data } = response;
        const { accessToken, expiresIn } = data.data;
        saveAccessSession(accessToken, expiresIn);
        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Clear the session and let React redirect to /login (no full page reload) */
function forceLogout(reason: AuthLogoutReason) {
  // Emit first: the AuthProvider handler runs synchronously and needs the user
  // cookie to still be present to know a real session was lost (for the toast).
  emitForcedLogout(reason);
  // Safety net in case no provider is mounted to handle the event.
  clearAccessSession();
}

// Auto-refresh on 401, disconnect if refresh fails
API.interceptors.response.use(
  (res) => {
    const payload = res?.data;
    if (payload && typeof payload === 'object' && 'success' in payload && payload.success === false) {
      const error = new Error(payload.error || payload.message || 'Request failed');
      (error as any).response = { data: payload };
      return Promise.reject(error);
    }
    return res;
  },
  async (err) => {
    const payload = err?.response?.data;
    if (payload && typeof payload === 'object' && 'success' in payload && payload.success === false) {
      err.message = payload.error || payload.message || 'Request failed';
      err.response = { ...err.response, data: payload };
    }

    // A timeout/offline failure carries no response, so replace axios' opaque
    // "timeout of 30000ms exceeded" with something a user can act on.
    const networkMessage = networkErrorMessage(err);
    if (networkMessage) err.message = networkMessage;

    const status = err.response?.status;
    const original = err.config;
    const isAuthEndpoint =
      typeof original?.url === 'string' &&
      (original.url.includes('/auth/login') ||
        original.url.includes('/auth/register') ||
        original.url.includes('/auth/refresh'));

    // The backend sends a stable code in `message` (ACCOUNT_LOCKED, TOKEN_EXPIRED…).
    // A locked/disabled account can never be recovered by refreshing, so we log
    // out immediately instead of attempting a pointless refresh round-trip.
    const codeReason = reasonFromErrorCode(payload?.message);
    if (!isAuthEndpoint && (codeReason === 'account-locked' || codeReason === 'account-disabled')) {
      forceLogout(codeReason);
      return Promise.reject(err);
    }

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        const { data } = await runRefresh();
        const { accessToken } = data.data;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return API(original);
      } catch {
        forceLogout('refresh-failed');
      }
    }
    return Promise.reject(err);
  }
);

export default API;

// ── Images (Supabase Storage) ─────────────────────────────────────────
/**
 * Multipart config for image uploads. The instance default is
 * `application/json`, which would keep the browser from adding the multipart
 * boundary — setting the header to `undefined` lets it compute the real one.
 */
const MULTIPART = { headers: { 'Content-Type': undefined } } as any;

/** Wraps a File in the `image` part every upload endpoint expects. */
export function imageFormData(file: File): FormData {
  const fd = new FormData();
  fd.append('image', file);
  return fd;
}

/**
 * Bucket folders, one per entity family. Mirrors `supabase.allowed-folders`
 * on the backend; anything else is rejected server-side.
 */
export type ImageFolder =
  | 'products' | 'categories' | 'brands' | 'services' | 'branches' | 'users' | 'vehicles' | 'workshop'
  | 'suppliers';

/**
 * Standalone upload, used while a record has no id yet (creation forms). The
 * returned URL is then sent with the normal create payload.
 */
export const storageApi = {
  upload: (file: File, folder: ImageFolder) =>
    API.post('/storage/images', imageFormData(file), { ...MULTIPART, params: { folder } }),
  /** Removes an object that no row references yet. */
  delete: (url: string, folder: ImageFolder) => API.delete('/storage/images', { params: { url, folder } }),
};

// ── Auth ──────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: object) => API.post('/auth/login', data),
  register: (data: object) => API.post('/auth/register', data),
  // Must use the same single-flight operation as the 401 interceptor. Calling
  // API.post directly here races rotating cookies under React StrictMode.
  refresh: runRefresh,
  /**
   * Revokes the server-side session. The refresh token is sent in the body so
   * the backend can revoke it even when the access token has already expired.
   */
  logout: () => API.post('/auth/logout'),
  /** Cheap session probe: 401 means the session is dead (expired, locked, disabled). */
  me: () => API.get('/auth/me'),
  /**
   * Self-service profile update. The backend also writes the shared fields into
   * the customer's CRM row, so `customers` stays in sync with `users`.
   */
  updateProfile: (data: object) => API.patch('/auth/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    API.patch('/auth/password', data),
};

// ── Services ──────────────────────────────────────────────────────────
export const servicesApi = {
  list: () => API.get('/services'),
  byBranch: (id: number) => API.get(`/services/branch/${id}`),
  byCategory: (cat: string) => API.get(`/services/category/${cat}`),
  getById: (id: number) => API.get(`/services/${id}`),
  create: (d: object) => API.post('/services', d),
  update: (id: number, d: object) => API.put(`/services/${id}`, d),
  delete: (id: number) => API.delete(`/services/${id}`),
  /** Upload/replace the service image; the backend stores the Supabase URL. */
  uploadImage: (id: number, file: File) =>
    API.post(`/services/${id}/image`, imageFormData(file), MULTIPART),
  deleteImage: (id: number) => API.delete(`/services/${id}/image`),
};

// ── Appointments ──────────────────────────────────────────────────────
export const appointmentsApi = {
  byCustomer: (id: number) => API.get(`/appointments/customer/${id}`),
  getById: (id: number) => API.get(`/appointments/${id}`),
  getSlots: (params: object) => API.get('/appointments/slots', { params }),
  book: (data: object) => API.post('/appointments', data),
  updateStatus: (id: number, s: string) => API.patch(`/appointments/${id}/status`, null, { params: { status: s } }),
  cancel: (id: number, reason: string) => API.post(`/appointments/${id}/cancel`, { reason }),
};

// ── Branches ──────────────────────────────────────────────────────────
export const branchesApi = {
  list: () => API.get('/branches'),
  getById: (id: number) => API.get(`/branches/${id}`),
  create: (d: object) => API.post('/branches', d),
  update: (id: number, d: object) => API.put(`/branches/${id}`, d),
  /** Upload/replace the branch image; the backend stores the Supabase URL. */
  uploadImage: (id: number, file: File) =>
    API.post(`/branches/${id}/image`, imageFormData(file), MULTIPART),
  deleteImage: (id: number) => API.delete(`/branches/${id}/image`),
};

// ── Customers ──────────────────────────────────────────────────────────
export const customersApi = {
  list: (params?: object) => API.get('/customers', { params }),
  getById: (id: number) => API.get(`/customers/${id}`),
  create: (d: object) => API.post('/customers', d),
  update: (id: number, d: object) => API.put(`/customers/${id}`, d),
  delete: (id: number) => API.delete(`/customers/${id}`),
};

// ── Vehicles ──────────────────────────────────────────────────────────
export const vehiclesApi = {
  mine: () => API.get('/vehicles/me'),
  byCustomer: (id: number) => API.get(`/vehicles/customer/${id}`),
  getById: (id: number) => API.get(`/vehicles/${id}`),
  getHistory: (id: number) => API.get(`/vehicles/${id}/history`),
  create: (d: object) => API.post('/vehicles', d),
  update: (id: number, d: object) => API.put(`/vehicles/${id}`, d),
  delete: (id: number) => API.delete(`/vehicles/${id}`),
  addHistory: (id: number, d: object) => API.post(`/vehicles/${id}/history`, d),
};

// ── Products ──────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: object) => API.get('/products', { params }),
  getById: (id: number) => API.get(`/products/${id}`),
  popular: (limit = 8) => API.get('/products/popular', { params: { limit } }),
  create: (d: object) => API.post('/products', d),
  update: (id: number, d: object) => API.put(`/products/${id}`, d),
  delete: (id: number) => API.delete(`/products/${id}`),
};

// ── Categories ────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => API.get('/categories'),
  subs: (id: number) => API.get(`/categories/${id}/subcategories`),
  create: (d: object) => API.post('/categories', d),
  update: (id: number, d: object) => API.put(`/categories/${id}`, d),
  /** Upload/replace the category image; the backend stores the Supabase URL. */
  uploadImage: (id: number, file: File) =>
    API.post(`/categories/${id}/image`, imageFormData(file), MULTIPART),
  deleteImage: (id: number) => API.delete(`/categories/${id}/image`),
};

// ── Brands / Marques ──────────────────────────────────────────────────
export const brandsApi = {
  /** `activeOnly` is what the public carousel uses; admin lists everything. */
  list: (activeOnly = false) => API.get('/brands', { params: { activeOnly } }),
  getById: (id: number) => API.get(`/brands/${id}`),
  create: (d: object) => API.post('/brands', d),
  update: (id: number, d: object) => API.put(`/brands/${id}`, d),
  delete: (id: number) => API.delete(`/brands/${id}`),
  /** Upload/replace the brand logo; the backend stores the Supabase URL. */
  uploadImage: (id: number, file: File) =>
    API.post(`/brands/${id}/image`, imageFormData(file), MULTIPART),
  deleteImage: (id: number) => API.delete(`/brands/${id}/image`),
};

// ── Orders ────────────────────────────────────────────────────────────
export const ordersApi = {
  byCustomer: (id: number, p?: object) => API.get(`/orders/customer/${id}`, { params: p }),
  listAll: (params?: object) => API.get('/orders', { params }),
  getById: (id: number) => API.get(`/orders/${id}`),
  /**
   * Places an order. `customerId` is optional and only used by staff ordering on
   * behalf of a walk-in; for a logged-in customer the backend resolves the CRM
   * row from the access token.
   */
  create: (d: object, customerId?: number) =>
    API.post('/orders', d, customerId != null ? { params: { customerId } } : undefined),
  updateStatus: (id: number, status: string) => API.patch(`/orders/${id}/status`, null, { params: { status } }),
};

// ── Inventory ─────────────────────────────────────────────────────────
export const inventoryApi = {
  byBranch: (id: number) => API.get(`/inventory/branch/${id}`),
  lowStock: (branchId?: number) => API.get('/inventory/low-stock', { params: { branchId } }),
  outOfStock: (branchId?: number) => API.get('/inventory/out-of-stock', { params: { branchId } }),
  adjust: (id: number, delta: number, note: string) =>
    API.patch(`/inventory/${id}/adjust`, null, { params: { delta, note } }),
  update: (id: number, data: {
    minimumStock: number
    maximumStock: number
    location?: string
    batchNumber?: string
    expiryDate?: string | null
  }) => API.patch(`/inventory/${id}`, data),
};

// ── Suppliers ─────────────────────────────────────────────────────────
export const suppliersApi = {
  /**
   * `activeOnly` mirrors `brandsApi.list`: purchase forms only want the
   * suppliers still in use, the admin table needs the deactivated ones too or
   * they can never be switched back on. Always call this through an arrow
   * function — handing it to TanStack Query directly would pass the query
   * context object as `activeOnly`.
   */
  list: (activeOnly = true) => API.get('/inventory/suppliers', { params: { activeOnly } }),
  create: (d: object) => API.post('/inventory/suppliers', d),
  update: (id: number, d: object) => API.put(`/inventory/suppliers/${id}`, d),
  /** Upload/replace the supplier logo; the backend stores the Supabase URL in `logoUrl`. */
  uploadImage: (id: number, file: File) =>
    API.post(`/inventory/suppliers/${id}/image`, imageFormData(file), MULTIPART),
  deleteImage: (id: number) => API.delete(`/inventory/suppliers/${id}/image`),
};

// ── Stock ledger (achats / ventes / reste) ────────────────────────────
/**
 * Stock is **derived**, not typed in: every change is a row in
 * `stock_movements` and `products.stockQuantity` is only the cached balance the
 * backend recomputes from that ledger. Placing an order now books a `SALE`
 * automatically and cancelling one books a `RETURN_CUSTOMER`, so the figure on a
 * product card finally matches reality.
 *
 * Mounted on `/stock`, not under `/products`: every `GET /products/**` is public,
 * and purchase costs and margins must not be.
 */
export const stockApi = {
  /** Newest-first history for one product. Paged like every admin list. */
  movements: (productId: number, params?: { page?: number; size?: number }) =>
    API.get(`/stock/products/${productId}/movements`, { params }),
  /** Totals for one product: acheté, vendu, reste, and the per-type breakdown. */
  summary: (productId: number) => API.get(`/stock/products/${productId}/summary`),
  /** Files an achat, a vente, a correction or a perte. */
  record: (productId: number, d: object) => API.post(`/stock/products/${productId}/movements`, d),
  /** Latest movements across the whole catalog. */
  latest: (params?: { page?: number; size?: number }) => API.get('/stock/movements', { params }),
  /** Catalog-wide totals; both date bounds are inclusive `YYYY-MM-DD`. */
  globalSummary: (params?: { from?: string; to?: string }) => API.get('/stock/summary', { params }),
  /** The picker options with their French labels, straight from the enum. */
  movementTypes: () => API.get('/stock/movement-types'),
};

// ── Workshop ──────────────────────────────────────────────────────────
export const workshopApi = {
  byCustomer: (id: number) => API.get(`/workshop/work-orders/customer/${id}`),
  getById: (id: number) => API.get(`/workshop/work-orders/${id}`),
  byStatus: (s: string) => API.get(`/workshop/work-orders/status/${s}`),
  create: (d: object) => API.post('/workshop/work-orders', d),
  advance: (id: number) => API.patch(`/workshop/work-orders/${id}/advance`),
  update: (id: number, d: object) => API.put(`/workshop/work-orders/${id}`, d),
};

// ── Loyalty ───────────────────────────────────────────────────────────
export const loyaltyApi = {
  mine: () => API.get('/loyalty/me'),
  getAccount: (customerId: number) => API.get(`/loyalty/customer/${customerId}`),
  earn: (customerId: number, pts: number) => API.post(`/loyalty/customer/${customerId}/earn`, null, { params: { points: pts } }),
  redeem: (customerId: number, pts: number) => API.post(`/loyalty/customer/${customerId}/redeem`, null, { params: { points: pts } }),
};

// ── Admin Appointments ─────────────────────────────────────────────────
export const adminAppointmentsApi = {
  /** Fetch all appointments (admin-level) */
  getAll: (params?: { status?: string; date?: string }) =>
    API.get('/appointments/admin/all', { params }),
  /** Fallback: fetch by branch if /admin/all endpoint not available */
  getByBranch: (branchId: number, params?: { status?: string }) =>
    API.get(`/appointments/branch/${branchId}`, { params }),
  getById: (id: number) => API.get(`/appointments/${id}`),
  updateStatus: (id: number, status: string) =>
    API.patch(`/appointments/${id}/status`, null, { params: { status } }),
  cancel: (id: number, reason: string) =>
    API.post(`/appointments/${id}/cancel`, { reason }),
};

// ── Admin Products (full CRUD with promo) ──────────────────────────────
export const adminProductsApi = {
  list: (params?: object) => API.get('/products/admin', { params }),
  getById: (id: number) => API.get(`/products/admin/${id}`),
  create: (d: object) => API.post('/products', d),
  update: (id: number, d: object) => API.put(`/products/${id}`, d),
  delete: (id: number) => API.delete(`/products/${id}`),
  /**
   * Upload/replace the product image. The backend pushes the binary to Supabase
   * Storage, deletes the previous object and persists the new public URL.
   */
  uploadImage: (id: number, file: File) =>
    API.post(`/products/${id}/image`, imageFormData(file), MULTIPART),
  deleteImage: (id: number) => API.delete(`/products/${id}/image`),
};

// ── Analytics (Admin reports & dashboard) ─────────────────────────────────
/**
 * Every figure on the dashboard and the reports page comes from here. The
 * backend aggregates `orders` / `order_items` / `products` / `customers` in SQL,
 * which is what makes the numbers correct — the previous client-side reduction
 * in `src/api.ts` only ever saw the first page of orders.
 *
 * Dates are ISO `YYYY-MM-DD` and **both bounds are inclusive**. Percentages come
 * back as `number | null`: `null` means the comparison base was zero, so render
 * `—` rather than a fake `+100%`.
 */
export const analyticsApi = {
  /** Everything the reports page needs, in one round-trip. */
  overview: (p: { from: string; to: string; year?: number }) => API.get('/analytics/overview', { params: p }),
  kpis: (p: { from: string; to: string }) => API.get('/analytics/kpis', { params: p }),
  /** Two aligned 12-month series (`year` and `year - 1`). Defaults to this year. */
  revenue: (year?: number) => API.get('/analytics/revenue', { params: year ? { year } : undefined }),
  /** Drill-down behind one bar of the revenue chart. `month` is 1-based. */
  month: (year: number, month: number) => API.get(`/analytics/revenue/${year}/${month}`),
  categories: (p: { from: string; to: string }) => API.get('/analytics/categories', { params: p }),
  /** Drill-down behind one row of the distribution bar. `0` = "Sans catégorie". */
  category: (categoryId: number, p: { from: string; to: string }) =>
    API.get(`/analytics/categories/${categoryId}`, { params: p }),
  topProducts: (p: { from: string; to: string; limit?: number }) => API.get('/analytics/top-products', { params: p }),
  topCustomers: (p: { from: string; to: string; limit?: number }) => API.get('/analytics/top-customers', { params: p }),
  orders: (p: { from: string; to: string; limit?: number }) => API.get('/analytics/orders', { params: p }),
};

/**
 * ERP back-office analytics — the sibling of {@link analyticsApi} for the modules
 * the ERP added on top of the e-commerce funnel: règlements (payments), bons de
 * commande (purchasing), bons de livraison (delivery), fiscalité (tax), trésorerie
 * (treasury) and RH (HR).
 *
 * Backed by `ErpAnalyticsController` at `/api/analytics/erp/*`, guarded server-side
 * by `AccessRules.ERP_FINANCE` (SUPER_ADMIN / BRANCH_ADMIN / MANAGER / ACCOUNTANT,
 * or the PAYMENT / ANALYTICS / REPORT authorities). Same `from`/`to` inclusive-ISO
 * contract, defaulting to the trailing 30 days. Amounts are `number` (2-decimal),
 * percentages `number` 0-100.
 */
export const erpAnalyticsApi = {
  /** Everything the ERP dashboard/report sections need, in one round-trip. */
  overview: (p: { from: string; to: string }) => API.get('/analytics/erp/overview', { params: p }),
  payments: (p: { from: string; to: string }) => API.get('/analytics/erp/payments', { params: p }),
  purchasing: (p: { from: string; to: string }) => API.get('/analytics/erp/purchasing', { params: p }),
  delivery: (p: { from: string; to: string }) => API.get('/analytics/erp/delivery', { params: p }),
  tax: (p: { from: string; to: string }) => API.get('/analytics/erp/tax', { params: p }),
  treasury: (p: { from: string; to: string }) => API.get('/analytics/erp/treasury', { params: p }),
  hr: () => API.get('/analytics/erp/hr'),
};

// ── Users & Permissions (Admin) ───────────────────────────────────────────
// `id` here is the account's public UUID (`AppUser.publicId`), never the
// sequential database key — the backend no longer serialises the latter.
export const usersApi = {
  list: (params?: object) => API.get('/users', { params }),
  getById: (id: string) => API.get(`/users/${id}`),
  updateRole: (id: string, role: string) => API.patch(`/users/${id}/role`, { role }),
  updatePermissions: (id: string, permissions: string[]) =>
    API.patch(`/users/${id}/permissions`, { permissions }),
  toggleLock: (id: string, locked: boolean) =>
    API.patch(`/users/${id}/lock`, null, { params: { locked } }),
  toggleActive: (id: string) => API.patch(`/users/${id}/toggle-active`),
  getRoles: () => API.get('/users/roles'),
  getPermissions: () => API.get('/users/permissions'),
};

// ── Notifications (admin bell) ────────────────────────────────────────────
/**
 * One notification line as the backend serialises it (`NotificationDto`).
 *
 * `read` is a property of the *pair* (notification, viewer), not of the row:
 * each account has its own read set server-side, so one admin opening the bell
 * never clears a colleague's badge.
 */
export interface NotificationItem {
  id: number;
  /** `ORDER_CREATED`, `ORDER_SHIPPED`, … — see `NotificationType` on the backend. */
  type: string;
  /** Ready-to-display French label, e.g. "Nouvelle commande". */
  title: string;
  /** Optional detail line, e.g. "3 article(s) · Sfax" or "Statut : PENDING → CONFIRMED". */
  message: string | null;
  /** The customer the bell leads with. Never null in practice — falls back to "Client". */
  actorName: string | null;
  /** Document number, e.g. `FACTURE-26000001`. */
  reference: string | null;
  amount: number | null;
  entityType: string | null;
  entityId: number | null;
  /** SPA route to open on click, e.g. `/admin/orders`. */
  link: string | null;
  /** Design-system tone chosen server-side, matching `StatusPill`. */
  tone: 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'gray' | string;
  read: boolean;
  createdAt: string;
}

/**
 * The staff feed behind the header bell. Gated server-side by
 * `AccessRules.NOTIFICATION_READ` (admin/manager/accountant/receptionist roles,
 * or the `ORDER_VIEW`/`ORDER_MANAGE` permissions) because the lines name
 * customers and quote order totals.
 *
 * Both mark endpoints answer with the **remaining** unread count, so the badge
 * updates from the same round-trip instead of needing a follow-up refetch.
 */
export const notificationsApi = {
  /** Newest first. `data.data` is a `PageResponse<NotificationItem>`. */
  list: (params?: { page?: number; size?: number }) => API.get('/notifications', { params }),
  /** `data.data.count` */
  unreadCount: () => API.get('/notifications/unread-count'),
  markRead: (id: number) => API.patch(`/notifications/${id}/read`),
  markAllRead: () => API.patch('/notifications/read-all'),
  /** Private feed for the authenticated customer; no recipient id is accepted. */
  personalList: (params?: { page?: number; size?: number }) => API.get('/notifications/me', { params }),
  personalUnreadCount: () => API.get('/notifications/me/unread-count'),
  markPersonalRead: (id: number) => API.patch(`/notifications/me/${id}/read`),
  markAllPersonalRead: () => API.patch('/notifications/me/read-all'),
};

/**
 * Absolute URL of an API path, for the few calls that cannot go through axios.
 *
 * The notification stream is one of them: it is read with `fetch` so the
 * `Authorization` header can be sent (`EventSource` cannot set headers, and
 * putting the token in the query string would write it into access logs and
 * browser history).
 */
export function apiUrl(path: string): string {
  const base = (API.defaults.baseURL || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
