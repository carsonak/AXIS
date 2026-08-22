# KijaniSpace Weather Mapping

The live provider endpoint is `GET /v1/agro_climate/land?lat=<lat>&lon=<lon>`. A sanitized Kisumu response is stored in [`fixtures/weather/kisumu-live.json`](../fixtures/weather/kisumu-live.json) and covered by parser regression tests.

## Rolling forecast window

Kijani supplies aligned hourly arrays under `forecast_data`, including `time`, `temperature`, `precipitation`, `precipitation_probability`, `windspeed`, and `potentialevapotranspiration`.

For each recommendation AXIS:

1. Interprets forecast wall-clock timestamps using the payload timezone.
2. Finds the first timestamp at or after the recommendation request time.
3. Selects the following available 24 aligned samples, or fewer near the end of the forecast.
4. Uses one common start index for every weather field.

| AXIS field | Provider aliases | Units | Rolling-window aggregation |
|---|---|---|---|
| `t_min_c` | `temperature`, `temp` | °C | minimum |
| `t_max_c` | `temperature`, `temp` | °C | maximum |
| `rain_next_24h_mm` | `precipitation`, `precipitation_mm`, `rain`, `rainfall`, `rain_mm` | mm | non-negative sum |
| `rain_probability` | `precipitation_probability`, `probability_of_precipitation`, `pop`, `rain_probability` | percent or 0–1 | maximum, normalized to 0–1 |
| `wind_ms` | `windspeed`, `wind_speed`, `wind_ms` | m/s | mean |
| `et0_mm` | `potentialevapotranspiration`, `evapotranspiration`, `et0_mm`, `eto` | mm | sum |
| `provider_observed_at` | `model_run`, `provider_observed_at`, `observed_at`, `timestamp` | provider time | parsed and stored as UTC RFC3339 |

Temperature and precipitation determine the usable required window. An optional array that cannot cover that same window is omitted rather than shifted. Payloads containing scalar daily fields continue through the scalar compatibility mapper.

## Timezones

The verified live payload identifies `EAT`, which AXIS interprets as UTC+03:00. RFC3339 timestamps retain their explicit offsets. If a naive provider timestamp has no recognized timezone, AXIS uses the location attached to the recommendation request time. The live HTTP path supplies current Nairobi time.

For example, `2026-08-21 13:08` in EAT is stored as `2026-08-21T10:08:00Z`.

## Authentication and failure behavior

Credentials must be supplied through `KIJANISPACE_API_KEY`; no credential is embedded in source or documentation. Supported values are:

- HTTP Basic credentials in `username:password` form;
- a complete `Basic …` authorization value;
- a complete `Bearer …` authorization value; or
- an unprefixed provider token/API key for generic Bearer and `X-API-Key` compatibility.

The client has a three-second timeout. A successful response is cached in memory for 60 minutes and can be used after a live-provider failure before AXIS falls back to embedded climatology. Climatological rainfall is never credited as forecast rain.

Live failures are logged by safe category (`CONFIGURATION`, `TIMEOUT`, `REQUEST`, `HTTP_STATUS`, `DECODE`, `TIMESTAMP`, or `NO_USABLE_DATA`) before cache or climatology is selected. Logs include an HTTP status when applicable but never include credentials, authorization headers, query keys, or provider response bodies.
