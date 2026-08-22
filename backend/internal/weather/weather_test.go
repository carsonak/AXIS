package weather

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	axisassets "axis"
	"axis/backend/internal/domain"
)

func TestFlexibleKijaniMapping(t *testing.T) {
	raw := map[string]any{"forecast": []any{map[string]any{"temp_min": 17.4, "temp_max": 28.8, "precipitation_mm": 4.0, "pop": 55.0, "wind_speed": 2.3}}}
	value, err := mapKijani(raw, time.Date(2026, 8, 20, 0, 0, 0, 0, time.UTC))
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
	requestedAt := time.Date(2026, 8, 21, 17, 0, 0, 0, time.FixedZone("EAT", 3*60*60))
	value, err := mapKijani(raw, requestedAt)
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
	if value.ProviderObservedAt == nil || *value.ProviderObservedAt != "2026-08-21T10:08:00Z" {
		t.Fatalf("bad provider timestamp: %v", stringValue(value.ProviderObservedAt))
	}
}

func TestKijaniRollingForecastWindow(t *testing.T) {
	raw := hourlyPayload(40, "EAT")
	requestedAt := time.Date(2026, 8, 21, 6, 30, 0, 0, time.FixedZone("EAT", 3*60*60))
	value, err := mapKijani(raw, requestedAt)
	if err != nil {
		t.Fatal(err)
	}
	if value.TMinC != 7 || value.TMaxC != 30 {
		t.Fatalf("temperature window = %.1f..%.1f, want 7..30", value.TMinC, value.TMaxC)
	}
	if value.RainNext24HMM != 444 {
		t.Fatalf("rain = %.1f, want 444", value.RainNext24HMM)
	}
	if value.ET0MM == nil || mathAbs(*value.ET0MM-44.4) > 1e-9 {
		t.Fatalf("ET0 = %+v, want 44.4", value.ET0MM)
	}
	if value.RainProbability == nil || *value.RainProbability != .3 {
		t.Fatalf("probability = %+v, want 0.3", value.RainProbability)
	}
	if value.WindMS == nil || *value.WindMS != 18.5 {
		t.Fatalf("wind = %+v, want 18.5", value.WindMS)
	}
}

func TestKijaniRollingForecastWindowNearEnd(t *testing.T) {
	raw := hourlyPayload(40, "EAT")
	requestedAt := time.Date(2026, 8, 22, 14, 0, 0, 0, time.FixedZone("EAT", 3*60*60))
	value, err := mapKijani(raw, requestedAt)
	if err != nil {
		t.Fatal(err)
	}
	if value.TMinC != 38 || value.TMaxC != 39 || value.RainNext24HMM != 77 {
		t.Fatalf("unexpected near-end window: %+v", value)
	}
}

func TestKijaniOptionalArraysMustCoverAlignedWindow(t *testing.T) {
	raw := hourlyPayload(40, "EAT")
	raw["forecast_data"].(map[string]any)["windspeed"] = []any{1.0, 2.0, 3.0}
	requestedAt := time.Date(2026, 8, 21, 7, 0, 0, 0, time.FixedZone("EAT", 3*60*60))
	value, err := mapKijani(raw, requestedAt)
	if err != nil {
		t.Fatal(err)
	}
	if value.WindMS != nil {
		t.Fatalf("short optional wind array should be omitted, got %+v", value.WindMS)
	}
	if value.ET0MM == nil {
		t.Fatal("aligned ET0 array should still be aggregated")
	}
}

func TestKijaniNullSamplesDoNotDiscardUsableForecast(t *testing.T) {
	raw := hourlyPayload(4, "EAT")
	raw["forecast_data"].(map[string]any)["temperature"] = []any{20.0, nil, 24.0, 22.0}
	raw["forecast_data"].(map[string]any)["precipitation"] = []any{0.0, 1.0, nil, 2.0}
	raw["forecast_data"].(map[string]any)["windspeed"] = []any{nil, 2.0, 4.0, nil}
	value, err := mapKijani(raw, time.Date(2026, 8, 21, 0, 0, 0, 0, time.FixedZone("EAT", 3*60*60)))
	if err != nil {
		t.Fatal(err)
	}
	if value.TMinC != 20 || value.TMaxC != 22 || value.RainNext24HMM != 2 {
		t.Fatalf("mapped required values = %+v", value)
	}
	if value.WindMS == nil || *value.WindMS != 3 {
		t.Fatalf("mapped optional wind = %+v", value.WindMS)
	}
}

func TestKijaniTimestampFallsBackToRequestLocation(t *testing.T) {
	raw := hourlyPayload(2, "Unsupported/Zone")
	requestedAt := time.Date(2026, 8, 21, 0, 0, 0, 0, time.FixedZone("request-zone", 2*60*60))
	value, err := mapKijani(raw, requestedAt)
	if err != nil {
		t.Fatal(err)
	}
	if value.ProviderObservedAt == nil || *value.ProviderObservedAt != "2026-08-21T11:08:00Z" {
		t.Fatalf("provider timestamp = %+v, want 2026-08-21T11:08:00Z", value.ProviderObservedAt)
	}
}

func TestKijaniAuthentication(t *testing.T) {
	tests := []struct {
		name          string
		key           string
		authorization string
		apiKey        string
		username      string
		password      string
	}{
		{name: "username and password", key: "farmer:passphrase", username: "farmer", password: "passphrase"},
		{name: "prefixed basic", key: "Basic c2FtcGxl", authorization: "Basic c2FtcGxl"},
		{name: "prefixed bearer", key: "Bearer sample:token", authorization: "Bearer sample:token"},
		{name: "unprefixed token", key: "sample-token", authorization: "Bearer sample-token", apiKey: "sample-token"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			provider := NewKijani("https://weather.example.test/land", test.key)
			provider.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if test.username != "" {
					username, password, ok := r.BasicAuth()
					if !ok || username != test.username || password != test.password {
						t.Errorf("basic auth = %q/%q/%v", username, password, ok)
					}
				} else if got := r.Header.Get("Authorization"); got != test.authorization {
					t.Errorf("Authorization = %q, want %q", got, test.authorization)
				}
				if got := r.Header.Get("X-API-Key"); got != test.apiKey {
					t.Errorf("X-API-Key = %q, want %q", got, test.apiKey)
				}
				return &http.Response{
					StatusCode: http.StatusOK,
					Status:     "200 OK",
					Body:       io.NopCloser(strings.NewReader(`{"t_min_c":17,"t_max_c":28,"rain_next_24h_mm":2,"provider_observed_at":"2026-08-21T10:08:00Z"}`)),
					Header:     make(http.Header),
					Request:    r,
				}, nil
			})}
			if _, err := provider.Daily(context.Background(), -.0917, 34.768, time.Date(2026, 8, 21, 17, 0, 0, 0, time.UTC)); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestKijaniFailureCategories(t *testing.T) {
	tests := []struct {
		name       string
		response   *http.Response
		err        error
		want       KijaniFailureKind
		wantStatus int
	}{
		{name: "timeout", err: context.DeadlineExceeded, want: KijaniTimeout},
		{name: "unauthorized", response: &http.Response{StatusCode: http.StatusUnauthorized, Status: "401 Unauthorized", Body: io.NopCloser(strings.NewReader("secret body")), Header: make(http.Header)}, want: KijaniHTTPStatus, wantStatus: 401},
		{name: "decode", response: &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Body: io.NopCloser(strings.NewReader("{")), Header: make(http.Header)}, want: KijaniDecode},
		{name: "no usable data", response: &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Body: io.NopCloser(strings.NewReader(`{"forecast_data":{"time":[],"temperature":[],"precipitation":[]}}`)), Header: make(http.Header)}, want: KijaniNoUsableData},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			provider := NewKijani("https://weather.example.test/land", "not-logged-secret")
			provider.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if test.response != nil {
					test.response.Request = r
				}
				return test.response, test.err
			})}
			_, err := provider.Daily(context.Background(), -.0917, 34.768, time.Now())
			var failure *KijaniError
			if !errors.As(err, &failure) || failure.Kind != test.want || failure.StatusCode != test.wantStatus {
				t.Fatalf("error = %#v", err)
			}
			if strings.Contains(err.Error(), "not-logged-secret") || strings.Contains(err.Error(), "secret body") {
				t.Fatalf("error leaked a secret: %v", err)
			}
		})
	}
}

func TestKijaniTimestampFailureIsCategorized(t *testing.T) {
	provider := NewKijani("https://weather.example.test/land", "key")
	provider.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Body: io.NopCloser(strings.NewReader(`{"forecast_data":{"time":["bad-time"],"temperature":[20],"precipitation":[0]}}`)), Header: make(http.Header), Request: r}, nil
	})}
	_, err := provider.Daily(context.Background(), -.0917, 34.768, time.Now())
	if KijaniFailureCategory(err) != string(KijaniTimestamp) {
		t.Fatalf("category = %s, error = %v", KijaniFailureCategory(err), err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func stringValue(value *string) string {
	if value == nil {
		return "<nil>"
	}
	return *value
}

func hourlyPayload(length int, timezone string) map[string]any {
	times := make([]any, length)
	temperature := make([]any, length)
	precipitation := make([]any, length)
	probability := make([]any, length)
	windspeed := make([]any, length)
	et0 := make([]any, length)
	start := time.Date(2026, 8, 21, 0, 0, 0, 0, time.UTC)
	for index := range length {
		times[index] = start.Add(time.Duration(index) * time.Hour).Format("2006-01-02 15:04")
		temperature[index] = float64(index)
		precipitation[index] = float64(index)
		probability[index] = float64(index)
		windspeed[index] = float64(index)
		et0[index] = float64(index) / 10
	}
	return map[string]any{
		"location":      map[string]any{"timezone": timezone},
		"forecast_info": map[string]any{"model_run": "2026-08-21 13:08"},
		"forecast_data": map[string]any{
			"time": times, "temperature": temperature, "precipitation": precipitation,
			"precipitation_probability": probability, "windspeed": windspeed,
			"potentialevapotranspiration": et0,
		},
	}
}

func mathAbs(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
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

func TestChainLogsLiveFailureAndFallbackWithoutSecrets(t *testing.T) {
	var output bytes.Buffer
	live := &stubProvider{err: &KijaniError{Kind: KijaniHTTPStatus, StatusCode: 401}}
	fallback := &stubProvider{value: domain.WeatherSnapshot{Source: "CLIMATOLOGY", TMinC: 17, TMaxC: 28}}
	chain := Chain{Live: live, Fallback: fallback, Logger: slog.New(slog.NewJSONHandler(&output, nil))}
	if _, err := chain.Daily(context.Background(), 0, 35, time.Now()); err != nil {
		t.Fatal(err)
	}
	logText := output.String()
	for _, wanted := range []string{`"category":"HTTP_STATUS"`, `HTTP 401`, `"source":"CLIMATOLOGY"`} {
		if !strings.Contains(logText, wanted) {
			t.Errorf("log missing %s: %s", wanted, logText)
		}
	}
}
