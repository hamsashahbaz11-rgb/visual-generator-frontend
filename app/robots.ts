import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Only public marketing pages are crawlable. The authenticated app (dashboard,
// projects, components, auth pages) must never be indexed, since it contains
// private project data and asset URLs.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/features', '/templates', '/pricing'],
      disallow: ['/dashboard', '/projects/', '/components', '/login', '/register'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
