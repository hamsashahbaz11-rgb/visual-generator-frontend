/** @type {import('next').NextConfig} */
// The Next.js App Router serves the public marketing site from ./web/app.
// It is isolated from ./src (the Vite SPA) so Next's Pages Router detection
// (which probes ./src/pages) never sees the Vite page components.
const nextConfig = {
  reactStrictMode: true,
  // Frontend builds must not depend on the backend checkout or a sibling folder.
  transpilePackages: ['@app/render'],
  poweredByHeader: false,
  // Next resolves routes from ./web/app (see package.json "build:web").
  pageExtensions: ['tsx', 'ts'],
  distDir: '.next',
}

export default nextConfig
