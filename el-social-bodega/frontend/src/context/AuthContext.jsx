import React, { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase, clearSupabaseAuthStorage, hasExpiredSessionInStorage } from '../services/supabase'
import api, { setApiAccessToken } from '../services/api'

const AuthContext = createContext(null)

/** Reason shown on login when auth init cleared stale/unreachable session (e.g. timeout). */
const SESSION_CLEARED_MESSAGE = 'Tu sesión expiró o no hay conexión. Inicia sesión de nuevo.'

/** Auth init timeout: shorter in dev so slow/unreachable Supabase doesn't block for 8s. */
const DEFAULT_AUTH_INIT_TIMEOUT_MS = import.meta.env.DEV ? 3000 : 8000
const AUTH_INIT_TIMEOUT_MS = Number(import.meta.env.VITE_AUTH_INIT_TIMEOUT) || DEFAULT_AUTH_INIT_TIMEOUT_MS

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  /** Set when we clear session due to getSession timeout; login page can show this once. */
  const [sessionClearedReason, setSessionClearedReason] = useState(null)

  useEffect(() => {
    // Track mount state to avoid updating unmounted component (StrictMode double-invoke safe)
    let mounted = true

    /**
     * Wraps supabase.auth.getSession() in a race against a timeout.
     * Without this, if Supabase needs to refresh an expired token but is unreachable
     * (paused free-tier project, network issue, etc.), the call hangs indefinitely
     * and loading never resolves — causing a permanent "Cargando..." screen.
     */
    const getSessionWithTimeout = (ms = AUTH_INIT_TIMEOUT_MS) =>
      Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`supabase.getSession() timed out after ${ms}ms`)), ms)
        ),
      ])

    /**
     * Tries to fetch the enriched user profile from the backend.
     * Falls back to the raw Supabase session user if the backend is unreachable.
     * Never throws — errors are handled gracefully.
     */
    const fetchUserProfile = async (activeSession) => {
      if (!activeSession?.user) {
        if (mounted) setUser(null)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (mounted) setUser(data)
      } catch {
        // Backend may not be running locally — use Supabase user as fallback
        if (mounted) setUser(activeSession.user)
      }
    }

    /**
     * Initializes auth state on mount.
     * If cache has an expired session, we clear it and skip getSession() so we never
     * trigger a blocking token refresh. Otherwise uses getSessionWithTimeout.
     */
    const initialize = async () => {
      try {
        if (hasExpiredSessionInStorage()) {
          clearSupabaseAuthStorage()
          if (mounted) {
            setSession(null)
            setUser(null)
            setSessionClearedReason(SESSION_CLEARED_MESSAGE)
          }
          return
        }
        const { data: { session: initialSession } } = await getSessionWithTimeout()
        if (!mounted) return

        setSession(initialSession)
        setApiAccessToken(initialSession?.access_token)
        await fetchUserProfile(initialSession)
      } catch (err) {
        if (err.message?.includes('timed out')) {
          console.warn('Auth init: getSession timed out — clearing stale session/cache')
          clearSupabaseAuthStorage()
          setApiAccessToken(null)
          supabase.auth.signOut({ scope: 'local' }).catch(() => { })
          if (mounted) setSessionClearedReason(SESSION_CLEARED_MESSAGE)
        } else {
          console.error('Auth initialization error:', err)
        }
        if (mounted) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initialize()

    /**
     * Responds to auth state changes AFTER initial load:
     * SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
     * We skip INITIAL_SESSION because initialize() already handles it,
     * avoiding a duplicate backend call on mount.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, activeSession) => {
        if (!mounted) return
        // INITIAL_SESSION is already handled by initialize() above
        if (event === 'INITIAL_SESSION') return

        setSession(activeSession)
        await fetchUserProfile(activeSession)
        // Loading was already resolved by initialize(); no need to set it again
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const signInTimeoutMs = 12000
    const signInWithTimeout = () =>
      Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('La conexión tardó demasiado. Revisa tu internet o intenta de nuevo.')),
            signInTimeoutMs
          )
        ),
      ])

    try {
      const { data, error } = await signInWithTimeout()
      if (error) {
        console.error('Supabase sign-in error:', error)
        throw error
      }
      setSession(data.session)
      setUser(data.user)
      setSessionClearedReason(null)
      setApiAccessToken(data.session?.access_token)

      try {
        const profileResp = await api.get('/auth/me')
        setUser(profileResp.data)
      } catch {
        // Backend unavailable — user_metadata.role fallback handles this
      }

      return data
    } catch (err) {
      console.error('Sign-in failed:', err)
      if (err.message?.includes('tardó demasiado') || err.message?.includes('Failed to fetch') || err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        throw new Error(
          'No se pudo conectar. Verifica tu conexión a internet y que Supabase esté disponible.'
        )
      }
      if (err.message?.includes('Invalid login credentials')) {
        throw new Error('Correo o contraseña incorrectos.')
      }
      throw err
    }
  }

  const signUp = async (email, password, role, sedeId, firstName, lastName) => {
    try {
      // Sign up with Supabase Auth; metadata is used by handle_new_user trigger
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role || 'user',
            sede_id: sedeId ?? null,
            first_name: firstName?.trim() || null,
            last_name: lastName?.trim() || null,
          }
        }
      })

      if (authError) {
        console.error('Supabase sign-up error:', authError)

        // Provide user-friendly error messages
        if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
          throw new Error('Este correo electrónico ya está registrado')
        }
        if (authError.message?.includes('password')) {
          throw new Error('La contraseña debe tener al menos 6 caracteres')
        }
        if (authError.message?.includes('email')) {
          throw new Error('Por favor ingresa un correo electrónico válido')
        }

        throw authError
      }

      if (!authData.user) {
        throw new Error('No se pudo crear el usuario')
      }

      // User profile is auto-created by database trigger (handle_new_user)
      // If we need to update role/sede_id, we can do it via backend API later
      // For now, the trigger creates a default 'user' profile

      // Check if email confirmation is required
      // If user.session is null, email confirmation is required
      if (!authData.session) {
        // Email confirmation is enabled - user needs to confirm email before signing in
        return {
          ...authData,
          requiresConfirmation: true,
        }
      }

      return authData
    } catch (err) {
      console.error('Sign-up failed:', err)
      if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        throw new Error(
          'No se pudo conectar con el servidor. Verifica tu conexión a internet y que las variables de entorno estén configuradas correctamente.'
        )
      }
      // If it's already a user-friendly error, re-throw it
      if (err.message && !err.message.includes('Error') && !err.message.includes('error')) {
        throw err
      }
      throw err
    }
  }

  const requestPasswordReset = async (email) => {
    const redirectTo = `${window.location.origin}/restablecer-contrasena`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw error
  }

  const signOut = async () => {
    const signOutTimeoutMs = 5000

    setUser(null)
    setSession(null)
    setSessionClearedReason(null)
    setApiAccessToken(null)
    clearSupabaseAuthStorage()

    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`supabase.signOut() timed out after ${signOutTimeoutMs}ms`)), signOutTimeoutMs)
        ),
      ])
    } catch (err) {
      // If Supabase is unreachable we still keep the user signed out locally.
      console.warn('Sign-out fallback: local session cleared, remote sign-out failed/timed out.', err)
    }
  }

  const value = {
    user,
    session,
    loading,
    sessionClearedReason,
    clearSessionClearedReason: () => setSessionClearedReason(null),
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  if (!user) {
    // Not authenticated — redirect to login preserving intended destination
    return <Navigate to="/iniciar-sesion" state={{ from: location }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const role = user.role || user.role_name || user.user_metadata?.role
    if (!role || !allowedRoles.includes(role)) {
      // Authenticated but wrong role — redirect to dashboard
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}
