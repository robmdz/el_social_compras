import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiPlus, FiRefreshCw } from 'react-icons/fi'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

const STATUS_LABELS = {
  draft: LABELS.orders.draft,
  sent: LABELS.orders.sent,
  in_review: LABELS.orders.inReview,
  approved: LABELS.orders.approved,
  dispatched: LABELS.orders.dispatched,
  delivered: LABELS.orders.delivered,
  rejected: LABELS.orders.rejected,
}

const STATUS_BADGE_CLASSES = {
  draft: 'bg-gray-200 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  dispatched: 'bg-purple-100 text-purple-800',
  delivered: 'bg-primary/20 text-primary-dark',
  rejected: 'bg-red-100 text-red-800',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value || 0)
}

export default function OrdersPage() {
  const { user } = useAuth()
  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const isAdmin = role === 'admin'
  const [orders, setOrders] = useState([])
  const [comparison, setComparison] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const [{ data: ordersData }, comparisonResp] = await Promise.all([
        api.get('/orders/', { params }),
        isAdmin ? api.get('/orders/comparison', { params }) : Promise.resolve({ data: [] }),
      ])
      setOrders(ordersData || [])
      setComparison(comparisonResp.data || [])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, isAdmin])

  const historicalOrders = useMemo(
    () => orders.filter((order) => ['delivered', 'rejected'].includes(order.status)),
    [orders]
  )

  const ordersToRender = activeTab === 'history' ? historicalOrders : orders

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{LABELS.orders.title}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FiRefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {(role === 'user' || role === 'admin') && (
            <Link
              to="/pedidos/nuevo"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
            >
              <FiPlus className="w-5 h-5" />
              {LABELS.orders.newOrder}
            </Link>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mb-4 sm:mb-6 flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg border ${activeTab === 'all' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
          >
            Todos los pedidos
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-2 rounded-lg border ${activeTab === 'comparison' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
          >
            Comparativo por sede
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg border ${activeTab === 'history' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
          >
            Historial
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <label htmlFor="status" className="block text-sm text-gray-600 mb-2">
          {LABELS.orders.status}
        </label>
        <select
          id="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">Todos</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          {LABELS.common.loading}
        </div>
      ) : isAdmin && activeTab === 'comparison' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {comparison.map((item) => (
            <div key={item.sede_id} className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800">{item.sede_name}</h3>
              <p className="text-sm text-gray-500 mt-1">Pedidos: {item.orders_count}</p>
              <p className="text-sm text-gray-500">Costo recomendado: {formatCurrency(item.total_suggested_cost)}</p>
              <p className="text-sm text-gray-500">Costo más alto: {formatCurrency(item.total_highest_cost)}</p>
              <p className="text-base text-primary font-semibold mt-2">
                Ahorro estimado: {formatCurrency(item.total_savings)}
              </p>
            </div>
          ))}
          {comparison.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 col-span-full">
              {LABELS.common.noData}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {ordersToRender.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                {LABELS.common.noData}
              </div>
            ) : (
              ordersToRender.map((order) => (
                <Link
                  key={order.id}
                  to={`/pedidos/${order.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow active:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800">#{order.id}</p>
                      <p className="text-sm text-gray-600 truncate">{order.sede_name || `Sede ${order.sede_id}`}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 truncate">{order.user_email || '—'}</p>
                  <span className="inline-block mt-2 text-sm font-medium text-primary">Ver detalle →</span>
                </Link>
              ))
            )}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto scroll-touch">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.sede}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado por</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.status}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.fecha}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{LABELS.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ordersToRender.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">#{order.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{order.sede_name || `Sede ${order.sede_id}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{order.user_email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE_CLASSES[order.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/pedidos/${order.id}`}
                        className="text-primary hover:text-primary-dark font-medium"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ordersToRender.length === 0 && (
              <div className="p-8 text-center text-gray-500">{LABELS.common.noData}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
