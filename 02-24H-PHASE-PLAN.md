# 24-Hour Phase Plan

The concrete deadline schedule below is authoritative. The older `H0–H24` breakdown remains afterward as a relative dependency guide only; it must not be interpreted as 24 hours still being available.

## Concrete deadline schedule — EAT

### Thursday, 20 August

- **19:00–19:30:** freeze corrected brand, API, rainfall rules, feature priorities and ownership.
- **19:30–20:30:** capture/map real Kijani data, deploy health, scaffold frontend/backend.
- **20:30–23:30:** parallel engine, API, Today UI, Dexie/PWA and provider work; exit with fixture screens and an offline-opening deployed shell.

### Friday, 21 August

- **07:00–10:00:** real phone → API → weather → engine → IndexedDB → UI.
- **10:00–13:00:** explanation, growth timeline, flow-rate minutes, offline logging and seven-day history.
- **14:00–15:30:** rain-adjustment analytics, deterministic comparison, multi-plot/chart polish and P0 validation.
- **15:30:** evaluate the AI stretch gate.
- **15:30–16:30:** at most one contributor and 60 minutes on AI; everyone else hardens.
- **16:30:** feature freeze; disable incomplete AI/P1 work.
- **16:30–18:00:** complete checks, two offline cycles, second-device test and release candidate.
- **18:00–20:00:** rehearsal, backup video, pitch and final deployment.

### Saturday, 22 August

- **07:00–07:30:** smoke-test and submit ahead of the 08:00 hard cutoff.
- No post-submission code changes unless the deployed application is inaccessible.

## Phase overview

| Hours | Goal | Exit gate |
|---|---|---|
| **H0–1** | Freeze contracts; kill deployment/API uncertainty | Everyone can run scaffolds; Kijani endpoint/auth known; API/domain frozen |
| **H1–5** | Five parallel foundations | Each layer works independently from fixtures/stubs |
| **H5–10** | First real vertical loop | Real phone → real server → real weather → real engine → litres |
| **H10–15** | P0 completion | Offline reopen + explanation + deployed flow all work |
| **H15–19** | P1 / polish | Record irrigation, history, minutes, impact; then feature freeze |
| **H19–22** | Harden | Bugs, tests, fallback, second device, release candidate |
| **H22–24** | Rehearse and pitch | Code frozen; full demo practiced repeatedly |

## H0–1 — contract and risk kill

**All tasks in this hour are [MUST].**

### Progress — 20 August 2026

- ✅ Branding, public API shapes, units, crop stages, ownership, Go/React scaffolds, health handler, and initial engine tests are complete.
- 🟡 Local health is verified through `httptest`, not a bound server or deployed URL.
- ⬜ Real Kijani response/auth capture, `kisumu-live.json`, completed Podman build, and Fly credential/deployment proof remain pending, so Gate G0 is not fully green.

- Freeze request/response shapes in `openapi.yaml`.
- Freeze the four canonical crop stages.
- Freeze internal units: m², mm, litres, L/min, °C.
- M5 captures a real KijaniSpace `/v1/agro_climate/water` response and auth method.
- M5 deploys a trivial Go health endpoint to the chosen Fly app, or proves `fly deploy` credentials are ready.
- M1/M4 agree exact IndexedDB repository interfaces.
- M3 writes the first engine tests from hand-calculated examples.
- Everyone verifies local Podman works: `podman --version` and one test image/build.

### Gate G0 at H1

- `main` has frontend + backend scaffolds.
- `/api/v1/health` works locally.
- `openapi.yaml`, stage IDs, and core domain names are frozen.
- Kijani response is saved to `fixtures/weather/kisumu-live.json`.
- Nobody needs another architecture meeting to start coding.

If G0 slips to H2, cut P1 history chart and extra crops immediately.

## H1–5 — parallel foundations

Everything below is **[P]** after G0.

### Progress — 20 August 2026

- ✅ The mobile shell, plot form, Today fixture path, explanation, Go handlers, engine, Dexie repositories, PWA configuration, provider/cache/fallback chain, API client, and container recipe are implemented.
- ✅ The independent backend suites and frontend typecheck/build pass.
- 🟡 The container recipe has not completed a real build, the Kijani adapter has not parsed a captured live payload, and the shell has not reopened offline on a physical phone; Gate G1 remains partially verified.

### M1

- Mobile shell, design tokens, navigation.
- Plot form from catalog fixture.
- Today screen from pinned recommendation fixture.
- Explanation drawer/sheet from explanation-step array.

### M2

- `GET /health`, `GET /catalog`, `POST /recommendations` handlers.
- Validation and shared error envelope.
- Recommendation endpoint wired first to a stub engine/weather object.
- Embedded frontend/static SPA fallback skeleton.

### M3

- Catalog loader/validation.
- Stage derivation from planting date.
- Kc interpolation.
- Hargreaves ETo and rainfall/efficiency/volume pipeline.
- Minimum 10 critical tests passing.

### M4

- Dexie schema/repositories.
- PWA precache.
- Seed fixture data into IndexedDB.
- Prove the shell reopens in airplane mode by H5.

### M5

- Kijani response field mapping.
- Live adapter + in-memory cache + fixture provider.
- Typed frontend fetch wrapper and mocks.
- `Containerfile`, Fly config, deployed skeleton.

### Gate G1 at H5

- UI renders a believable recommendation from fixture.
- Backend endpoint returns same-shaped fixture.
- Engine passes its first core test suite.
- PWA shell opens without internet on a real phone.
- Weather adapter prints/returns parsed real Kijani values.

## H5–10 — first real end-to-end loop

Integrate in this exact order to keep failures local.

### Progress — 20 August 2026

- ✅ Weather → engine → API and UI → IndexedDB → refresh integrations are present, with fixture/fallback behavior exercised by automated checks.
- 🟡 The integrated path has only been verified through tests and builds; it has not run as phone → deployed server → real Kijani.
- ⬜ Gate G2 and the architecture-freeze evidence require a deployed physical-phone run with an authenticated live response.

1. **H5–6 [INT M2+M3]** Replace stub engine with real `Compute`.
2. **H6–7 [INT M2+M5]** Replace stub weather with provider chain.
3. **H7–8 [INT M1+M4]** UI reads/writes plot and recommendation through IndexedDB repositories.
4. **H8–9 [INT M4+M5]** Online refresh calls real backend then persists response locally.
5. **H9–10 [ALL]** Deploy and run on physical Android phone using a real Kisumu location.

### Gate G2 at H10 — architecture freeze

A deployed phone must display a litre recommendation produced from:

```text
real plot inputs + real KijaniSpace weather + real engine
```

If it does not, **all P1 work stops** until it does.

**Architecture freeze at H10:** no new major dependency, service, database, auth layer or data model. Only complete/fix what exists.

## H10–15 — P0 complete

Priority order:

### Progress — 20 August 2026

- ✅ Explanation steps, derived stage/age, confidence/source/freshness presentation, fallback behavior, validation, and responsive layouts are implemented.
- 🟡 The complete saved recommendation path compiles and the PWA is generated, but offline force-close/reopen and mobile visual QA have not been performed.
- ⬜ The deployed smoke test is pending, so Gate G3 is not green and bonus work must remain gated.

1. Offline reopen: force-close with airplane mode, reopen to saved plot + recommendation.
2. Explanation screen shows all intermediate values.
3. Stage chip visibly shows automatically derived stage and age.
4. Weather-source/freshness/confidence badge.
5. Climatology/fixture fallback returns an honest low-confidence recommendation when Kijani fails.
6. Form validation and human-readable errors.
7. Mobile layout polish on actual demo phone.
8. Final P0 test pass and deployed smoke test.

### Gate G3 at H15

P0 Definition of Done is fully green on the deployed URL and physical phone.

If P0 is not green, H15–19 becomes P0-only; do not start P1.

## H15–19 — rich journey, P1 and polish

Only start once G3 is green.

### Progress — 20 August 2026

- ✅ Flow-rate minutes, local irrigation events, manual cumulative flow-meter deltas, seven-day list/chart, rain adjustment, deterministic comparison, multi-plot switching, settings, and the optional insights shell are implemented and pass automated compilation/tests.
- 🟡 These frontend interactions still need browser and physical-phone verification.
- ⛔ AI remains disabled, soil readings remain preview-only context, and automatic sensor/meter hardware adapters are not implemented. These items do not qualify for the feature-freeze release unless their gates are passed.

The Action + History bundle is not generic polish: flow minutes, offline logging and a simple seven-day history are P0. Complete the remaining enhancements in this order:

1. **[MUST]** Optional flow rate → duration minutes.
2. **[MUST]** “I irrigated” writes a local event, including flow-meter start/end readings.
3. **[MUST]** 7-day recommended-versus-applied history list.
4. **[MUST]** Rain-adjustment metric from the explicit no-rain baseline.
5. **[SHOULD]** Install prompt + icon/manifest polish.
6. **[SHOULD]** Tiny history chart.
7. **[SHOULD]** Deterministic “why different from yesterday?” comparison.
8. **[AHEAD]** Multi-plot and settings polish.
9. **[AHEAD]** Calibrated soil-sensor adjuster only after agronomic validation.
10. **[AHEAD]** AI explanation/history insight only under the stretch gate.

### Feature freeze at H19

Anything not merged and working is dropped. No “almost finished” branches survive feature freeze.

## H19–22 — harden

### Progress — 20 August 2026

- ✅ Automated Go tests/vet, TypeScript checking, and production PWA build have passed locally.
- 🟡 Deterministic rainy, dry, fallback, and fixture cases are automated, but the final clean-tree `make check` will be rerun after handoff cleanup.
- ⬜ Container execution, two offline device cycles, two-phone testing, deployed health, screen recording, and release-candidate tagging remain pending; Gate G4 is not green.

- Run `make check` from clean pull.
- Test at least one rainy/reduced case and one dry/irrigate case.
- Test all unit conversions.
- Test Kijani unreachable → fallback.
- Test `AXIS_WEATHER_MODE=fixture` produces pinned demo result.
- Test offline force-close/reopen twice.
- Test on two phones if available.
- Capture successful screen recording.
- Freeze/copy exact demo data and plot inputs into `docs/DEMO_SCRIPT.md`.
- Prepare USB `scrcpy` or other wired mirroring.

### Gate G4 at H22 — code freeze

Tag the release candidate. From here only demo-blocking fixes, each followed by a complete demo rerun.

## H22–24 — demo rehearsal and pitch

### Progress — 20 August 2026

- ⬜ Rehearsal, phone driving/narration roles, live/fixture switching practice, backup video, pitch answers, final deployment, and submission have not started.
- ⛔ No release or submission claim should be made until Gate G4 and the physical-phone demo run pass.

- Full 3–5 minute demo at least three times.
- One person narrates; one person drives phone.
- Practice Kijani/live mode and fixture mode.
- Practice airplane-mode transition.
- Everyone memorizes the engine explanation and the “no backend DB” trade-off.
- Prepare answers for correctness, offline, scalability, and “why not AI?”

## Cut list if behind

Cut in this exact order:

1. AI explanation.
2. Calibrated soil-moisture adjustment.
3. Multi-plot polish.
4. History chart.
5. Yesterday comparison.
6. Crops beyond tomato, maize and kale.
7. Custom install prompt.

Never cut:

- Automatic stage derivation from age.
- Core litres recommendation.
- Explanation.
- Offline reopening with saved answer.
- KijaniSpace path.
- Demo fixture/fallback.
- Deployed HTTPS URL.
