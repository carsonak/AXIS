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
- ✅ A bound container smoke test and isolated Fly HTTPS/API smoke tests have recorded verification; production release verification remains separate.

## M3 — Irrigation engine and agronomy

- ✅ Implemented catalog validation, crop stages/Kc, provider/Hargreaves ET₀, rain credit, efficiency, litres, duration, SKIP, confidence, comparison, explanations, and golden tests.
- ✅ Kept soil observations contextual and separated flow-meter events from recommendation calculation.
- 🟡 Crop coefficients and the golden Kisumu result still require independent human agronomic review.

## M4 — IndexedDB, PWA, refresh, and history

- ✅ Implemented Dexie repositories for plots, recommendations, irrigation events, catalog, settings, insights, sensor readings, immutable decision snapshots, and bounded timeline weather.
- ✅ Implemented IndexedDB-first recommendation display, hourly foreground refresh, reconnect/resume checks, manual refresh, history/chart, local irrigation logging, event/end-of-day snapshots, and cached historical/forecast timeline rendering.
- ✅ Production PWA generation passes the frontend build.
- 🟡 Physical install, force-close/reopen, offline event recording, storage survival, and second-device acceptance remain unverified.

## M5 — Weather, integration, and release

- ✅ Implemented `/v1/agro_climate/land`, generic environment-supplied authentication, rolling hourly mapping, provider timestamps, three-second timeout, memory cache, fixture, and climatology fallback.
- ✅ Added the sanitized Kisumu live fixture, parser regression tests, API client, CI integration, and container path.
- ↪ The original `/water` endpoint and fixed indices `0–23` were corrected.
- ✅ Added `fly.toml`; isolated Fly HTTPS, live Kijani, timeline, recommendation-feedback, and responsive browser smoke checks are recorded. Production and physical-device acceptance remain separate.
- ⛔ AI remains an optional disabled explanation adapter, not part of irrigation calculation.

## Integration record

| Integration | Outcome |
|---|---|
| Engine → API | ✅ Implemented and tested |
| Weather → API | ✅ Implemented and tested with fixture/live payload |
| IndexedDB → UI | ✅ Implemented; 🟡 device acceptance pending |
| Online refresh → stored advice | ✅ Implemented; 🟡 browser timing acceptance pending |
| Static PWA → Go server/container | ✅ Build and container path verified |
| Open-Meteo/Kijani → weather timeline | ✅ Automated, container, and isolated-deployment evidence recorded |
| Deployed service → responsive browser | ✅ Isolated smoke flow recorded |
| Deployed service → physical phone | ⬜ Outstanding |

Before handoff, run `mise run check`. Treat container, live-provider, browser, deployment, and physical-device results as separate evidence.
