# Architecture and Frozen Contracts

## Current implementation

- ✅ The OpenAPI shapes, Go domain types, crop catalog, deterministic recommendation handler, errors, weather-source normalization, container build/runtime smoke tests, and live KijaniSpace authenticated integration are complete and covered by automated tests.
- ✅ Farmer persistence remains device-local; the Go backend is stateless for plots, recommendations, events, sensors, and insights.
- ✅ Static PWA serving works in automated handler tests and production builds; an isolated Fly deployment and responsive browser smoke flow are recorded. Production and physical-device behavior remain separate checks.
- ⛔ Soil-humidity input is returned as context only. AI is disabled unless every server-side feature flag and provider setting is present.

## 1. Recommended MVP architecture

AXIS is a **local-first PWA with a stateless Go calculation/weather service**.

The device is the system of record for farmer data. The backend does not know who the farmer is and stores no plots or irrigation events. This reduces deployment and data-governance risk while preserving offline use.

### Why this is the right scope for 24 productive hours

A server database would force the team to build authentication or identity, CRUD persistence, migrations, conflict rules, offline write queues, server/client reconciliation, persistent volumes, backups, and more API endpoints. None of that makes the core recommendation more convincing to a judge.

IndexedDB already satisfies the important demo requirements: plot details persist, last recommendation persists, irrigation history persists, and the app still works when connectivity disappears.

## 2. Final stack

| Concern | Decision | Hackathon reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fastest agent-supported path; familiar ecosystem. |
| Styling | Purpose-built CSS | Implemented mobile-first styling without an additional runtime dependency. |
| Routing | React Router | Small, predictable route structure. |
| Local data | Dexie over IndexedDB | Typed, reliable local persistence and reactive reads. |
| PWA | vite-plugin-pwa / Workbox | Installable shell and precaching with minimal custom service-worker code. |
| Backend | Go stdlib `net/http` | Minimal dependencies and easy single-binary deployment. |
| Crop config | `go:embed` JSON | Versioned with engine, no configuration service. |
| Weather cache | In-memory Go map with TTL | Enough for transient provider failure; no persistent infrastructure. |
| Container | OCI `Containerfile`, built locally with Podman | Rootless local workflow, no Docker daemon/sudo issues. |
| Deployment | Fly.io, one service | HTTPS and one URL; no volume/database needed. |
| Tests | Go stdlib + Vitest/Testing Library + ESLint + TypeScript/build | Cover calculations, contracts, refresh coordination, snapshots, timeline transforms, and core components. |
| CI | GitHub Actions + Mise | Runs Go tests/vet and frontend tests/lint/typecheck/build on pull requests to any target branch and pushes to `main`. |

## 3. Domain contract

These are the current domain concepts. Change them only through a synchronized contract update.

### Device-only `Plot`

```ts
type Plot = {
  id: string;                 // UUID generated in browser
  name: string;
  lat: number;
  lon: number;
  areaM2: number;             // internal unit only
  cropId: string;
  plantingDate: string;       // YYYY-MM-DD; derived once from crop age if needed
  plantingDateEstimated: boolean;
  irrigationMethodId: string;
  flowRateLpm?: number;       // optional P0; enables duration
  createdAt: string;
  updatedAt: string;
};
```

The recommendation request may also include the latest timestamped `soil_moisture` observation. It is validated and returned as sensor context, but does not change litres until a calibrated adjuster is agronomically approved. Flow-meter measurements belong to device-local irrigation events because they describe actual water applied after a recommendation.

### Crop age rule

The farmer is asked **“How old is this crop?”** during plot setup. The UI accepts days or weeks and immediately converts that answer to a date anchor:

```text
plantingDate = today - cropAgeDays
```

From then onward AXIS computes age from `today - plantingDate`. The farmer does **not** have to update crop age every day, and AXIS does not store a drifting `ageDays` field.

If the farmer knows the exact planting/transplanting date, the form can accept that directly; otherwise `plantingDateEstimated=true`.

### Uniform crop stages

All crops use the same four canonical stage IDs:

```text
ESTABLISHING → DEVELOPING → PRODUCTIVE → MATURING
```

Farmer-facing labels:

- **Establishing** — “Germinating / establishing”
- **Developing** — “Growing / developing”
- **Productive** — “Flowering / fruiting / peak growth”
- **Maturing** — “Maturing / nearing harvest”

The labels are deliberately broad enough to work across tomatoes, maize, onions, beans and leafy vegetables. Internally they map to FAO-56 Initial / Development / Mid-season / Late-season stages.

### Backend request type

The server does not receive a stored Plot object by ID. It receives the calculation inputs every time:

```json
{
  "plot": {
    "id": "local-uuid",
    "name": "Tomato plot",
    "lat": -0.0917,
    "lon": 34.7680,
    "area_m2": 1011.71,
    "crop_id": "tomato",
    "planting_date": "2026-06-12",
    "planting_date_estimated": false,
    "irrigation_method_id": "drip",
    "flow_rate_lpm": 45
  },
  "date": "2026-08-20"
}
```

`date` is optional; server defaults to today in Africa/Nairobi.

## 4. API contract — stateless and calculation-focused

Base path: `/api/v1`.

### `GET /health`

Purpose: deployment smoke test.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "engine_version": "0.1.0",
  "weather_mode": "live"
}
```

### `GET /catalog`

Purpose: initial/refreshed crop and irrigation configuration. The PWA mirrors it into IndexedDB so plot creation still works offline after first load.

Representative response:

```json
{
  "schema_version": "2.0.0",
  "engine_version": "0.1.0",
  "stages": [
    {"id":"establishing","display_name":"Germinating / establishing"},
    {"id":"developing","display_name":"Growing / developing"},
    {"id":"productive","display_name":"Flowering / fruiting / peak growth"},
    {"id":"maturing","display_name":"Maturing / nearing harvest"}
  ],
  "crops": [
    {"id":"tomato","display_name":"Tomato","total_days":135,"confidence":"HIGH","stage_days":{"establishing":30,"developing":40,"productive":40,"maturing":25}}
  ],
  "irrigation_methods": [
    {"id":"drip","display_name":"Drip","efficiency":0.90,"preferred_window":"EARLY_MORNING"}
  ]
}
```

### `POST /recommendations`

Purpose: the single business endpoint.

Input: the full current plot calculation context plus the device-local sum of water already logged for that plot and Nairobi-local date. Optional before/after sensor readings remain corroborating context only.
Output: recommendation + weather provenance + explanation steps.

Representative response:

```json
{
  "plot_id": "local-uuid",
  "date": "2026-08-20",
  "generated_at": "2026-08-20T15:10:00Z",
  "engine_version": "0.1.0",
  "crop_stage": {
    "id": "productive",
    "display_name": "Flowering / fruiting / peak growth",
    "crop_age_days": 74,
    "stage_day": 5
  },
  "decision": {
    "action": "REDUCED",
    "litres": 2400,
    "litres_exact": 2424.6,
    "daily_target_litres": 2400,
    "daily_target_litres_exact": 2424.6,
    "applied_today_litres": 0,
    "gross_depth_mm": 2.4,
    "modeled_gross_depth_before_threshold_mm": 2.4,
    "duration_minutes": 55,
    "recommended_window": "EARLY_MORNING",
    "headline": "Apply a rain-adjusted 2,400 litres today, preferably early morning.",
    "baseline_litres_no_rain": 6021.8,
    "rain_adjustment_litres": 3597.2
  },
  "weather": {
    "source": "DEMO_FIXTURE",
    "t_min_c": 17.4,
    "t_max_c": 28.8,
    "rain_next_24h_mm": 4.0,
    "rain_probability": 0.55,
    "et0_mm": 4.658136182389694,
    "et0_method": "HARGREAVES"
  },
  "explanation": {
    "steps": [
      {"key":"et0","label":"Weather water demand","value":4.66,"unit":"mm"},
      {"key":"kc","label":"Crop factor","value":1.15,"unit":""},
      {"key":"etc","label":"Estimated crop water use","value":5.36,"unit":"mm"},
      {"key":"rain","label":"Forecast rain credited","value":3.2,"unit":"mm"},
      {"key":"efficiency","label":"Drip efficiency","value":90,"unit":"%"},
      {"key":"area","label":"Plot area","value":1011.7,"unit":"m²"},
      {"key":"baseline","label":"Without forecast rain","value":6021.8,"unit":"L"},
      {"key":"daily_target","label":"Today's adjusted target","value":2424.6,"unit":"L"},
      {"key":"applied_today","label":"Already irrigated today","value":0,"unit":"L"},
      {"key":"litres","label":"Remaining amount to apply","value":2424.6,"unit":"L"}
    ]
  },
  "confidence": {
    "level": "LOW",
    "reasons": ["Deterministic demo weather"]
  },
  "sensor_context": {
    "soil_moisture_connected": false,
    "used_for_adjustment": false,
    "status": "NOT_CONNECTED",
    "reason": "AXIS is operating in sensor-free model mode."
  },
  "warnings": []
}
```

This example is generated by `go run ./backend/cmd/golden` and pinned by an engine test against `fixtures/recommendations/tomato.json`.

### `GET /weather/history`

Returns at most 14 requested past Africa/Nairobi dates from Open-Meteo reanalysis. Hourly values and daily summaries are explicitly labeled `OPEN_METEO`; modeled shallow-soil values are weather-model context, not field-sensor observations.

### `POST /weather/forecast`

Accepts the complete device-local plot calculation input and returns today plus at most five Kijani provider-supplied future dates. Each available future day is run independently through the deterministic engine with zero future applied water. The endpoint does not manufacture climatology forecast days.

### `POST /insights`

Accepts one current deterministic recommendation, a question, and at most seven explicitly selected local-history rows. It is disabled by default, stores no farmer data, and returns explanation text only; provider failure cannot alter or block deterministic advice.

### Important errors

- `400 VALIDATION_FAILED`
- `400 UNKNOWN_CROP`
- `400 UNKNOWN_IRRIGATION_METHOD`
- `400 INVALID_DATE`
- `422 INVALID_WEATHER_INPUT` only if all normal weather/fallback sources are invalid
- `500 INTERNAL` for programming faults only

KijaniSpace downtime should **not** normally cause a 5xx; it should fall back and report lower confidence.

## 5. Weather provider contract

```go
type Provider interface {
    Daily(ctx context.Context, lat, lon float64, requestedAt time.Time) (domain.WeatherSnapshot, error)
}
```

Normal provider chain:

1. KijaniSpace live.
2. In-memory cached successful snapshot for same rounded location/date.
3. Embedded climatology for the Lake Victoria/Kenya region.

The Kijani client has a three-second timeout and the successful in-memory cache has a 60-minute TTL. Existing advice is refreshed hourly while the PWA is active and online, with reconnect/resume and manual triggers. Climatology supplies fallback temperature inputs only; its monthly mean rainfall is never credited as a forecast.

Demo mode:

```text
AXIS_WEATHER_MODE=fixture
```

short-circuits to a pinned fixture before any network call.

### KijaniSpace facts verified from the live API

Use:

```text
GET /v1/agro_climate/land?lat=<lat>&lon=<lon>
```

The live endpoint serves multi-day hourly weather and agro-climatic forecasts. The adapter finds the first forecast timestamp at or after the recommendation time and aggregates the following available 24 aligned samples. Kijani credentials come only from `KIJANISPACE_API_KEY`, which supports HTTP Basic credentials, prefixed Basic/Bearer authorization values, and unprefixed provider tokens/API keys. A sanitized live payload for Kisumu (`-0.0917`, `34.7680`) is committed as `fixtures/weather/kisumu-live.json` and covered by parser regression tests. The `/water` endpoint is reserved for water bodies and is not used for farm plots.

## 6. Bonus integration boundaries

- `POST /api/v1/insights` is disabled by default. When configured, the backend sends the current deterministic explanation and at most seven selected history records to an OpenAI-compatible provider. The response contains explanatory text only and cannot alter recommendation fields.
- AI credentials remain server-side, no history is persisted by the backend, and provider failure leaves the native explanation untouched.
- Provider timeouts, network failures, HTTP rejections, malformed responses, and empty responses have distinct safe API codes and structured log categories. Logs may include status, provider request ID, and duration, but never credentials, authorization headers, request bodies, or provider response bodies. The canonical environment-variable reference is [`.env.example`](.env.example).
- The current soil-humidity preview accepts timestamped VWC plus optional field-capacity, wilting-point and root-zone calibration. Stale or uncalibrated inputs never affect litres, and the adjustment model remains inactive.
- The current flow-meter path accepts manually entered cumulative start/end readings and stores their difference as measured applied litres. Automatic hardware ingestion remains a future adapter.

## 7. Repository structure

```text
axis/
├── .github/workflows/ci.yaml
├── AGENTS.md
├── Containerfile
├── README.md
├── mise.toml
├── openapi.yaml
├── crops.json / climatology.json
├── fixtures/
│   ├── recommendations/tomato.json
│   └── weather/{kisumu-demo,kisumu-live,kisumu-timeline}.json
├── docs/
├── backend/
│   ├── cmd/{server,golden}/
│   ├── internal/{catalog,domain,httpapi,insights,irrigation,weather}/
│   └── web/{fallback,dist}/
└── frontend/
    ├── public/
    └── src/{pages and shared TypeScript modules}
```

`fly.toml` defines the stateless service deployment shape. Deployment state, credentials, and manual verification are operational evidence rather than architectural guarantees; see `docs/TEAM-HANDOFF.md`.

## 8. Integration and verification

GitHub Actions runs the repository-wide Mise check for pull requests to any target branch and pushes to `main`.

- Before merge: `mise run check` locally = Go tests + Go vet + frontend unit/component tests + ESLint + TypeScript typecheck + frontend production/PWA build + backend build.
- Keep `openapi.yaml`, Go domain types, TypeScript types, fixtures, and examples synchronized.
- Record live-provider, container, browser, deployment, and physical-device checks independently of compilation.
- Temporary ownership and release tasks live in `docs/TEAM-HANDOFF.md`, not in the architectural contract.
