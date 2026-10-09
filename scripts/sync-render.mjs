// Re-packs @app/render from the backend checkout into vendor/ so the frontend
// never reads a sibling-folder path at install time.
//
// Usage:
//   node scripts/sync-render.mjs            # regenerate vendor tarball from BACKEND_RENDER_DIR
//   node scripts/sync-render.mjs --check    # exit 1 if vendor tarball is out of date
//
// BACKEND_RENDER_DIR defaults to ../Visual Diagram Gen Backend/packages/render.
// The vendored tarball is the only input used by npm install / npm ci.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(here, '..')
const vendorTarball = join(frontendRoot, 'vendor', 'app-render-0.1.0.tgz')
const backendRender = resolve(
  process.env.BACKEND_RENDER_DIR ?? join(frontendRoot, '..', 'Visual Diagram Gen Backend', 'packages', 'render'),
)
const checkOnly = process.argv.includes('--check')

const sha = (buf) => createHash('sha256').update(buf).digest('hex')

if (!existsSync(join(backendRender, 'package.json'))) {
  console.error(`Backend @app/render not found at ${backendRender}. Set BACKEND_RENDER_DIR.`)
  process.exit(2)
}

const work = mkdtempSync(join(tmpdir(), 'app-render-pack-'))
try {
  // Build from source so the packed dist is never stale. Run the package's own
  // build script; the backend workspace provides the local typescript binary.
  execFileSync('pnpm', ['run', 'build'], { cwd: backendRender, stdio: 'inherit', shell: true })
  const out = execFileSync('pnpm', ['pack', '--pack-destination', work], {
    cwd: backendRender,
    encoding: 'utf8',
    shell: true,
  }).trim().split(/\r?\n/).pop()
  const fresh = out.endsWith('.tgz') ? out : join(work, out)

  if (checkOnly) {
    // Tarballs embed mtimes, so compare the extracted dist files instead of raw bytes.
    const files = ['package/dist/index.js', 'package/dist/index.d.ts']
    for (const file of files) {
      const fresh_ = execFileSync('tar', ['-xzOf', fresh, file], { encoding: 'utf8' })
      const vendor_ = execFileSync('tar', ['-xzOf', vendorTarball, file], { encoding: 'utf8' })
      if (sha(Buffer.from(fresh_)) !== sha(Buffer.from(vendor_))) {
        console.error(`vendor/app-render-0.1.0.tgz is out of date (${file}). Run: node scripts/sync-render.mjs`)
        process.exit(1)
      }
    }
    console.log('vendor @app/render matches backend build')
  } else {
    copyFileSync(fresh, vendorTarball)
    console.log(`wrote ${vendorTarball}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
