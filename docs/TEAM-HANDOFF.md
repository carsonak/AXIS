# AXIS Team Handoff

This is the current home for temporary ownership, release work, and manual verification. Durable product rules live in [`AGENTS.md`](../AGENTS.md).

## Current status

Legend: ✅ verified; 🟡 implemented but manually unverified; ↪ changed from the original plan; ⛔ intentionally deferred; ⬜ outstanding.

- ✅ Deterministic engine, contracts, Go tests/vet, frontend typecheck/build, CI, sanitized live Kijani capture/parser, and container build/runtime have recorded verification.
- ✅ Kijani uses the `/v1/agro_climate/land` endpoint and request-time-aligned rolling hourly forecasts.
- 🟡 The IndexedDB-first PWA, hourly foreground refresh, reconnect/resume refresh, manual refresh, history, plots, settings, and irrigation logging are implemented but still need browser and physical-device acceptance.
- ⛔ AI remains disabled by default; soil-humidity adjustment and automatic sensor/flow-meter ingestion remain gated.
- ⬜ Fly configuration/deployment, deployed HTTPS smoke testing, two offline force-close/reopen cycles, second-device testing, rehearsal, recording, and submission are not verified in this repository.

## Temporary ownership

- **M1 — farmer journey:** responsive Today/plot/recommendation UI and browser acceptance.
- **M2 — API/server:** handlers, contracts, static serving, and deployment support.
- **M3 — agronomy:** engine, catalog, golden fixtures, tests, and independent coefficient review.
- **M4 — offline/history:** Dexie, PWA behavior, refresh lifecycle, irrigation events, and device acceptance.
- **M5 — weather/release:** Kijani integration, fallback/cache, container, deployment, and release coordination.

Ownership describes coordination, not permission to ignore cross-cutting contracts. Keep changes small and synchronize contract representations first.

## Remaining manual verification

- [ ] Run the generated PWA in a browser and confirm cached advice renders before an online refresh.
- [ ] Confirm hourly refresh, manual refresh, reconnect, foreground resume, and failure preservation against a live backend.
- [ ] Install/open on the target phone, enable airplane mode, force-close/reopen twice, and verify plots, advice, explanations, and history survive.
- [ ] Record irrigation offline and confirm it remains after reopening.
- [ ] Repeat the critical flow on a second device or browser profile.
- [ ] Independently review crop coefficients and the golden Kisumu agronomy result.
- [ ] Add deployment configuration only when deployment is authorized; then verify `/api/v1/health`, static routing, HTTPS, and live Kijani from the deployed service.
- [ ] Rehearse and record the exact demo flow before making a release/submission claim.

## Handoff commands

```bash
mise install
npm ci --prefix frontend
mise run check
mise run build
AXIS_WEATHER_MODE=fixture mise run run
```

State which automated, container, provider, browser, deployment, and physical-device checks were actually performed. Do not infer one from another.
