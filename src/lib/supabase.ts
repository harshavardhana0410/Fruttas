import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * False when the environment is not wired up yet. main.tsx renders a setup
 * screen instead of the app.
 *
 * This module deliberately does NOT throw on missing config. Throwing at
 * import time happens before React mounts, so it produces a blank white page
 * with the reason buried in the console.
 */
export const isSupabaseConfigured = Boolean(url && key)

/**
 * The single client instance for the whole app.
 *
 * Only ever the publishable key. Vite inlines every VITE_-prefixed variable
 * into the bundle, so a service_role key placed here would ship to every
 * browser that loads the app.
 */
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
})
