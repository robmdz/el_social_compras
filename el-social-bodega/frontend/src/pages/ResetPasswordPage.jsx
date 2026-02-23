import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { LABELS } from '../utils/labels'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [canReset, setCanReset] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setCanReset(true)
    })
    // In case the session was already recovered (e.g. page refresh after opening link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCanReset(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await signOut()
      toast.success(LABELS.auth.passwordUpdated)
      navigate('/iniciar-sesion', { replace: true })
    } catch (err) {
      toast.error(err.message || 'No se pudo actualizar la contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="El Social" className="h-14 w-auto object-contain" />
        </div>
        {canReset ? (
          <>
            <h1 className="text-2xl font-bold text-primary mb-2 text-center font-brand">
              {LABELS.auth.resetPasswordTitle}
            </h1>
            <p className="text-gray-600 text-sm text-center mb-6">
              {LABELS.auth.resetPasswordInstructions}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {LABELS.auth.newPassword}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {LABELS.auth.confirmPassword}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? LABELS.common.loading : LABELS.auth.setNewPassword}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-primary mb-2 text-center font-brand">
              {LABELS.auth.recoverPasswordTitle}
            </h1>
            <p className="text-gray-600 text-sm text-center mb-6">
              {LABELS.auth.invalidResetLink}
            </p>
            <button
              type="button"
              onClick={() => navigate('/recuperar-contrasena')}
              className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary-dark"
            >
              {LABELS.auth.sendResetLink}
            </button>
            <button
              type="button"
              onClick={() => navigate('/iniciar-sesion')}
              className="mt-3 w-full py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Volver al inicio de sesión
            </button>
          </>
        )}
      </div>
    </div>
  )
}
