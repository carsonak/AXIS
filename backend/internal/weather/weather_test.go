package weather

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	axisassets "axis"
	"axis/backend/internal/domain"
)

func TestFlexibleKijaniMapping(t *testing.T) {
	raw := map[string]any{"forecast": []any{map[string]any{"temp_min": 17.4, "temp_max": 28.8, "precipitation_mm": 4.0, "pop": 55.0, "wind_speed": 2.3}}}
	value, err := mapKijani(raw)
	if err != nil {
		t.Fatal(err)
	}
	if value.Source != "KIJANISPACE" || value.TMinC != 17.4 || value.TMaxC != 28.8 || value.RainNext24HMM != 4 {
		t.Fatalf("bad map: %+v", value)
	}
	if value.RainProbability == nil || *value.RainProbability != .55 {
		t.Fatalf("bad probability: %+v", value.RainProbability)
	}
}

func TestRealKijaniLivePayloadMapping(t *testing.T) {
	b, err := axisassets.Files.ReadFile("fixtures/weather/kisumu-live.json")
	if err != nil {
		t.Fatal(err)
	}
	var raw any
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatal(err)
	}
	value, err := mapKijani(raw)
	if err != nil {
		t.Fatal(err)
	}
	if value.Source != "KIJANISPACE" {
		t.Fatalf("unexpected source: %s", value.Source)
	}
	if value.TMinC < 15 || value.TMinC > 25 {
		t.Fatalf("tMin out of expected range: %f", value.TMinC)
	}
	if value.TMaxC < 25 || value.TMaxC > 35 {
		t.Fatalf("tMax out of expected range: %f", value.TMaxC)
	}
	if value.RainProbability == nil || *value.RainProbability < 0 || *value.RainProbability > 1 {
		t.Fatalf("bad rain probability: %+v", value.RainProbability)
	}
	if value.ET0MM == nil || *value.ET0MM <= 0 {
		t.Fatalf("bad et0: %+v", value.ET0MM)
	}
	if value.WindMS == nil || *value.WindMS <= 0 {
		t.Fatalf("bad wind: %+v", value.WindMS)
	}
}

func TestClimatologyUsesSpecificRegionFirst(t *testing.T) {
	provider, err := LoadClimatology(axisassets.Files, "climatology.json")
	if err != nil {
		t.Fatal(err)
	}
	value, err := provider.Daily(context.Background(), -.0917, 34.768, time.Date(2026, 8, 20, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if value.Source != "CLIMATOLOGY" || value.TMinC != 17.4 || value.TMaxC != 28.8 {
		t.Fatalf("unexpected climate: %+v", value)
	}
}

type stubProvider struct {
	value domain.WeatherSnapshot
	err   error
	calls int
}

func (p *stubProvider) Daily(context.Context, float64, float64, time.Time) (domain.WeatherSnapshot, error) {
	p.calls++
	return p.value, p.err
}

func TestChainCachesLiveSuccess(t *testing.T) {
	live := &stubProvider{value: domain.WeatherSnapshot{Source: "KIJANISPACE", TMinC: 10, TMaxC: 20}}
	fallback := &stubProvider{value: domain.WeatherSnapshot{Source: "CLIMATOLOGY", TMinC: 1, TMaxC: 2}}
	chain := Chain{Live: live, Cache: NewCache(time.Hour), Fallback: fallback}
	date := time.Date(2026, 8, 20, 0, 0, 0, 0, time.UTC)
	first, err := chain.Daily(context.Background(), 0, 35, date)
	if err != nil {
		t.Fatal(err)
	}
	if first.Source != "KIJANISPACE" {
		t.Fatal("live value not returned")
	}
	live.err = context.DeadlineExceeded
	second, err := chain.Daily(context.Background(), 0, 35, date)
	if err != nil {
		t.Fatal(err)
	}
	if second.Source != "MEMORY_CACHE" || fallback.calls != 0 {
		t.Fatalf("cache was not used: %+v", second)
	}
}
