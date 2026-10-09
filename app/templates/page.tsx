import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Templates',
  description: 'Starting points for explainer videos, presenter overlays and vertical clips. Build your own in the studio.',
  alternates: { canonical: '/templates' },
}

// Only layouts the studio supports are listed. Each is created from a blank
// project; no template gallery or preset files are shipped with this release.
const LAYOUTS = [
  { title: 'Screen only', body: 'A full-frame visual for slides, diagrams or footage.' },
  { title: 'Picture-in-picture', body: 'A presenter panel in the corner over the main visual.' },
  { title: 'Vertical presenter and screen', body: 'A stacked layout for portrait video.' },
  { title: 'Side by side', body: 'Presenter and visual next to each other.' },
]

export default function TemplatesPage() {
  return (
    <main className="marketing">
      <header className="marketing-nav">
        <Link href="/" className="brand">Framewell Studio</Link>
        <nav aria-label="Primary">
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>
      <section className="marketing-hero">
        <h1>Templates</h1>
        <p className="marketing-lede">Layouts to start from. Pick one when you create a project, then adjust it on the canvas.</p>
      </section>
      <section className="marketing-features" aria-label="Layouts">
        <ul>
          {LAYOUTS.map((layout) => (
            <li key={layout.title}>
              <h2>{layout.title}</h2>
              <p>{layout.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="marketing-actions">
        <Link href="/register" className="button primary">Start from a layout</Link>
      </div>
    </main>
  )
}
