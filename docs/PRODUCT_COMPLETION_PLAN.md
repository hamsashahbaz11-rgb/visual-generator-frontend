# Product Completion Plan

Source of truth: `ARCHITECTURE_AND_CONTRACTS.md`, `FEATURE_ACCEPTANCE_MATRIX.md`, `IMPLEMENTATION_DECISIONS.md` in this folder.

## Audit summary

Verified and working:
- Backend: 459 tests pass, workspace build passes, lint has 0 errors.
- Frontend: typecheck passes, production build passes, 172 tests pass.
- Deterministic layout and motion engine, scene evaluator, render lifecycle, scene render jobs, asset upload and streaming, transcripts, OpenRouter AI pipeline with bounded agent.
- Editor components: canvas, selection, inspector, animation authoring, timeline, AI panel, render panel.

Not present or broken:
- Next.js migration, public marketing homepage, SEO.
- Google sign-in, admin role, plans, entitlements, usage limits, discount codes, manual grants.
- Project aspect ratio (landscape/portrait/square) and layout presets.
- Video clips, audio elements with volume/trim, captions, scene transitions, targeted or full-screen effects.
- Undo/redo.
- Shared `@app/render` depends on a sibling-folder junction, which breaks remote builds.
- Frontend CI and lint.
- Six tracked media files under backend `apps/api/storage/`.

## Prompt 2 — Platform foundation and product data contracts

Goal: make the project buildable from a clean checkout, add the missing data contracts additively, and migrate the frontend to Next.js without losing functionality. Each task lists acceptance criteria.

### P2-1. Shared rendering dependency (blocker first)
1. Confirm backend remote URL is reachable from a clean clone. (Owner input if not.)
2. Replace `file:` dependency with a pinned git subdirectory dependency or the documented fallback from D-02.
3. Add `prepare` or build step so `dist/` exists after install.
- Acceptance: `git clone` of the frontend to an empty folder, then `npm install` and `npm run build`, succeeds with no sibling folder present.

### P2-2. Frontend CI and lint
1. Add ESLint config mirroring backend rules.
2. Add `.github/workflows/ci.yml` for frontend: install, typecheck, test, build, lint.
- Acceptance: CI green on clean clone. Lint has 0 errors.

### P2-3. Repository hygiene
1. Untrack `tsconfig.tsbuildinfo` and `tsconfig.node.tsbuildinfo`.
2. Remove stale `vite.config.js` and `vite.config.d.ts` (after confirming `vite.config.ts` is the only config).
3. Confirm no test depends on `apps/api/storage/*`, then `git rm --cached` those files and add a fixtures folder if needed.
4. Backend: fix the 26 lint warnings (unused imports and variables). No behavior change.
- Acceptance: lint has 0 warnings in both repos; tests still pass.

### P2-4. Additive migrations (backend)
1. Verify `0004_snapshot.json` matches current `schema.ts` (run `drizzle-kit generate` with no changes and expect "No schema changes").
2. Add migration `0005`: `users.role` (default `user`), `projects.aspect` (default `landscape`).
3. Add migration `0006`: `plans`, `user_entitlements`, `usage_counters`, `discount_codes`, `discount_redemptions`, `access_grants`.
4. Add migration `0007` (only if D-07 is confirmed): `oauth_identities`.
- Acceptance: migrations apply to a copy of an existing database with existing projects intact (row counts unchanged, `aspect` = `landscape`).

### P2-5. Schema contracts (backend `packages/schema`)
1. Add `aspect` enum and dimension mapping (landscape 1920x1080, portrait 1080x1920, square 1080x1080).
2. Add element schemas: `videoClip`, `audio` (volume, trimStart, trimEnd), `caption` (cues with start/end/text).
3. Add layout preset registry: screen-only, picture-in-picture presenter, circular webcam overlay, vertical presenter-and-screen, side-by-side.
- Acceptance: schema tests for each new type; existing `VideoSpec` and `SceneDocument` fixtures still validate unchanged.

### P2-6. Evaluator and renderer parity (backend `packages/render`, worker)
1. Implement evaluator support for new element types.
2. Worker composition renders `videoClip`, `audio`, `caption` through the same evaluated tree.
3. Add golden test: same scene document, same frame, editor evaluator and worker evaluator produce identical transforms.
- Acceptance: golden test green; worker test renders a fixture scene containing each new element type.

### P2-7. Authorization and admin groundwork (backend)
1. Add `requireAdmin` guard. Add tests: 403 for non-admin, 200 for admin.
2. Add ownership tests for project and scene routes (user B blocked from user A's data).
- Acceptance: new tests green; existing 459 tests still green.

### P2-8. Next.js migration (frontend)
1. Scaffold Next.js App Router in the frontend repo.
2. Port routes per `IMPLEMENTATION_DECISIONS.md` D-01 route map.
3. Mark editor components `"use client"`. Dynamic-import canvas and timeline with `ssr: false`.
4. Keep Zustand auth read client-side only (no SSR token access).
5. Port the 172 tests to run against the Next components (Vitest + jsdom). Keep Vite build until parity.
- Acceptance: `next build` succeeds, all existing 172 tests pass, every route in the route map renders, and no route silently disappears.

### P2-9. Public homepage and SEO (frontend)
1. Marketing homepage at `/` (static), with title, description, Open Graph tags.
2. `robots.txt` and `sitemap.xml`.
- Acceptance: homepage HTML contains title and description without JavaScript; metadata test passes.

## Prompt 3 — Product features on top of the foundation

Ordered by dependency.

### P3-1. Editor reliability
1. Undo/redo stack in document store (command history, bounded depth). Tests: 10 edits then 10 undos restore original.
2. Autosave with debounce, retry, and visible save state. Tests: failed save retains local state and shows error.
3. Element trimming via timeline drag. Test: drag handle updates `timing.duration`.
4. Group UI: create, nest, move, ungroup. Tests per operation.

### P3-2. Project format and layout presets (editor)
1. Format picker (landscape, portrait, square) on project create and in project settings. Updates composition dimensions.
2. Layout preset picker applied to a scene; inspector shows preset-owned elements as editable.
- Acceptance: switching format reflows preset rectangles; preview and render dimensions match.

### P3-3. Media in scenes
1. Add images, video clips, and audio elements from the asset library to a scene.
2. Video clip trim (in/out) and audio trim and volume in the inspector.
3. Background audio, narration, and voice track separation.
- Acceptance: each element type appears in preview and in a rendered MP4 (automated render test with a fixture).

### P3-4. Captions
1. Create captions from a transcript (existing transcript data) into caption elements.
2. Caption editor: edit text and timing per cue.
3. Render captions in the worker composition.
- Acceptance: transcript-to-caption test; caption rendered in worker test.

### P3-5. Transitions and effects
1. Scene transitions (fade, slide, wipe) as scene-level keyframes.
2. Full-screen effects and targeted effects (element or region) as keyframe tracks.
3. Effect controls in inspector.
- Acceptance: evaluator tests and parity golden test for each effect type.

### P3-6. AI workflows
1. Multi-scene creation from prompt through the existing planner, with validated output.
2. Iterative edit commands through the bounded agent.
3. Make provider selection in the UI real (remove hardcoded `gemini`), or document the removal.
- Acceptance: mocked-provider tests for each operation; live smoke test documented as blocked on keys if not run.

### P3-7. Rendering reliability
1. Failed render recovery: retry action, clear error state.
2. Progress and status polling shows queued, running, complete, failed, cancelled.
3. Output parity check against editor preview on a golden fixture.
- Acceptance: integration test on job failure and retry; download test for MP4.

### P3-8. Google sign-in
1. Backend OAuth routes and identity storage (requires credentials: BLOCKED until owner provides OAuth client).
2. Frontend sign-in button and callback route.
- Acceptance: mocked OAuth provider test; live test blocked on credentials.

### P3-9. Admin and entitlements
1. Admin UI at `/admin` guarded by role check.
2. Plans and entitlement enforcement on render count and AI calls (402 with code).
3. Manual access grants and discount codes (create, validate, redeem, expire, exhaust).
- Acceptance: tests for each guard, limit, and redemption rule.

## Blockers requiring owner action

| Item | Needed from owner |
|---|---|
| Frontend clean-clone build | Confirm backend remote and release branch (`upgrade`) for the git dependency. |
| Google sign-in | OAuth client ID and secret, and allowed redirect URIs. |
| Live AI | `GEMINI_API_KEY` and `OPENROUTER_API_KEY` for live smoke tests. |
| Live rendering | Chromium and ffmpeg in CI runner. |
| S3 storage | Bucket and credentials if production uses S3. |
| Payment provider | Not required for Prompt 2 or 3; choose later. |

## Not done in Prompt 1

- No code migrations, no Next.js scaffold, no schema changes, no git operations. Prompt 1 is the audit and planning stage.
- No live external services were called.
