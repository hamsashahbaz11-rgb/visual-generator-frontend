import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Features',
  description: 'Describe an idea, arrange visuals on a canvas, add your media and captions, and export an MP4 video.',
  alternates: { canonical: '/features' },
}

const FEATURES = [
  { title: 'Canvas editing', body: 'Place, align and layer elements visually, with an inspector for exact position, size and opacity.' },
  { title: 'Timeline and animation', body: 'Set when each element appears and add keyframed motion for position, size, rotation and opacity.' },
  { title: 'Your media', body: 'Upload images, logos and clips to a project. Media stays in your account and is not shared publicly.' },
  { title: 'AI-assisted drafts', body: 'Generate a first draft from a prompt or transcript, then refine it with follow-up edits.' },
  { title: 'Reusable components', body: 'Save a visual element as a component and reuse it across scenes and projects.' },
  { title: 'Render to MP4', body: 'Render a scene in the background and download the finished video when it completes.' },
]

export default function FeaturesPage() {
  return (
    <main className="marketing">
      <header className="marketing-nav">
        <Link href="/" className="brand">Framewell Studio</Link>
        <nav aria-label="Primary">
          <Link href="/templates">Templates</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>
      <section className="marketing-hero">
        <h1>Features</h1>
        <p className="marketing-lede">Everything you need to turn an idea into a video, without learning professional editing software.</p>
      </section>
      <section className="marketing-features" aria-label="Feature list">
        <ul>
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="marketing-actions">
        <Link href="/register" className="button primary">Create your first video</Link>
      </div>
    </main>
  )
}
