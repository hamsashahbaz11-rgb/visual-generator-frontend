'use client'

// Navigation helpers for the Next.js App Router, exposed under the same names
// the editor used with react-router-dom so call sites change only their import.
//
// `useParams` reads the dynamic segments of the current route from the Next
// navigation context. Pages also receive params as props from the App Router;
// both paths return the same values.

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useParams as useNextParams, useSearchParams } from 'next/navigation'
import NextLink from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

export interface NavigateOptions {
  replace?: boolean
}

/** Returns a navigate(to, options) function backed by the Next router. */
export function useNavigate() {
  const router = useRouter()
  return useCallback(
    (to: string, options?: NavigateOptions) => {
      if (options?.replace) router.replace(to)
      else router.push(to)
    },
    [router],
  )
}

/** Dynamic route params for the current page or layout. */
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): Partial<T> {
  const params = useNextParams()
  return useMemo(() => (params ?? {}) as Partial<T>, [params])
}

/** Current pathname (react-router `useLocation().pathname` equivalent). */
export function useLocation(): { pathname: string; search: string } {
  const pathname = usePathname() ?? '/'
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ''
  return { pathname, search: search ? `?${search}` : '' }
}

type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string; children?: ReactNode }

/** react-router-style Link taking `to`, rendered with next/link. */
export function Link({ to, children, ...rest }: LinkProps) {
  return (
    <NextLink href={to} {...rest}>
      {children}
    </NextLink>
  )
}
