# Five-Person Workstreams

Every task is labeled so developers know whether to start immediately or wait.

## Member 1 — Frontend Lead / Farmer Journey

**Primary ownership**

`frontend/src/pages` except history, `frontend/src/components.tsx`, `frontend/src/context.tsx`, `frontend/src/styles.css`, and public assets.

**Progress — 20 August 2026:** 🟡 The four-destination shell, plot form, Today dashboard, stage timeline, explanation, responsive styling, alerts, and multi-plot UI are implemented and typecheck/build successfully. Physical-phone visual and interaction QA remains pending. Styling was implemented with purpose-built CSS rather than Tailwind.

**P0 deliverables**

- [P][MUST] App shell and mobile navigation.
- [P][MUST] Plot setup form: location, crop, crop age, area, irrigation method.
- [P][MUST] Age UX: accept days/weeks or exact date, convert to planting-date anchor.
- [P][MUST] Today screen with litre hero number, stage chip, time window, confidence/freshness badge.
- [P][MUST] “Why?” explanation sheet from generic step array.
- [D: M4 repository signatures][INT] Switch screen reads/writes from fixture to IndexedDB.
- [D: M5 API client][INT] Trigger recommendation refresh via M4's data-layer action.

**First tasks after H1**

1. Six base components: Button, Card, Input, Select/Tile, Badge, BottomSheet.
2. Today screen rendering the pinned recommendation fixture.
3. Plot form with big tap targets and area-unit conversion UI.
4. Age control and derived-stage preview from a mock helper.

**Integration points**

- M4 supplies `plotRepo`, `recommendationRepo` and live hooks.
- M5 supplies typed API client/mock response.
- M3 supplies stage names and explanation-step semantics through frozen contract.

**Fallback work if blocked**

Explanation screen, empty/loading/error states, app icon, install education, demo screenshots.

**Good AI-agent work**

React components, Tailwind layouts, form validation, accessibility labels, fixture-driven states.

---

## Member 2 — Go API / Server Shell

**Primary ownership**

`backend/cmd/server`, `backend/internal/httpapi`, frontend asset embedding/serving.

**Progress — 20 August 2026:** ✅ Health, catalog, recommendations, validation/errors, engine/weather wiring, static SPA/fallback serving, and the disabled-by-default insights shell are implemented and covered by Go tests. 🟡 Bound-port and deployed HTTPS smoke tests remain pending.

**P0 deliverables**

- [P][MUST] `GET /api/v1/health`.
- [P][MUST] `GET /api/v1/catalog`.
- [P][MUST] `POST /api/v1/recommendations` request validation and error envelopes.
- [P][MUST] Unit conversion helpers at HTTP boundary if any alternative unit enters the API; preferred API shape remains m² only.
- [P][MUST] Static compiled PWA served from same Go origin with SPA fallback.
- [AHEAD] Feature-flagged `POST /api/v1/insights` shell. It returns explanation text only and never recommendation fields.
- [D: M3 `Compute` signature][INT] Wire engine.
- [D: M5 `Provider` signature][INT] Wire weather.

**First tasks after H1**

1. Go module and structured logger.
2. Health route.
3. Handlers with stubbed interfaces.
4. `httptest` contract tests against `openapi.yaml` examples.
5. Static asset handler.

**Dependencies**

Only interface signatures, never another member's completed implementation. Stub both weather and engine from minute one.

**Fallback work if blocked**

Request validation, HTTP tests, Makefile targets, server-side panic recovery, debug logs.

**Good AI-agent work**

Handler skeletons, DTOs, validation tables, HTTP tests, static-file serving.

---

## Member 3 — Irrigation Engine / Agronomy / Crop Stages

**Primary ownership**

`backend/internal/irrigation`, `backend/internal/catalog`, root `crops.json`, `docs/AGRONOMY.md`.

**Progress — 20 August 2026:** ✅ The catalog, stage/Kc/ETo/rain/efficiency/volume/duration/SKIP/confidence pipelines, deterministic comparisons, golden fixture, and critical tests are complete. 🟡 A second human agronomic sanity check remains pending; ⛔ sensor adjustment remains validation-gated.

**P0 deliverables**

- [P][MUST] Crop config loader and startup validation.
- [P][MUST] Age/planting-date → canonical stage calculation.
- [P][MUST] Kc interpolation across stage boundaries.
- [P][MUST] Hargreaves ETo.
- [P][MUST] Rainfall reduction logic.
- [P][MUST] Efficiency correction.
- [P][MUST] mm × m² → litres.
- [P][MUST] Explanation-step output.
- [P][MUST] Confidence/warnings.
- [P][MUST] At least 12 critical unit tests.

**First tasks after H1**

1. Write test table before implementation.
2. Implement stage derivation and boundary tests.
3. Implement ETo and hand-check one Kisumu example.
4. Implement volume pipeline.
5. Produce the golden recommendation fixture that M1/M2/M5 share.

**Dependencies**

None after frozen domain types. M3 is deliberately unblocked.

**Integration point**

M2 imports `irrigation.Compute` by H5–6.

**Fallback work if blocked**

`AGRONOMY.md`, manual calculations, comparison with FAO references, sanity-check demo values.

**Good AI-agent work**

Test scaffolding and JSON validation. **Do not accept generated equations or coefficients without human verification.**

---

## Member 4 — Offline / IndexedDB / PWA / History

**Primary ownership**

`frontend/src/db.ts`, client data hooks/state, `frontend/vite.config.ts`, `frontend/src/pages/HistoryPage.tsx`.

**Progress — 20 August 2026:** 🟡 Dexie repositories, saved recommendations, irrigation events, history list/chart, freshness, local analytics, PWA generation, insight cache, sensor context, and manual flow-meter deltas are implemented and compile. The required physical-phone offline reopen and offline-recording cycles remain pending.

**P0 deliverables**

- [P][MUST] Dexie schema: `plots`, `recommendations`, `events`, `catalog`, `settings`.
- [P][MUST] Typed repository interfaces agreed with M1.
- [P][MUST] Service-worker/app-shell precache.
- [P][MUST] Offline reopen on physical Android phone.
- [P][MUST] Persist new recommendation locally after successful online refresh.
- [P][MUST] Freshness helper: current / saved today / stale / fallback.
- [P][MUST] Local “I irrigated” event and 7-day recommended-versus-applied list.
- [P][MUST] Flow-meter event support using cumulative end minus start readings.
- [D: M5 API wrapper][INT] `refreshRecommendation(plot)` network action.

**P1 deliverables**

- [SHOULD] Tiny history chart and deterministic previous-day comparison.
- [SHOULD] Rain-adjustment aggregation from the explicit no-rain baseline.
- [AHEAD] Cached AI insights and soil-sensor reading repository.

**First tasks after H1**

1. Create Dexie schema.
2. Define exact repository function signatures with M1.
3. Seed fixture plot/recommendation into DB.
4. Configure PWA and test offline shell before doing history.

**Dependencies**

No backend required for the local data layer. Use fixtures until M5 API wrapper is ready.

**Fallback work if blocked**

History, freshness logic, offline banners, install prompt, phone/mirroring setup.

**Good AI-agent work**

Dexie repositories, hooks, date/freshness helpers, local history, PWA manifest boilerplate.

---

## Member 5 — Weather / Integration / Deployment Owner

**Primary ownership**

`backend/internal/weather`, `frontend/src/api.ts`, `fixtures`, `openapi.yaml`, `Containerfile`, the planned `fly.toml`, integration docs and `main` health.

**Progress — 20 August 2026:** ✅ The provider abstraction, fixture, climatology, three-second Kijani client, one-hour memory cache, API client, and parser tests are implemented. 🟡 The container recipe is prepared but not run to completion. ⬜ Real Kijani capture, `fly.toml`, Fly deployment, and physical integration remain pending. ⛔ The AI adapter exists only as a disabled bonus scaffold.

**P0 deliverables**

- [P][MUST] Real KijaniSpace response capture and field mapping.
- [P][MUST] `weather.Provider` interface and Kijani adapter.
- [P][MUST] In-memory TTL cache.
- [P][MUST] Climatology fallback.
- [P][MUST] `AXIS_WEATHER_MODE=fixture` deterministic provider.
- [P][MUST] Typed frontend API client + mock.
- [P][MUST] Podman local container path.
- [P][MUST] Fly deployment and HTTPS URL.
- [INT][MUST] Keep `main` runnable and coordinate H5–10 integrations.
- [AHEAD] AI provider adapter only if the stretch gate passes; credentials stay server-side.

**First tasks in H0–1**

1. Authenticate against `/v1/agro_climate/water` and save a real response.
2. Write `docs/WEATHER_MAPPING.md` before parser code.
3. Verify API key handling via environment variable/secret.
4. Commit frozen `openapi.yaml`.
5. Deploy `GET /health` skeleton.

**Dependencies**

None. M5 owns the external dependency and deployment uncertainty directly.

**Fallback work if Kijani is blocked**

Finish provider interface/fixture/climatology and keep the whole application moving. Continue trying to resolve credentials in parallel, but do not let the rest of the team wait.

**Good AI-agent work**

HTTP client boilerplate, fixture parser tests, cache wrapper, Containerfile, fetch client. Human must verify field mapping and fallback ordering.

---

# Parallel/dependency board

| Task | Owner | Label | Dependency |
|---|---|---|---|
| UI shell | M1 | [P] | H1 contract freeze |
| Plot form | M1 | [P] | catalog fixture |
| Today screen | M1 | [P] | recommendation fixture |
| HTTP routes | M2 | [P] | H1 API freeze |
| Recommendation handler stub | M2 | [P] | frozen DTOs |
| Engine | M3 | [P] | domain types only |
| Stage model | M3 | [P] | crops.json |
| Dexie repositories | M4 | [P] | repository signatures |
| PWA shell | M4 | [P] | frontend scaffold |
| Kijani adapter | M5 | [P] | live response/auth only |
| Deploy skeleton | M5 | [P] | Fly credentials |
| Engine → API | M2+M3 | [INT] | M3 core tests green |
| Weather → API | M2+M5 | [INT] | adapter parses fixture/live response |
| IndexedDB → UI | M1+M4 | [INT] | repository API stable |
| Real API → device | M4+M5 | [INT] | deployed backend |
| Full phone demo | All | [INT] | above integrations |

# Merge discipline without CI

Before any merge to `main`, the author runs:

```bash
make check
```

which should do approximately:

```bash
cd backend && go test ./... && go vet ./...
cd frontend && npm run typecheck && npm run build
```

M5 may block a merge if it modifies another member's owned directory or a frozen shared contract without coordination.
