import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, User } from './types'
import { loadProfile, signIn as apiSignIn, signOut as apiSignOut } from './data'
import { supabase } from './supabase'
import { useTableStream } from './useRealtime'

interface SessionValue {
  user: User | null
  role: Role
  ready: boolean
  signIn: (email: string, password: string, role: Role) => Promise<void>
  signOut: () => void
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true

    // Resolve whatever session supabase-js restored from storage.
    loadProfile()
      .then((u) => {
        if (live) setUser(u)
      })
      .catch(() => {
        if (live) setUser(null)
      })
      .finally(() => {
        if (live) setReady(true)
      })

    // Keeps the app honest across token refresh, sign-out in another tab,
    // and a session that expired while the laptop was asleep.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!live) return
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadProfile()
          .then((u) => live && setUser(u))
          .catch(() => live && setUser(null))
      }
    })

    return () => {
      live = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // An admin assigning a kitchen or changing a role reaches this person
  // without them signing out and back in.
  useTableStream('profiles', () => {
    loadProfile()
      .then(setUser)
      .catch(() => setUser(null))
  })

  const signIn = useCallback(async (email: string, password: string, role: Role) => {
    setUser(await apiSignIn(email, password, role))
  }, [])

  const signOut = useCallback(() => {
    void apiSignOut()
    setUser(null)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ user, role: user?.role ?? 'staff', ready, signIn, signOut }),
    [user, ready, signIn, signOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used inside SessionProvider')
  return v
}

/** The signed-in user, for screens that render only behind the auth gate. */
export function useUser(): User {
  const { user } = useSession()
  if (!user) throw new Error('useUser called outside an authenticated route')
  return user
}

const MOTION_KEY = 'frutta.motion.v1'

export function useMotionPreference() {
  const [reduced, setReduced] = useState(() => {
    try {
      return localStorage.getItem(MOTION_KEY) === 'off'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'off' : 'on'
    try {
      localStorage.setItem(MOTION_KEY, reduced ? 'off' : 'on')
    } catch {
      /* ignore */
    }
  }, [reduced])

  return [reduced, setReduced] as const
}

/** True while the browser reports no connection. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}
