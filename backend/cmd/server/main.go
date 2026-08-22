package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	axisassets "axis"
	"axis/backend/internal/catalog"
	"axis/backend/internal/httpapi"
	"axis/backend/internal/insights"
	"axis/backend/internal/weather"
	"axis/backend/web"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cat, err := catalog.Load(axisassets.Files, "crops.json")
	if err != nil {
		logger.Error("load catalog", "error", err)
		os.Exit(1)
	}
	climate, err := weather.LoadClimatology(axisassets.Files, "climatology.json")
	if err != nil {
		logger.Error("load climatology", "error", err)
		os.Exit(1)
	}

	mode := strings.ToLower(env("AXIS_WEATHER_MODE", "live"))
	var weatherProvider weather.Provider
	var historicalProvider weather.HistoricalProvider
	var forecastProvider weather.ForecastSeriesProvider
	if mode == "fixture" {
		weatherProvider = weather.FixtureProvider{}
		timelineFixture := weather.FixtureTimelineProvider{}
		historicalProvider = timelineFixture
		forecastProvider = timelineFixture
	} else {
		mode = "live"
		kijani := weather.NewKijani(os.Getenv("KIJANISPACE_API_URL"), os.Getenv("KIJANISPACE_API_KEY"))
		weatherProvider = weather.Chain{
			Live:  kijani,
			Cache: weather.NewCache(60 * time.Minute), Fallback: climate, Logger: logger,
		}
		historicalProvider = weather.NewOpenMeteo(os.Getenv("OPEN_METEO_ARCHIVE_URL"))
		forecastProvider = kijani
	}

	var insightProvider insights.Provider = insights.DisabledProvider{}
	aiTimeout := insights.DefaultTimeout
	if strings.EqualFold(os.Getenv("AXIS_AI_INSIGHTS_ENABLED"), "true") && os.Getenv("AXIS_AI_ENDPOINT") != "" && os.Getenv("AXIS_AI_API_KEY") != "" && os.Getenv("AXIS_AI_MODEL") != "" {
		aiTimeout = durationEnv("AXIS_AI_TIMEOUT", insights.DefaultTimeout, logger)
		insightProvider = &insights.CompatibleProvider{
			Endpoint: os.Getenv("AXIS_AI_ENDPOINT"), APIKey: os.Getenv("AXIS_AI_API_KEY"), Model: os.Getenv("AXIS_AI_MODEL"),
			Timeout: aiTimeout,
		}
	}
	staticFiles, err := web.StaticFiles()
	if err != nil {
		logger.Error("load frontend", "error", err)
		os.Exit(1)
	}
	server := &httpapi.Server{Catalog: cat, Weather: weatherProvider, Historical: historicalProvider, Forecast: forecastProvider, Insights: insightProvider, WeatherMode: mode, Static: staticFiles, Logger: logger}
	port := env("PORT", "8080")
	writeTimeout := 15 * time.Second
	if _, enabled := insightProvider.(*insights.CompatibleProvider); enabled && writeTimeout <= aiTimeout {
		writeTimeout = aiTimeout + 5*time.Second
	}
	httpServer := &http.Server{Addr: ":" + port, Handler: server.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: writeTimeout, IdleTimeout: 60 * time.Second}
	_, aiEnabled := insightProvider.(*insights.CompatibleProvider)
	logger.Info("AXIS server listening", "port", port, "weather_mode", mode, "kijani_configured", os.Getenv("KIJANISPACE_API_KEY") != "", "ai_enabled", aiEnabled, "ai_timeout", aiTimeout.String(), "write_timeout", writeTimeout.String())
	if err := httpServer.ListenAndServe(); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration, logger *slog.Logger) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	duration, err := time.ParseDuration(value)
	if err != nil || duration <= 0 {
		logger.Warn("invalid duration configuration; using default", "key", key, "value", value, "default", fallback)
		return fallback
	}
	return duration
}
