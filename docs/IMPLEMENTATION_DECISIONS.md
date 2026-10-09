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
