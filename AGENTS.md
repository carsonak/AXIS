# AXIS Agent Guide

These invariants apply to every human or AI contributor working in this repository.

## Product and safety boundaries

- The product name is **AXIS — Agricultural Excellence in Irrigation Schemes**.
- The deterministic irrigation engine is authoritative. AI may explain or summarize its results, but must never calculate or change litres, minutes, confidence, or `IRRIGATE` / `REDUCED` / `SKIP`.
- AXIS estimates daily crop-water replacement. It does not claim to measure the field's complete soil-water deficit.
- Farmer plots, recommendations, irrigation events, sensor context, settings, and cached insights remain in device-local IndexedDB. Do not add backend persistence, authentication, or synchronization during the hackathon build.
- Do not simulate sensor observations and present them as real. Soil-humidity readings remain contextual until a calibrated adjustment model has been locally and agronomically validated.
- Flow-meter volume is the validated difference between cumulative end and start readings. Manual entry exists; automatic hardware ingestion does not yet exist.

## Calculation invariants

- Internal units are square metres, millimetres, litres, litres per minute, and degrees Celsius. Convert display units only at system boundaries.
- `1 mm × 1 m² = 1 litre`. Irrigation efficiency is applied by division.
- Crop stage identifiers are `establishing`, `developing`, `productive`, and `maturing`. `stage_day` is one-based; crops beyond their configured duration remain in `maturing` with a warning.
- Forecast rain below 2 mm or below 40% probability receives no credit. At or above the probability threshold, credit 80%; when probability is unavailable, credit 50%.
- Never deduct climatological average rainfall as though it were a forecast.
- Gross modeled requirements below 1 mm produce `SKIP` and zero application while retaining the sub-threshold deficit in the explanation.
- Weather sources are `KIJANISPACE`, `MEMORY_CACHE`, `CLIMATOLOGY`, and `DEMO_FIXTURE`. Hargreaves confidence is at most `MEDIUM`; climatology and demo fixtures are `LOW`.
- Rain adjustment means `max(0, baseline_litres_no_rain - recommended_litres)` and must be labeled “Water avoided because rain was considered.”

## Contracts and offline behavior

- Keep `openapi.yaml`, Go domain types, TypeScript types, fixtures, and examples synchronized whenever a contract changes.
- The Today screen must render its last complete stored recommendation from IndexedDB before attempting a refresh. Preserve freshness, source, and confidence indicators.
- The backend must remain stateless for farmer data. The optional insights endpoint accepts only the current deterministic explanation and at most seven explicitly selected history rows.
- AI credentials stay on the server. AI is disabled by default, failures never block Today, and successful output is labeled as AI-generated.
- The live Kijani call uses a three-second timeout and a 60-minute successful-response memory cache before climatology fallback.

## Repository hygiene and verification

- Do not commit `AXIS.webp`, secrets, `node_modules`, TypeScript build metadata, generated Vite JavaScript declarations, or `backend/web/dist` bundles.
- Generated PWA output belongs in `backend/web/dist`; a committed fallback page keeps a source-only checkout runnable.
- Preserve unrelated work and stage explicit paths. Avoid broad cleanup or destructive Git commands.
- Run `mise run check` before handing off. Record container, deployment, live-provider, browser, and physical-device checks separately; a successful compile does not prove those environments.
- Keep incomplete AI and hardware integrations disabled or clearly labeled as previews. Do not turn a scaffold into a product claim.

## Ownership

- M1: Today, plot/crop screens, timeline, explanation, responsive UI.
- M2: Go server, contracts, handlers, static serving, optional insights shell.
- M3: agronomy engine, catalog, deterministic analytics, golden fixtures and tests.
- M4: Dexie, PWA/offline behavior, irrigation events, history and local analytics.
- M5: Kijani provider, cache/fallback, deployment and optional provider adapters.

When a change crosses ownership boundaries, coordinate the contract first and keep the commit small enough to review during the hackathon.
