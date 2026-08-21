# Five-Person Workstreams — Outcome Record

The M1–M5 split was temporary implementation coordination. It is retained as history; current temporary work belongs in [`docs/TEAM-HANDOFF.md`](docs/TEAM-HANDOFF.md), and durable contributor rules belong in [`AGENTS.md`](AGENTS.md).

Status legend: ✅ implemented and verified; 🟡 implemented but manually unverified; ↪ changed from the original plan; ⛔ intentionally deferred; ⬜ outstanding.

## M1 — Farmer journey UI

- ✅ Implemented the application shell, plot setup/editing, Today, recommendations, explanation, alerts, crop details, responsive layouts, and multi-plot UI.
- ↪ Purpose-built CSS was used instead of the originally suggested Tailwind layouts.
- ✅ The frontend typechecks and builds.
- 🟡 Browser/mobile visual, accessibility, and interaction acceptance remain manual work.

## M2 — Go API and server

- ✅ Implemented health, catalog, recommendation, validation/error, static SPA/fallback, and disabled-insights handlers with Go tests.
- ✅ Wired the deterministic engine and weather provider chain into the stateless service.
- 🟡 A bound container smoke test has recorded verification; deployed HTTPS behavior remains unverified.

## M3 — Irrigation engine and agronomy

- ✅ Implemented catalog validation, crop stages/Kc, provider/Hargreaves ET₀, rain credit, efficiency, litres, duration, SKIP, confidence, comparison, explanations, and golden tests.
- ✅ Kept soil observations contextual and separated flow-meter events from recommendation calculation.
- 🟡 Crop coefficients and the golden Kisumu result still require independent human agronomic review.

## M4 — IndexedDB, PWA, refresh, and history

- ✅ Implemented Dexie repositories for plots, recommendations, irrigation events, catalog, settings, insights, and sensor readings.
- ✅ Implemented IndexedDB-first recommendation display, hourly foreground refresh, reconnect/resume checks, manual refresh, history/chart, and local irrigation logging.
- ✅ Production PWA generation passes the frontend build.
- 🟡 Physical install, force-close/reopen, offline event recording, storage survival, and second-device acceptance remain unverified.

## M5 — Weather, integration, and release

- ✅ Implemented `/v1/agro_climate/land`, generic environment-supplied authentication, rolling hourly mapping, provider timestamps, three-second timeout, memory cache, fixture, and climatology fallback.
- ✅ Added the sanitized Kisumu live fixture, parser regression tests, API client, CI integration, and container path.
- ↪ The original `/water` endpoint and fixed indices `0–23` were corrected.
- ⬜ No `fly.toml`, Fly deployment, deployed HTTPS smoke test, or physical live integration is recorded.
- ⛔ AI remains an optional disabled explanation adapter, not part of irrigation calculation.

## Integration record

| Integration | Outcome |
|---|---|
| Engine → API | ✅ Implemented and tested |
| Weather → API | ✅ Implemented and tested with fixture/live payload |
| IndexedDB → UI | ✅ Implemented; 🟡 device acceptance pending |
| Online refresh → stored advice | ✅ Implemented; 🟡 browser timing acceptance pending |
| Static PWA → Go server/container | ✅ Build and container path verified |
| Deployed service → physical phone | ⬜ Outstanding |

Before handoff, run `mise run check`. Treat container, live-provider, browser, deployment, and physical-device results as separate evidence.
