import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiPackage, FiTruck, FiShoppingCart, FiBarChart2, FiShield, FiUsers } from 'react-icons/fi'

export default function HomePage() {
  const { user } = useAuth()

  // If user is logged in, redirect to dashboard is handled by App.jsx
  // This page is for unauthenticated users

  const features = [
    {
      icon: FiPackage,
      title: 'Gestión de Inventario',
      description: 'Controla entradas, salidas y ajustes de inventario con trazabilidad completa',
    },
    {
      icon: FiTruck,
      title: 'Proveedores',
      description: 'Administra proveedores y compara precios para optimizar compras',
    },
    {
      icon: FiShoppingCart,
      title: 'Pedidos Inteligentes',
      description: 'Sistema de pedidos con sugerencias automáticas de proveedores con mejores precios',
    },
    {
      icon: FiBarChart2,
      title: 'Reportes y Estadísticas',
      description: 'Dashboards con visualizaciones de movimientos, tendencias de precios y ahorros',
    },
    {
      icon: FiShield,
      title: 'Control de Acceso',
      description: 'Sistema de roles (Administrador, Usuario, Revisor) con permisos diferenciados',
    },
    {
      icon: FiUsers,
      title: 'Multi-sede',
      description: 'Gestiona inventario centralizado para las 7 sedes de El Social Medellín',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <FiPackage className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">El Social Bodega</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/iniciar-sesion"
                className="px-4 py-2 text-gray-700 hover:text-primary transition-colors"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/registro"
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                Registrarse
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Sistema de Gestión de Bodega
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Plataforma inteligente para la gestión de inventario, proveedores y pedidos
            de El Social Medellín S.A.S
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/registro"
              className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors font-medium"
            >
              Comenzar Ahora
            </Link>
            <Link
              to="/iniciar-sesion"
              className="px-6 py-3 bg-white text-primary border-2 border-primary rounded-md hover:bg-primary/5 transition-colors font-medium"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>© 2026 El Social Medellín S.A.S - Sistema de Gestión de Bodega</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
