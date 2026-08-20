# Architecture and Frozen Contracts

## 1. Recommended MVP architecture

AXIS is a **local-first PWA with a stateless Go calculation/weather service**.

The device is the system of record for hackathon data. The backend does not know who the farmer is and stores no plots or irrigation events. This sharply reduces deployment and integration risk while preserving the judged user experience.

### Why this is the right scope for 24 productive hours

A server database would force the team to build authentication or identity, CRUD persistence, migrations, conflict rules, offline write queues, server/client reconciliation, persistent volumes, backups, and more API endpoints. None of that makes the core recommendation more convincing to a judge.

IndexedDB already satisfies the important demo requirements: plot details persist, last recommendation persists, irrigation history persists, and the app still works when connectivity disappears.

## 2. Final stack

| Concern | Decision | Hackathon reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fastest agent-supported path; familiar ecosystem. |
| Styling | Tailwind CSS | Fast mobile-first UI, little CSS merge contention. |
| Routing | React Router | Small, predictable route structure. |
| Local data | Dexie over IndexedDB | Typed, reliable local persistence and reactive reads. |
| PWA | vite-plugin-pwa / Workbox | Installable shell and precaching with minimal custom service-worker code. |
| Backend | Go stdlib `net/http` | Minimal dependencies and easy single-binary deployment. |
| Crop config | `go:embed` JSON | Versioned with engine, no configuration service. |
| Weather cache | In-memory Go map with TTL | Enough for transient provider failure; no persistent infrastructure. |
| Container | OCI `Containerfile`, built locally with Podman | Rootless local workflow, no Docker daemon/sudo issues. |
| Deployment | Fly.io, one service | HTTPS and one URL; no volume/database needed. |
| Tests | Go stdlib + frontend typecheck/build | Spend test budget on calculations and contracts, not infrastructure. |
| CI | None | Local `make check` before merge; avoids workflow/debug overhead. |

## 3. Domain contract

These concepts are frozen at H1.

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

## 4. API contract — deliberately tiny

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

Input: the full current plot calculation context.
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
      {"key":"litres","label":"Water to apply","value":2424.6,"unit":"L"}
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
    Daily(ctx context.Context, lat, lon float64, date domain.Date) (domain.WeatherSnapshot, error)
}
```

Normal provider chain:

1. KijaniSpace live.
2. In-memory cached successful snapshot for same rounded location/date.
3. Embedded climatology for the Lake Victoria/Kenya region.

The Kijani client has a three-second timeout and the successful in-memory cache has a 60-minute TTL. Climatology supplies fallback temperature inputs only; its monthly mean rainfall is never credited as a forecast.

Demo mode:

```text
AXIS_WEATHER_MODE=fixture
```

short-circuits to a pinned fixture before any network call.

### KijaniSpace facts verified from the current OpenAPI spec

Use:

```text
GET /v1/agro_climate/water?lat=<lat>&lon=<lon>
```

The endpoint is described as one forecast day of water-relevant temperature, windspeed, and precipitation data. The spec currently gives the 200 response an empty/untyped schema, so **do not invent response field names**. Member 5 must capture one real authenticated response in H0–1 and write the mapping before the adapter is implemented.

The spec advertises Bearer, API-key header/query, and HTTP Basic security alternatives. Obtain/verify whichever credential the organizers provide during the first hour.

For P0, use the `/water` endpoint, not `/land`, because `/water` is directly aligned with this calculation and has fewer fields to interpret.

## 6. Bonus integration boundaries

- `POST /api/v1/insights` is disabled by default. When configured, the backend sends the current deterministic explanation and at most seven selected history records to an OpenAI-compatible provider. The response contains explanatory text only and cannot alter recommendation fields.
- AI credentials remain server-side, no history is persisted by the backend, and provider failure leaves the native explanation untouched.
- Soil-humidity adapters provide timestamped VWC plus optional field-capacity, wilting-point and root-zone calibration. Stale or uncalibrated inputs never affect litres.
- Flow-meter adapters provide cumulative start/end readings; the device stores their difference as measured applied litres.

## 7. Repository structure

```text
axis/
├── README.md
├── Makefile
├── Containerfile                 # M5
├── fly.toml                      # M5
├── openapi.yaml                  # M5, frozen H1
├── fixtures/                     # M3/M5, shared with permission
│   ├── weather/kisumu-live.json
│   ├── weather/kisumu-demo.json
│   └── recommendations/tomato.json
├── docs/
│   ├── AGRONOMY.md               # M3
│   ├── WEATHER_MAPPING.md         # M5
│   └── DEMO_SCRIPT.md             # M5
├── backend/
│   ├── cmd/server/main.go         # M2 wiring
│   ├── internal/
│   │   ├── domain/                # frozen shared types
│   │   ├── httpapi/               # M2
│   │   ├── irrigation/            # M3
│   │   ├── catalog/               # M3
│   │   └── weather/               # M5
│   ├── data/crops.json            # M3
│   └── web/                        # generated Vite build, embedded by M2
└── frontend/
    ├── vite.config.ts              # M4
    └── src/
        ├── app/                     # M1
        ├── screens/                 # M1
        ├── components/              # M1
        ├── db/                      # M4
        ├── hooks/                   # M4
        ├── api/                     # M5 client/types/mocks
        └── screens/history/         # M4
```

## 8. Git/integration strategy

No CI.

- `main` must always be runnable; Member 5 is accountable.
- Use branches lasting **60–90 minutes**, not day-long feature branches.
- Before merge: `make check` locally = Go tests + Go vet + TS typecheck + frontend build.
- Squash merge or fast-forward after a quick human diff.
- Shared contract files (`openapi.yaml`, `backend/internal/domain`, `fixtures/`) require Member 5 approval after H1.
- Every AI-agent prompt begins: **“Only modify files under the ownership path I give you. If another file is required, stop and report it.”**
