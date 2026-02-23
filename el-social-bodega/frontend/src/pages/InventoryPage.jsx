import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiAlertTriangle, FiPackage, FiMapPin, FiArrowRight, FiArrowLeft } from 'react-icons/fi'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'
import ProductFormModal from '../components/ProductFormModal'

const MOVEMENT_TYPE_LABELS = {
  purchase_entry: LABELS.inventory.purchaseEntry,
  exit_by_request: LABELS.inventory.exitByRequest,
  adjustment: LABELS.inventory.adjustment,
  loss_damage: LABELS.inventory.lossDamage,
}

const TAB_BODEGA = 'bodega'
const TAB_SEDES = 'sedes'

export default function InventoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const isAdmin = role === 'admin'

  const [activeTab, setActiveTab] = useState(TAB_BODEGA)
  const [products, setProducts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modalProduct, setModalProduct] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [sedes, setSedes] = useState([])
  const [selectedSedeId, setSelectedSedeId] = useState('')
  const [sedeStock, setSedeStock] = useState([])
  const [sedeStockLoading, setSedeStockLoading] = useState(false)
  const [sedeQuantityEdit, setSedeQuantityEdit] = useState({})
  const [savingSedeProduct, setSavingSedeProduct] = useState(null)

  const [transferModal, setTransferModal] = useState(null)
  const [transferQuantity, setTransferQuantity] = useState(1)
  const [transferSedeId, setTransferSedeId] = useState('')
  const [submittingTransfer, setSubmittingTransfer] = useState(false)

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

  const fetchSedes = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/sedes')
      setSedes(data || [])
    } catch {
      setSedes([])
    }
  }, [])

  const fetchSedeStock = useCallback(async () => {
    if (!selectedSedeId) {
      setSedeStock([])
      return
    }
    setSedeStockLoading(true)
    try {
      const { data } = await api.get('/sede-stock', { params: { sede_id: selectedSedeId } })
      setSedeStock(data || [])
      setSedeQuantityEdit({})
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar stock de sede')
      setSedeStock([])
    } finally {
      setSedeStockLoading(false)
    }
  }, [selectedSedeId])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchProducts(), fetchAlerts()]).finally(() => setLoading(false))
  }, [fetchProducts, fetchAlerts])

  useEffect(() => {
    fetchSedes()
  }, [fetchSedes])

  useEffect(() => {
    if (activeTab === TAB_SEDES && sedes.length > 0 && !selectedSedeId) {
      setSelectedSedeId(String(sedes[0].id))
    }
  }, [activeTab, sedes, selectedSedeId])

  useEffect(() => {
    if (activeTab === TAB_SEDES && selectedSedeId) fetchSedeStock()
    else setSedeStock([])
  }, [activeTab, selectedSedeId, fetchSedeStock])

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

  const handleSedeQuantityChange = (productId, value) => {
    const n = parseInt(value, 10)
    setSedeQuantityEdit((prev) => ({ ...prev, [productId]: isNaN(n) ? 0 : Math.max(0, n) }))
  }

  const handleSaveSedeQuantity = async (productId) => {
    const quantity = sedeQuantityEdit[productId] ?? sedeStock.find((r) => r.product_id === productId)?.quantity ?? 0
    setSavingSedeProduct(productId)
    try {
      await api.put('/sede-stock', { product_id: productId, quantity }, { params: { sede_id: selectedSedeId } })
      toast.success('Cantidad actualizada')
      fetchSedeStock()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSavingSedeProduct(null)
    }
  }

  const selectedSedeName = sedes.find((s) => String(s.id) === selectedSedeId)?.name || LABELS.inventory.sedeSelect

  const openTransferToSede = async (p, e) => {
    e.stopPropagation()
    const availableQty = Number(p?.current_quantity ?? 0)
    if (availableQty < 1) {
      toast.error('No hay stock en bodega para transferir este insumo')
      return
    }
    let availableSedes = sedes
    if (!availableSedes.length) {
      try {
        const { data } = await api.get('/auth/sedes')
        availableSedes = data || []
        setSedes(availableSedes)
      } catch {
        toast.error('No se pudieron cargar las sedes')
        return
      }
    }
    if (!availableSedes.length) {
      toast.error('No hay sedes disponibles para transferir')
      return
    }
    setTransferModal({ direction: 'bodega_to_sede', product: p })
    setTransferQuantity(1)
    setTransferSedeId(String(availableSedes[0].id))
  }

  const openTransferToBodega = (row, e) => {
    e.stopPropagation()
    const availableQty = Number(row?.quantity ?? 0)
    if (availableQty < 1) {
      toast.error('No hay stock en la sede para retornar este insumo')
      return
    }
    setTransferModal({ direction: 'sede_to_bodega', product: row, sedeId: selectedSedeId })
    setTransferQuantity(1)
    setTransferSedeId(selectedSedeId)
  }

  const closeTransferModal = () => {
    setTransferModal(null)
    setTransferQuantity(1)
    setTransferSedeId('')
  }

  const handleSubmitTransfer = async () => {
    if (!transferModal) return
    const sedeId = transferModal.direction === 'bodega_to_sede' ? transferSedeId : transferModal.sedeId
    const productId = transferModal.product?.id ?? transferModal.product?.product_id
    const maxQty = transferModal.direction === 'bodega_to_sede'
      ? (transferModal.product?.current_quantity ?? 0)
      : (transferModal.product?.quantity ?? 0)
    if (!sedeId || !productId || transferQuantity < 1 || transferQuantity > maxQty) {
      toast.error('Verifica la cantidad y la sede')
      return
    }
    setSubmittingTransfer(true)
    try {
      await api.post('/transfer', {
        product_id: productId,
        direction: transferModal.direction,
        sede_id: Number(sedeId),
        quantity: transferQuantity,
      })
      toast.success('Transferencia realizada')
      closeTransferModal()
      fetchProducts()
      fetchAlerts()
      if (activeTab === TAB_SEDES && selectedSedeId) fetchSedeStock()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al transferir')
    } finally {
      setSubmittingTransfer(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{LABELS.inventory.title}</h1>
        {isAdmin && activeTab === TAB_BODEGA && (
          <button
            onClick={handleAddProduct}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark shadow-md"
          >
            <FiPlus size={18} />
            {LABELS.inventory.addProduct}
          </button>
        )}
      </div>

      {/* Tabs: Bodega | Sedes — full width on mobile */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4 sm:mb-6 w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab(TAB_BODEGA)}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-lg font-medium transition-colors min-h-[44px] ${
            activeTab === TAB_BODEGA ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <FiPackage size={18} />
          {LABELS.inventory.tabBodega}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(TAB_SEDES)}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-lg font-medium transition-colors min-h-[44px] ${
            activeTab === TAB_SEDES ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <FiMapPin size={18} />
          {LABELS.inventory.tabSedes}
        </button>
      </div>

      {activeTab === TAB_SEDES && (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <label className="font-medium text-gray-700">{LABELS.inventory.sedeSelect}:</label>
          <select
            value={selectedSedeId}
            onChange={(e) => setSelectedSedeId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent min-w-[200px]"
          >
            <option value="">— {LABELS.inventory.sedeSelect} —</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selectedSedeId && (
            <span className="text-gray-600 text-sm">
              {LABELS.inventory.stockAtSede}: <strong>{selectedSedeName}</strong>
            </span>
          )}
        </div>
      )}

      {activeTab === TAB_BODEGA && alerts.length > 0 && (
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

      {activeTab === TAB_BODEGA && (
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
            <div className="overflow-x-auto scroll-touch -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm font-medium text-gray-600">
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.code}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.name}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">{LABELS.inventory.category}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.unit}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.currentStock}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 hidden xl:table-cell">{LABELS.inventory.quantityCountedAt}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.minStock}</th>
                    {isAdmin && <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.common.actions}</th>}
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
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono text-sm">{p.code}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium">{p.name}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600 hidden lg:table-cell">{p.category}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600">{p.unit}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <span className={isLowStock ? 'font-semibold text-red-600' : ''}>
                            {p.current_quantity ?? 0}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600 text-sm hidden xl:table-cell">
                          {p.quantity_counted_at
                            ? new Date(p.quantity_counted_at).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600">{p.min_stock ?? 0}</td>
                        {isAdmin && (
                          <td className="px-3 sm:px-4 py-2 sm:py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 sm:gap-2 items-center">
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTransferToSede(p, e) }}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                title={LABELS.inventory.moveToSede}
                              >
                                <FiArrowRight size={16} />
                              </button>
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
      )}

      {activeTab === TAB_SEDES && (
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {!selectedSedeId ? (
            <div className="p-12 text-center text-gray-500">{LABELS.inventory.sedeSelect}</div>
          ) : sedeStockLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sedeStock.length === 0 ? (
            <div className="p-12 text-center text-gray-500">{LABELS.common.noData}</div>
          ) : (
            <div className="overflow-x-auto scroll-touch -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm font-medium text-gray-600">
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.code}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.name}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">{LABELS.inventory.category}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.unit}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">{LABELS.inventory.currentStock}</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 hidden xl:table-cell">{LABELS.inventory.quantityCountedAt}</th>
                    {isAdmin && <th className="px-3 sm:px-4 py-2 sm:py-3 w-24">{LABELS.common.actions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {sedeStock.map((row) => {
                    const qty = sedeQuantityEdit[row.product_id] !== undefined ? sedeQuantityEdit[row.product_id] : row.quantity
                    const isEditing = sedeQuantityEdit[row.product_id] !== undefined
                    return (
                      <tr key={row.product_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono text-sm">{row.code}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium">{row.name}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600 hidden lg:table-cell">{row.category}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600">{row.unit}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          {isAdmin ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                value={qty}
                                onChange={(e) => handleSedeQuantityChange(row.product_id, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveSedeQuantity(row.product_id)}
                                disabled={savingSedeProduct === row.product_id}
                                className="px-2 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50"
                              >
                                {savingSedeProduct === row.product_id ? '...' : LABELS.common.save}
                              </button>
                            </div>
                          ) : (
                            <span>{row.quantity}</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600 text-sm hidden xl:table-cell">
                          {row.quantity_counted_at
                            ? new Date(row.quantity_counted_at).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        {isAdmin && (
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTransferToBodega(row, e) }}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title={LABELS.inventory.moveToBodega}
                            >
                              <FiArrowLeft size={16} />
                            </button>
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
      )}

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

      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeTransferModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {transferModal.direction === 'bodega_to_sede'
                ? LABELS.inventory.transferToSedeTitle
                : LABELS.inventory.transferToBodegaTitle}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              {transferModal.product?.name ?? transferModal.product?.code}
              {transferModal.direction === 'sede_to_bodega' && (
                <span className="block text-gray-500 mt-1">
                  {LABELS.inventory.stockAtSede}: {selectedSedeName}
                </span>
              )}
            </p>
            {transferModal.direction === 'bodega_to_sede' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.inventory.sedeSelect}</label>
                <select
                  value={transferSedeId}
                  onChange={(e) => setTransferSedeId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="">— {LABELS.inventory.sedeSelect} —</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.inventory.transferQuantity}</label>
              <input
                type="number"
                min={1}
                max={
                  transferModal.direction === 'bodega_to_sede'
                    ? (transferModal.product?.current_quantity ?? 0)
                    : (transferModal.product?.quantity ?? 0)
                }
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                Máximo:{' '}
                {transferModal.direction === 'bodega_to_sede'
                  ? (transferModal.product?.current_quantity ?? 0)
                  : (transferModal.product?.quantity ?? 0)}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeTransferModal() }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {LABELS.common.cancel}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSubmitTransfer()
                }}
                disabled={submittingTransfer}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {submittingTransfer ? '...' : LABELS.inventory.confirmTransfer}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
