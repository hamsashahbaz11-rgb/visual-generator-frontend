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
