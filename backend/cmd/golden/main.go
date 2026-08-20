// Command golden prints the deterministic recommendation used by API tests,
// documentation, and frontend mocks.
package main

import (
	"encoding/json"
	"os"
	"time"

	axisassets "axis"
	"axis/backend/internal/catalog"
	"axis/backend/internal/domain"
	"axis/backend/internal/irrigation"
)

func main() {
	cat, err := catalog.Load(axisassets.Files, "crops.json")
	if err != nil {
		panic(err)
	}
	flow, probability := 45.0, .55
	request := domain.RecommendationRequest{Date: "2026-08-20", Plot: domain.PlotCalculationInput{ID: "local-uuid", Name: "Tomato plot", Lat: -.0917, Lon: 34.768, AreaM2: 1011.714, CropID: "tomato", PlantingDate: "2026-06-07", IrrigationMethodID: "drip", FlowRateLPM: &flow}}
	weather := domain.WeatherSnapshot{Source: "DEMO_FIXTURE", TMinC: 17.4, TMaxC: 28.8, RainNext24HMM: 4, RainProbability: &probability}
	recommendation, err := irrigation.Compute(request, weather, cat, time.Date(2026, 8, 20, 15, 10, 0, 0, time.UTC))
	if err != nil {
		panic(err)
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(recommendation); err != nil {
		panic(err)
	}
}
