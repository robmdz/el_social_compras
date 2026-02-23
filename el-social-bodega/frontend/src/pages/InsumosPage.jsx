import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'

function getCurrentPeriod() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value || 0)
}

export default function InsumosPage() {
  const { user } = useAuth()
  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const isAdmin = role === 'admin'
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [comparison, setComparison] = useState([])
  const [loading, setLoading] = useState(true)
  const [linkForm, setLinkForm] = useState({ slot: 1, supplier_id: '' })
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    unit: '',
    min_stock: 0,
  })
  const period = getCurrentPeriod()
  const [priceForm, setPriceForm] = useState({
    supplier_id: '',
    price: '',
    recorded_month: period.month,
    recorded_year: period.year,
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    category: '',
    unit: '',
    min_stock: 0,
    initial_quantity: 0,
    initial_stock_location: 'all_sedes',
    initial_sede_id: '',
  })
  const [creating, setCreating] = useState(false)
  const [sedes, setSedes] = useState([])
  const [selectedSedeId, setSelectedSedeId] = useState('')
  const [selectedSedeStockQty, setSelectedSedeStockQty] = useState(0)
  const [loadingSelectedSedeStock, setLoadingSelectedSedeStock] = useState(false)
  const [movingAllStock, setMovingAllStock] = useState('')

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/products', {
        params: search.trim() ? { search: search.trim() } : {},
      })
      setProducts(data || [])
      if (!selectedProductId && data?.length) {
        setSelectedProductId(data[0].id)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar insumos')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    const { data } = await api.get('/suppliers')
    setSuppliers(data || [])
  }

  const fetchSedes = async () => {
    try {
      const { data } = await api.get('/auth/sedes')
      const list = data || []
      setSedes(list)
      if (role === 'user' && user?.sede_id) {
        setSelectedSedeId(String(user.sede_id))
      } else if (list.length > 0 && !selectedSedeId) {
        setSelectedSedeId(String(list[0].id))
      }
    } catch {
      setSedes([])
    }
  }

  const fetchProductDetail = async (productId) => {
    if (!productId) return
    try {
      const [{ data: product }, { data: comparisonData }] = await Promise.all([
        api.get(`/products/${productId}`),
        api.get(`/products/${productId}/price-comparison`),
      ])
      setSelectedProduct(product)
      setComparison(comparisonData || [])
      setEditForm({
        name: product.name || '',
        category: product.category || '',
        unit: product.unit || '',
        min_stock: product.min_stock || 0,
      })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar detalle del insumo')
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchSuppliers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    fetchSedes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.sede_id])

  useEffect(() => {
    fetchProductDetail(selectedProductId)
  }, [selectedProductId])

  useEffect(() => {
    const fetchSelectedSedeStock = async () => {
      if (!selectedProductId || !selectedSedeId) {
        setSelectedSedeStockQty(0)
        return
      }
      setLoadingSelectedSedeStock(true)
      try {
        const { data } = await api.get('/sede-stock', { params: { sede_id: selectedSedeId } })
        const row = (data || []).find((item) => item.product_id === Number(selectedProductId))
        setSelectedSedeStockQty(Number(row?.quantity ?? 0))
      } catch {
        setSelectedSedeStockQty(0)
      } finally {
        setLoadingSelectedSedeStock(false)
      }
    }
    fetchSelectedSedeStock()
  }, [selectedProductId, selectedSedeId])

  const refreshSelectedProduct = async () => {
    if (!selectedProductId) return
    await fetchProductDetail(selectedProductId)
    if (selectedSedeId) {
      try {
        const { data } = await api.get('/sede-stock', { params: { sede_id: selectedSedeId } })
        const row = (data || []).find((item) => item.product_id === Number(selectedProductId))
        setSelectedSedeStockQty(Number(row?.quantity ?? 0))
      } catch {
        setSelectedSedeStockQty(0)
      }
    }
  }

  const moveAllStock = async (direction) => {
    if (!isAdmin || !selectedProduct || !selectedSedeId) return
    const isToSede = direction === 'bodega_to_sede'
    const quantity = isToSede
      ? Number(selectedProduct.current_quantity ?? 0)
      : Number(selectedSedeStockQty ?? 0)
    if (quantity < 1) {
      toast.error(isToSede ? 'No hay stock en bodega para mover' : 'No hay stock en sede para retornar')
      return
    }
    setMovingAllStock(direction)
    try {
      await api.post('/transfer', {
        product_id: Number(selectedProduct.id),
        direction,
        sede_id: Number(selectedSedeId),
        quantity,
      })
      toast.success(isToSede ? 'Insumo movido completamente a la sede' : 'Insumo movido completamente a bodega')
      await refreshSelectedProduct()
      await fetchProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al mover stock')
    } finally {
      setMovingAllStock('')
    }
  }

  const saveProduct = async () => {
    if (!selectedProduct) return
    try {
      await api.put(`/products/${selectedProduct.id}`, {
        ...editForm,
        min_stock: parseInt(editForm.min_stock, 10) || 0,
      })
      toast.success('Insumo actualizado')
      fetchProducts()
      fetchProductDetail(selectedProduct.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar insumo')
    }
  }

  const approveProduct = async () => {
    if (!selectedProduct) return
    try {
      await api.patch(`/products/${selectedProduct.id}/approve`)
      toast.success('Insumo aprobado')
      fetchProducts()
      fetchProductDetail(selectedProduct.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al aprobar insumo')
    }
  }

  const linkSupplier = async () => {
    if (!selectedProduct || !linkForm.supplier_id) return
    try {
      await api.post(`/products/${selectedProduct.id}/suppliers`, {
        slot: Number(linkForm.slot),
        supplier_id: Number(linkForm.supplier_id),
      })
      toast.success('Proveedor vinculado')
      fetchProductDetail(selectedProduct.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al vincular proveedor')
    }
  }

  const unlinkSupplier = async (slot) => {
    if (!selectedProduct) return
    try {
      await api.delete(`/products/${selectedProduct.id}/suppliers/${slot}`)
      toast.success('Proveedor desvinculado')
      fetchProductDetail(selectedProduct.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al desvincular proveedor')
    }
  }

  const savePrice = async () => {
    if (!selectedProduct || !priceForm.supplier_id || !priceForm.price) return
    try {
      await api.post(`/products/${selectedProduct.id}/prices`, {
        supplier_id: Number(priceForm.supplier_id),
        price: Number(priceForm.price),
        recorded_month: Number(priceForm.recorded_month),
        recorded_year: Number(priceForm.recorded_year),
      })
      toast.success('Precio registrado')
      fetchProductDetail(selectedProduct.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar precio')
    }
  }

  const createProduct = async () => {
    const name = (createForm.name || '').trim()
    const category = (createForm.category || '').trim()
    const unit = (createForm.unit || '').trim()
    if (!name || !category || !unit) {
      toast.error('Nombre, categoría y unidad son obligatorios')
      return
    }
    if (createForm.initial_stock_location === 'single_sede' && !createForm.initial_sede_id) {
      toast.error('Selecciona una sede para el destino')
      return
    }
    setCreating(true)
    try {
      const { data } = await api.post('/products', {
        name,
        category,
        unit,
        min_stock: parseInt(createForm.min_stock, 10) || 0,
        initial_quantity: Math.max(0, parseInt(createForm.initial_quantity, 10) || 0),
        initial_stock_location: createForm.initial_stock_location,
        initial_sede_id: createForm.initial_stock_location === 'single_sede'
          ? Number(createForm.initial_sede_id)
          : null,
      })
      toast.success('Insumo creado')
      setShowAddModal(false)
      setCreateForm({
        name: '',
        category: '',
        unit: '',
        min_stock: 0,
        initial_quantity: 0,
        initial_stock_location: 'all_sedes',
        initial_sede_id: '',
      })
      await fetchProducts()
      setSelectedProductId(data.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear insumo')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{LABELS.supplies.title}</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium"
          >
            {LABELS.supplies.addSupply}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar insumo"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-3"
          />
          {loading ? (
            <p className="text-sm text-gray-500">{LABELS.common.loading}</p>
          ) : (
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
              {products.map((product) => (
                <li
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                  className={`rounded-lg border p-3 cursor-pointer ${
                    selectedProductId === product.id ? 'border-primary bg-primary/5' : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.code || 'Sin código'} · {product.category}</p>
                  {product.is_pending && (
                    <span className="inline-flex mt-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Pendiente de aprobación
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {!selectedProduct ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-gray-500">
              Selecciona un insumo para ver detalle.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">{selectedProduct.name}</h2>
                  {selectedProduct.is_pending && isAdmin && (
                    <button
                      onClick={approveProduct}
                      className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                    >
                      Aprobar insumo
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    readOnly={!isAdmin}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Nombre"
                  />
                  <input
                    value={editForm.category}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                    readOnly={!isAdmin}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Categoría"
                  />
                  <input
                    value={editForm.unit}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                    readOnly={!isAdmin}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Unidad"
                  />
                  <input
                    type="number"
                    value={editForm.min_stock}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, min_stock: e.target.value }))}
                    readOnly={!isAdmin}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Stock mínimo"
                  />
                </div>
                {isAdmin && (
                  <button
                    onClick={saveProduct}
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                  >
                    Guardar cambios
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Código: {selectedProduct.code || 'Sin código'} · Creador: {selectedProduct.created_by || 'Sistema'}
                </p>
                <div className="mt-4 rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px]">
                      <label className="block text-xs text-gray-600 mb-1">Sede para consultar stock</label>
                      <select
                        value={selectedSedeId}
                        onChange={(e) => setSelectedSedeId(e.target.value)}
                        disabled={role === 'user'}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                      >
                        <option value="">Selecciona sede...</option>
                        {sedes.map((sede) => (
                          <option key={sede.id} value={sede.id}>
                            {sede.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm text-gray-700">
                      <p><span className="text-gray-500">Stock en bodega:</span> <strong>{Number(selectedProduct.current_quantity ?? 0)}</strong></p>
                      <p>
                        <span className="text-gray-500">Stock en sede:</span>{' '}
                        <strong>{loadingSelectedSedeStock ? '...' : Number(selectedSedeStockQty ?? 0)}</strong>
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveAllStock('bodega_to_sede')}
                        disabled={!selectedSedeId || movingAllStock !== ''}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {movingAllStock === 'bodega_to_sede' ? 'Moviendo...' : 'Mover todo a sede'}
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAllStock('sede_to_bodega')}
                        disabled={!selectedSedeId || movingAllStock !== ''}
                        className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                      >
                        {movingAllStock === 'sede_to_bodega' ? 'Moviendo...' : 'Mover todo a bodega'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Proveedores vinculados (slots 1-3)</h3>
                <div className="space-y-2 mb-4">
                  {[1, 2, 3].map((slot) => {
                    const entry = comparison.find((item) => item.slot === slot)
                    return (
                      <div key={slot} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                        <div>
                          <p className="font-medium text-gray-700">Slot {slot}</p>
                          <p className="text-sm text-gray-500">
                            {entry ? entry.supplier_name : 'Sin proveedor'}
                          </p>
                        </div>
                        {entry && isAdmin && (
                          <button
                            onClick={() => unlinkSupplier(slot)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Desvincular
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {isAdmin && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={linkForm.slot}
                      onChange={(e) => setLinkForm((prev) => ({ ...prev, slot: Number(e.target.value) }))}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value={1}>Slot 1</option>
                      <option value={2}>Slot 2</option>
                      <option value={3}>Slot 3</option>
                    </select>
                    <select
                      value={linkForm.supplier_id}
                      onChange={(e) => setLinkForm((prev) => ({ ...prev, supplier_id: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="">Selecciona proveedor</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.company_name}</option>
                      ))}
                    </select>
                    <button
                      onClick={linkSupplier}
                      className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark"
                    >
                      Vincular proveedor
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Precios por proveedor</h3>
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Precio actual</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Variación</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mejor precio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {comparison.map((item) => (
                        <tr key={item.supplier_id}>
                          <td className="px-3 py-2 text-sm">{item.supplier_name}</td>
                          <td className="px-3 py-2 text-sm">{formatCurrency(item.current_price)}</td>
                          <td className="px-3 py-2 text-sm">
                            {item.variation_pct == null ? '—' : `${item.variation_pct.toFixed(2)}%`}
                          </td>
                          <td className="px-3 py-2 text-sm">{item.is_best_price ? 'Sí' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isAdmin && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <select
                      value={priceForm.supplier_id}
                      onChange={(e) => setPriceForm((prev) => ({ ...prev, supplier_id: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="">Proveedor</option>
                      {comparison.map((item) => (
                        <option key={item.supplier_id} value={item.supplier_id}>{item.supplier_name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={priceForm.price}
                      onChange={(e) => setPriceForm((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="Precio"
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <input
                      type="number"
                      value={priceForm.recorded_month}
                      onChange={(e) => setPriceForm((prev) => ({ ...prev, recorded_month: e.target.value }))}
                      placeholder="Mes"
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <input
                      type="number"
                      value={priceForm.recorded_year}
                      onChange={(e) => setPriceForm((prev) => ({ ...prev, recorded_year: e.target.value }))}
                      placeholder="Año"
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <button
                      onClick={savePrice}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                    >
                      Registrar precio
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !creating && setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{LABELS.supplies.newSupply}</h2>
            <div className="space-y-3">
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                value={createForm.category}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Categoría"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                value={createForm.unit}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="Unidad (ej: unidad, caja, kg)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                type="number"
                min={0}
                value={createForm.min_stock}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, min_stock: e.target.value }))}
                placeholder="Stock mínimo"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                type="number"
                min={0}
                value={createForm.initial_quantity}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, initial_quantity: e.target.value }))}
                placeholder={LABELS.supplies.initialQuantity}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <div>
                <label className="block text-sm text-gray-700 mb-1">{LABELS.supplies.stockDestination}</label>
                <select
                  value={createForm.initial_stock_location}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, initial_stock_location: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="all_sedes">{LABELS.supplies.destinationAllSedes}</option>
                  <option value="single_sede">{LABELS.supplies.destinationSingleSede}</option>
                  <option value="bodega">{LABELS.supplies.destinationBodega}</option>
                </select>
              </div>
              {createForm.initial_stock_location === 'single_sede' && (
                <select
                  value={createForm.initial_sede_id}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, initial_sede_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">{LABELS.supplies.selectSede}</option>
                  {sedes.map((sede) => (
                    <option key={sede.id} value={sede.id}>
                      {sede.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => !creating && setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={creating}
              >
                {LABELS.supplies.cancel}
              </button>
              <button
                type="button"
                onClick={createProduct}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {creating ? 'Creando...' : LABELS.supplies.createSupply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
