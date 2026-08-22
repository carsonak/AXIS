# First-Hour Checklist — Outcome Record

This historical checklist records the foundation decisions made at the start of the build.

Status legend: ✅ implemented and verified; 🟡 implemented but manually unverified; ↪ changed from the original plan; ⛔ intentionally deferred; ⬜ outstanding.

## Product and contracts

- ✅ Product name, pitch, internal units, API contracts, four crop-stage IDs, and device-local persistence model were established.
- ✅ Go and React/TypeScript/Vite scaffolds, health/catalog/recommendation endpoints, shared domain types, and initial tests were created.
- ↪ The original “no CI” assumption changed: GitHub Actions now runs `mise run check`.
- ✅ No backend farmer database or farmer authentication was introduced.

## Frontend and offline foundation

- ✅ Responsive application shell, routes, plot forms, Today, crop-age capture, Dexie repositories, and PWA build configuration are implemented.
- ↪ Purpose-built CSS replaced the tentative Tailwind plan.
- 🟡 Target-phone installation and offline force-close/reopen remain manual acceptance work.

## Engine foundation

- ✅ Catalog embedding, stage boundaries, Hargreaves, rain/efficiency/unit behavior, golden fixture, and critical tests are implemented.
- 🟡 Independent human agronomic review remains outstanding.

## Weather and release foundation

- ✅ The authenticated live response is sanitized in `fixtures/weather/kisumu-live.json` and covered by parser tests.
- ↪ Land coordinates use `/v1/agro_climate/land`; the original `/water` assumption was removed.
- ✅ Forecast temperature, precipitation, probability, windspeed, ET₀, timestamps, fallback, timeout, and cache paths are implemented.
- ✅ Container build/runtime has recorded verification.
- ✅ `fly.toml` and isolated development deployment/health verification are recorded. Production release and physical-device verification remain outstanding.

## Exit-gate result

The code foundations and contracts passed; a later isolated development deployment passed its recorded smoke checks, while production and physical-device gates remain open. Those outstanding checks remain in [`docs/TEAM-HANDOFF.md`](docs/TEAM-HANDOFF.md) and must not be inferred from automated builds.
