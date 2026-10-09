import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Framewell Studio pricing. Plans and prices are not yet published.',
  alternates: { canonical: '/pricing' },
}

export default function PricingPage() {
  return (
    <main className="marketing">
      <header className="marketing-nav">
        <Link href="/" className="brand">Framewell Studio</Link>
        <nav aria-label="Primary">
          <Link href="/features">Features</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>
      <section className="marketing-hero">
        <h1>Pricing</h1>
        <p className="marketing-lede">
          Plans and prices are not published yet. No paid plans are available, and no payment is taken on this site.
        </p>
        <p>Create an account to use the studio. Your account and projects are kept in your workspace.</p>
      </section>
      <div className="marketing-actions">
        <Link href="/register" className="button primary">Create an account</Link>
      </div>
    </main>
  )
}
