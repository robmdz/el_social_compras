import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

export default function ProductFormModal({ product, onClose, onSuccess }) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: '',
    unit: '',
    min_stock: 0,
    initial_quantity: 0,
    initial_stock_location: 'all_sedes',
    initial_sede_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [sedes, setSedes] = useState([])
  const [selectedSedeId, setSelectedSedeId] = useState('')
  const [bodegaStock, setBodegaStock] = useState(0)
  const [selectedSedeStock, setSelectedSedeStock] = useState(0)
  const [loadingSedeStock, setLoadingSedeStock] = useState(false)
  const [movingAll, setMovingAll] = useState('')

  useEffect(() => {
    if (product) {
      setBodegaStock(Number(product.current_quantity ?? 0))
      setForm({
        code: product.code || '',
        name: product.name || '',
        category: product.category || '',
        unit: product.unit || '',
        min_stock: product.min_stock ?? 0,
        initial_quantity: 0,
        initial_stock_location: 'all_sedes',
        initial_sede_id: '',
      })
    } else {
      setBodegaStock(0)
      setForm({
        code: '',
        name: '',
        category: '',
        unit: '',
        min_stock: 0,
        initial_quantity: 0,
        initial_stock_location: 'all_sedes',
        initial_sede_id: '',
      })
    }
  }, [product])

  useEffect(() => {
    const fetchSedes = async () => {
      try {
        const { data } = await api.get('/auth/sedes')
        const list = data || []
        setSedes(list)
        if (list.length > 0) setSelectedSedeId(String(list[0].id))
      } catch {
        setSedes([])
      }
    }
    fetchSedes()
  }, [product?.id])

  useEffect(() => {
    const fetchSelectedSedeStock = async () => {
      if (!product?.id || !selectedSedeId) {
        setSelectedSedeStock(0)
        return
      }
      setLoadingSedeStock(true)
      try {
        const { data } = await api.get('/sede-stock', { params: { sede_id: selectedSedeId } })
        const row = (data || []).find((item) => item.product_id === product.id)
        setSelectedSedeStock(Number(row?.quantity ?? 0))
      } catch {
        setSelectedSedeStock(0)
      } finally {
        setLoadingSedeStock(false)
      }
    }
    fetchSelectedSedeStock()
  }, [product?.id, selectedSedeId])

  const refreshStockSnapshot = async () => {
    if (!product?.id) return
    const [{ data: updatedProduct }, sedeResp] = await Promise.all([
      api.get(`/products/${product.id}`),
      selectedSedeId ? api.get('/sede-stock', { params: { sede_id: selectedSedeId } }) : Promise.resolve({ data: [] }),
    ])

    if (updatedProduct) {
      setBodegaStock(Number(updatedProduct.current_quantity ?? 0))
      setForm((prev) => ({
        ...prev,
        code: updatedProduct.code || prev.code,
        name: updatedProduct.name || prev.name,
        category: updatedProduct.category || prev.category,
        unit: updatedProduct.unit || prev.unit,
        min_stock: updatedProduct.min_stock ?? prev.min_stock,
      }))
    }
    const row = (sedeResp.data || []).find((item) => item.product_id === product.id)
    setSelectedSedeStock(Number(row?.quantity ?? 0))
  }

  const handleMoveAll = async (direction) => {
    if (!product?.id || !selectedSedeId) {
      toast.error('Selecciona una sede')
      return
    }
    const isToSede = direction === 'bodega_to_sede'
    const quantity = isToSede
      ? Number(bodegaStock ?? 0)
      : Number(selectedSedeStock ?? 0)
    if (quantity < 1) {
      toast.error(isToSede ? 'No hay stock en bodega para mover' : 'No hay stock en la sede para retornar')
      return
    }

    setMovingAll(direction)
    try {
      await api.post('/transfer', {
        product_id: product.id,
        direction,
        sede_id: Number(selectedSedeId),
        quantity,
      })
      toast.success(isToSede ? 'Insumo movido completamente a la sede' : 'Insumo movido completamente a bodega')
      await refreshStockSnapshot()
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo mover el insumo')
    } finally {
      setMovingAll('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (product?.id) {
        await api.put(`/products/${product.id}`, form)
        toast.success('Producto actualizado correctamente')
      } else {
        if (form.initial_stock_location === 'single_sede' && !form.initial_sede_id) {
          toast.error('Selecciona una sede para el destino')
          setSaving(false)
          return
        }
        await api.post('/products', {
          code: form.code,
          name: form.name,
          category: form.category,
          unit: form.unit,
          min_stock: form.min_stock,
          initial_quantity: Math.max(0, parseInt(form.initial_quantity, 10) || 0),
          initial_stock_location: form.initial_stock_location,
          initial_sede_id: form.initial_stock_location === 'single_sede'
            ? Number(form.initial_sede_id)
            : null,
        })
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
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col safe-area-bottom">
        <div className="p-4 sm:p-6 overflow-y-auto scroll-touch flex-1 min-h-0">
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
          {!product?.id && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.supplies.initialQuantity}</label>
                <input
                  type="number"
                  min="0"
                  value={form.initial_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, initial_quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.supplies.stockDestination}</label>
                <select
                  value={form.initial_stock_location}
                  onChange={(e) => setForm((f) => ({ ...f, initial_stock_location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all_sedes">{LABELS.supplies.destinationAllSedes}</option>
                  <option value="single_sede">{LABELS.supplies.destinationSingleSede}</option>
                  <option value="bodega">{LABELS.supplies.destinationBodega}</option>
                </select>
              </div>
              {form.initial_stock_location === 'single_sede' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.supplies.selectSede}</label>
                  <select
                    value={form.initial_sede_id}
                    onChange={(e) => setForm((f) => ({ ...f, initial_sede_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Seleccionar sede...</option>
                    {sedes.map((sede) => (
                      <option key={sede.id} value={sede.id}>{sede.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          {product?.id && (
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 space-y-3">
              <p className="text-sm font-medium text-gray-700">Ubicación de stock del insumo</p>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sede</label>
                <select
                  value={selectedSedeId}
                  onChange={(e) => setSelectedSedeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Seleccionar sede...</option>
                  {sedes.map((sede) => (
                    <option key={sede.id} value={sede.id}>{sede.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-white border border-gray-200 p-2">
                  <p className="text-gray-500">Stock bodega</p>
                  <p className="font-semibold text-gray-800">{Number(bodegaStock ?? 0)}</p>
                </div>
                <div className="rounded bg-white border border-gray-200 p-2">
                  <p className="text-gray-500">Stock sede</p>
                  <p className="font-semibold text-gray-800">
                    {loadingSedeStock ? '...' : Number(selectedSedeStock ?? 0)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleMoveAll('bodega_to_sede')}
                  disabled={!selectedSedeId || movingAll !== ''}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {movingAll === 'bodega_to_sede' ? 'Moviendo...' : 'Mover todo a sede'}
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveAll('sede_to_bodega')}
                  disabled={!selectedSedeId || movingAll !== ''}
                  className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {movingAll === 'sede_to_bodega' ? 'Moviendo...' : 'Mover todo a bodega'}
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {LABELS.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[44px] px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-60"
            >
              {saving ? LABELS.common.loading : LABELS.common.save}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
