import { Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'


// Public pages
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Shop from './pages/Shop'
import ServicesPage from './pages/ServicesPage'
import AppointmentsPage from './pages/AppointmentsPage'
import ProductDetail from './pages/ProductDetail'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'

// Customer portal
import CustomerDashboard from './pages/CustomerDashboard'
import VehiclesPage from './pages/VehiclesPage'
import OrdersPage from './pages/OrdersPage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import ProfilePage from './pages/ProfilePage'
import NotificationsPage from './pages/NotificationsPage'
import MyAppointmentsPage from './pages/MyAppointmentsPage'
import Likes from './pages/Likes'

// Admin
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminProducts from './pages/admin/AdminProducts'
import AdminOrders from './pages/admin/AdminOrders'
import AdminClients from './pages/admin/AdminClients'
import AdminAppointments from './pages/admin/AdminAppointments'
import AdminWorkshop from './pages/admin/AdminWorkshop'
import AdminInventory from './pages/admin/AdminInventory'
import AdminSuppliers from './pages/admin/AdminSuppliers'
import AdminServices from './pages/admin/AdminServices'
import AdminBranches from './pages/admin/AdminBranches'
import AdminReports from './pages/admin/AdminReports'
import AdminCategories from './pages/admin/AdminCategories'
import AdminBrands from './pages/admin/AdminBrands'
import AdminUsers from './pages/admin/AdminUsers'

// Shared layout
import PublicLayout from './components/layout/PublicLayout'
import BrandedLoader from './components/BrandedLoader'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 5 },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, validateSession } = useAuth()
  const location = useLocation()

  // Re-validate on every navigation: an admin lock or a revoked token is only
  // observable server-side, so each route change asks the backend.
  useEffect(() => {
    if (isAuthenticated) void validateSession()
  }, [location.pathname, isAuthenticated, validateSession])

  if (loading) return <BrandedLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<BrandedLoader />}>
            <Routes>
              {/* Public */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/shop/:id" element={<ProductDetail />} />
                <Route path="/likes" element={<Likes />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>

              {/* Customer portal */}
              <Route element={<PublicLayout />}>
                <Route path="/dashboard" element={<ProtectedRoute><CustomerDashboard /></ProtectedRoute>} />
                <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                <Route path="/orders/:id" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/my-appointments" element={<ProtectedRoute><MyAppointmentsPage /></ProtectedRoute>} />
              </Route>

              {/* Admin — AdminLayout has its own auth + role guard */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="clients" element={<AdminClients />} />
                <Route path="appointments" element={<AdminAppointments />} />
                <Route path="workshop" element={<AdminWorkshop />} />
                <Route path="inventory" element={<AdminInventory />} />
                <Route path="suppliers" element={<AdminSuppliers />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="branches" element={<AdminBranches />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="brands" element={<AdminBrands />} />
                <Route path="users" element={<AdminUsers />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-right" richColors theme="dark" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
