# AXIS Team Handoff

This is the current home for temporary ownership, release work, and manual verification. Durable product rules live in [`AGENTS.md`](../AGENTS.md).

## Current status

Legend: ✅ verified; 🟡 implemented but manually unverified; ↪ changed from the original plan; ⛔ intentionally deferred; ⬜ outstanding.

- ✅ Deterministic engine, contracts, Go tests/vet, frontend typecheck/build, CI, sanitized live Kijani capture/parser, and container build/runtime have recorded verification.
- ✅ Kijani uses the `/v1/agro_climate/land` endpoint and request-time-aligned rolling hourly forecasts.
- 🟡 The IndexedDB-first PWA, hourly foreground refresh, reconnect/resume refresh, manual refresh, history, plots, settings, and irrigation logging are implemented but still need browser and physical-device acceptance.
- ⛔ AI remains disabled by default; soil-humidity adjustment and automatic sensor/flow-meter ingestion remain gated.
- ✅ The isolated `axis-irrigation-dev` Fly deployment, HTTPS health endpoint, live Kijani request, deterministic irrigation-feedback request, and safe JSON rejection wording have recorded verification.
- ⬜ Browser acceptance, two offline force-close/reopen cycles, second-device testing, rehearsal, recording, and submission are not verified in this repository.

## Fly weather finding — 2026-08-22

The deployed `axis-irrigation` app reports live weather mode, but `flyctl secrets list --app axis-irrigation` confirms that `KIJANISPACE_API_KEY` is absent. This is the root cause of the observed climatology fallback: the live provider rejects the request locally as unconfigured, and the previously deployed fallback chain does not log that error. Configure the credential without exposing it in shell history or documentation, then deploy this branch and verify that a Kisumu recommendation reports `weather.source: KIJANISPACE` or emits one of the new safe failure categories.

The isolated Fly app `axis-irrigation-dev` does not affect production. Its nine staged variables, including the dev-only AI timeout, report `Deployed`; their values were never printed. `GET /api/v1/health` returned `status: ok`, live weather mode, and AI enabled.

The initially staged Kijani URL ended in `/v1/agro_climate/water`. Authentication succeeded, but the provider returned HTTP 400 with the safe diagnostic `not water` for the Kisumu land coordinate. After changing only the dev app URL to `/v1/agro_climate/land`, the same stateless request returned `weather.source: KIJANISPACE`, provider time `2026-08-21T20:52:00Z`, and a 0.1 mm forecast. This proves the dev fallback was an endpoint/coordinate-kind mismatch, not an authentication failure. The new production logger did not expose credentials, authorization headers, request bodies, or provider response bodies.

The deployed irrigation-feedback smoke test returned a positive daily target, subtracted logged water once, and returned `SKIP`, zero remaining litres, no runtime, and the already-applied headline when 12,000 L exceeded the 11,000 L rounded target. Unknown IndexedDB metadata and malformed JSON both returned HTTP 400 with distinct safe wording. The staged AI provider remained unavailable across two attempts because its request exceeded the server's eight-second timeout; the endpoint returned the explicit safe 502 response and left the deterministic recommendation unchanged.

## Fly AI timeout finding — 2026-08-22

The configurable AI timeout and structured provider-failure classification were deployed to `axis-irrigation-dev`. With the default 30-second timeout, a stateless English insight request succeeded with HTTP 200 in 8.09 seconds. The dev-only `AXIS_AI_TIMEOUT` setting was then changed to `20s`; the same request returned a safe timeout response after 20.27 seconds. The corresponding application log classified it as `TIMEOUT` with `duration_ms: 20000`, while startup reported an AI timeout of 20 seconds and a server write timeout of 25 seconds. After the final build was deployed, another request at the 20-second setting succeeded with HTTP 200 in 11.89 seconds. This confirms the earlier 20-second result was the AI client deadline rather than the server write deadline, and shows substantial provider latency variance between consecutive requests.

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
- [x] Verify `/api/v1/health`, HTTPS, live Kijani, irrigation feedback, and JSON validation on the isolated dev deployment.
- [ ] Verify browser static routing and the complete browser flow against the isolated dev deployment.
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
