import React, { useEffect, useState } from 'react'
import { FiBell, FiAlertTriangle, FiShoppingCart, FiTrendingUp, FiInfo, FiCheck } from 'react-icons/fi'
import api from '../services/api'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

const NOTIFICATION_TYPES = {
  low_stock: { icon: FiAlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-500' },
  new_order: { icon: FiShoppingCart, color: 'text-secondary', bg: 'bg-amber-50', border: 'border-secondary' },
  new_product_request: { icon: FiCheck, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary' },
  price_spike: { icon: FiTrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-500' },
  default: { icon: FiInfo, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary' },
}

function getTypeConfig(type) {
  return NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.default
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data || [])
    } catch (err) {
      console.error('Notifications fetch error:', err)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (err) {
      console.error('Mark read error:', err)
    }
  }

  const handleApproveSupply = async (notification) => {
    const productId = notification.product_id
    if (!productId) return
    try {
      await api.patch(`/products/${productId}/approve`)
      toast.success(LABELS.notifications.supplyApproved)
      await handleMarkRead(notification.id)
      fetchNotifications()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al aprobar insumo')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-600">{LABELS.common.loading}</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
        <FiBell className="w-7 h-7 text-primary" />
        {LABELS.notifications.title}
      </h1>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-100">
          <FiBell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">{LABELS.notifications.noNotifications}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => {
            const config = getTypeConfig(n.type)
            const Icon = config.icon
            const isUnread = !n.read

            return (
              <div
                key={n.id}
                className={`bg-white rounded-xl shadow-md p-5 border border-gray-100 transition-shadow hover:shadow-lg ${
                  isUnread ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0 w-fit`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800">{n.message}</p>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 flex-wrap">
                    {n.type === 'new_product_request' && n.product_id && (
                      <button
                        onClick={() => handleApproveSupply(n)}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors"
                      >
                        {LABELS.notifications.approveSupply}
                      </button>
                    )}
                    {isUnread && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        {LABELS.notifications.markRead}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
