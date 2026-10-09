'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/authStore'

// Client-side guard for the protected app layout.
//
// Auth state is persisted in localStorage through zustand. Server rendering and
// the first client render must produce identical markup, so nothing protected is
// shown until the persisted store has rehydrated on the client. The persist API
// is touched only inside effects, never during render, so prerendering on the
// server never reads browser storage.
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const persist = useAuthStore.persist
    if (persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return persist.onFinishHydration(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (hydrated && !token) router.replace('/login')
  }, [hydrated, token, router])

  if (!hydrated || !token) return null
  return <>{children}</>
}
