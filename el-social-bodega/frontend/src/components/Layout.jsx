import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import { FiHome, FiTruck, FiPackage, FiShoppingCart, FiBell, FiUpload, FiMenu, FiX, FiBox } from 'react-icons/fi'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/iniciar-sesion')
  }

  const closeSidebar = () => setSidebarOpen(false)

  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const isAdmin = role === 'admin'
  const isLeader = role === 'user'
  const isReviewer = role === 'reviewer'

  const adminItems = [
    { to: '/dashboard', label: LABELS.nav.dashboard, icon: FiHome },
    { to: '/proveedores', label: LABELS.nav.suppliers, icon: FiTruck },
    { to: '/inventario', label: LABELS.nav.inventory, icon: FiPackage },
    { to: '/pedidos', label: LABELS.nav.orders, icon: FiShoppingCart },
    { to: '/insumos', label: LABELS.nav.supplies, icon: FiBox },
    { to: '/notificaciones', label: LABELS.nav.notifications, icon: FiBell },
    { to: '/importar', label: LABELS.nav.import, icon: FiUpload },
  ]

  const reviewerItems = [
    { to: '/dashboard', label: LABELS.nav.dashboard, icon: FiHome },
    { to: '/pedidos', label: LABELS.nav.orders, icon: FiShoppingCart },
  ]

  const leaderItems = [
    { to: '/pedidos', label: LABELS.nav.orders, icon: FiShoppingCart },
    { to: '/insumos', label: LABELS.nav.supplies, icon: FiBox },
  ]

  const navItems = isLeader ? leaderItems : isAdmin ? adminItems : isReviewer ? reviewerItems : []

  const sidebarContent = (
    <>
      <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-primary-light flex items-center justify-between">
        <img src="/logo.png" alt="El Social" className="h-10 w-auto object-contain" />
        <button
          type="button"
          onClick={closeSidebar}
          className="md:hidden touch-target p-2 rounded-md hover:bg-primary-light/80 -m-2"
          aria-label="Cerrar menú"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scroll-touch">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-3 min-h-[44px] rounded-md transition-colors ${
                isActive ? 'bg-primary-light text-white' : 'hover:bg-primary-light/80'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-primary-light">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-3 min-h-[44px] rounded-md hover:bg-primary-light/80"
        >
          {LABELS.auth.logout}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          aria-label="Cerrar menú"
        />
      )}

      {/* Sidebar: drawer on mobile, fixed on desktop */}
      <aside
        className={`
          w-64 bg-primary text-white flex flex-col shrink-0
          fixed md:static inset-y-0 left-0 z-40
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-14 pt-[env(safe-area-inset-top,0)] bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 min-h-14">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="md:hidden touch-target p-2 rounded-md text-gray-600 hover:bg-gray-100 -m-2"
              aria-label="Abrir menú"
            >
              <FiMenu className="w-6 h-6" />
            </button>
            <img src="/logo.png" alt="El Social" className="h-8 w-auto object-contain md:hidden" />
          </div>
          <span className="text-gray-600 text-sm truncate max-w-[180px] sm:max-w-none">
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
