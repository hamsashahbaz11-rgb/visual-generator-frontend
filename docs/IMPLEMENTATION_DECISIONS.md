# Implementation Decisions

Each decision lists the choice, the alternatives rejected, the reason, and the migration risk.

## D-01 Frontend framework: Next.js App Router, incremental migration

**Choice.** Move the frontend to Next.js App Router. Public marketing pages are server components or statically generated. The authenticated editor is a client-side island under a `(app)` route group, with `"use client"` boundaries around canvas, timeline, AI panel, and render components. Browser-only libraries are loaded with `next/dynamic` and `ssr: false` where needed.

**Route mapping.**

| Current route | Target route |
|---|---|
| `/` (dashboard) | `/dashboard` |
| `/login`, `/register` | `/login`, `/register` (keep paths) |
| `/` (new public) | marketing homepage (static) |
| `/projects/:id` | `/projects/[id]` |
| `/projects/:projectId/canvas` | `/projects/[projectId]/canvas` |
| `/projects/:projectId/scenes/:sceneId` | `/projects/[projectId]/scenes/[sceneId]` |
| `/components*` | `/components*` (keep) |

Existing `/` dashboard moves to `/dashboard`. The old `/` link targets in the app must be updated in the same change. The `*` fallback redirect to `/` becomes a not-found page.

**Rejected alternatives.**
- Keep Vite and add a prerendering plugin: does not give route-level metadata, streaming, or server components for the marketing site. SEO would stay fragile.
- Rewrite components from scratch in Next: discards tested canvas, timeline, inspector and AI code (172 frontend tests, all against current components). Rejected.
- Put backend logic into Next.js API routes: explicitly rejected by the product requirements.

**Migration steps (Prompt 2).**
1. Scaffold Next.js App Router in a new branch of the frontend repo. Keep the Vite app building until parity is reached.
2. Move `src/components`, `src/canvas`, `src/components/timeline`, `src/store`, `src/services` unchanged, mark editor roots `"use client"`.
3. Port `main.tsx`/`App.tsx` routing to file-based routes. Port `AppProviders` into a client `providers.tsx`.
4. Replace `react-router-dom` `Link`/`useNavigate`/`useParams` with `next/link`, `next/navigation`. Keep a thin adapter module during transition so existing tests keep their surface.
5. Keep Vitest for unit tests. Add Playwright for route and E2E checks.
6. Delete Vite files only after the Next build and all 172 existing tests pass.

**Risks.** Hydration mismatches from `localStorage`-backed Zustand auth store (must read token only on the client). Test harness changes (jsdom with Next components). Tailwind/PostCSS config re-verification. `react-router-dom` hooks used throughout editor code.

## D-02 Shared rendering package: pnpm workspace consumed by version, not a sibling junction

**Problem.** The frontend declares `@app/render` as `file:../Visual Diagram Gen Backend/packages/render`. The junction exists only on this machine. A remote build fails. A junction also means the frontend silently uses whatever was last built in the backend's `dist/`.

**Choice (phased).**

Phase 1 (immediate, Prompt 2): publish-free reproducible consumption.
- Option A (preferred for this two-repo layout): keep both repos and pin the backend commit SHA. In the frontend, depend on the backend package via a git dependency: `"@app/render": "git+https://github.com/Hamza-Universe/Visual-Generator-Backend.git#<sha>&path:packages/render"`. This requires pnpm or npm support for subdirectory git dependencies and a built `dist` (add a `prepare` script). Verify with a clean clone.
- Option B: move `packages/render` and `packages/schema` into a dedicated, versioned repo or npm registry package (`@app/render@x.y.z`). Requires a publish step. Deferred until there is an npm scope and release process.

Phase 2 (later, only if needed): a monorepo that contains frontend and backend. Explicitly not done now; repository ownership must not change for convenience.

**Decision for Prompt 2:** Option A is the target. Until a remote is confirmed reachable from a clean clone, keep the `file:` reference for local dev and add a documented `pnpm`/`npm` script that fails fast with a clear message if the sibling is missing.

**Rejected.**
- Copy `packages/render/src` into the frontend: creates a second rendering implementation and breaks editor/export parity. Rejected outright.
- Keep the junction: blocks CI and production builds. Rejected.
- Publish to npm now: needs an npm account, scope, and release process not present in the workspace. Blocked on owner credentials; not done here.

**Blocker.** Confirming that the backend repo URL is reachable from the build environment and that the backend `upgrade` branch is the release branch. Owner must confirm which branch is the release line.

**Parity guard.** Add a test in the frontend that imports `BUILT_IN_RENDERER_KEYS` and asserts the renderer registry matches. Add a backend test that snapshots `evaluateSceneAtFrame` output for a fixed document, consumed by both sides.

## D-03 Backend: retain Fastify, PostgreSQL, BullMQ, Remotion worker, shared packages

**Choice.** No rewrite. All route, schema, and worker code is preserved. Changes are additive.

**Rejected.** Next.js API routes or server actions as the backend: would discard 459 passing tests, the BullMQ render pipeline, Remotion worker, and shared schema validation. Rejected.

## D-04 Database: additive migrations only

**Choice.** New migrations `0005` onward, each additive (`ADD COLUMN ... DEFAULT`, `CREATE TABLE`). No drops, no type changes on `projects.spec`, `scenes.meta`, or `component_instances` JSON.

**Specific planned changes:**
- `users.role` text, default `'user'`, check constraint in `('user','admin')`.
- `users.google_sub` text unique nullable, for Google sign-in identity. Alternative: separate `oauth_identities` table (chosen if multiple providers are planned; decided in Prompt 2 by the owner).
- `projects.aspect` text default `'landscape'` (`landscape`, `portrait`, `square`). Existing rows get `landscape`, which matches current behavior.
- `plans`, `user_entitlements`, `usage_counters`, `discount_codes`, `discount_redemptions`, `access_grants` tables.
- `assets.kind` extended to include `captions` (for `.vtt`/`.srt`) only if caption files are stored as assets. Otherwise captions live in JSON on the element, which is the preferred path.

**Migration risks.** Existing projects must keep rendering. Default values must be backfilled in the same migration. Drizzle `db:generate` must run against a clean schema snapshot. Snapshot `0004_snapshot.json` must match the current schema before generating `0005`; this has not been verified in this audit.

## D-05 Core data contracts: extend, do not replace

- `SceneDocument` (`packages/schema/src/document.ts`) is the source of truth for scene editing.
- New element types are added as discriminated union members with `z.literal` types: `videoClip`, `audio`, `caption`, `presenterLayout` (or layout preset expressed as layout intents plus a preset registry). Existing `component` instances keep working unchanged.
- Each new element type requires: schema entry, renderer in `@app/render`, worker composition support, editor renderer, inspector fields, and a parity test.
- Presets (screen-only, PiP, circular webcam, vertical presenter, side-by-side) are data: a registry mapping preset id to a set of layout intents and a default format. Presets must produce the same rectangles in editor and worker.
- Visual effects targeted at elements or regions are expressed through the existing keyframe/motion system, extended with `effect` tracks. No separate rendering path.
- Full-screen effects and scene transitions are scene-level keyframes evaluated by `@app/render`.

## D-06 AI: keep the structured pipeline

- Keep `apps/api/src/ai/*` (plan, apply, verification, bounded agent, operations registry).
- Keep OpenRouter as the scene-authoring provider behind `AISceneProvider`.
- Consolidate the two provider paths (`services/ai/*` for Gemini transcription and generation, `ai/*` for OpenRouter scene authoring) behind one provider configuration surface. Do not merge the logic yet; first add a test that both paths produce validated `SceneDocument`/`VideoSpec` output.
- Never accept unvalidated JSON from the model. Every output passes Zod validation and the layout/motion verification step before apply.

**Rejected.** A single prompt generating frontend code or raw JSON: unsafe, unvalidated, and not testable.

## D-07 Authentication

- Keep email/password as the fallback (already implemented, tested).
- Add Google sign-in as an OAuth 2.0 authorization code flow on the backend (`/auth/google/start`, `/auth/google/callback`), issuing the same bearer token the existing login issues. Requires Google OAuth client ID and secret: **BLOCKED on owner credentials**.
- Session storage: keep `localStorage` bearer token for Prompt 2 to avoid breaking existing clients. Document XSS risk. Move to httpOnly cookie as a follow-up, not in this stage.

## D-08 Subscriptions, entitlements, admin

- Not implemented in Prompt 1. Designed as additive tables (D-04).
- Admin is a role check (`requireAdmin`), not a separate app. Admin UI lives under `/admin` in the Next.js app with server-side role checks.
- Payment provider is not chosen. Entitlements are enforced from the `plans` and `user_entitlements` tables so a payment provider can be added later. Manual grants and discount codes work without a payment provider.

## D-09 Repository hygiene (no history rewrite)

- Do not rewrite git history. Do not delete the six tracked media files in `apps/api/storage/` in this stage; they may be referenced by tests. Prompt 2 will move them to a test-fixtures folder or untrack them with `git rm --cached` after confirming no test depends on them.
- Remove duplicate Vite artifacts (`vite.config.js`, `vite.config.d.ts`) during the Next migration.
- Untrack `tsconfig.tsbuildinfo` and `tsconfig.node.tsbuildinfo` (ignored pattern not applied).

## D-10 Assumptions

- The backend `upgrade` branch is the working line for the backend. Owner must confirm.
- The frontend `spec-before` branch is the working line for the frontend.
- Node 24 and pnpm 10.12.1 are the target toolchain (from backend CI and `packageManager`).
- The frontend currently uses npm (`package-lock.json`), while the backend uses pnpm. This mixed toolchain is an assumption to keep for now.
- Live external calls (Gemini, OpenRouter, Google OAuth, S3, SMTP) were not executed. Their status is "implemented but not live-verified."

## D-11 Rejected in this stage

- Large speculative rewrites before the architecture is recorded (per requirements).
- Repository consolidation or ownership change.
- Publishing packages to a registry.
- Deleting user data or history rewriting.

---

## Prompt 2 outcomes and revised decisions (2026-10-09)

These record what was tested in Prompt 2. Where a planned decision did not survive testing, it is revised here and the original is kept for the record.

### D-02 revised: shared `@app/render` is a vendored, verified tarball

**Tested, and rejected: git subdirectory dependency.** `npm install` from `git+https://github.com/Hamza-Universe/Visual-Generator-Backend.git#<sha>` installed the whole backend repository as the package. npm does not support selecting a subdirectory (`packages/render`), so the `file:`-style path could not be replaced this way. The lock also recorded an SSH URL (`ssh://git@github.com/...`), which only works on a machine with that key. Both problems make it unsuitable for a clean CI runner.

**Chosen: vendored tarball.**
- `pnpm pack` in the backend `packages/render` produces `app-render-0.1.0.tgz` containing `dist/` and a manifest with no runtime dependencies. This was verified.
- It is committed to the frontend at `vendor/app-render-0.1.0.tgz` and referenced as `file:./vendor/app-render-0.1.0.tgz`. No junction and no sibling path.
- Verified: `npm ci` in a clean copy of the frontend, with no backend folder present, installs, typechecks, builds, and passes all 172 tests.
- Drift control: `npm run sync:render` rebuilds the backend package and repacks the tarball. `npm run check:render` compares the packed `dist/index.js` and `dist/index.d.ts` with the backend build and exits 1 on drift. Verified: check passes against the current backend.

**Trade-offs.** Two copies exist (the backend source is authoritative). A backend render change requires running `sync:render` and committing the tarball in the frontend. The check script needs the backend checkout, so it runs locally or in a backend CI job, not in frontend CI. Publishing to a registry remains the long-term option once a release process exists.

**Windows note.** `sync-render.mjs` uses `shell: true` to run `pnpm` on Windows. Node prints `DEP0190` (args passed to a shell). It is a warning, not a failure. Replacing it with `pnpm.cmd` resolution is a small follow-up.

### D-01 revised: Next.js is installed, the public site is migrated, the editor is not

**Version.** Next 14.2.35 is pinned. Next 16 requires React 19 for its current peer range and would force an unplanned React upgrade alongside the router change. The project runs React 18.3.1.

**Tested problem 1: Next's Pages Router detection.** Next resolves `./pages` and then `./src/pages`. Because this project's Vite pages live at `src/pages`, Next always enables its Pages Router and tries to prerender Vite components, failing on `import.meta.env`. There is no config switch to disable this. Resolution: the Next app lives in `web/` (`web/app`), and `next build web` is used, so Next never scans `src/`.

**Tested problem 2: Next rewrote `tsconfig.json`.** Running Next modified the shared `tsconfig.json` (`jsx: preserve`, added plugin). Reverted with `git checkout`; the file has zero diff. The Next-specific options live in `tsconfig.next.json`.

**Built and verified:** `web/app/layout.tsx` (metadata, Open Graph, robots, viewport), `web/app/page.tsx` (server component, prerendered as static), `web/app/providers.tsx` (client boundary for the existing `AppProviders`). `npm run build:web` passes. The homepage HTML contains the h1, title, description meta tag, Open Graph title, and feature copy.

**Not done: editor cutover.** The editor, dashboard, components, and auth pages still run on Vite with `react-router-dom`. Reasons: (1) they use `useNavigate`, `useParams`, `useLocation`, `Link`, `Navigate`, and `Outlet` across roughly 15 files; (2) the 172 tests render them inside `BrowserRouter`, so a router swap changes test infrastructure, not just app code; (3) no browser automation is set up here to verify client navigation and hydration. Moving them is the first task of Prompt 3, following the route map in D-01. Until then, the two apps are served together by the deployment, with `/` as the Next site and the SPA behind it. This coexistence must be verified at the deployment layer before release; it was not tested here.

### D-04 outcome: migration 0005 applied to the configured database

- `packages/db/drizzle/0005_additive_foundation.sql` was generated by drizzle-kit, and its contents were reviewed: `CREATE TABLE` (6), `ADD COLUMN ... DEFAULT` on existing tables (2), new foreign keys and indexes. No drops, no type changes.
- It was applied with `drizzle-kit migrate` after confirming the database was reachable and missing the new column. Applied migrations: 6 tracked.
- Verified after apply: `users.role` default `'user'`, `projects.aspect` default `'landscape'`, all 6 new tables present, existing 23 users and 2 projects unchanged.
- The e2e worker test failed before the migration with `column "role" of relation "users" does not exist` (42703), which confirmed the migration was needed. It passes after.
- Not verified: applying the migration to a *production* copy. The configured database is the one the local tests use; treat it as the only verified target.

### D-05 outcome: contracts are schema-only

`packages/schema/src/media.ts` defines aspect ratios with canonical dimensions, media element schemas (video clip, audio, caption), five layout presets as data, and effect schemas (scene, element, and region targets). Region targets must lie inside the frame. These are validated by 15 tests plus the existing 73. No element is rendered: the worker and editor do not yet handle the new types, so these contracts do not add user-visible features.

### D-07 and D-08 status

- Admin guard: `requireAdmin` reads the role from the database on every call (not from the token) and returns 403 for non-admins and for role values other than exactly `admin`. Covered by 10 tests against the real `AuthService`. No admin routes or UI exist.
- Google sign-in: NOT implemented. Blocked on OAuth credentials.
- Entitlement enforcement and discount redemption: tables only, no logic.

### Finding: 403 vs 404 for scenes

`requireSceneAccess` returns 404 when the scene does not exist, and 403 with a distinct message when it exists but belongs to another user. Projects return 404 in both cases. The 403 reveals that the scene exists. This was not changed, because the frontend may depend on the 403 status. Decision needed: standardise on 404 for both (recommended), with a frontend check. Recorded as an open item.

### Open items carried into Prompt 3

1. Editor cutover to Next.js, following the D-01 route map, with browser tests.
2. Remove the remaining 16 lint warnings in backend test files; fix the 4 frontend `exhaustive-deps` warnings with a behavior review.
3. Standardise scene-ownership errors to 404.
4. Worker and editor support for video clip, audio, caption, presets, and effects.
5. Run `openapi.json` against the route table.
6. Live verification of external services (not run).

---

## Prompt 3 decisions (2026-10-09)

### D-12 Next.js version: 16.4 (current major), not 14

The previous stage pinned Next 14.2.35. Official docs (Next 16 upgrade guide) show Next 16 requires Node 20.9+ and supports React 19.2. The project now runs Next 16.4.0 with React 19.3 and Testing Library 16, because staying on 14 would keep an older major than the current release. The Active/Maintenance LTS label is not used anywhere in the official documentation I checked, so no LTS claim is made.

Breaking changes applied: React 19 requires `JSX` to be imported from `react` (7 type errors in `renderers.tsx`, fixed). Next 16 uses Turbopack by default; the build passes without a webpack config.

### D-13 Routing: App Router, `@/` alias, and a react-router compatibility shim

- Route tree lives at the project root `app/`, with the authenticated routes in an `(app)` route group. `AuthGuard` is a client layout for that group.
- Component call sites kept their hook names (`useNavigate`, `useParams`, `useLocation`, `Link`) through `src/routing/navigation.tsx`, which wraps `next/navigation`. This kept the editor logic and its tests unchanged.
- Route page files import with the `@/src/...` alias. Relative imports broke at different directory depths and were replaced.
- `src/pages` was renamed to `src/views`, because Next detects a `src/pages` folder as its Pages Router and refuses to build alongside `app/`.
- The project route is `/projects/[id]`, not `[projectId]`. Next rejects two different slug names at the same level.

### D-14 Auth hydration

`AuthGuard` reads the persisted zustand store only inside `useEffect` (`hasHydrated` / `onFinishHydration`). Server prerendering never touches browser storage, which fixed a prerender crash (`Cannot read properties of undefined (reading 'hasHydrated')`).

### D-15 Environment variables

Vite's `import.meta.env` is undefined under Next, which would have silently pointed a deployed build at `localhost:3001`. The API base URL now reads `process.env.NEXT_PUBLIC_API_BASE_URL` (defaults to `localhost:3001`). The dev-only renderer assertion uses `process.env.NODE_ENV`. Deployments must set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SITE_URL` at build time; the sitemap otherwise uses `localhost:3000`.

### D-16 CORS methods

The API's CORS registration allowed only `GET, HEAD, POST`. Inspector saves use `PATCH`, so the browser blocked them. Fixed by listing every verb the routes serve. This was a real product defect found only by a browser test. Production `CORS_ORIGIN` must be set to the real frontend origin; the local value is `*`.

### D-17 Browser testing

Playwright 1.64 with Chromium, running against `next start` (production build) and the live local API on port 3002. Test accounts are created through the real `/auth/register` endpoint with unique emails; no shared credentials are stored. The Vitest suite is limited to `src/` so it does not pick up the Playwright specs.

### D-18 Unverified: render worker and MP4

Redis and Docker are not available locally, so the render queue and worker were not exercised in this pass. The existing worker smoke test depends on a reachable database and Redis-backed queue. No MP4 export was produced or verified in this pass.

### D-19 Migration 0005 remains the only applied migration this pass

No new migrations were run. Phase 2 and Phase 3 schema changes (e.g. media elements in scenes, plans enforcement) are NOT yet applied anywhere. Any future migration must first be tested on a dedicated disposable database; the configured database is treated as shared.

### D-20 Staged media deletions

The six backend media files were staged for deletion from the index in the previous stage. They are referenced nowhere in code, tests or docs. The staging was reverted (`git restore --staged`), so the files are tracked again and unchanged on disk. Whether they should be untracked is an owner decision.
