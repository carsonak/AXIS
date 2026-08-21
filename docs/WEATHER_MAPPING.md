# KijaniSpace Weather Mapping

The provider endpoint `/v1/agro_climate/land` serves multi-day forecast arrays (powered by meteoblue data). The AXIS weather adapter extracts and aggregates the 24-hour forecast window (indices 0–23) for daily irrigation recommendations.

**Progress — 21 August 2026:** ✅ Live authenticated KijaniSpace capture completed and verified; units, field structure, authentication methods, and regression fixture ([`fixtures/weather/kisumu-live.json`](../fixtures/weather/kisumu-live.json)) verified.

| AXIS field | Accepted provider fields / aliases | Units | Aggregation (Next 24h) |
|---|---|---|---|
| `t_min_c` | `temperature`, `t_min_c`, `tmin`, `temperature_min` | °C | `min(temperature[0:24])` |
| `t_max_c` | `temperature`, `t_max_c`, `tmax`, `temperature_max` | °C | `max(temperature[0:24])` |
| `rain_next_24h_mm` | `precipitation`, `rain_next_24h_mm`, `precipitation_mm` | mm | `sum(precipitation[0:24])` |
| `rain_probability` | `precipitation_probability`, `rain_probability`, `pop` | percent (0–100) converted to 0–1 | `max(probability[0:24]) / 100` |
| `wind_ms` | `windspeed`, `wind_ms`, `wind_speed` | m/s | `mean(windspeed[0:24])` |
| `et0_mm` | `potentialevapotranspiration`, `evapotranspiration`, `et0_mm` | mm | `sum(potentialevapotranspiration[0:24])` |
| `provider_observed_at` | `model_run`, `provider_observed_at`, `timestamp` | ISO8601 | Direct string / parsed timestamp |

## Key Findings from Live Capture
1. **Endpoint**: For agricultural plots and land coordinates, use `GET /v1/agro_climate/land?lat=<lat>&lon=<lon>`. (The `/v1/agro_climate/water` endpoint returns `400 {"detail":"not water"}` for land coordinates).
2. **Authentication**: Supports HTTP Basic auth (`-u admin:secret` / `Authorization: Basic YWRtaW46c2VjcmV0`), API Key header (`X-API-Key`), and Bearer tokens.
3. **Payload Structure**: Real provider returns `forecast_data` with hourly arrays (120 elements for 5-day forecast).
4. **Fixture**: Sanitized live capture for Kisumu (`-0.0917`, `34.7680`) is committed as `fixtures/weather/kisumu-live.json`.

