package weather

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestOpenMeteoHistoryBuildsAgriculturalQueryAndMapsNairobiHours(t *testing.T) {
	provider := NewOpenMeteo("https://archive.example.test/v1/archive")
	provider.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		query := r.URL.Query()
		for key, want := range map[string]string{
			"latitude": "-0.091700", "longitude": "34.768000", "start_date": "2026-08-18", "end_date": "2026-08-19",
			"timezone": TimelineTimezone, "wind_speed_unit": "ms", "hourly": openMeteoHourly,
		} {
			if got := query.Get(key); got != want {
				t.Errorf("%s = %q, want %q", key, got, want)
			}
		}
		return &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Header: make(http.Header), Request: r, Body: io.NopCloser(strings.NewReader(`{"timezone":"Africa/Nairobi","hourly":{"time":["2026-08-18T23:00","2026-08-19T00:00"],"temperature_2m":[20,19],"relative_humidity_2m":[null,81],"precipitation":[0,1.2],"rain":[0,1.2],"weather_code":[1,61],"et0_fao_evapotranspiration":[0.1,0.2],"vapour_pressure_deficit":[null,0.4],"wind_speed_10m":[2,3],"soil_temperature_0_to_7cm":[21,20],"soil_moisture_0_to_7cm":[0.22,null]}}`))}, nil
	})}
	days, err := provider.History(context.Background(), -.0917, 34.768, time.Date(2026, 8, 18, 0, 0, 0, 0, time.UTC), time.Date(2026, 8, 19, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 2 || days[0].Date != "2026-08-18" || days[1].Date != "2026-08-19" {
		t.Fatalf("unexpected days: %+v", days)
	}
	if days[0].Hourly[0].RelativeHumidityPC != nil || days[1].Summary.RainMM == nil || *days[1].Summary.RainMM != 1.2 {
		t.Fatalf("optional fields or summary mapped incorrectly: %+v", days)
	}
	if !strings.HasSuffix(days[0].Hourly[0].Time, "+03:00") {
		t.Fatalf("hour is not Nairobi-local RFC3339: %s", days[0].Hourly[0].Time)
	}
}

func TestOpenMeteoHistoryRejectsProviderFailure(t *testing.T) {
	provider := NewOpenMeteo("https://archive.example.test/v1/archive")
	provider.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusServiceUnavailable, Status: "503 Service Unavailable", Header: make(http.Header), Request: r, Body: io.NopCloser(strings.NewReader("private detail"))}, nil
	})}
	_, err := provider.History(context.Background(), 0, 35, time.Now(), time.Now())
	if err == nil || strings.Contains(err.Error(), "private detail") {
		t.Fatalf("expected safe provider error, got %v", err)
	}
}

func TestKijaniForecastSeriesGroupsCalendarDaysAndCapsHorizon(t *testing.T) {
	raw := hourlyPayload(8*24, "EAT")
	days, err := mapKijaniSeries(raw, time.Date(2026, 8, 21, 8, 0, 0, 0, nairobiLocation))
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 6 || days[0].Kind != "CURRENT" || days[5].Date != "2026-08-26" {
		t.Fatalf("unexpected forecast horizon: %+v", days)
	}
	if len(days[0].Hourly) != 24 || days[1].Summary.TMinC == nil || *days[1].Summary.TMinC != 24 {
		t.Fatalf("calendar grouping failed: %+v", days[1])
	}
	if days[1].Summary.RainProbability == nil || *days[1].Summary.RainProbability != .47 {
		t.Fatalf("probability normalization failed: %+v", days[1].Summary.RainProbability)
	}
}
