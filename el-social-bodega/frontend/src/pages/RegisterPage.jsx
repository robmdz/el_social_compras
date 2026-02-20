import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'
import { supabase } from '../services/supabase'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    sedeId: '',
  })
  const [sedes, setSedes] = useState([])
  const [loadingSedes, setLoadingSedes] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const fetchSedes = async () => {
      try {
        // Try to fetch sedes from Supabase directly
        const { data, error } = await supabase
          .from('sedes')
          .select('id, name')
          .order('name')
        
        if (error) {
          console.error('Error fetching sedes:', error)
          toast.error('No se pudieron cargar las sedes')
        } else {
          setSedes(data || [])
        }
      } catch (err) {
        console.error('Error fetching sedes:', err)
        toast.error('No se pudieron cargar las sedes')
      } finally {
        setLoadingSedes(false)
      }
    }
    fetchSedes()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setSubmitting(true)
    try {
      const result = await signUp(
        formData.email,
        formData.password,
        formData.role,
        formData.sedeId ? parseInt(formData.sedeId) : null
      )
      
      // Check if email confirmation is required
      if (result?.requiresConfirmation || !result?.session) {
        toast.success(
          'Registro exitoso. Por favor revisa tu correo electrónico y confirma tu cuenta antes de iniciar sesión.',
          {
            duration: 8000,
          }
        )
      } else {
        toast.success('Registro exitoso. Tu cuenta ha sido creada. Redirigiendo...', {
          duration: 3000,
        })
        // Auto-sign in if session is available
        setTimeout(() => {
          navigate('/dashboard')
        }, 1000)
        return
      }
      
      navigate('/iniciar-sesion')
    } catch (err) {
      let errorMessage = 'Error al registrar usuario'
      if (err.message) {
        errorMessage = err.message
      } else if (err.error?.message) {
        errorMessage = err.error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-primary mb-6 text-center">
          {LABELS.auth.register}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {LABELS.auth.email}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {LABELS.auth.password}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {LABELS.auth.confirmPassword}
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {LABELS.auth.role}
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="user">{LABELS.auth.roleUser}</option>
              <option value="reviewer">{LABELS.auth.roleReviewer}</option>
              <option value="admin">{LABELS.auth.roleAdmin}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {LABELS.auth.sede}
            </label>
            {loadingSedes ? (
              <p className="text-sm text-gray-500 py-2">{LABELS.common.loading}</p>
            ) : (
              <select
                name="sedeId"
                value={formData.sedeId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="">Seleccionar sede (opcional)</option>
                {sedes.map((sede) => (
                  <option key={sede.id} value={sede.id}>
                    {sede.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? LABELS.common.loading : LABELS.auth.submitRegister}
          </button>

          <div className="text-center text-sm text-gray-600 mt-4">
            <span>¿Ya tienes una cuenta? </span>
            <Link to="/iniciar-sesion" className="text-primary hover:underline">
              {LABELS.auth.login}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
