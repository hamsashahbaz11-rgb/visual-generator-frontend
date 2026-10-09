import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Lists public marketing pages only. Authenticated and per-user URLs are
// excluded: they are dynamic, private, and noindexed by robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['/', '/features', '/templates', '/pricing']
  return pages.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }))
}
