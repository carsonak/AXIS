# KijaniSpace Weather Mapping

The supplied provider OpenAPI description does not type the `/v1/agro_climate/water` success payload. The adapter therefore searches nested objects/arrays for these normalized aliases and fails closed if required values are absent.

**Progress — 20 August 2026:** ✅ alias mapping, timeout, cache, fixture, and climatology behavior are implemented and tested; 🟡 no real authenticated Kijani response has yet been captured, so production field names and units remain unverified.

| AXIS field | Accepted provider aliases | Required |
|---|---|---|
| `t_min_c` | `t_min_c`, `tmin`, `temperature_min`, `min_temperature`, `temp_min` | Yes |
| `t_max_c` | `t_max_c`, `tmax`, `temperature_max`, `max_temperature`, `temp_max` | Yes |
| `rain_next_24h_mm` | `rain_next_24h_mm`, `precipitation`, `precipitation_mm`, `rain`, `rainfall`, `rain_mm` | Yes |
| `rain_probability` | `rain_probability`, `precipitation_probability`, `probability_of_precipitation`, `pop` | No; percent values are converted to 0–1 |
| `wind_ms` | `wind_ms`, `windspeed`, `wind_speed` | No |
| `et0_mm` | `et0_mm`, `eto`, `reference_et`, `reference_evapotranspiration` | No; Hargreaves is the fallback |
| `provider_observed_at` | `provider_observed_at`, `observed_at`, `timestamp`, `time` | No |

Before live judging, save a real authenticated payload as `fixtures/weather/kisumu-live.json`, confirm units manually, and add a parser regression test. Do not commit credentials.
