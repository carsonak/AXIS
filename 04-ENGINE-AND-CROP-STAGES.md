# Irrigation Engine and Uniform Crop-Stage Model

Owner: **Member 3**. The engine is pure, deterministic, and contains no HTTP/database/network code.

## Current progress — 20 August 2026

- ✅ Catalog validation, one-based stage derivation and boundaries, Kc interpolation, Hargreaves ETo, rain thresholds, efficiency, unit conversion, duration, rounding, SKIP behavior, confidence, deterministic comparisons, and rain-adjustment baselines are implemented and tested.
- ✅ The golden recommendation fixture is exercised by the engine test suite.
- 🟡 Crop coefficients and the Kisumu demo result still need a second human agronomic sanity check before release.
- ⛔ Soil-humidity adjustment remains deliberately inactive until its calibration model is validated; readings can only appear as non-authoritative context.

## 1. Farmer-facing crop-stage model

AXIS asks for crop age at least once and then automatically derives one of four universal stages.

| Canonical ID | Farmer-facing text | FAO-56 mapping | Meaning |
|---|---|---|---|
| `establishing` | Germinating / establishing | Initial | emergence/transplant establishment, small canopy |
| `developing` | Growing / developing | Development | canopy expands; Kc rises toward peak |
| `productive` | Flowering / fruiting / peak growth | Mid-season | maximum/near-maximum crop water demand |
| `maturing` | Maturing / nearing harvest | Late-season | senescence/ripening/harvest transition |

The third label includes multiple biological descriptions because not all supported crops have an obvious farmer-visible flowering/fruiting period; the canonical concept is **peak water-use stage**.

### Age capture

UI supports either:

- exact planting/transplanting date; or
- age in days/weeks.

If age is used:

```text
estimated planting date = today's Nairobi date - age in days
```

That date is stored locally. The crop's age automatically increases with calendar time.

### Stage derivation

Each crop has four stage durations in `crops.json`.

Example tomato:

```json
"stage_days": {
  "establishing": 30,
  "developing": 40,
  "productive": 40,
  "maturing": 25
}
```

For age `DAP` (days after planting):

```text
0 .. 29     → establishing
30 .. 69    → developing
70 .. 109   → productive
110 .. 134  → maturing
> 134       → maturing + past-expected-harvest warning
```

Boundary convention must be tested and used consistently across all crops.

## 2. Engine interface

```go
type Input struct {
    Plot struct {
        ID                    string
        Name                  string
        Lat, Lon              float64
        AreaM2                float64
        CropID                string
        PlantingDate          domain.Date
        PlantingDateEstimated bool
        IrrigationMethodID    string
        FlowRateLPM           *float64
    }
    Weather domain.WeatherSnapshot
    Date    domain.Date
}

func Compute(in Input, catalog domain.Catalog) (domain.IrrigationRecommendation, error)
```

No `time.Now()` inside `Compute`; date is an input.

## 3. Calculation pipeline

### Step 1 — crop age and stage

```text
DAP = Date - PlantingDate
```

Reject DAP < 0. Warn for DAP beyond expected crop duration.

### Step 2 — Kc

Config stores three FAO Kc anchors:

- `kc.establishing` = Kc initial
- `kc.productive` = Kc mid
- `kc.maturing` = Kc end

Rules:

- establishing: flat `Kc_establishing`
- developing: linear interpolation from establishing to productive
- productive: flat `Kc_productive`
- maturing: linear interpolation from productive to final `Kc_maturing`

This preserves FAO-56 stage behavior while presenting simpler stage names.

### Step 3 — reference ETo

If a real Kijani field is conclusively identified as daily reference ETo with compatible units, the adapter may pass it through and mark method `PROVIDER`.

Otherwise P0 uses Hargreaves:

```text
J  = day of year
φ  = latitude in radians
dr = 1 + 0.033 cos(2πJ/365)
δ  = 0.409 sin(2πJ/365 - 1.39)
ωs = acos(clamp(-tanφ tanδ, -1, 1))
Ra_MJ = (24*60/π) * 0.0820 * dr *
        [ωs sinφ sinδ + cosφ cosδ sinωs]
Ra_mm = 0.408 * Ra_MJ
ETo = 0.0023 * (Tmean + 17.8) * sqrt(Tmax-Tmin) * Ra_mm
```

FAO-56 states Equation 52 uses ETo and Ra in mm/day; the `0.408` conversion converts extraterrestrial radiation from MJ/m²/day to equivalent evaporation depth before applying the Hargreaves form.

Clamp implausible ETo to `[0.5, 12]` mm/day and emit a warning. Reject invalid `Tmax < Tmin` weather and let the weather provider fallback chain try another source.

A Kisumu sanity example for 20 Aug, latitude about -0.09°, Tmin 17.4°C and Tmax 28.8°C gives Hargreaves ETo of roughly **4.7 mm/day**; use the implementation test to pin the exact value.

### Step 4 — crop water requirement

```text
ETc = Kc × ETo
```

### Step 5 — effective forecast rainfall

The current Kijani OpenAPI description guarantees precipitation conceptually, but not exact response fields or a probability field. Therefore implement rainfall logic around optional data rather than assuming probability exists.

If probability is available:

```text
if forecast_mm < 2.0 or probability < 0.40:
    credited_forecast = 0
else:
    credited_forecast = 0.80 × forecast_mm
```

If probability is absent:

```text
if forecast_mm < 2.0:
    credited_forecast = 0
else:
    credited_forecast = 0.50 × forecast_mm
```

The 50% credit is an explicit conservative hackathon heuristic intended to avoid trusting an uncertain forecast as if it were guaranteed rain. Mark confidence one level lower and document the assumption.

If weather source is `CLIMATOLOGY`, credited rainfall is always zero. A monthly mean is not a forecast and must never be subtracted as if rain were expected today.

Then:

```text
Pe = min(ETc, credited_forecast)
IRn = max(0, ETc - Pe)
```

Do not attempt a multi-day soil-water balance in P0.

### Step 6 — irrigation efficiency

```text
IRg = IRn / efficiency
```

**Divide, never multiply.** Lower-efficiency methods must require more gross water than drip for identical crop/weather inputs.

### Step 7 — litres

```text
LitresExact = IRg_mm × AreaM2
```

because:

```text
1 mm over 1 m² = 1 litre
```

### Step 8 — duration, if flow exists

```text
minutes = litres / flow_rate_lpm
```

P1 only; the core recommendation remains litres.

### Step 9 — action

- `< 1.0 mm` gross requirement → `SKIP`
- rainfall reduced but requirement remains → `REDUCED`
- otherwise → `IRRIGATE`

P0 does not need soil-dependent split applications.

## 4. Rounding

Store exact values for analytics; round only display values.

- litres < 1,000 → nearest 10 L
- litres ≥ 1,000 → nearest 50 L
- minutes → nearest 5 min
- depth → 1 decimal place
- Kc → 2 decimal places

Avoid fake precision.

## 5. Confidence

Suggested logic:

**HIGH**

- live/recent weather,
- known crop,
- exact planting date or clear age,
- standard crop data confidence HIGH.

**MEDIUM**

Any one of:

- planting date estimated from an approximate age,
- Hargreaves instead of provider ETo,
- rainfall probability unavailable,
- crop data confidence MEDIUM.

**LOW**

- climatology fallback,
- generic vegetable crop,
- demo fixture should be labeled `DEMO_FIXTURE` even if deterministic.

Confidence is not a statistical probability. It is a transparent data-quality label.

## 6. P0 validation

- area `(0, 100000]` m²
- latitude/longitude within the supported Kijani/Lake Victoria deployment footprint for the demo; UI may still store another location but server should report unsupported-provider bounds clearly
- crop exists
- irrigation method exists
- efficiency `(0,1]`
- planting date not in future
- crop age not absurdly beyond 400 days for current crop catalog
- flow, if present, `(0,10000]` L/min
- `Tmax >= Tmin`
- final litres finite and non-negative

## 7. Critical tests

At minimum:

1. Tomato mid/peak stage, drip, no rain → plausible litres.
2. Same input with rain → litres decrease and action `REDUCED` or `SKIP`.
3. Same input furrow vs drip → furrow litres > drip litres.
4. 1 acre conversion at UI/helper boundary → 4046.8564224 m².
5. Flow 45 L/min → expected runtime.
6. Hargreaves Kisumu Aug 20 → ~4.66 mm/day.
7. Equator/equinox → no NaN.
8. `Tmax == Tmin` → bounded/clamped result with warning.
9. Unknown crop → error, never default to zero Kc.
10. Crop age exactly at every stage boundary → no off-by-one or Kc discontinuity.
11. DAP beyond total days → warning + end Kc behavior.
12. Two identical inputs → identical calculation values.
13. Rain probability below threshold → no forecast credit.
14. Rain probability missing → 50% conservative credit + confidence downgrade.
15. Area/efficiency blast-radius tests ensuring no 10×/1000× result.

## 8. Scientifically important vs hackathon simplification

### Do not compromise

- Kc source values.
- stage interpolation.
- Hargreaves radiation calculation.
- efficiency division.
- units.
- crop lookup failure behavior.

### Explicit simplifications

- no root-zone soil-water balance.
- no rainfall carry-over to next day.
- no field-calibrated crop coefficients.
- rainfall effectiveness heuristic.
- no soil-specific volume adjustment in P0.
- no irrigation interval optimization.
- one homogeneous crop/age per plot.

### Future path

The clean extension is an `Adjuster` chain after net requirement is calculated. A soil-moisture sensor or farmer feedback can later modify the modeled deficit without changing the weather adapter or crop-stage logic.

The request contract accepts an optional timestamped volumetric soil-moisture observation. Stale readings are rejected for adjustment, and calibrated readings require field capacity, wilting point and root-zone depth. In the hackathon build the calibrated adjuster remains preview-only until agronomically validated, so a sensor can never silently corrupt the deterministic litres value.

Flow meters do not belong in `Compute`: they measure actual applied water after the recommendation. Device-local irrigation events may store cumulative start/end readings and use their difference as the authoritative applied volume.
