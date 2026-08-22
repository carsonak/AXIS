package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	axisassets "axis"
	"axis/backend/internal/catalog"
	"axis/backend/internal/domain"
	"axis/backend/internal/insights"
	"axis/backend/internal/weather"
	"axis/backend/web"
)

type recordingWeatherProvider struct {
	requestedAt time.Time
}

type recordingInsightProvider struct {
	input domain.InsightRequest
}

func (p *recordingInsightProvider) Generate(_ context.Context, input domain.InsightRequest) (domain.InsightResponse, error) {
	p.input = input
	return domain.InsightResponse{Summary: "Grounded answer.", Observations: []string{}, Language: input.Language, GeneratedAt: time.Date(2026, 8, 20, 15, 10, 0, 0, time.UTC), Label: "AI-generated explanation"}, nil
}

func (p *recordingWeatherProvider) Daily(_ context.Context, _, _ float64, requestedAt time.Time) (domain.WeatherSnapshot, error) {
	p.requestedAt = requestedAt
	return domain.WeatherSnapshot{Source: "KIJANISPACE", TMinC: 17.4, TMaxC: 28.8, RainNext24HMM: 0}, nil
}

func testServer(t *testing.T) *Server {
	t.Helper()
	cat, err := catalog.Load(axisassets.Files, "crops.json")
	if err != nil {
		t.Fatal(err)
	}
	static, err := web.StaticFiles()
	if err != nil {
		t.Fatal(err)
	}
	return &Server{Catalog: cat, Weather: weather.FixtureProvider{}, Insights: insights.DisabledProvider{}, WeatherMode: "fixture", Static: static, Now: func() time.Time { return time.Date(2026, 8, 20, 15, 10, 0, 0, time.UTC) }}
}

func TestHealthCatalogAndSPA(t *testing.T) {
	handler := testServer(t).Handler()
	for _, path := range []string{"/api/v1/health", "/api/v1/catalog", "/plots/new"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s returned %d: %s", path, rec.Code, rec.Body.String())
		}
	}
}

func TestRecommendationContract(t *testing.T) {
	input := map[string]any{"date": "2026-08-20", "plot": map[string]any{"id": "plot-1", "name": "Tomato plot", "lat": -0.0917, "lon": 34.768, "area_m2": 1011.714, "crop_id": "tomato", "planting_date": "2026-06-07", "planting_date_estimated": false, "irrigation_method_id": "drip", "flow_rate_lpm": 45}}
	body, _ := json.Marshal(input)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/recommendations", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	testServer(t).Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var value map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &value); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"plot_id", "date", "generated_at", "engine_version", "crop_stage", "decision", "weather", "explanation", "confidence", "warnings"} {
		if _, ok := value[key]; !ok {
			t.Errorf("missing %s", key)
		}
	}
	decision := value["decision"].(map[string]any)
	for _, key := range []string{"baseline_litres_no_rain", "rain_adjustment_litres", "daily_target_litres", "daily_target_litres_exact", "applied_today_litres", "litres", "duration_minutes"} {
		if _, ok := decision[key]; !ok {
			t.Errorf("decision missing %s", key)
		}
	}
}

func TestLiveRecommendationUsesCurrentNairobiTimeForWeather(t *testing.T) {
	provider := &recordingWeatherProvider{}
	server := testServer(t)
	server.Weather = provider
	server.WeatherMode = "live"

	input := map[string]any{"date": "2026-08-20", "plot": map[string]any{"id": "plot-1", "name": "Tomato plot", "lat": -0.0917, "lon": 34.768, "area_m2": 1011.714, "crop_id": "tomato", "planting_date": "2026-06-07", "planting_date_estimated": false, "irrigation_method_id": "drip", "flow_rate_lpm": 45}}
	body, _ := json.Marshal(input)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/recommendations", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	_, offset := provider.requestedAt.Zone()
	if provider.requestedAt.Hour() != 18 || provider.requestedAt.Minute() != 10 || offset != 3*60*60 {
		t.Fatalf("weather requested at %s, want 18:10 UTC+03:00", provider.requestedAt)
	}
}

func TestInvalidRequestAndDisabledInsights(t *testing.T) {
	handler := testServer(t).Handler()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/recommendations", bytes.NewBufferString(`{"plot":{}}`))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid request status = %d", rec.Code)
	}
	req = httptest.NewRequest(http.MethodPost, "/api/v1/insights", bytes.NewBufferString(`{}`))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("disabled insights status = %d", rec.Code)
	}
}

func TestInsightQuestionValidationAndForwarding(t *testing.T) {
	provider := &recordingInsightProvider{}
	server := testServer(t)
	server.Insights = provider
	handler := server.Handler()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/insights", bytes.NewBufferString(`{"question":"How did rain affect this plot?","recommendation":{},"history":[],"language":"en"}`))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if provider.input.Question != "How did rain affect this plot?" {
		t.Fatalf("question = %q", provider.input.Question)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/v1/insights", bytes.NewBufferString(`{"question":"   ","recommendation":{},"history":[]}`))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), `"field":"question"`) {
		t.Fatalf("blank question response = %d: %s", rec.Code, rec.Body.String())
	}

	history := make([]map[string]any, 8)
	for i := range history {
		history[i] = map[string]any{"date": "2026-08-20", "recommended_litres": i}
	}
	body, err := json.Marshal(map[string]any{"question": "Explain the pattern", "recommendation": map[string]any{}, "history": history})
	if err != nil {
		t.Fatal(err)
	}
	req = httptest.NewRequest(http.MethodPost, "/api/v1/insights", bytes.NewReader(body))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), `"field":"history"`) {
		t.Fatalf("history limit response = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestInsightRejectsUnknownRecommendationMetadataAsSchemaError(t *testing.T) {
	server := testServer(t)
	server.Insights = &recordingInsightProvider{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/insights", bytes.NewBufferString(`{"question":"Explain this","recommendation":{"id":"local-only","savedAt":"2026-08-20T00:00:00Z"},"history":[]}`))
	rec := httptest.NewRecorder()
	server.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "fields that are not supported") {
		t.Fatalf("response = %d: %s", rec.Code, rec.Body.String())
	}
}
