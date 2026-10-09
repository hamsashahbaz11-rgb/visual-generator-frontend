# Feature Acceptance Matrix

Status key: `VERIFIED` = implemented and exercised by an automated test or a verified build step. `INCOMPLETE` = implemented in part. `BROKEN` = known defect. `MISSING` = not present. `BLOCKED` = needs external configuration. `NOT REQUIRED` = out of initial scope.

Baseline results (2026-10-09, unmodified checkouts):

| Check | Frontend | Backend |
|---|---|---|
| Typecheck (`tsc -b` / `pnpm build`) | PASS | PASS (all 7 packages) |
| Production build | PASS (`vite build`, 1789 modules, JS 508 kB, gzip 151 kB) | PASS |
| Tests | PASS, 22 files, 172 tests | PASS, 30 files, 459 tests |
| Lint | Not configured (no ESLint in frontend) | PASS with 0 errors, 26 warnings |

Warnings only from the frontend build: `services/components.ts` is both dynamically and statically imported (no effect on correctness, prevents code splitting), and chunk exceeds 500 kB.

## A. Authentication and accounts

| Feature | Status | Evidence | Required automated test (to add) |
|---|---|---|---|
| Email/password register | VERIFIED (backend) | `auth.test.ts`, `POST /auth/register` | Keep existing; add frontend RegisterPage route test |
| Email/password login | VERIFIED (backend) | `auth.test.ts`, `POST /auth/login` | Keep existing |
| Password reset (request + reset) | VERIFIED (backend) | `password-reset.test.ts` | Keep existing |
| Session on `GET /auth/me` | VERIFIED (backend) | `auth.test.ts` | Keep existing |
| Frontend AuthGuard redirect when logged out | INCOMPLETE | Guard exists (`AuthGuard.tsx`), no test | E2E: visiting `/projects/x` logged out redirects to `/login` |
| Token expiry / 401 handling | INCOMPLETE | 401 clears store (`api.ts`); no refresh flow | Test: 401 response clears auth and routes to login |
| Google sign-in | MISSING | No OAuth route, no client code, no `google` string in code | Backend: OAuth callback, identity table, account-link tests. Frontend: button and callback route |
| Fallback auth (email/password) | VERIFIED | Above | Keep |
| Admin role and admin routes | MISSING | No `role` column, no admin routes | Migration adds `role`; `requireAdmin` tests (403 for non-admin) |

## B. Projects, scenes, autosave

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Project CRUD | VERIFIED (backend) | `projects` routes | Keep existing |
| Scene CRUD | VERIFIED (backend) | `scenes.ts` routes | Keep existing |
| Ownership checks on project/scene | VERIFIED (backend) | `component-auth.test.ts` covers components; project/scene ownership needs explicit test | Add: user B cannot read or write user A's project (403/404) |
| Autosave of scene document | MISSING | Grep of `src` finds no debounced document save; the only debounce is the component search box. Stores exist but do not persist edits automatically | Test: edit triggers debounced PATCH; failed save shows error and retains local state |
| Project format (landscape/portrait/square) | MISSING | No project column, no preset enum | Schema: `aspect` enum; default landscape; migration default for existing rows |
| Dashboard listing and creation | INCOMPLETE | `DashboardPage.tsx`, `NewProjectDialog.tsx` exist | Test: create project, appears in list |

## C. Editor: canvas, selection, inspector, layers

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Canvas render of elements | VERIFIED | `SceneCanvas.test.tsx`, `renderers.test.tsx` | Keep |
| Selection and drag | VERIFIED | `SceneCanvas.interactions.test.tsx` | Keep |
| Multi-select align | VERIFIED | `LayoutToolbar.test.tsx` | Keep |
| Inspector: X, width, rotation, opacity, visibility | VERIFIED | `Inspector.test.tsx` (8) | Keep |
| Layer ordering (bring to front, send backward) | VERIFIED | `Inspector.test.tsx` | Keep |
| Animation / keyframe authoring | VERIFIED | `Inspector.animation.test.tsx`, `animationOps.test.ts` | Keep |
| Groups (create, nest, move) | INCOMPLETE | Schema supports `groups` with parent; frontend `documentTree.ts` and `relationships.ts` tests exist. No UI group-creation test found | Test: group selection, move group moves children, ungroup |
| Undo / redo | MISSING | Grep of `src` for undo/redo/history finds no history stack; confirmed | Store test: 10 edits then undo x10 restores initial document |
| Scene tree view | INCOMPLETE | `documentTree.ts` logic verified; UI tree not separately tested | Component test on tree expand/select |
| Component library (drag into canvas) | INCOMPLETE | `ComponentsPage.tsx` exists; drag-into-canvas path not tested | E2E: add component from library appears in canvas |

## D. Timeline

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Timeline playback and frame stepping | VERIFIED | `Timeline.test.tsx`, `useTimelinePlayback.test.ts` | Keep |
| Keyframe display and edit | VERIFIED | `Timeline.keyframes.test.tsx` | Keep |
| Geometry (frame to pixel) | VERIFIED | `timelineGeometry.test.ts` | Keep |
| Element trimming (start/duration drag) | INCOMPLETE | Timing fields exist (`timing.start`, `timing.duration`); drag-trim UI not verified | Test: drag trim handle updates `timing.duration` |
| Scene transitions | MISSING | No transition primitive in schema | Schema + renderer test (fade, slide between scenes) |
| Video clip trimming | MISSING | No video-clip element type | Schema: `videoClip` with in/out points |

## E. Motion and layout engine

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Deterministic layout intents | VERIFIED | `packages/schema/test/layout.test.ts`, `packages/render/test/layout.test.ts`, `aiLayout.test.ts` | Keep |
| Motion sequencing (sequence, parallel, overlap, stagger) | VERIFIED | `packages/render/test/motion.test.ts`, `aiMotion.test.ts` | Keep |
| Evaluator parity (editor preview vs worker render) | INCOMPLETE | Both use `@app/render`; no automated frame-parity test comparing preview frame vs rendered frame | Golden test: same scene document evaluated in editor and worker produces identical transforms at N frames |
| Layout presets (screen-only, PiP, circular webcam, vertical presenter, side-by-side) | MISSING | No preset definitions | Preset registry test: each preset yields expected rectangles for each format |
| Targeted effects / full-screen effects | MISSING | Only motion/keyframe system exists | Effect primitive schema and renderer tests |

## F. Media

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Upload audio / video / image / logo / side_video | VERIFIED (backend) | `assets` routes, mime validation | Keep; add tests for size limit and unsupported mime |
| Stream asset file with Range | VERIFIED (backend) | `GET /assets/:id/file` | Keep |
| Asset delete | VERIFIED (backend) | `DELETE /assets/:id` | Add: deleting asset referenced by a scene is blocked or handled |
| Multiple images in one project | VERIFIED (data) | Assets are per project; `Img` used in worker | Keep |
| Short video clip in scene | INCOMPLETE | `side_video` exists only as a single `sideVideo` field in legacy VideoSpec; no scene-level clip element | Schema and renderer test for `videoClip` element |
| Voice / narration / background audio | INCOMPLETE | `Html5Audio` in legacy composition; no scene audio element with volume and trim | Schema: `audio` element with `volume`, `trimStart`, `trimEnd` |
| Share links for assets | VERIFIED (backend) | `asset_share_links`, `public-file` route | Keep |
| Transcripts (Gemini transcribe, JSON import) | VERIFIED (backend), BLOCKED for live run | `transcription.ts`, `transcripts.test`-equivalent not confirmed | Mocked provider test; live test blocked by `GEMINI_API_KEY` |
| Captions (create / edit / burn-in) | MISSING | Transcripts exist; no caption element type or renderer | Caption element schema + worker render test |
| Audio volume controls | MISSING | None | Inspector test on volume |

## G. AI

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| OpenRouter scene planning | INCOMPLETE | Pipeline in `apps/api/src/ai/*`; live call not exercised | Mocked provider test (exists in `ai.test.ts`); live smoke blocked by `OPENROUTER_API_KEY` |
| Validated apply of AI plan | VERIFIED | `apply.ts`, `verification.ts`, `ai.test.ts` | Keep |
| Bounded agent execution | VERIFIED (backend) | `agent.test.ts` (459-test suite) | Keep |
| Frontend AI panel | VERIFIED (component) | `AiPanel.test.tsx` (9) | Keep |
| Multi-scene AI creation | INCOMPLETE | Planner supports scene plans; end-to-end multi-scene in UI not verified | E2E: prompt yields N scenes with valid documents |
| Transcript-to-scene generation | INCOMPLETE | `generate.ts` hardcodes `provider: 'gemini'` from UI | Test: UI passes selected provider; manual provider path works |
| Gemini / OpenRouter provider selection | INCOMPLETE | Two parallel paths (`services/ai` and `ai/`) | Consolidate behind one `AISceneProvider` interface |

## H. Rendering and export

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Scene render job (BullMQ) | VERIFIED (backend) | `sceneRenderJob.test.ts`, `renders.test.ts` | Keep |
| Render status polling in frontend | VERIFIED (component) | `SceneRenderPanel.test.tsx` (idempotency key) | Keep |
| Duplicate render protection | VERIFIED | Client key guard in `renders` | Keep |
| Cancel render | VERIFIED (backend) | `POST /renders/:id/cancel` | Add: cancel mid-job transitions to cancelled |
| Failed job recovery / retry | INCOMPLETE | `error` column and lifecycle states exist; retry path not verified | Test: failed render can be re-queued |
| MP4 download | VERIFIED (component) | `renders.download` creates blob link | Add: download filename and content-type test |
| Preview of render output | VERIFIED (component) | `previewUrl` | Keep |
| Output parity with editor preview | INCOMPLETE | See Section E | Golden frame test |
| Worker composition for all media types | INCOMPLETE | `video.tsx` covers Img, OffthreadVideo, Html5Audio in legacy composition only | Worker test rendering each element type |
| Production rendering smoke (real Remotion) | BLOCKED | Requires Chromium and ffmpeg in environment; `e2e-smoke.test.ts` present | Run in CI with ffmpeg |

## I. Subscriptions, entitlements, admin

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Plans table and entitlements | MISSING | No table | Migration + entitlement service tests |
| Usage limits (renders, storage, AI calls) | MISSING | `projects.max_components` exists but is a component cap, not a plan limit | Enforcement tests returning 402/403 with code |
| Manual access grants | MISSING | None | Admin route tests |
| Discount codes | MISSING | None | Redemption tests (valid, expired, exhausted) |
| Protected admin UI | MISSING | None | Route guard tests |
| Payment provider | NOT REQUIRED (initial) | | |

## J. Frontend platform

| Feature | Status | Evidence | Required automated test |
|---|---|---|---|
| Next.js App Router migration | MISSING | Project is Vite SPA | Build and route parity tests after migration |
| SEO public homepage | MISSING | Single `index.html` title, no meta | Metadata and sitemap tests |
| Responsive layout | INCOMPLETE | CSS exists; no viewport tests | Playwright viewport tests (mobile, tablet, desktop) |
| Loading and error states | INCOMPLETE | `ErrorAlert`, `LoadingSpinner` exist; coverage uneven | Per-page loading/error test |
| Frontend CI | MISSING | No workflow in frontend checkout | CI runs typecheck, build, test |
| Frontend lint | MISSING | No ESLint config in frontend | Add ESLint with same rules as backend |
| Dependency on sibling `file:` path | BROKEN for remote builds | Junction only valid on this machine | Clean-checkout install test (see decisions D-02) |

## K. Repository hygiene

| Item | Status | Notes |
|---|---|---|
| Six media files tracked in `apps/api/storage/` | BROKEN (hygiene) | Binary user/test data committed. Remove from index in Prompt 2 (no history rewrite) |
| Stale tracked Vite artifacts (`vite.config.js`, `vite.config.d.ts`) | INCOMPLETE | Duplicate of `vite.config.ts`; to be removed during migration |
| `tsconfig.tsbuildinfo` tracked | INCOMPLETE | Build artifact; `.gitignore` lists `*.tsbuildinfo`, so it is tracked despite ignore rule |
| Backend lint warnings (26) | INCOMPLETE | Unused imports and variables; no errors |
| Duplicate AI provider paths | INCOMPLETE | `services/ai/*` and `ai/*` both exist |

---

## Prompt 2 outcomes (verified 2026-10-09)

Only items below marked VERIFIED were run and passed in this pass. Everything else keeps its audit status.

### Check results after Prompt 2

| Check | Frontend (clean clone, `npm ci`) | Backend (`pnpm`) |
|---|---|---|
| Install from lockfile, no sibling folder | PASS (414 packages) | PASS |
| Typecheck / build | PASS (`tsc -b` + `vite build`) and PASS (`next build web`) | PASS (`pnpm build`, 7 packages) |
| Lint | PASS, 0 errors, 4 warnings (`react-hooks/exhaustive-deps`, deliberately not auto-fixed) | PASS, 0 errors, 16 warnings (test files only) |
| Tests | PASS, 22 files, 172 tests | PASS, 34 files, 497 tests (was 459) |

### Status changes

| Item | Was | Now | Evidence |
|---|---|---|---|
| Shared `@app/render` dependency | BROKEN for remote builds (sibling junction) | VERIFIED | Vendored tarball `vendor/app-render-0.1.0.tgz`; clean `npm ci` passes; `npm run check:render` confirms it matches the backend build |
| Frontend CI | MISSING | VERIFIED (workflow written, runs the same commands verified locally) | `.github/workflows/ci.yml`. Not yet executed on GitHub (no push performed) |
| Frontend lint | MISSING | VERIFIED | `eslint.config.js`; 0 errors |
| Repository hygiene: tracked media | BROKEN | VERIFIED | 6 files untracked with `git rm --cached` (staged); files kept on disk; `**/storage/` ignored |
| Drizzle snapshot consistency | UNVERIFIED | VERIFIED | `drizzle-kit generate` reports "No schema changes" |
| Migration 0005 (additive) | MISSING | VERIFIED on the configured DB | `users.role` and `projects.aspect` added with defaults; 6 new tables; 23 users and 2 projects preserved (defaults `user` / `landscape`) |
| Aspect ratio (landscape/portrait/square) | MISSING | VERIFIED (schema contract and DB column) | `packages/schema/src/media.ts`; 15 media tests. Editor picker NOT implemented (Prompt 3) |
| Media element contracts (video clip, audio, caption) | MISSING | VERIFIED (schema only) | Zod contracts with trim/volume/cue validation. NOT rendered by the worker yet (Prompt 3) |
| Layout presets (5) | MISSING | VERIFIED (data contract only) | `LAYOUT_PRESETS`; rectangle and aspect tests. Not applied in editor or worker yet |
| Effects contract | MISSING | VERIFIED (schema only) | `EffectSchema` with scene/element/region targets. Not evaluated or rendered yet |
| Admin role guard (`requireAdmin`) | MISSING | VERIFIED (unit) | 10 tests in `apps/api/test/authorization.test.ts` against the real `AuthService`. No admin routes exist yet |
| Ownership of scenes, components | INCOMPLETE | VERIFIED on the real DB | 7 tests in `apps/api/test/ownership.test.ts`; fixtures removed after each run |
| Preview/render parity | INCOMPLETE | VERIFIED at the evaluator level | 6 tests in `packages/render/test/parity.test.ts`. Editor and worker both call `renderSceneAtFrame` |
| Next.js App Router | MISSING | PARTIAL | `web/app` builds; `/` is statically prerendered with SEO metadata. Editor, dashboard, and auth remain on Vite (see decisions D-01) |
| Public marketing homepage | MISSING | VERIFIED (static HTML) | Prerendered HTML contains h1, title, description, Open Graph, and feature copy |
| Google sign-in, plans, entitlements, discounts, admin UI | MISSING | UNCHANGED (tables only) | Tables exist for plans, entitlements, usage, grants, discounts. No routes, no OAuth, no enforcement |

### Known gaps still open (not claimed as complete)

- Undo/redo: MISSING (unchanged).
- Document autosave: MISSING (unchanged).
- Editor aspect picker, media elements in the canvas, captions, effects, transitions, and presets in the UI: MISSING (Prompt 3).
- Worker rendering of new element types: MISSING (Prompt 3).
- Editor migration to Next.js: NOT DONE (Prompt 3).
- Live verification of Gemini, OpenRouter, Google, S3, SMTP, and a real Remotion render: NOT RUN.
- `openapi.json` vs routes: NOT CHECKED.
- Next-app browser behavior (client navigation, hydration): NOT TESTED. Only the static build and HTML were verified.

---

## Prompt 3 outcomes (verified 2026-10-09, Phase 1 and the first editor fix)

Status key: PASS = verified by a run in this pass. FAIL = defect found. BLOCKED = requires external configuration not present. NOT STARTED = not implemented in this pass.

### Phase 1: Next.js migration (gate)

| Requirement | Status | Evidence |
|---|---|---|
| Next.js App Router is the only app (Vite and react-router removed) | PASS | `next build` compiles; `vite`/`react-router-dom` absent from direct dependencies; old `App.tsx`, `main.tsx`, `index.html` removed |
| Next version | PASS | Next 16.4.0 (current major), React 19.3, Node 24 locally (Next 16 requires 20.9+). No Active/Maintenance LTS label was found in the official docs, so none is claimed |
| Routes: `/`, `/login`, `/register`, `/dashboard`, `/projects/[id]`, `/projects/[id]/canvas`, `/projects/[id]/scenes/[sceneId]`, `/components`, `/components/new`, `/components/[id]`, `/components/[id]/edit` | PASS | Production build route table lists every route |
| Public pages `/features`, `/templates`, `/pricing` | PASS | Built and tested. Pricing shows no invented prices; it states none are published |
| `robots.txt`, `sitemap.xml` | PASS | Generated; contents checked. Sitemap contains only the four public pages. Robots disallows the app and auth pages |
| Metadata, canonical URLs, Open Graph | PASS | Homepage E2E test checks title, description and og:title |
| Protected routes redirect to login when unauthenticated | PASS | E2E 9a |
| Login with a real account reaches the dashboard | PASS | E2E 3 (real register then login via the form) |
| Wrong password shows an API error | PASS | E2E 9b |
| Project not found shows the API error, not a blank page | PASS | E2E 4b |
| Open project, canvas, scene editor | PASS | E2E 5 |
| Timeline, animation inspector, AI panel, render panel present | PASS | E2E 7 (checks real labels: Scene timeline, Inspector, AI prompt, Refresh renders) |
| Select element, edit a supported property, save, verify on server and after reload | PASS (after fix) | E2E 6. Server stores `position.x = 321`; value survives reload |
| Scene load failure shows an error | PASS | E2E 8 |
| No hydration errors on homepage | PASS | E2E 1 checks console for hydration messages |
| Client state and navigation without hydration errors across the whole editor | PARTIAL | Only the homepage hydration check is asserted. Other pages are exercised but not checked for console hydration errors |

### Defect found and fixed in this pass

- **CORS blocked inspector saves.** The API preflight allowed only `GET, HEAD, POST`, so the browser rejected `PATCH /instances/:id` (the inspector's save) with `ERR_FAILED`. The API direct calls worked, which hid the problem. Fix: `@fastify/cors` now allows `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`, the verbs the routes serve. Regression test: `apps/api/test/cors.test.ts` (1 passing). Verified live: preflight returns 204 with PATCH in `Access-Control-Allow-Methods`.
- The remaining CORS origin is `*` in the local `.env`. This is acceptable for local development only. Production must set `CORS_ORIGIN` to the deployed frontend origin.

### Phase 2 and 3: NOT STARTED in this pass

Phase 2 (formats, media elements, layout presets applied to scenes, effects, captions, audio, undo/redo, autosave with states, AI multi-scene) and Phase 3 (Google sign-in, admin panel, entitlements, discounts, billing) are not implemented. The contracts from the previous stage exist, but the editor and worker do not use them. These are not claimed as complete.

### Verification commands and results (this pass)

| Check | Command | Result |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.json` | PASS, 0 errors |
| Frontend unit/component tests | `npx vitest run` | PASS, 22 files, 172 tests |
| Frontend lint | `npx eslint .` | PASS, 0 errors, 4 warnings (`react-hooks/exhaustive-deps`, deliberately not auto-fixed) |
| Frontend production build | `npx next build` | PASS, all routes compile |
| Browser acceptance | `npx playwright test` (production build, live API on localhost:3002) | PASS, 15 tests (4 editor, 7 migration, 4 public) |
| Backend build | `pnpm build` | PASS, 7 packages |
| Backend tests | `pnpm vitest run` (with `.env` loaded for config-dependent suites) | PASS, 491 plus the 7 ownership tests and 1 CORS test |
| Backend lint | `pnpm lint` | 0 errors; warnings in test files only |

Test counts: frontend 172 unit plus 15 browser; backend 498 (was 459 at the start of Prompt 2).

### Not verified in this pass

- Redis and the render worker: not running locally (no Redis or Docker). Render-job tests and MP4 export were NOT executed in this pass. The existing worker smoke test passes only when the database is reachable.
- Live AI (OpenRouter, Gemini): not called.
- Google, billing, and SMTP: not configured or called.
- Cross-browser: Chromium only.
