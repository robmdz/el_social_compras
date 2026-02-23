import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SuppliersPage from './pages/SuppliersPage'
import InventoryPage from './pages/InventoryPage'
import ProductDetailPage from './pages/ProductDetailPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailPage from './pages/OrderDetailPage'
import NewOrderPage from './pages/NewOrderPage'
import NotificationsPage from './pages/NotificationsPage'
import ImportPage from './pages/ImportPage'
import InsumosPage from './pages/InsumosPage'
import { ProtectedRoute } from './context/AuthContext'

function ProtectedLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      <Layout>{children}</Layout>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const defaultAuthenticatedPath = role === 'user' ? '/pedidos' : '/dashboard'

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-gray-50 px-4">
        <p className="text-gray-600">Cargando...</p>
        <p className="text-sm text-gray-400 text-center">Si la conexión es lenta, puede tardar unos segundos.</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to={defaultAuthenticatedPath} replace /> : <HomePage />}
      />
      <Route
        path="/iniciar-sesion"
        element={user ? <Navigate to={defaultAuthenticatedPath} replace /> : <LoginPage />}
      />
      <Route
        path="/recuperar-contrasena"
        element={user ? <Navigate to={defaultAuthenticatedPath} replace /> : <ForgotPasswordPage />}
      />
      <Route
        path="/restablecer-contrasena"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/registro"
        element={user ? <Navigate to={defaultAuthenticatedPath} replace /> : <RegisterPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin', 'reviewer']}>
            <ProtectedLayout>
              <DashboardPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proveedores"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProtectedLayout>
              <SuppliersPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventario"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProtectedLayout>
              <InventoryPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventario/:productId"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProtectedLayout>
              <ProductDetailPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <OrdersPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos/nuevo"
        element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <ProtectedLayout>
              <NewOrderPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos/:orderId"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <OrderDetailPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProtectedLayout>
              <NotificationsPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/importar"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProtectedLayout>
              <ImportPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/insumos"
        element={
          <ProtectedRoute allowedRoles={['admin', 'user']}>
            <ProtectedLayout>
              <InsumosPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? defaultAuthenticatedPath : "/"} replace />} />
    </Routes>
  )
}
