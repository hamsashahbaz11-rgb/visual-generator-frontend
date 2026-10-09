import type { Metadata } from 'next'
import Link from 'next/link'

// Server component: the copy below is present in the initial HTML, so search
// engines and link previews see it without executing JavaScript.
export const metadata: Metadata = {
  title: 'Create polished videos from an idea',
  description:
    'A visual video studio for creators, educators and developers. Describe an idea, arrange visuals on a canvas, add media and captions, and export an MP4.',
  alternates: { canonical: '/' },
}

const FEATURES = [
  {
    title: 'Describe it, then refine it',
    body: 'Start from a prompt or a transcript. AI drafts scenes you can rearrange and edit.',
  },
  {
    title: 'Visual canvas, no CSS',
    body: 'Drag, align and layer elements on a canvas. Layouts such as picture-in-picture handle the structure for you.',
  },
  {
    title: 'Your media, your timing',
    body: 'Use your own images, clips, voice recordings and background audio, with simple trimming and volume.',
  },
  {
    title: 'Export an MP4',
    body: 'Preview what you see and render the same frames to a downloadable MP4 in landscape, portrait or square.',
  },
]

export default function HomePage() {
  return (
    <main className="marketing">
      <header className="marketing-nav">
        <span className="brand">Framewell Studio</span>
        <nav aria-label="Primary">
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="button primary">Start free</Link>
        </nav>
      </header>

      <section className="marketing-hero">
        <p className="eyebrow">Visual video studio</p>
        <h1>Make a clear video from a single idea.</h1>
        <p className="marketing-lede">
          Built for creators, educators and developers who do not want to learn professional editing software.
        </p>
        <div className="marketing-actions">
          <Link href="/register" className="button primary">Create your first video</Link>
          <Link href="/login" className="button secondary">I already have an account</Link>
        </div>
      </section>

      <section className="marketing-features" aria-labelledby="features-title">
        <h2 id="features-title">What you can do</h2>
        <ul>
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="marketing-footer">
        <span>Framewell Studio</span>
      </footer>
    </main>
  )
}
