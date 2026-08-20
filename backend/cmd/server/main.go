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
	if mode == "fixture" {
		weatherProvider = weather.FixtureProvider{}
	} else {
		mode = "live"
		weatherProvider = weather.Chain{
			Live:  weather.NewKijani(os.Getenv("KIJANISPACE_API_URL"), os.Getenv("KIJANISPACE_API_KEY")),
			Cache: weather.NewCache(60 * time.Minute), Fallback: climate,
		}
	}

	var insightProvider insights.Provider = insights.DisabledProvider{}
	if strings.EqualFold(os.Getenv("AXIS_AI_INSIGHTS_ENABLED"), "true") && os.Getenv("AXIS_AI_ENDPOINT") != "" && os.Getenv("AXIS_AI_API_KEY") != "" && os.Getenv("AXIS_AI_MODEL") != "" {
		insightProvider = &insights.CompatibleProvider{
			Endpoint: os.Getenv("AXIS_AI_ENDPOINT"), APIKey: os.Getenv("AXIS_AI_API_KEY"), Model: os.Getenv("AXIS_AI_MODEL"),
		}
	}
	staticFiles, err := web.StaticFiles()
	if err != nil {
		logger.Error("load frontend", "error", err)
		os.Exit(1)
	}
	server := &httpapi.Server{Catalog: cat, Weather: weatherProvider, Insights: insightProvider, WeatherMode: mode, Static: staticFiles, Logger: logger}
	port := env("PORT", "8080")
	httpServer := &http.Server{Addr: ":" + port, Handler: server.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}
	_, aiEnabled := insightProvider.(*insights.CompatibleProvider)
	logger.Info("AXIS server listening", "port", port, "weather_mode", mode, "ai_enabled", aiEnabled)
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
