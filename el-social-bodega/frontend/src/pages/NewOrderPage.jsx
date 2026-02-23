import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FiArrowLeft, FiCheck, FiPlus } from 'react-icons/fi'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

const SEDES = [
  { id: 1, name: 'El Social Laureles' },
  { id: 2, name: 'El Social Poblado' },
  { id: 3, name: 'El Social Envigado' },
  { id: 4, name: 'El Social Sabaneta' },
  { id: 5, name: 'El Social Belén' },
  { id: 6, name: 'El Social Estadio' },
  { id: 7, name: 'El Social Centro' },
]

export default function NewOrderPage() {
  const { user } = useAuth()
  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const userSedeId = user?.sede_id != null ? Number(user.sede_id) : null
  const isSedeFixed = role === 'user' && userSedeId != null
  const navigate = useNavigate()
  const [sedeId, setSedeId] = useState('')

  useEffect(() => {
    if (role === 'user' && userSedeId != null) {
      setSedeId(String(userSedeId))
    }
  }, [role, userSedeId])
  const [executorType, setExecutorType] = useState('admin_managed')
  const [step, setStep] = useState(1)
  const [orderId, setOrderId] = useState(null)
  const [order, setOrder] = useState(null)
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [showSuggestProduct, setShowSuggestProduct] = useState(false)
  const [suggestForm, setSuggestForm] = useState({
    name: '',
    category: '',
    unit: '',
  })

  const canDirect = role === 'user'
  const canFinalize = useMemo(() => (order?.items || []).length > 0, [order?.items])

  const fetchOrder = async (currentOrderId) => {
    const { data } = await api.get(`/orders/${currentOrderId}`)
    setOrder(data)
  }

  const fetchGrouped = async (currentOrderId) => {
    const { data } = await api.get(`/orders/${currentOrderId}/grouped-by-supplier`)
    setGrouped(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const effectiveSedeId = isSedeFixed ? userSedeId : sedeId
    if (!effectiveSedeId) {
      if (role === 'user') {
        toast.error('No tienes una sede asignada. Contacta al administrador.')
      } else {
        toast.error('Selecciona una sede')
      }
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/orders/', {
        sede_id: typeof effectiveSedeId === 'number' ? effectiveSedeId : parseInt(sedeId, 10),
        executor_type: executorType,
      })
      toast.success('Pedido creado correctamente')
      setOrderId(data.id)
      await fetchOrder(data.id)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear el pedido')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchProducts = async (value) => {
    setSearch(value)
    setSelectedProduct(null)
    if (!value.trim()) {
      setProducts([])
      return
    }
    try {
      const { data } = await api.get('/products', { params: { search: value.trim() } })
      setProducts(data || [])
    } catch {
      setProducts([])
    }
  }

  const handleAddItem = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!selectedProduct || quantity < 1 || !orderId) {
      toast.error('Selecciona un producto y una cantidad válida')
      return
    }
    setLoading(true)
    try {
      await api.post(`/orders/${orderId}/items`, {
        product_id: selectedProduct.id,
        quantity_requested: quantity,
      })
      await fetchOrder(orderId)
      setSearch('')
      setProducts([])
      setSelectedProduct(null)
      setQuantity(1)
      toast.success('Producto agregado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al agregar producto')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuggestion = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    setSuggestLoading(true)
    try {
      await api.post('/products', {
        name: suggestForm.name.trim(),
        category: suggestForm.category.trim(),
        unit: suggestForm.unit.trim(),
        min_stock: 0,
      })
      toast.success('Sugerencia enviada para aprobación de admin')
      setShowSuggestProduct(false)
      setSuggestForm({ name: '', category: '', unit: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al sugerir producto')
    } finally {
      setSuggestLoading(false)
    }
  }

  const goToReview = async () => {
    if (!orderId) return
    await fetchGrouped(orderId)
    setStep(3)
  }

  const handleFinish = async () => {
    if (!orderId) return
    setLoading(true)
    try {
      if (executorType === 'leader_direct') {
        await api.patch(`/orders/${orderId}/status`, { status: 'sent' })
        const { data } = await api.get(`/orders/${orderId}/purchase-list/pdf`, {
          responseType: 'blob',
        })
        const blob = new Blob([data], { type: 'application/pdf' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `pedido-${orderId}-lista-compra.pdf`
        link.click()
        URL.revokeObjectURL(link.href)
        toast.success('Pedido enviado y PDF descargado')
      } else {
        toast.success('Pedido guardado para gestión del administrador')
      }
      navigate(`/pedidos/${orderId}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al finalizar pedido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <Link
        to="/pedidos"
        className="inline-flex items-center gap-2 mb-4 sm:mb-6 py-2 text-primary hover:text-primary-dark font-medium transition-colors touch-target"
      >
        <FiArrowLeft className="w-5 h-5" />
        {LABELS.common.back}
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
          {LABELS.orders.newOrder}
        </h1>

        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="sede" className="block text-sm font-medium text-gray-700 mb-2">
                {LABELS.orders.sede}
              </label>
              {isSedeFixed ? (
                <p className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-700">
                  {SEDES.find((s) => s.id === userSedeId)?.name ?? `Sede ${userSedeId}`}
                  <span className="ml-2 text-sm text-gray-500">(no se puede cambiar)</span>
                </p>
              ) : (
                <select
                  id="sede"
                  value={sedeId}
                  onChange={(e) => setSedeId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Selecciona una sede</option>
                  {SEDES.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quién realiza la compra</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="executor_type"
                    value="admin_managed"
                    checked={executorType === 'admin_managed'}
                    onChange={(e) => setExecutorType(e.target.value)}
                  />
                  Compras (admin) realiza la compra y seguimiento
                </label>
                {canDirect && (
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="executor_type"
                      value="leader_direct"
                      checked={executorType === 'leader_direct'}
                      onChange={(e) => setExecutorType(e.target.value)}
                    />
                    Yo realizo la compra y quiero descargar PDF inmediatamente
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? LABELS.common.loading : 'Continuar'}
              </button>
              <Link
                to="/pedidos"
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {LABELS.common.cancel}
              </Link>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Agregar productos al pedido</label>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchProducts(e.target.value)}
                placeholder="Buscar producto por nombre o código"
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
              />
              {search && !selectedProduct && products.length > 0 && (
                <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-40 overflow-y-auto">
                  {products.map((product) => (
                    <li
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product)
                        setSearch(`${product.name} (${product.code || 'Sin código'})`)
                        setProducts([])
                      }}
                      className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-sm"
                    >
                      {product.name} <span className="text-gray-500">({product.code || 'Sin código'})</span>
                    </li>
                  ))}
                </ul>
              )}

              {search && products.length === 0 && !selectedProduct && (
                <div className="rounded-lg border border-dashed border-gray-300 p-3">
                  <p className="text-sm text-gray-600 mb-2">¿No encuentras el producto?</p>
                  <button
                    type="button"
                    onClick={() => setShowSuggestProduct((v) => !v)}
                    className="text-primary font-medium text-sm"
                  >
                    Sugerir nuevo producto
                  </button>
                </div>
              )}

              {showSuggestProduct && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <input
                    value={suggestForm.name}
                    onChange={(e) => setSuggestForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del producto"
                    className="w-full rounded border border-gray-300 px-3 py-2"
                    required
                  />
                  <input
                    value={suggestForm.category}
                    onChange={(e) => setSuggestForm((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Categoría"
                    className="w-full rounded border border-gray-300 px-3 py-2"
                    required
                  />
                  <input
                    value={suggestForm.unit}
                    onChange={(e) => setSuggestForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="Unidad (unidad, caja, kg, litro)"
                    className="w-full rounded border border-gray-300 px-3 py-2"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleCreateSuggestion}
                    disabled={suggestLoading}
                    className="px-3 py-2 bg-primary text-white rounded-lg"
                  >
                    {suggestLoading ? LABELS.common.loading : 'Enviar sugerencia'}
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProduct || loading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                >
                  <FiPlus className="w-4 h-4" />
                  Agregar
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Productos agregados</p>
              {order?.items?.length ? (
                <ul className="space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="text-sm text-gray-700">
                      {item.product_name} x {item.quantity_requested} · {item.suggested_supplier_name || 'Sin proveedor sugerido'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Aún no has agregado productos</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={goToReview}
                disabled={!canFinalize}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                Revisar por proveedor
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Vista por proveedor</h2>
            {grouped.map((group) => (
              <div key={group.supplier_id || group.supplier_name} className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-primary">{group.supplier_name}</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      {item.product_name} ({item.product_code || 'Sin código'}) x {item.quantity_requested}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm font-semibold text-gray-800">
                  Subtotal: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(group.subtotal || 0)}
                </p>
              </div>
            ))}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Volver a editar
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading || !canFinalize}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                <FiCheck className="w-4 h-4" />
                Finalizar pedido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
