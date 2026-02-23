import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log environment variables in development (for debugging)
if (import.meta.env.DEV) {
  console.log('Supabase Config:', {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
    hasKey: !!supabaseAnonKey,
  })
}

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY')
  const errorMsg = `Missing required environment variables: ${missing.join(', ')}. ` +
    `Please check your .env file in the frontend directory and restart the dev server.`
  console.error(errorMsg)
  throw new Error(errorMsg)
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  const errorMsg = `Invalid Supabase URL format: ${supabaseUrl}. ` +
    `Expected format: https://your-project.supabase.co`
  console.error(errorMsg)
  throw new Error(errorMsg)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

function getSupabaseStorageKey() {
  const url = new URL(supabaseUrl)
  const projectRef = url.hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

/**
 * Clears Supabase auth data from localStorage synchronously.
 * Use when getSession times out or session is stale so the next load doesn't
 * retry refresh with the same cached tokens (which causes repeated loading).
 * Key format matches @supabase/supabase-js: sb-<project>-auth-token.
 */
export function clearSupabaseAuthStorage() {
  try {
    const storageKey = getSupabaseStorageKey()
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(`${storageKey}-user`)
      localStorage.removeItem(`${storageKey}-code-verifier`)
    }
  } catch (_) {
    // ignore
  }
}

/**
 * Returns true if localStorage has a session whose access_token is already expired.
 * When true, caller should clear storage and skip getSession() to avoid a blocking refresh.
 */
export function hasExpiredSessionInStorage() {
  try {
    if (typeof localStorage === 'undefined') return false
    const raw = localStorage.getItem(getSupabaseStorageKey())
    if (!raw) return false
    const data = JSON.parse(raw)
    const token = data?.access_token
    if (!token) return false
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload?.exp
    if (typeof exp !== 'number') return false
    // Consider expired 60s before actual exp to avoid edge cases
    return exp < Math.floor(Date.now() / 1000) + 60
  } catch (_) {
    return false
  }
}
