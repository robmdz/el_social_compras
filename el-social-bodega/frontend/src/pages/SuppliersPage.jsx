import React, { useState, useEffect, useCallback } from 'react'
import { FiPlus, FiEdit, FiTrash2, FiSearch } from 'react-icons/fi'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

const INITIAL_FORM = {
  nit: '',
  company_name: '',
  category: '',
  advisor_name: '',
  contact_phone_1: '',
  contact_phone_2: '',
  email: '',
  response_days: '',
  credit_days: '',
}

export default function SuppliersPage() {
  const { user } = useAuth()
  const role = user?.role || user?.role_name || user?.user_metadata?.role
  const isAdmin = role === 'admin'

  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const [allCategories, setAllCategories] = useState([])

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (categoryFilter) params.category = categoryFilter
      const { data } = await api.get('/suppliers', { params })
      setSuppliers(data || [])
      if (!categoryFilter && !search.trim()) {
        const cats = [...new Set((data || []).map((s) => s.category).filter(Boolean))].sort()
        setAllCategories(cats)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar proveedores')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const categories = categoryFilter ? [categoryFilter] : allCategories

  const openCreateModal = () => {
    setEditingId(null)
    setFormData(INITIAL_FORM)
    setModalOpen(true)
  }

  const openEditModal = (supplier) => {
    setEditingId(supplier.id)
    setFormData({
      nit: supplier.nit || '',
      company_name: supplier.company_name || '',
      category: supplier.category || '',
      advisor_name: supplier.advisor_name || '',
      contact_phone_1: supplier.contact_phone_1 || '',
      contact_phone_2: supplier.contact_phone_2 || '',
      email: supplier.email || '',
      response_days: supplier.response_days != null ? String(supplier.response_days) : '',
      credit_days: supplier.credit_days != null ? String(supplier.credit_days) : '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setFormData(INITIAL_FORM)
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      nit: formData.nit.trim(),
      company_name: formData.company_name.trim(),
      category: formData.category.trim(),
      advisor_name: formData.advisor_name.trim() || null,
      contact_phone_1: formData.contact_phone_1.trim(),
      contact_phone_2: formData.contact_phone_2.trim() || null,
      email: formData.email.trim() || null,
      response_days: formData.response_days ? parseInt(formData.response_days, 10) : null,
      credit_days: formData.credit_days ? parseInt(formData.credit_days, 10) : null,
    }
    if (!payload.nit || !payload.company_name || !payload.category || !payload.contact_phone_1) {
      toast.error('Complete todos los campos obligatorios')
      return
    }
    setFormLoading(true)
    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, payload)
        toast.success('Proveedor actualizado correctamente')
      } else {
        await api.post('/suppliers', payload)
        toast.success('Proveedor creado correctamente')
      }
      closeModal()
      fetchSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/suppliers/${id}`)
      toast.success('Proveedor eliminado correctamente')
      setDeleteConfirmId(null)
      fetchSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {LABELS.suppliers.title}
        </h1>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg shadow-md hover:bg-primary-dark transition-colors font-medium"
          >
            <FiPlus size={18} />
            {LABELS.suppliers.addNew}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={LABELS.common.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition bg-white min-w-[180px]"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              {LABELS.common.loading}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {LABELS.common.noData}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-600">
                  <th className="px-4 py-3">{LABELS.suppliers.nit}</th>
                  <th className="px-4 py-3">{LABELS.suppliers.companyName}</th>
                  <th className="px-4 py-3">{LABELS.suppliers.category}</th>
                  <th className="px-4 py-3">{LABELS.suppliers.advisor}</th>
                  <th className="px-4 py-3">{LABELS.suppliers.phone1}</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right">{LABELS.common.actions}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-gray-100 hover:bg-primary/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-800 font-mono text-sm">{s.nit}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{s.company_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary-dark">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.advisor_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.contact_phone_1 || '—'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition"
                            title={LABELS.common.edit}
                          >
                            <FiEdit size={18} />
                          </button>
                          {deleteConfirmId === s.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(s.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                {LABELS.common.confirm}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                {LABELS.common.cancel}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(s.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title={LABELS.common.delete}
                            >
                              <FiTrash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingId ? LABELS.common.edit : LABELS.suppliers.addNew}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.nit} *</label>
                <input
                  type="text"
                  name="nit"
                  value={formData.nit}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.companyName} *</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.category} *</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  required
                  list="category-list"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
                <datalist id="category-list">
                  {allCategories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.advisor}</label>
                <input
                  type="text"
                  name="advisor_name"
                  value={formData.advisor_name}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.phone1} *</label>
                  <input
                    type="tel"
                    name="contact_phone_1"
                    value={formData.contact_phone_1}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.phone2}</label>
                  <input
                    type="tel"
                    name="contact_phone_2"
                    value={formData.contact_phone_2}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.email}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.responseDays}</label>
                  <input
                    type="number"
                    name="response_days"
                    value={formData.response_days}
                    onChange={handleFormChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{LABELS.suppliers.creditDays}</label>
                  <input
                    type="number"
                    name="credit_days"
                    value={formData.credit_days}
                    onChange={handleFormChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-60"
                >
                  {formLoading ? LABELS.common.loading : LABELS.common.save}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  {LABELS.common.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
