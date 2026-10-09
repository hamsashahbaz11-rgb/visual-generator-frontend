# Architecture and Contracts

Audit baseline date: 2026-10-09.
Frontend checkout: `Visual Diagram Gen Frontend`, branch `spec-before` (clean).
Backend checkout: `Visual Diagram Gen Backend`, branch `upgrade` (clean).

## 1. Repository boundaries

| Repository | Branch | Stack | Owns |
|---|---|---|---|
| Frontend | `spec-before` | Vite 5 + React 18 SPA, React Router 7, TanStack Query, Zustand, Tailwind, Vitest | Editor UI, canvas, timeline, AI panel, asset UI, render UI |
| Backend | `upgrade` | pnpm workspace: Fastify API, Remotion worker, BullMQ, PostgreSQL via Drizzle, MCP server | API, persistence, AI pipeline, rendering, storage |

Both repositories are present in the workspace. No repository is missing. Neither checkout has uncommitted changes at the time of the audit.

The workspace root `D:\Web development\Projects\Visual Diagram Full Stack` is not a git repository. It contains the two checkouts plus `.kilo`, `.vscode`, and `.pnpm-store`.

## 2. Shared packages (backend workspace)

| Package | Path | Role |
|---|---|---|
| `@app/schema` | `packages/schema` | Zod/Ajv schemas for VideoSpec, SceneDocument, layout, motion, timeline, render lifecycle, telemetry |
| `@app/render` | `packages/render` | Deterministic evaluator, layout engine, motion/easing, timeline, render tree. Used by editor preview and by worker (parity) |
| `@app/db` | `packages/db` | Drizzle schema, migrations 0000 to 0004, seed |
| `@app/storage` | `packages/storage` | Storage adapter (local filesystem and S3 client) |
| `@app/api` | `apps/api` | Fastify API |
| `@app/worker` | `apps/worker` | BullMQ consumer, Remotion bundling and rendering |
| `@app/mcp` | `apps/mcp` | MCP tool server |

## 3. How the frontend consumes `@app/render` (current state)

- `package.json` declares `"@app/render": "file:../Visual Diagram Gen Backend/packages/render"`.
- `node_modules/@app/render` is a **Windows directory junction** pointing at the backend `packages/render` folder.
- The package exports `./dist/index.js`. The junction is valid only if the backend has been built (`pnpm --filter @app/render build`).
- The frontend imports the package at runtime from `animationOps.ts`, `renderers.tsx`, `timelineGeometry.ts`, and tests (`evaluateSceneAtFrame`, `connectorEndpointsFor`, `BUILT_IN_RENDERER_KEYS`, and related exports).
- The `file:` path is relative to the frontend folder name `Visual Diagram Gen Backend`. A remote frontend checkout, CI runner, or Vercel/Netlify build will not contain that sibling path and will fail on `npm install`.

Risk: this is the single largest deployment blocker for a remote build. See `IMPLEMENTATION_DECISIONS.md` D-02.

## 4. Persistence model (verified from `packages/db/src/schema.ts`)

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, name, email (unique), password_hash, last_login_at | No role, no plan, no entitlement, no OAuth identity |
| `password_reset_tokens` | user_id, token_hash, expires_at, used_at | |
| `projects` | id, name, spec (jsonb), max_components, user_id | No aspect ratio / format column. Format is only present inside `spec` if the producer writes it |
| `components` | name (unique), props_schema, enter/exit styles, color/ref/asset props, user_id, is_public | Component registry |
| `assets` | kind (text, not enum-constrained in DB), original_name, storage_key, mime_type, size_bytes, duration_seconds, user_id, project_id | Kinds accepted by API: `audio`, `video`, `image`, `logo`, `side_video` |
| `scenes` | project_id, name, description, duration, meta (jsonb) | |
| `component_instances` | scene_id, component_definition_id, group_id, props, position, size, transform, style, visible, z_index, timing, animation | Holds motion/keyframes in `animation` jsonb |
| `groups` | scene_id, parent_group_id (self-reference), name, z_index | Nested groups supported in schema |
| `transcripts` | asset_id, language, text, words (jsonb), duration_seconds | |
| `asset_share_links` | asset_id, user_id, token_hash (unique), expires_at, revoked_at | |
| `renders` | project_id, scene_id (nullable), client_key, status, progress, spec_snapshot (jsonb), output_asset_id, error, started_at, completed_at | Scene and legacy VideoSpec renders share this table |

Authentication: email/password only. Session is a bearer token stored in browser `localStorage` under key `framewell-auth` via Zustand persist. There is no refresh token, no OAuth, and no server-side session table.

## 5. Document and layout contracts (verified from `packages/schema/src/document.ts`)

- `SceneDocument` carries `fps` (int 1 to 240, default 30) and `timeline.durationFrames` (default 300).
- Element `size` is `{ width, height }` with positive numbers. Element `position`, `transform`, `style`, `timing`, `animation`, `zIndex`, `visible` are stored in the instance row.
- Layout intents (`packages/schema/src/layout.ts`): `horizontal`, `vertical`, `grid`, `center`, `stack`, `align`, `distribute`, `flow`, `fitText`, `constrain`, `detectOverlaps`, `resolveCollisions`. This is a real deterministic engine, not a placeholder.
- Motion (`packages/schema/src/motion.ts`): sequence/parallel/overlap/stagger modes; forward/reverse/centerOut/edgesIn ordering.
- Easing and animatable property enums exist in `document.ts`.
- Renderable component image fit: `cover` or `contain`; shape `circle`, `rounded`, `square` (`spec.ts`).

Not present in any schema:
- Canvas aspect-ratio presets (landscape / portrait / square). The composition is fixed by the legacy `VideoSpec` and `SceneDocument` width/height per scene, not by a project-level format.
- Layout presets for presenter/webcam/side-by-side (only general layout intents exist).
- Video clip elements, audio-track elements with volume/trim, caption elements.
- Targeted or full-screen effect primitives beyond the motion/keyframe system.

## 6. Rendering

- Worker entry: `apps/worker/src/index.ts`, BullMQ queue, Redis connection via `REDIS_URL`.
- Renderer: `apps/worker/src/renderer.ts` uses `@remotion/renderer` `getCompositions` and `renderMedia`.
- Compositions registered in `apps/worker/src/remotion/index.tsx`:
  - `VisualDiagram` (legacy VideoSpec, `video.tsx`)
  - `SceneFrame` (`sceneFrame.tsx`)
  - `SceneProduction` (`sceneProduction.tsx`, uses shared evaluator and render tree)
- Media in the legacy composition: `Img`, `OffthreadVideo` (side video), `Html5Audio` (background audio).
- Render lifecycle states and telemetry are defined in `packages/schema/src/renderLifecycle.ts` and `renderTelemetry.ts`.
- Output: MP4, stored as an asset with `output_asset_id`, downloaded through `GET /renders/:id/file`.
- Cancel: `POST /renders/:id/cancel`. Status polling: `GET /renders/:id/status`.

Known gap: the composition dimensions and fps for scene renders come from the scene document. No project-level output format is applied.

## 7. API surface (verified from `apps/api/src/index.ts` and `routes/*`)

Registered route groups:

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me` |
| Projects | project CRUD under `routes/projects.ts` |
| Scenes | scene routes under `routes/scenes.ts` |
| Components | registry routes under `routes/components.ts` |
| Assets | `POST /assets` (multipart, `kind` required), `GET /assets`, `GET /assets/:id/file` (with Range support), `DELETE /assets/:id`, `POST /assets/:id/share-url`, `GET /assets/:id/public-file/:token` |
| Transcripts | `routes/transcripts.ts` (transcribe via Gemini, import JSON) |
| Generation | `routes/generate.ts` (`POST /projects/:id/generate`, provider `gemini` or `manual`) |
| AI | `routes/ai.ts` (OpenRouter-backed planning, apply, and agent execution) |
| Renders | `POST /projects/:id/renders`, `POST /scenes/:id/renders`, `GET /projects/:id/renders`, `GET /scenes/:id/renders`, `GET /renders/:id`, `GET /renders/:id/status`, `GET /renders/:id/file`, `POST /renders/:id/cancel` |

Error contract: `{ error: { code, message, details } }`, with Zod-style `issues` in `details`. The frontend `parseApiError` expects this shape.

OpenAPI: `openapi.json` exists at the backend root and is covered by `apps/api/test/openapi.test.ts`. Whether it matches every route has not been verified in this stage.

## 8. AI

- Two provider paths exist:
  1. Gemini transcription and generation (`services/ai/gemini.ts`, `services/transcription.ts`, `routes/generate.ts`) controlled by `AI_PROVIDER`, `GEMINI_API_KEY`, `AI_MODEL`.
  2. OpenRouter scene-authoring (`apps/api/src/ai/*`, `routes/ai.ts`) controlled by `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (default `openrouter/free`), `OPENROUTER_BASE_URL`.
- The OpenRouter pipeline is structured: plan, apply, verification, bounded agent, observability, and an operations registry. It is not a single prompt that emits arbitrary code.
- Frontend AI panel (`src/components/ai/AiPanel.tsx`) calls the AI routes. Its bounded agent execution was added in the latest frontend commit.
- Transcript generation in the frontend (`generation.ts`) currently sends `provider: 'gemini'` with `save: false`. This is a hardcoded provider choice in the UI.
- Live AI behavior was not exercised in this audit (no API keys in the environment).

## 9. Authentication and authorization

- Backend: `requireAuth` in `routes/auth.ts`; bearer token. Project, scene, asset, and render routes perform ownership checks (`userId` matches). The component-auth test covers component access.
- Frontend: `AuthGuard` wraps authenticated routes. Token persisted in `localStorage`. On 401 the store is cleared.
- Not present: admin role, admin routes, plan entitlements, usage quotas, discount codes, manual access grants, Google sign-in.

## 10. Frontend route map (verified from `src/App.tsx`)

| Path | Component | Auth |
|---|---|---|
| `/login` | LoginPage | public |
| `/register` | RegisterPage | public |
| `/` | DashboardPage | guarded |
| `/projects/:id` | EditorPage (transcripts, assets, AI, renders) | guarded |
| `/projects/:projectId/canvas` | CanvasLanding | guarded |
| `/projects/:projectId/scenes/:sceneId` | SceneEditorPage (canvas, timeline, inspector, render) | guarded |
| `/components` | ComponentsPage | guarded |
| `/components/new` | ComponentFormPage | guarded |
| `/components/:id` | ComponentDetailPage | guarded |
| `/components/:id/edit` | ComponentFormPage | guarded |
| `*` | redirect to `/` | |

There is no public marketing page, no templates route, and no admin route. `/` is the authenticated dashboard, not a homepage.

## 11. Deployment and environment constraints

- Frontend: Vite static build (`dist/`). No SSR, no SEO metadata beyond the static `index.html` title. Google Fonts loaded by CSS `@import` at runtime.
- Backend: Node 24, pnpm 10.12.1 (`packageManager`), `pnpm install --frozen-lockfile` in CI.
- Backend CI (`.github/workflows/ci.yml`) runs `pnpm vitest run`, `pnpm build`, `pnpm lint` on push and pull request. The frontend has no CI workflow in its checkout.
- Environment variables (names only, from `apps/api/src/config.ts`): `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `MAX_UPLOAD_MB`, `API_BASE_URL`, `GEMINI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`, plus email and storage settings. Values were not read or recorded.
- Backend root contains `.env` (untracked, ignored) and `.env.example` (tracked). Only `.env.example` is tracked.
- Local media files exist under backend `storage/` and `apps/api/storage/`. Six media files under `apps/api/storage/` are tracked in git. This is a hygiene issue (binary test or user data committed to the repo).

## 12. Target architecture (decided in IMPLEMENTATION_DECISIONS.md)

- Frontend: Next.js App Router, with a public marketing site at `/` (static or server-rendered for SEO) and the interactive editor as client components under an authenticated `(app)` segment. Vite code moves into this structure incrementally.
- Backend: unchanged Fastify API, PostgreSQL, Redis/BullMQ, Remotion worker, shared packages.
- Shared rendering: `@app/render` and `@app/schema` published or consumed from the backend workspace through a versioned, reproducible mechanism rather than a sibling-folder junction. Details in `IMPLEMENTATION_DECISIONS.md`.
- Contracts: extend the existing Zod schemas and additive migrations. No destructive changes to `projects.spec` or `scenes`.
