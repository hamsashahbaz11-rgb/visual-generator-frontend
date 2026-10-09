'use client'
import type { ReactNode } from 'react'
import { AuthGuard } from '@/src/components/layout/AuthGuard'

// Protected application shell. Every route in the (app) group requires a token;
// AuthGuard redirects to /login when the persisted session is missing.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
