'use client'

import type { ReactNode } from 'react'
import { AppProviders } from '@/src/providers/AppProviders'

// Client boundary for the existing client-only providers (TanStack Query and
// the toast context). Server components render the shell; these hooks never run
// on the server.
export function Providers({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
