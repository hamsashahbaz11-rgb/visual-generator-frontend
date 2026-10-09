import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/src/styles.css'
import { Providers } from './providers'

const SITE_NAME = 'Framewell Studio'
const SITE_DESCRIPTION =
  'Turn an idea into a polished video. Arrange visuals on a canvas, add your media, animations and captions, then export an MP4.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#f6f7f9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
