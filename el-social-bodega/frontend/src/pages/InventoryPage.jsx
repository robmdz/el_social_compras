import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiAlertTriangle } from 'react-icons/fi'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

const MOVEMENT_TYPE_LABELS = {
  purchase_entry: LABELS.inventory.purchaseEntry,
  exit_by_request: LABELS.inventory.exitByRequest,
  adjustment: LABELS.inventory.adjustment,
  loss_damage: LABELS.inventory.lossDamage,
}

function ProductFormModal({ product, onClose, onSuccess }) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: '',
    unit: '',
    min_stock: 0,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setForm({
        code: product.code || '',
        name: product.name || '',
        category: product.category || '',
        unit: product.unit || '',
        min_stock: product.min_stock ?? 0,
      })
    } else {
      setForm({ code: '', name: '', category: '', unit: '', min_stock: 0 })
    }
  }, [product])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (product?.id) {
        await api.put(`/products/${product.id}`, form)
        toast.success('Producto actualizado correctamente')
      } else {
        await api.post('/products', form)
        toast.success('Producto creado correctamente')
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          {product ? LABELS.common.edit : LABELS.inventory.addProduct}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.inventory.code}</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.inventory.name}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.inventory.category}</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.inventory.unit}</label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="unidad, caja, kg, litro..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.inventory.minStock}</label>
            <input
              type="number"
              min="0"
              value={form.min_stock}
              onChange={(e) => setForm((f) => ({ ...f, min_stock: parseInt(e.target.value, 10) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {LABELS.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-60"
            >
              {saving ? LABELS.common.loading : LABELS.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const isAdmin = role === 'admin'

  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modalProduct, setModalProduct] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const fetchProducts = useCallback(async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (categoryFilter) params.category = categoryFilter
      const { data } = await api.get('/products', { params })
      setProducts(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar productos')
      setProducts([])
    }
  }, [search, categoryFilter])

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await api.get('/alerts/low-stock')
      setAlerts(data)
    } catch {
      setAlerts([])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchProducts(), fetchAlerts()]).finally(() => setLoading(false))
  }, [fetchProducts, fetchAlerts])

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort()

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este producto?')) return
    setDeletingId(id)
    try {
      await api.delete(`/products/${id}`)
      toast.success('Producto eliminado')
      fetchProducts()
      fetchAlerts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEdit = (p, e) => {
    e.stopPropagation()
    setModalProduct(p)
    setShowFormModal(true)
  }

  const handleAddProduct = () => {
    setModalProduct(null)
    setShowFormModal(true)
  }

  const handleRowClick = (id) => {
    navigate(`/inventario/${id}`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{LABELS.inventory.title}</h1>
        {isAdmin && (
          <button
            onClick={handleAddProduct}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark shadow-md"
          >
            <FiPlus size={18} />
            {LABELS.inventory.addProduct}
          </button>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <FiAlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-semibold text-amber-800">{LABELS.inventory.lowStockAlerts}</h3>
            <p className="text-sm text-amber-700 mt-1">
              {alerts.length} producto{alerts.length !== 1 ? 's' : ''} con stock por debajo del mínimo
            </p>
            <ul className="mt-2 text-sm text-amber-800 space-y-1">
              {alerts.slice(0, 5).map((a) => (
                <li key={a.product_id}>
                  {a.product_name} ({a.product_code}): {a.current_quantity} / {a.min_stock} — déficit: {a.deficit}
                </li>
              ))}
              {alerts.length > 5 && <li>...y {alerts.length - 5} más</li>}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={LABELS.common.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-w-[180px]"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">{LABELS.common.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-sm font-medium text-gray-600">
                  <th className="px-4 py-3">{LABELS.inventory.code}</th>
                  <th className="px-4 py-3">{LABELS.inventory.name}</th>
                  <th className="px-4 py-3">{LABELS.inventory.category}</th>
                  <th className="px-4 py-3">{LABELS.inventory.unit}</th>
                  <th className="px-4 py-3">{LABELS.inventory.currentStock}</th>
                  <th className="px-4 py-3">{LABELS.inventory.minStock}</th>
                  {isAdmin && <th className="px-4 py-3">{LABELS.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLowStock = (p.current_quantity ?? 0) < (p.min_stock ?? 0)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleRowClick(p.id)}
                      className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                        isLowStock ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm">{p.code}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.category}</td>
                      <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                      <td className="px-4 py-3">
                        <span className={isLowStock ? 'font-semibold text-red-600' : ''}>
                          {p.current_quantity ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.min_stock ?? 0}</td>
                      {isAdmin && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleEdit(p, e)}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                              title={LABELS.common.edit}
                            >
                              <FiEdit size={16} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(p.id, e)}
                              disabled={deletingId === p.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              title={LABELS.common.delete}
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showFormModal && (
        <ProductFormModal
          product={modalProduct}
          onClose={() => {
            setShowFormModal(false)
            setModalProduct(null)
          }}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  )
}
