import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import { FiHome, FiTruck, FiPackage, FiShoppingCart, FiBell, FiUpload } from 'react-icons/fi'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/iniciar-sesion')
  }

  const navItems = [
    { to: '/dashboard', label: LABELS.nav.dashboard, icon: FiHome },
    { to: '/proveedores', label: LABELS.nav.suppliers, icon: FiTruck },
    { to: '/inventario', label: LABELS.nav.inventory, icon: FiPackage },
    { to: '/pedidos', label: LABELS.nav.orders, icon: FiShoppingCart },
    { to: '/notificaciones', label: LABELS.nav.notifications, icon: FiBell },
  ]

  const isAdmin = user?.role === 'admin' || user?.role_name === 'admin' || user?.user_metadata?.role === 'admin'
  if (isAdmin) {
    navItems.push({ to: '/importar', label: LABELS.nav.import, icon: FiUpload })
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-primary text-white flex flex-col">
        <div className="p-4 border-b border-primary-light">
          <h2 className="font-bold text-lg">El Social Bodega</h2>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isActive ? 'bg-primary-light text-white' : 'hover:bg-primary-light/80'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-primary-light">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-primary-light/80"
          >
            {LABELS.auth.logout}
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <span className="text-gray-600">
            {user?.email || user?.user_metadata?.email}
          </span>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}
