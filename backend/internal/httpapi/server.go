package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"axis/backend/internal/domain"
	"axis/backend/internal/insights"
	"axis/backend/internal/irrigation"
	"axis/backend/internal/weather"
)

type Server struct {
	Catalog     domain.Catalog
	Weather     weather.Provider
	Insights    insights.Provider
	WeatherMode string
	Static      fs.FS
	Now         func() time.Time
	Logger      *slog.Logger
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", s.health)
	mux.HandleFunc("GET /api/v1/catalog", s.catalog)
	mux.HandleFunc("POST /api/v1/recommendations", s.recommendation)
	mux.HandleFunc("POST /api/v1/insights", s.insight)
	if s.Static != nil {
		mux.Handle("/", spaHandler(s.Static))
	}
	return withSecurityHeaders(withRecovery(s.logger(), mux))
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
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", "Request body must be valid JSON.", "")
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
	snapshot, err := s.Weather.Daily(r.Context(), input.Plot.Lat, input.Plot.Lon, date)
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
		writeError(w, http.StatusBadRequest, "VALIDATION_FAILED", "Request body must be valid JSON.", "")
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
		s.logger().Warn("AI insight failed", "error", err)
		writeError(w, http.StatusBadGateway, "AI_INSIGHT_FAILED", "AI explanation is temporarily unavailable; the deterministic recommendation is unchanged.", "")
		return
	}
	writeJSON(w, http.StatusOK, result)
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
		if path == "" {
			path = "index.html"
		}
		if info, err := fs.Stat(files, path); err == nil && !info.IsDir() {
			clone := r.Clone(r.Context())
			clone.URL.Path = "/" + path
			fileServer.ServeHTTP(w, clone)
			return
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
