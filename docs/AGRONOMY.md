# AXIS Agronomy Notes

The implemented engine follows the calculation and simplification rules in `04-ENGINE-AND-CROP-STAGES.md`.

**Current status:** ✅ the deterministic rules and golden fixture are covered by automated tests; ✅ provider ET₀ is accepted only within the engine's plausible range; 🟡 coefficients and demo outputs still need a second human agronomic review; ⛔ sensor adjustment remains inactive.

- Crop coefficients and stage durations come from the versioned `crops.json` catalog.
- Reference ETo uses a provider value only when it is present and plausible; otherwise AXIS computes Hargreaves ETo from daily minimum/maximum temperature, latitude and day of year.
- Effective rainfall is zero below 2 mm or below 40% probability, 80% above the probability threshold, and 50% when probability is missing. Climatological mean rainfall is never credited.
- Net depth is divided by irrigation efficiency; 1 mm over 1 m² equals 1 litre.
- Requirements below 1 mm gross depth produce a zero-litre `SKIP` action while retaining the modeled pre-threshold depth in the explanation.
- `baseline_litres_no_rain` is the same-day result with zero forecast rain. `rain_adjustment_litres` is its difference from the recommendation whenever forecast rain was credited, including rain-driven `SKIP` days; it is zero when no rain qualified, so a dry sub-threshold `SKIP` never claims rain saved water. It is not a claim about total water saved.
- Soil-sensor adjustment is preview-only. A trustworthy root-zone balance needs validated calibration and local agronomic review.

Run `go test ./backend/internal/irrigation` for pinned boundary, unit, rain, confidence, sensor and golden-fixture cases.
