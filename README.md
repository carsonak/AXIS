# AXIS

**Agricultural Excellence in Irrigation Schemes** is an offline-friendly web app that turns crop age, plot area, irrigation method, and weather into an explainable daily irrigation recommendation.

AXIS answers a practical question for a specific plot: how many litres should be applied today, and for how long when the irrigation flow rate is known?

## How it works

1. A farmer creates a plot with its crop, planting date or age, area, location, irrigation method, and optional flow rate.
2. AXIS obtains a rolling 24-hour forecast from KijaniSpace or uses an explicitly labeled fallback.
3. A deterministic agronomy engine derives the crop stage and calculates crop-water replacement, forecast-rain credit, irrigation efficiency, litres, and optional runtime.
4. The complete recommendation and explanation are stored in device-local IndexedDB so they remain available offline.
5. While the app is open and online, existing advice refreshes hourly. Farmers can also refresh it manually.

## Current capabilities

- Four consistent crop stages with crop-specific durations and coefficients.
- Provider ET₀ when available, with Hargreaves ET₀ fallback.
- Explainable `IRRIGATE`, `REDUCED`, and `SKIP` decisions.
- KijaniSpace `/v1/agro_climate/land` integration, three-second timeout, memory cache, climatology fallback, and deterministic fixture mode.
- Offline plots, recommendations, irrigation events, settings, sensor context, and seven-day history.
- Same-day irrigation feedback: locally logged water is summed per plot and subtracted by the deterministic engine from the weather-adjusted daily target; offline displays are clearly based on the last saved target until reconciliation.
- Deterministic quick explanations remain available offline, while unmatched custom assistant questions use the optional AI provider and show explicit failures instead of fabricated fallback answers.
- Manual irrigation records and cumulative flow-meter start/end entry.
- Data source, confidence, last refresh, and provider-model timestamps.
- Optional AI explanations behind a disabled-by-default server feature flag. AI never calculates or changes irrigation values.

Automated Go checks, frontend typechecking/building, the sanitized live Kijani payload, and the container path are verified. Deployment and physical-device offline acceptance remain separate manual checks; see [the current team handoff](docs/TEAM-HANDOFF.md).

## Run locally

Install [Mise](https://mise.jdx.dev/), then run:

```bash
mise install
npm ci --prefix frontend
mise run build
AXIS_WEATHER_MODE=fixture mise run run
```

Open `http://localhost:8080`.

A source-only checkout embeds a small backend status page. `mise run build` generates the PWA into `backend/web/dist`; generated bundles are intentionally not committed.

## Live weather

The canonical list of environment variables, defaults, accepted formats, and safe placeholders is maintained in [`.env.example`](.env.example). Never commit credentials.

## Verify changes

```bash
npm ci --prefix frontend
mise run check
```

`mise run check` runs Go tests and vet plus frontend typechecking and a production build. Browser, service-worker, deployment, provider, container, and physical-device checks must be recorded separately.

## Safety and privacy boundaries

- The deterministic engine is authoritative; AI may only explain its existing output.
- AXIS estimates daily crop-water replacement, not the field's complete soil-water deficit.
- Soil-humidity readings are context only until a calibrated adjustment model is locally and agronomically validated.
- Flow-meter volume is calculated from manually entered cumulative end minus start readings; automatic hardware ingestion is not implemented.
- Farmer data remains in device-local IndexedDB. The backend is stateless and has no farmer authentication or synchronization service.

## Documentation

- [Bird's-eye guide](00-BIRDS-EYE.md)
- [Architecture and contracts](01-ARCHITECTURE-AND-CONTRACTS.md)
- [Implementation history](02-24H-PHASE-PLAN.md)
- [Agronomy engine](04-ENGINE-AND-CROP-STAGES.md)
- [Offline/PWA behavior](05-OFFLINE-PWA.md)
- [Kijani weather mapping](docs/WEATHER_MAPPING.md)
- [Current handoff and manual verification](docs/TEAM-HANDOFF.md)
