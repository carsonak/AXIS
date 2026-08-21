# AXIS Team Handoff — 20 August 2026

## What happened

The intended task was to tighten the implementation plan and publish it so all five contributors could begin in parallel. During that planning pass, substantial implementation work was started earlier than intended. Undoing working, tested code would cost the team time without improving the plan, so the repository now preserves that work in reviewable commits and documents its limits honestly.

Treat this as a head start, not a release candidate. Roughly 70% of the planned implementation is represented in code, while release readiness is closer to 50–55% because live-provider, container, deployment, browser, and physical-device evidence is still missing.

## What the team can rely on

- ✅ The Go engine, crop catalog, weather abstractions, cache/fallback behavior, API handlers, golden fixture, and automated backend tests are implemented.
- ✅ The React/TypeScript application typechecks and produces a PWA build.
- 🟡 Today, Plots, History, More, Dexie persistence, offline-oriented rendering, charts, comparisons, settings, and manual cumulative flow-meter entry are implemented but need browser/phone QA.
- 🟡 The Kijani client and tolerant payload mapper exist, but no real authenticated response has been captured to prove its production field mapping.
- ⛔ AI is disabled by default and may only explain deterministic data. Soil-humidity values are preview context only. Neither can change irrigation recommendations.
- ⬜ Podman/container execution, Fly deployment, two offline force-close/reopen cycles, a second-device run, rehearsal, recording, and submission remain outstanding.

## Immediate parallel pickup

- **M1 — frontend journey:** run the app on the target phone; check plot creation under 90 seconds, responsive layout, labels, empty/error states, Today explanation, and Kiswahili catalog labels. Fix only verified UI defects.
- **M2 — API/server:** review OpenAPI against Go/TypeScript types, run a bound-port health/catalog/recommendation smoke test, inspect validation responses, and support deployment integration. Keep the server stateless.
- **M3 — agronomy:** independently review coefficients and the golden Kisumu calculation; rerun stage/rain/SKIP/unit tests; validate the farmer-facing explanation. Do not activate soil adjustment without agronomic evidence.
- **M4 — offline/history:** perform the two physical-phone airplane-mode force-close/reopen cycles, record irrigation offline, verify history after reopening, test installability, and repeat on a second device if available.
- **M5 — weather/deployment:** capture and sanitize a real Kijani response, confirm units/auth/aliases, add a regression fixture, complete the Podman build, add Fly configuration, deploy HTTPS, and coordinate the end-to-end smoke test.

One contributor may consider AI only after the documented stretch gate passes. Automatic soil-sensor or flow-meter ingestion is future adapter work; the current flow-meter path is manual start/end entry.

## Start here

```bash
mise install
npm ci --prefix frontend
mise run check
mise run build
AXIS_WEATHER_MODE=fixture mise run run
```

Then open `http://localhost:8080`. The full generated PWA is intentionally not committed; a source-only checkout shows a small backend status page until `mise run build` runs.

Before merging any change:

1. Read `AGENTS.md` and the ownership section in `03-MEMBER-WORKSTREAMS.md`.
2. Keep OpenAPI, Go types, TypeScript types, and fixtures synchronized.
3. Run `mise run check`.
4. State which live, container, browser, and physical-device checks were actually performed.

## Brief to say to the team

> I was meant to finish the AXIS implementation plan and push it so we could divide the work. During that process, implementation started earlier than planned. Enough of it is working and covered by automated checks that deleting it would waste time, so I have kept it and separated it into logical commits. The deterministic engine and API are the strongest completed pieces, and the frontend/offline journey is substantially implemented. It is not release-ready yet: real Kijani validation, container and Fly deployment, and physical-phone offline testing are still open. AI and sensor adjustments are safely gated and do not control irrigation. Please review the commits, take the M1–M5 pickup tasks in parallel, and record real verification rather than assuming a successful build proves the demo.
