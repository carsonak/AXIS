# First-Hour Checklist

The first hour exists to remove dependencies, not to build polished screens.

## All five together — minute 0–15

- [ ] Confirm product name: **AXIS — Agricultural Excellence in Irrigation Schemes**.
- [ ] Confirm one-sentence pitch: “AXIS tells a farmer how many litres of water a specific plot needs today, using crop age and weather, and keeps that advice available offline.”
- [ ] Freeze the three API endpoints: health, catalog, recommendations.
- [ ] Freeze the four stage IDs: establishing, developing, productive, maturing.
- [ ] Freeze internal units: m², mm, litres, L/min, °C.
- [ ] Confirm no backend database, no auth, no CI.
- [ ] Confirm owners M1–M5.
- [ ] Pin freeze times: H10 architecture, H19 features, H22 code.

## Member 1 — minute 15–60

- [ ] Create/verify React + TypeScript + Vite app.
- [ ] Configure Tailwind.
- [ ] Add routes: `/`, `/plot/new`, `/plot/:id`, `/plot/:id/history`.
- [ ] Build mobile shell and one Today card using fixture data.
- [ ] Implement crop-age control accepting weeks/days and returning a planting-date anchor.
- [ ] Commit only M1-owned paths.

## Member 2 — minute 15–60

- [ ] Initialize Go module.
- [ ] Create frozen domain/request/response types from `openapi.yaml`.
- [ ] Add `GET /api/v1/health`.
- [ ] Add empty/stub `GET /catalog` and `POST /recommendations` handlers.
- [ ] Add one `httptest` health test.
- [ ] Commit only M2-owned paths.

## Member 3 — minute 15–60

- [ ] Copy revised `crops.json` into backend data path.
- [ ] Create stage-boundary test table for tomato.
- [ ] Create Hargreaves Kisumu test expected around 4.66 mm/day for the pinned Aug-20 example.
- [ ] Create drip-vs-furrow test asserting furrow requires more gross water.
- [ ] Start `AGRONOMY.md` with assumptions and FAO-56 citation.
- [ ] Commit only M3-owned paths.

## Member 4 — minute 15–60

- [ ] Install/configure Dexie.
- [ ] Create five tables: plots, recommendations, irrigationEvents, catalog, settings.
- [ ] Agree repository function signatures with M1 in writing.
- [ ] Configure `vite-plugin-pwa` and placeholder manifest.
- [ ] Identify demo phone and verify browser/PWA install capability.
- [ ] Commit only M4-owned paths.

## Member 5 — minute 15–60

- [ ] Call/authenticate `GET https://api.kijanispace.eu/v1/agro_climate/water?lat=-0.0917&lon=34.7680` using the organizer-provided auth method.
- [ ] Save raw response as `fixtures/weather/kisumu-live.json`.
- [ ] Write `docs/WEATHER_MAPPING.md`: raw provider field → AXIS field, units, nullable behavior.
- [ ] Record whether the live response exposes ETo and/or precipitation probability. Do not assume either.
- [ ] Commit frozen `openapi.yaml`.
- [ ] Create `Containerfile` and prove `podman build -f Containerfile .` starts the health endpoint locally, or get as far as possible with the available scaffold.
- [ ] Verify Fly credentials/app and deploy the health endpoint or complete `fly launch --no-deploy` so deployment risk is known.

## Hour-one exit gate

At H1:

- [ ] `main` contains both frontend and backend scaffolds.
- [ ] Every developer can start work without waiting on another implementation.
- [ ] Contract files are frozen.
- [ ] Real Kijani response/auth is known and saved.
- [ ] Local health endpoint returns 200.
- [ ] Podman works for the team.
- [ ] Deployment path is proven or the exact blocker is known and owned by M5.

If these are not true, do not start P1 or visual polish. Fix the foundations first.
