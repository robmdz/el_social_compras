import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const { requestPasswordReset } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
      toast.success(LABELS.auth.resetLinkSent)
    } catch (err) {
      toast.error(err.message || 'No se pudo enviar el enlace. Verifica el correo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <button
          type="button"
          onClick={() => navigate('/iniciar-sesion')}
          className="mb-4 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          ← Volver al inicio de sesión
        </button>
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="El Social" className="h-14 w-auto object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2 text-center font-brand">
          {LABELS.auth.recoverPasswordTitle}
        </h1>
        <p className="text-gray-600 text-sm text-center mb-6">
          {LABELS.auth.recoverPasswordInstructions}
        </p>
        {sent ? (
          <div className="rounded-md bg-green-50 border border-green-200 text-green-800 text-sm p-4 text-center">
            {LABELS.auth.resetLinkSent}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {LABELS.auth.email}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? LABELS.common.loading : LABELS.auth.sendResetLink}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
