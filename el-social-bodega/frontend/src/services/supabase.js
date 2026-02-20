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
