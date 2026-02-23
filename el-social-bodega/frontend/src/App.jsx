import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-gray-50">
        <p className="text-gray-600">Cargando...</p>
        <p className="text-sm text-gray-400">Si la conexión es lenta, puede tardar unos segundos.</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <HomePage />}
      />
      <Route
        path="/iniciar-sesion"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/registro"
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <DashboardPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proveedores"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <SuppliersPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventario"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <InventoryPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventario/:productId"
        element={
          <ProtectedRoute>
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
          <ProtectedRoute>
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
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
    </Routes>
  )
}
