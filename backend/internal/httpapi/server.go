package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"axis/backend/internal/domain"
	"axis/backend/internal/insights"
	"axis/backend/internal/irrigation"
	"axis/backend/internal/weather"
)

// Server wires stateless calculation and provider dependencies; it never persists farmer records.
type Server struct {
	Catalog     domain.Catalog
	Weather     weather.Provider
	Historical  weather.HistoricalProvider
	Forecast    weather.ForecastSeriesProvider
	Insights    insights.Provider
	WeatherMode string
	Static      fs.FS
	Now         func() time.Time
	Logger      *slog.Logger
}

// Handler exposes the versioned JSON API and, when configured, the embedded SPA with security/recovery middleware.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", s.health)
	mux.HandleFunc("GET /api/v1/catalog", s.catalog)
	mux.HandleFunc("POST /api/v1/recommendations", s.recommendation)
	mux.HandleFunc("GET /api/v1/weather/history", s.weatherHistory)
	mux.HandleFunc("POST /api/v1/weather/forecast", s.weatherForecast)
	mux.HandleFunc("POST /api/v1/insights", s.insight)
	if s.Static != nil {
		mux.Handle("/", spaHandler(s.Static))
	}
	return withSecurityHeaders(withRecovery(s.logger(), mux))
}

func (s *Server) weatherHistory(w http.ResponseWriter, r *http.Request) {
	if s.Historical == nil {
		writeError(w, http.StatusServiceUnavailable, "HISTORICAL_WEATHER_UNAVAILABLE", "Historical weather is not configured.", "")
		return
	}
	lat, latErr := strconv.ParseFloat(r.URL.Query().Get("latitude"), 64)
	lon, lonErr := strconv.ParseFloat(r.URL.Query().Get("longitude"), 64)
	if latErr != nil || lonErr != nil || !finiteCoordinate(lat, lon) {
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", "Valid latitude and longitude are required.", "location")
		return
	}
	start, startErr := time.Parse("2006-01-02", r.URL.Query().Get("start_date"))
	end, endErr := time.Parse("2006-01-02", r.URL.Query().Get("end_date"))
	if startErr != nil || endErr != nil || end.Before(start) {
		writeError(w, http.StatusBadRequest, "INVALID_DATE", "A valid start_date through end_date range is required.", "start_date")
		return
	}
	if int(end.Sub(start).Hours()/24)+1 > 14 {
		writeError(w, http.StatusBadRequest, "DATE_RANGE_TOO_LARGE", "Historical weather requests are limited to 14 days.", "end_date")
		return
	}
	today := s.now().In(time.FixedZone("Africa/Nairobi", 3*60*60)).Format("2006-01-02")
	if end.Format("2006-01-02") >= today {
		writeError(w, http.StatusBadRequest, "INVALID_DATE", "Historical weather must end before today's Africa/Nairobi date.", "end_date")
		return
	}
	days, err := s.Historical.History(r.Context(), lat, lon, start, end)
	if err != nil {
		s.logger().Warn("historical weather failed", "error", err)
		writeError(w, http.StatusBadGateway, "HISTORICAL_WEATHER_UNAVAILABLE", "Historical weather is temporarily unavailable.", "")
		return
	}
	writeJSON(w, http.StatusOK, domain.WeatherTimelineResponse{Timezone: weather.TimelineTimezone, Days: days})
}

func (s *Server) weatherForecast(w http.ResponseWriter, r *http.Request) {
	if s.Forecast == nil {
		writeError(w, http.StatusServiceUnavailable, "FORECAST_UNAVAILABLE", "Multi-day weather forecast is not configured.", "")
		return
	}
	var input domain.ForecastTimelineRequest
	if err := decodeJSON(r, &input); err != nil {
		_, message := classifyJSONError(err)
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", message, "")
		return
	}
	if !finiteCoordinate(input.Plot.Lat, input.Plot.Lon) {
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", "Valid plot coordinates are required.", "plot.location")
		return
	}
	now := s.now()
	localNow := now.In(time.FixedZone("Africa/Nairobi", 3*60*60))
	days, err := s.Forecast.ForecastSeries(r.Context(), input.Plot.Lat, input.Plot.Lon, localNow)
	if err != nil {
		s.logger().Warn("forecast series failed", "category", weather.KijaniFailureCategory(err), "error", err)
		writeError(w, http.StatusBadGateway, "FORECAST_UNAVAILABLE", "Multi-day weather forecast is temporarily unavailable.", "")
		return
	}
	today := localNow.Format("2006-01-02")
	for index := range days {
		day := &days[index]
		if day.Date <= today {
			continue
		}
		if day.Summary.TMinC == nil || day.Summary.TMaxC == nil || day.Summary.RainMM == nil {
			day.PlanningUnavailable = "Required temperature or rainfall inputs are unavailable for this day."
			continue
		}
		snapshot := domain.WeatherSnapshot{Source: "KIJANISPACE", ProviderObservedAt: day.ProviderModelRunAt, TMinC: *day.Summary.TMinC, TMaxC: *day.Summary.TMaxC, RainNext24HMM: *day.Summary.RainMM, RainProbability: day.Summary.RainProbability, WindMS: day.Summary.MeanWindMS, ET0MM: day.Summary.ET0MM}
		if snapshot.ET0MM != nil {
			snapshot.ET0Method = "PROVIDER"
		}
		recommendation, computeErr := irrigation.Compute(domain.RecommendationRequest{Plot: input.Plot, Date: day.Date, AppliedTodayLitres: 0}, snapshot, s.Catalog, now)
		if computeErr != nil {
			var validation irrigation.ValidationError
			if errors.As(computeErr, &validation) {
				writeError(w, http.StatusBadRequest, validation.Code, validation.Message, validation.Field)
				return
			}
			s.logger().Error("future recommendation failed", "date", day.Date, "error", computeErr)
			day.PlanningUnavailable = "AXIS could not calculate this day's irrigation plan."
			continue
		}
		day.Recommendation = &recommendation
	}
	writeJSON(w, http.StatusOK, domain.WeatherTimelineResponse{Timezone: weather.TimelineTimezone, Days: days})
}

func finiteCoordinate(lat, lon float64) bool {
	return !math.IsNaN(lat) && !math.IsNaN(lon) && !math.IsInf(lat, 0) && !math.IsInf(lon, 0) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	aiEnabled := s.Insights != nil && !isInsightsDisabled(s.Insights)
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok", "version": domain.Version, "engine_version": domain.EngineVersion,
		"weather_mode": s.WeatherMode, "ai_insights_enabled": aiEnabled,
		"sensor_support": map[string]bool{"soil_moisture_context": true, "flow_meter_events": true},
	})
}

func (s *Server) catalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"schema_version":     s.Catalog.SchemaVersion,
		"engine_version":     s.Catalog.EngineVersion,
		"stages":             s.Catalog.StageModel.CanonicalStages,
		"crops":              s.Catalog.Crops,
		"irrigation_methods": s.Catalog.IrrigationMethods,
	})
}

func (s *Server) recommendation(w http.ResponseWriter, r *http.Request) {
	var input domain.RecommendationRequest
	if err := decodeJSON(r, &input); err != nil {
		category, message := classifyJSONError(err)
		s.logger().Warn("recommendation request rejected", "category", category, "error", err)
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", message, "")
		return
	}
	now := s.now()
	localNow := now.In(time.FixedZone("Africa/Nairobi", 3*60*60))
	today := localNow.Format("2006-01-02")
	if input.Date == "" {
		input.Date = today
	}
	if s.WeatherMode == "live" && input.Date != today {
		writeError(w, http.StatusBadRequest, "INVALID_DATE", "Live recommendations only support today's Africa/Nairobi date.", "date")
		return
	}
	date, err := time.Parse("2006-01-02", input.Date)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_DATE", "Date must use YYYY-MM-DD.", "date")
		return
	}
	if s.Weather == nil {
		writeError(w, http.StatusUnprocessableEntity, "INVALID_WEATHER_INPUT", "No weather provider is configured.", "")
		return
	}
	weatherTime := date
	if s.WeatherMode == "live" {
		weatherTime = localNow
	}
	snapshot, err := s.Weather.Daily(r.Context(), input.Plot.Lat, input.Plot.Lon, weatherTime)
	if err != nil {
		s.logger().Warn("weather providers failed", "error", err)
		writeError(w, http.StatusUnprocessableEntity, "INVALID_WEATHER_INPUT", "Weather is unavailable for this location.", "plot.location")
		return
	}
	recommendation, err := irrigation.Compute(input, snapshot, s.Catalog, now)
	if err != nil {
		var validation irrigation.ValidationError
		if errors.As(err, &validation) {
			status := http.StatusBadRequest
			if validation.Code == "INVALID_WEATHER_INPUT" {
				status = http.StatusUnprocessableEntity
			}
			writeError(w, status, validation.Code, validation.Message, validation.Field)
			return
		}
		s.logger().Error("recommendation failed", "error", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL", "The recommendation could not be generated.", "")
		return
	}
	writeJSON(w, http.StatusOK, recommendation)
}

func (s *Server) insight(w http.ResponseWriter, r *http.Request) {
	if s.Insights == nil || isInsightsDisabled(s.Insights) {
		writeError(w, http.StatusNotFound, "AI_INSIGHTS_DISABLED", "AI insights are not enabled for this deployment.", "")
		return
	}
	var input domain.InsightRequest
	if err := decodeJSON(r, &input); err != nil {
		category, message := classifyJSONError(err)
		s.logger().Warn("insight request rejected", "category", category, "error", err)
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", message, "")
		return
	}
	if strings.TrimSpace(input.Question) == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", "A question is required.", "question")
		return
	}
	if len(input.History) > 7 {
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", "At most seven history items may be analyzed.", "history")
		return
	}
	result, err := s.Insights.Generate(r.Context(), input)
	if err != nil {
		if errors.Is(err, insights.ErrDisabled) {
			writeError(w, http.StatusNotFound, "AI_INSIGHTS_DISABLED", "AI insights are not enabled for this deployment.", "")
			return
		}
		attributes := []any{"category", "UNKNOWN", "error", err}
		var providerError *insights.ProviderError
		if errors.As(err, &providerError) {
			attributes = []any{
				"category", providerError.Kind,
				"status_code", providerError.StatusCode,
				"provider_request_id", providerError.RequestID,
				"duration_ms", providerError.Duration.Milliseconds(),
				"error", err,
			}
		}
		s.logger().Warn("AI insight failed", attributes...)
		status, code, message := classifyInsightError(err)
		writeError(w, status, code, message, "")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func classifyInsightError(err error) (int, string, string) {
	var providerError *insights.ProviderError
	if !errors.As(err, &providerError) {
		return http.StatusBadGateway, "AI_INSIGHT_FAILED", "AI explanation is temporarily unavailable; the deterministic recommendation is unchanged."
	}
	switch providerError.Kind {
	case insights.FailureTimeout:
		return http.StatusGatewayTimeout, "AI_PROVIDER_TIMEOUT", "The AI provider took too long to respond; the deterministic recommendation is unchanged."
	case insights.FailureTransport:
		return http.StatusBadGateway, "AI_PROVIDER_UNREACHABLE", "The AI provider could not be reached; the deterministic recommendation is unchanged."
	case insights.FailureProviderHTTP:
		return http.StatusBadGateway, "AI_PROVIDER_REJECTED", "The AI provider rejected the explanation request; the deterministic recommendation is unchanged."
	case insights.FailureResponseDecode, insights.FailureEmptyResponse:
		return http.StatusBadGateway, "AI_PROVIDER_INVALID_RESPONSE", "The AI provider returned an unusable response; the deterministic recommendation is unchanged."
	case insights.FailureRequestBuild:
		return http.StatusBadGateway, "AI_PROVIDER_CONFIG_ERROR", "The AI provider is misconfigured; the deterministic recommendation is unchanged."
	default:
		return http.StatusBadGateway, "AI_INSIGHT_FAILED", "AI explanation is temporarily unavailable; the deterministic recommendation is unchanged."
	}
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return errors.New("multiple JSON values")
	}
	return nil
}

func classifyJSONError(err error) (string, string) {
	var syntax *json.SyntaxError
	if errors.As(err, &syntax) || errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, io.EOF) {
		return "MALFORMED_JSON", "Request body must be valid JSON."
	}
	if strings.Contains(err.Error(), "unknown field") {
		return "UNKNOWN_FIELD", "Request body contains fields that are not supported by this API."
	}
	var typeError *json.UnmarshalTypeError
	if errors.As(err, &typeError) {
		return "INVALID_FIELD_TYPE", "Request body contains a field with an invalid value type."
	}
	return "INVALID_SCHEMA", "Request body does not match the expected API schema."
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code, message, field string) {
	writeJSON(w, status, domain.ErrorEnvelope{Error: domain.APIError{Code: code, Message: message, Field: field}})
}

func (s *Server) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}
func (s *Server) logger() *slog.Logger {
	if s.Logger != nil {
		return s.Logger
	}
	return slog.Default()
}
func isInsightsDisabled(provider insights.Provider) bool {
	_, ok := provider.(insights.DisabledProvider)
	return ok
}

func spaHandler(files fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(files))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" && path != "index.html" {
			if info, err := fs.Stat(files, path); err == nil && !info.IsDir() {
				clone := r.Clone(r.Context())
				clone.URL.Path = "/" + path
				fileServer.ServeHTTP(w, clone)
				return
			}
		}
		data, err := fs.ReadFile(files, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	})
}

func withRecovery(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("panic recovered", "panic", recovered)
				writeError(w, http.StatusInternalServerError, "INTERNAL", "The server encountered an unexpected error.", "")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Permissions-Policy", "geolocation=(self), camera=(), microphone=()")
		next.ServeHTTP(w, r)
	})
}
