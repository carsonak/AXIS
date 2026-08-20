# First-Hour Checklist

The first hour exists to remove dependencies, not to build polished screens.

## Current progress — 20 August 2026

- ✅ Product naming, contracts, ownership, frontend/backend scaffolds, engine tests, Dexie/PWA setup, provider abstractions, fallback data, and local handler checks are complete.
- 🟡 The container recipe and Kijani parser exist but have not been verified with a completed container run or real authenticated response.
- ⬜ Physical-phone PWA testing and the Fly deployment path remain unproven and are owned by M4/M5.
- ⛔ Bonus AI and sensor adjustment remain outside the first-hour/P0 gate.

## All five together — minute 0–15

- [x] Confirm product name: **AXIS — Agricultural Excellence in Irrigation Schemes**.
- [x] Confirm one-sentence pitch: “AXIS tells a farmer how many litres of water a specific plot needs today, using crop age and weather, and keeps that advice available offline.”
- [x] Freeze the three core API endpoints: health, catalog, recommendations. The optional insights endpoint remains gated.
- [x] Freeze the four stage IDs: establishing, developing, productive, maturing.
- [x] Freeze internal units: m², mm, litres, L/min, °C.
- [x] Confirm no backend database, no auth, no CI.
- [x] Confirm owners M1–M5.
- [x] Pin freeze times: H10 architecture, H19 features, H22 code.

## Member 1 — minute 15–60

- [x] Create/verify React + TypeScript + Vite app.
- [x] Implement purpose-built responsive CSS; Tailwind was deliberately not added.
- [x] Add the four-destination routes used by the final navigation: Today, Plots, History, More, plus plot creation/editing.
- [x] Build mobile shell and Today screen using fixture data.
- [x] Implement crop-age control accepting weeks/days and returning a planting-date anchor.
- [x] Isolate the frontend implementation in its own logical commit.

## Member 2 — minute 15–60

- [x] Initialize Go module.
- [x] Create frozen domain/request/response types from `openapi.yaml`.
- [x] Add `GET /api/v1/health`.
- [x] Add implemented `GET /api/v1/catalog` and `POST /api/v1/recommendations` handlers.
- [x] Add `httptest` coverage for health, catalog, recommendations, errors, SPA serving, and disabled insights.
- [x] Isolate backend implementation in its own logical commit.

## Member 3 — minute 15–60

- [x] Embed the revised root `crops.json` catalog in the backend.
- [x] Create stage-boundary test table for tomato.
- [x] Create the pinned Hargreaves Kisumu test.
- [x] Create drip-vs-furrow test asserting furrow requires more gross water.
- [x] Add `AGRONOMY.md` with assumptions and calculation boundaries.
- [x] Include engine/catalog work in the isolated backend commit.

## Member 4 — minute 15–60

- [x] Install/configure Dexie.
- [x] Create device-local tables for plots, recommendations, irrigation events, catalog, settings, insights, and sensor readings.
- [x] Implement typed repository functions consumed by the UI.
- [x] Configure `vite-plugin-pwa`, manifest, and source-only fallback behavior.
- [ ] Identify demo phone and verify browser/PWA install capability.
- [x] Include offline/history work in the isolated frontend commit.

## Member 5 — minute 15–60

- [ ] Call/authenticate `GET https://api.kijanispace.eu/v1/agro_climate/water?lat=-0.0917&lon=34.7680` using the organizer-provided auth method.
- [ ] Save raw response as `fixtures/weather/kisumu-live.json`.
- [x] Write `docs/WEATHER_MAPPING.md` with provisional aliases, units, nullable behavior, and an explicit live-verification warning.
- [ ] Record whether the live response exposes ETo and/or precipitation probability. Do not assume either.
- [x] Commit frozen `openapi.yaml`.
- [x] Create the corrected `Containerfile`; completing a Podman build and local health check remains pending.
- [ ] Verify Fly credentials/app and deploy the health endpoint or complete `fly launch --no-deploy` so deployment risk is known.

## Hour-one exit gate

At H1:

- [x] `main` contains both frontend and backend scaffolds.
- [x] Every developer can start work without waiting on another implementation.
- [x] Contract files are frozen.
- [ ] Real Kijani response/auth is known and saved.
- [x] Local health handler returns 200 in automated in-process tests; a bound-port smoke test remains pending.
- [ ] Podman works for the team.
- [ ] Deployment path is proven or the exact blocker is known and owned by M5.

If these are not true, do not start P1 or visual polish. Fix the foundations first.
