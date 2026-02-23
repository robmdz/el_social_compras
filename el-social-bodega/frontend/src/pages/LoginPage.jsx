import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signIn, sessionClearedReason, clearSessionClearedReason } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
      toast.success('Sesión iniciada correctamente')
    } catch (err) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-4 inline-flex items-center text-sm font-medium text-primary hover:text-primary-dark"
        >
          ← Volver al inicio
        </button>
        <h1 className="text-2xl font-bold text-primary mb-6 text-center">
          {LABELS.auth.login}
        </h1>
        {sessionClearedReason && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm"
          >
            {sessionClearedReason}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          onFocus={() => sessionClearedReason && clearSessionClearedReason()}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {LABELS.auth.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? LABELS.common.loading : LABELS.auth.submit}
          </button>
        </form>
      </div>
    </div>
  )
}
