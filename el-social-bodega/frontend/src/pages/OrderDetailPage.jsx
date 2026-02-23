import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FiArrowLeft, FiDownload, FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi'
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

const STATUS_STEPS = [
  { key: 'draft', label: LABELS.orders.draft },
  { key: 'sent', label: LABELS.orders.sent },
  { key: 'in_review', label: LABELS.orders.inReview },
  { key: 'approved', label: LABELS.orders.approved },
  { key: 'dispatched', label: LABELS.orders.dispatched },
  { key: 'delivered', label: LABELS.orders.delivered },
]

const STATUS_ORDER = ['draft', 'sent', 'in_review', 'approved', 'dispatched', 'delivered', 'rejected']

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status
  const classes = STATUS_BADGE_CLASSES[status] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

function getStepIndex(status) {
  const idx = STATUS_ORDER.indexOf(status)
  if (status === 'rejected') return -1
  return idx
}

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [addLoading, setAddLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [purchasePdfLoading, setPurchasePdfLoading] = useState(false)
  const [supplierGroups, setSupplierGroups] = useState([])
  const [editingItemId, setEditingItemId] = useState(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [showSuggestProduct, setShowSuggestProduct] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestForm, setSuggestForm] = useState({
    name: '',
    category: '',
    unit: '',
  })

  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const isAdmin = role === 'admin'
  const canEditItems = role === 'user' || role === 'admin'
  const isDraft = order?.status === 'draft'

  const fetchOrder = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/orders/${orderId}`)
      setOrder(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar el pedido')
      navigate('/pedidos')
    } finally {
      setLoading(false)
    }
  }, [orderId, navigate])

  const fetchGroupedBySupplier = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}/grouped-by-supplier`)
      setSupplierGroups(data || [])
    } catch {
      setSupplierGroups([])
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  useEffect(() => {
    fetchGroupedBySupplier()
  }, [fetchGroupedBySupplier, fetchOrder])

  useEffect(() => {
    if (!productSearch.trim()) {
      setProducts([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/products', {
          params: { search: productSearch.trim() },
        })
        setProducts(data || [])
      } catch {
        setProducts([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!selectedProduct || quantity < 1) {
      toast.error('Selecciona un producto y cantidad válida')
      return
    }
    setAddLoading(true)
    try {
      await api.post(`/orders/${orderId}/items`, {
        product_id: selectedProduct.id,
        quantity_requested: quantity,
      })
      toast.success('Producto agregado')
      setSelectedProduct(null)
      setProductSearch('')
      setQuantity(1)
      fetchOrder()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al agregar producto')
    } finally {
      setAddLoading(false)
    }
  }

  const handleUpdateItem = async (itemId) => {
    const qty = parseInt(editQuantity, 10)
    if (isNaN(qty) || qty < 1) {
      toast.error('Cantidad inválida')
      return
    }
    try {
      await api.put(`/orders/${orderId}/items/${itemId}`, {
        quantity_requested: qty,
      })
      toast.success('Cantidad actualizada')
      setEditingItemId(null)
      setEditQuantity('')
      fetchOrder()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar')
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('¿Eliminar este producto del pedido?')) return
    try {
      await api.delete(`/orders/${orderId}/items/${itemId}`)
      toast.success('Producto eliminado')
      fetchOrder()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  const handleStatusChange = async (newStatus) => {
    setStatusLoading(true)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus })
      toast.success('Estado actualizado')
      fetchOrder()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar estado')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleExportPdf = async () => {
    setPdfLoading(true)
    try {
      const { data } = await api.get(`/orders/${orderId}/savings-report/pdf`, {
        responseType: 'blob',
      })
      const blob = new Blob([data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `pedido-${orderId}-ahorros.pdf`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success('PDF descargado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al exportar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleExportPurchaseListPdf = async () => {
    setPurchasePdfLoading(true)
    try {
      const { data } = await api.get(`/orders/${orderId}/purchase-list/pdf`, {
        responseType: 'blob',
      })
      const blob = new Blob([data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `pedido-${orderId}-lista-compra.pdf`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success('PDF de lista por proveedor descargado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al exportar PDF')
    } finally {
      setPurchasePdfLoading(false)
    }
  }

  const handleCreateSuggestion = async () => {
    setSuggestLoading(true)
    try {
      await api.post('/products', {
        name: suggestForm.name.trim(),
        category: suggestForm.category.trim(),
        unit: suggestForm.unit.trim(),
        min_stock: 0,
      })
      toast.success('Sugerencia enviada para aprobación')
      setShowSuggestProduct(false)
      setSuggestForm({ name: '', category: '', unit: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al sugerir producto')
    } finally {
      setSuggestLoading(false)
    }
  }

  const currentStepIndex = order ? getStepIndex(order.status) : -1

  const showSendButton = isDraft && canEditItems
  const showReviewButton = order?.status === 'sent' && isAdmin
  const showApproveRejectButtons = order?.status === 'in_review' && isAdmin
  const showDispatchButton = order?.status === 'approved' && isAdmin
  const showDeliverButton = order?.status === 'dispatched' && isAdmin

  if (loading || !order) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500">{LABELS.common.loading}</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <Link
        to="/pedidos"
        className="inline-flex items-center gap-2 mb-4 sm:mb-6 py-2 text-primary hover:text-primary-dark font-medium transition-colors touch-target"
      >
        <FiArrowLeft className="w-5 h-5" />
        {LABELS.common.back}
      </Link>

      {/* Order header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Pedido #{order.id}
            </h1>
            <p className="text-gray-600 mt-1">
              {order.sede_name || `Sede ${order.sede_id}`} · {formatDate(order.created_at)}
            </p>
            <div className="mt-2">
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors font-medium disabled:opacity-50"
            >
              <FiDownload className="w-5 h-5" />
              {pdfLoading ? LABELS.common.loading : LABELS.orders.exportPdf}
            </button>
            <button
              onClick={handleExportPurchaseListPdf}
              disabled={purchasePdfLoading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-secondary text-secondary rounded-lg hover:bg-secondary/10 transition-colors font-medium disabled:opacity-50"
            >
              <FiDownload className="w-5 h-5" />
              {purchasePdfLoading ? LABELS.common.loading : 'Lista por proveedor PDF'}
            </button>
          </div>
        </div>

        {/* Status timeline */}
        {order.status !== 'rejected' && (
          <div className="mt-8">
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {STATUS_STEPS.map((step, idx) => {
                const isActive = idx <= currentStepIndex
                const isCurrent = order.status === step.key
                return (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                          isActive
                            ? isCurrent
                              ? 'bg-primary text-white'
                              : 'bg-primary/20 text-primary'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span className={`mt-1 text-xs font-medium ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 min-w-[20px] ${idx < currentStepIndex ? 'bg-primary' : 'bg-gray-200'}`} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Savings summary */}
      {order.items?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{LABELS.orders.totalSuggestedCost}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(order.total_suggested_cost)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{LABELS.orders.totalHighestCost}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(order.total_highest_cost)}</p>
          </div>
          <div className="bg-primary/10 rounded-xl border-2 border-primary p-4">
            <p className="text-sm font-medium text-primary">{LABELS.orders.totalSavings}</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(order.total_savings)}</p>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Productos</h2>
        </div>
        {order.items?.length > 0 ? (
          <div className="overflow-x-auto scroll-touch">
            <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '600px' }}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.product}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.quantity}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.suggestedSupplier}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.suggestedPrice}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.highestPrice}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{LABELS.orders.savings}</th>
                  {isDraft && canEditItems && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{LABELS.common.actions}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{item.product_name}</span>
                      {item.product_code && (
                        <span className="block text-xs text-gray-500">{item.product_code}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingItemId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => handleUpdateItem(item.id)}
                            className="text-primary text-sm font-medium"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => { setEditingItemId(null); setEditQuantity(''); }}
                            className="text-gray-500 text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-700">{item.quantity_requested}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={item.suggested_supplier_name ? 'font-medium text-primary' : 'text-gray-400'}>
                        {item.suggested_supplier_name || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{formatCurrency(item.suggested_price)}</td>
                    <td className="px-6 py-4 text-gray-700">{formatCurrency(item.highest_price)}</td>
                    <td className="px-6 py-4 font-medium text-primary">{formatCurrency(item.savings_per_item)}</td>
                    {isDraft && canEditItems && (
                      <td className="px-6 py-4 text-right">
                        {editingItemId === item.id ? null : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setEditingItemId(item.id); setEditQuantity(String(item.quantity_requested)); }}
                              className="p-1.5 text-gray-600 hover:text-primary"
                              title={LABELS.common.edit}
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 text-gray-600 hover:text-red-600"
                              title={LABELS.common.delete}
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No hay productos en este pedido.
          </div>
        )}
      </div>

      {/* Add item form (draft only) */}
      {isDraft && canEditItems && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">{LABELS.orders.addItem}</h3>
          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setSelectedProduct(null); }}
                placeholder={LABELS.common.search}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {productSearch && !selectedProduct && products.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {products.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => { setSelectedProduct(p); setProductSearch(`${p.name} (${p.code})`); setProducts([]); }}
                      className="px-4 py-2 hover:bg-primary/10 cursor-pointer text-sm"
                    >
                      {p.name} <span className="text-gray-500">({p.code})</span>
                    </li>
                  ))}
                </ul>
              )}
              {productSearch && !selectedProduct && products.length === 0 && (
                <div className="mt-2 rounded-lg border border-dashed border-gray-300 p-3">
                  <p className="text-sm text-gray-600 mb-2">¿No encuentras el producto?</p>
                  <button
                    type="button"
                    onClick={() => setShowSuggestProduct((v) => !v)}
                    className="text-primary text-sm font-medium"
                  >
                    Sugerir nuevo producto
                  </button>
                </div>
              )}
              {showSuggestProduct && (
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <input
                    value={suggestForm.name}
                    onChange={(e) => setSuggestForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del producto"
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                  <input
                    value={suggestForm.category}
                    onChange={(e) => setSuggestForm((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Categoría"
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                  <input
                    value={suggestForm.unit}
                    onChange={(e) => setSuggestForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="Unidad"
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSuggestion}
                    disabled={suggestLoading || !suggestForm.name || !suggestForm.category || !suggestForm.unit}
                    className="px-3 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
                  >
                    {suggestLoading ? LABELS.common.loading : 'Enviar sugerencia'}
                  </button>
                </div>
              )}
            </div>
            <div className="w-full sm:w-32">
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                placeholder={LABELS.orders.quantity}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={addLoading || !selectedProduct}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlus className="w-5 h-5" />
              {addLoading ? LABELS.common.loading : LABELS.common.add}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Vista por proveedor</h3>
        {supplierGroups.length > 0 ? (
          <div className="space-y-4">
            {supplierGroups.map((group) => (
              <div key={group.supplier_id || group.supplier_name} className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-primary">{group.supplier_name}</h4>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      {item.product_name} ({item.product_code || 'Sin código'}) x {item.quantity_requested}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm font-semibold text-gray-800">
                  Subtotal: {formatCurrency(group.subtotal)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay datos agrupados por proveedor.</p>
        )}
      </div>

      {/* Admin action buttons */}
      <div className="flex flex-wrap gap-3">
        {showSendButton && (
          <button
            onClick={() => handleStatusChange('sent')}
            disabled={statusLoading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium disabled:opacity-50"
          >
            {LABELS.orders.send}
          </button>
        )}
        {showReviewButton && (
          <button
            onClick={() => handleStatusChange('in_review')}
            disabled={statusLoading}
            className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark font-medium disabled:opacity-50"
          >
            {LABELS.orders.review}
          </button>
        )}
        {showApproveRejectButtons && (
          <>
            <button
              onClick={() => handleStatusChange('approved')}
              disabled={statusLoading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium disabled:opacity-50"
            >
              {LABELS.orders.approve}
            </button>
            <button
              onClick={() => handleStatusChange('rejected')}
              disabled={statusLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
            >
              {LABELS.orders.reject}
            </button>
          </>
        )}
        {showDispatchButton && (
          <button
            onClick={() => handleStatusChange('dispatched')}
            disabled={statusLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
          >
            {LABELS.orders.dispatch}
          </button>
        )}
        {showDeliverButton && (
          <button
            onClick={() => handleStatusChange('delivered')}
            disabled={statusLoading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium disabled:opacity-50"
          >
            {LABELS.orders.deliver}
          </button>
        )}
      </div>
    </div>
  )
}
