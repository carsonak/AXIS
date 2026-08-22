package weather

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"

	"axis/backend/internal/domain"
)

const (
	TimelineTimezone = "Africa/Nairobi"
	openMeteoHourly  = "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,et0_fao_evapotranspiration,vapour_pressure_deficit,wind_speed_10m,soil_temperature_0_to_7cm,soil_moisture_0_to_7cm"
)

var nairobiLocation = time.FixedZone("Africa/Nairobi", 3*60*60)

type HistoricalProvider interface {
	History(ctx context.Context, lat, lon float64, start, end time.Time) ([]domain.TimelineWeatherDay, error)
}

type ForecastSeriesProvider interface {
	ForecastSeries(ctx context.Context, lat, lon float64, requestedAt time.Time) ([]domain.TimelineWeatherDay, error)
}

type FixtureTimelineProvider struct{}

func (FixtureTimelineProvider) History(_ context.Context, _, _ float64, start, end time.Time) ([]domain.TimelineWeatherDay, error) {
	groups := map[string][]domain.TimelineHourlyWeather{}
	for date := start.In(nairobiLocation); !date.After(end.In(nairobiLocation)); date = date.AddDate(0, 0, 1) {
		temperature, rain, humidity, wind, et0 := 23.0, 1.0, 72.0, 2.0, 4.2
		groups[date.Format("2006-01-02")] = []domain.TimelineHourlyWeather{{Time: time.Date(date.Year(), date.Month(), date.Day(), 12, 0, 0, 0, nairobiLocation).Format(time.RFC3339), TemperatureC: &temperature, PrecipitationMM: &rain, RelativeHumidityPC: &humidity, WindMS: &wind, ET0MM: &et0}}
	}
	return groupedTimelineDays(groups, "HISTORICAL", "OPEN_METEO", nil), nil
}

func (FixtureTimelineProvider) ForecastSeries(_ context.Context, _, _ float64, requestedAt time.Time) ([]domain.TimelineWeatherDay, error) {
	groups := map[string][]domain.TimelineHourlyWeather{}
	for offset := 0; offset <= 5; offset++ {
		date := requestedAt.In(nairobiLocation).AddDate(0, 0, offset)
		temperature, rain, probability, wind, et0 := 25.0+float64(offset), float64(offset%2), .55, 2.2, 4.5
		groups[date.Format("2006-01-02")] = []domain.TimelineHourlyWeather{{Time: time.Date(date.Year(), date.Month(), date.Day(), 12, 0, 0, 0, nairobiLocation).Format(time.RFC3339), TemperatureC: &temperature, PrecipitationMM: &rain, RainProbability: &probability, WindMS: &wind, ET0MM: &et0}}
	}
	modelRun := requestedAt.UTC().Format(time.RFC3339)
	days := groupedTimelineDays(groups, "FORECAST", "KIJANISPACE", &modelRun)
	days[0].Kind = "CURRENT"
	return days, nil
}

type OpenMeteoProvider struct {
	Endpoint string
	Client   *http.Client
}

func NewOpenMeteo(endpoint string) *OpenMeteoProvider {
	if endpoint == "" {
		endpoint = "https://archive-api.open-meteo.com/v1/archive"
	}
	return &OpenMeteoProvider{Endpoint: endpoint, Client: &http.Client{Timeout: 5 * time.Second}}
}

func (p *OpenMeteoProvider) History(ctx context.Context, lat, lon float64, start, end time.Time) ([]domain.TimelineWeatherDay, error) {
	u, err := url.Parse(p.Endpoint)
	if err != nil {
		return nil, fmt.Errorf("parse Open-Meteo endpoint: %w", err)
	}
	q := u.Query()
	q.Set("latitude", strconv.FormatFloat(lat, 'f', 6, 64))
	q.Set("longitude", strconv.FormatFloat(lon, 'f', 6, 64))
	q.Set("start_date", start.In(nairobiLocation).Format("2006-01-02"))
	q.Set("end_date", end.In(nairobiLocation).Format("2006-01-02"))
	q.Set("timezone", TimelineTimezone)
	q.Set("wind_speed_unit", "ms")
	q.Set("hourly", openMeteoHourly)
	u.RawQuery = q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("build Open-Meteo request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := p.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request Open-Meteo history: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("Open-Meteo history returned HTTP %d", resp.StatusCode)
	}
	var payload openMeteoResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode Open-Meteo history: %w", err)
	}
	return mapOpenMeteo(payload)
}

type openMeteoResponse struct {
	Timezone string `json:"timezone"`
	Hourly   struct {
		Time                []string   `json:"time"`
		Temperature         []*float64 `json:"temperature_2m"`
		RelativeHumidity    []*float64 `json:"relative_humidity_2m"`
		Precipitation       []*float64 `json:"precipitation"`
		Rain                []*float64 `json:"rain"`
		WeatherCode         []*int     `json:"weather_code"`
		ET0                 []*float64 `json:"et0_fao_evapotranspiration"`
		VPD                 []*float64 `json:"vapour_pressure_deficit"`
		Wind                []*float64 `json:"wind_speed_10m"`
		SoilTemperature     []*float64 `json:"soil_temperature_0_to_7cm"`
		ModeledSoilMoisture []*float64 `json:"soil_moisture_0_to_7cm"`
	} `json:"hourly"`
}

func mapOpenMeteo(payload openMeteoResponse) ([]domain.TimelineWeatherDay, error) {
	if payload.Timezone != "" && payload.Timezone != TimelineTimezone {
		return nil, fmt.Errorf("Open-Meteo returned unexpected timezone %q", payload.Timezone)
	}
	if len(payload.Hourly.Time) == 0 {
		return nil, errors.New("Open-Meteo history contains no hourly timestamps")
	}
	groups := map[string][]domain.TimelineHourlyWeather{}
	for index, rawTime := range payload.Hourly.Time {
		parsed, err := time.ParseInLocation("2006-01-02T15:04", rawTime, nairobiLocation)
		if err != nil {
			return nil, fmt.Errorf("parse Open-Meteo time %q: %w", rawTime, err)
		}
		point := domain.TimelineHourlyWeather{
			Time: parsed.Format(time.RFC3339), TemperatureC: floatAt(payload.Hourly.Temperature, index),
			RelativeHumidityPC: floatAt(payload.Hourly.RelativeHumidity, index), PrecipitationMM: floatAt(payload.Hourly.Precipitation, index),
			RainMM: floatAt(payload.Hourly.Rain, index), WeatherCode: intAt(payload.Hourly.WeatherCode, index), ET0MM: floatAt(payload.Hourly.ET0, index),
			VapourPressureDeficit: floatAt(payload.Hourly.VPD, index), WindMS: floatAt(payload.Hourly.Wind, index),
			SoilTemperatureC: floatAt(payload.Hourly.SoilTemperature, index), ModeledSoilMoistureM3M3: floatAt(payload.Hourly.ModeledSoilMoisture, index),
		}
		date := parsed.Format("2006-01-02")
		groups[date] = append(groups[date], point)
	}
	return groupedTimelineDays(groups, "HISTORICAL", "OPEN_METEO", nil), nil
}

func (p *KijaniProvider) ForecastSeries(ctx context.Context, lat, lon float64, requestedAt time.Time) ([]domain.TimelineWeatherDay, error) {
	raw, err := p.fetchRaw(ctx, lat, lon)
	if err != nil {
		return nil, err
	}
	return mapKijaniSeries(raw, requestedAt)
}

func mapKijaniSeries(raw any, requestedAt time.Time) ([]domain.TimelineWeatherDay, error) {
	times, okTimes := findStringArray(raw, "time")
	temperatures, okTemperature := findNumberArray(raw, "temperature", "temp")
	precipitation, okPrecipitation := findNumberArray(raw, "precipitation", "precipitation_mm", "rainfall", "rain_mm")
	if !okTimes || !okTemperature || !okPrecipitation || len(times) == 0 {
		return nil, &KijaniError{Kind: KijaniNoUsableData, Err: errors.New("Kijani forecast series is missing time, temperature, or precipitation arrays")}
	}
	location := kijaniLocation(raw, nairobiLocation)
	today := requestedAt.In(nairobiLocation).Format("2006-01-02")
	lastDate := requestedAt.In(nairobiLocation).AddDate(0, 0, 5).Format("2006-01-02")
	probability, _ := findNumberArray(raw, "precipitation_probability", "probability_of_precipitation", "pop", "rain_probability")
	humidity, _ := findNumberArray(raw, "relativehumidity", "relative_humidity", "relative_humidity_2m")
	winds, _ := findNumberArray(raw, "windspeed", "wind_speed", "wind_ms")
	et0, _ := findNumberArray(raw, "potentialevapotranspiration", "et0_mm", "eto")
	soilTemperature, _ := findNumberArray(raw, "soiltemperature_0to10cm", "soil_temperature_0_to_7cm")
	soilMoisture, _ := findNumberArray(raw, "soilmoisture_0to10cm", "soil_moisture_0_to_7cm")
	groups := map[string][]domain.TimelineHourlyWeather{}
	limit := min(len(times), len(temperatures), len(precipitation))
	for index := 0; index < limit; index++ {
		parsed, err := parseKijaniTime(times[index], location)
		if err != nil {
			return nil, &KijaniError{Kind: KijaniTimestamp, Err: fmt.Errorf("parse forecast time %q: %w", times[index], err)}
		}
		date := parsed.In(nairobiLocation).Format("2006-01-02")
		if date < today || date > lastDate {
			continue
		}
		point := domain.TimelineHourlyWeather{
			Time: parsed.In(nairobiLocation).Format(time.RFC3339), TemperatureC: finiteAt(temperatures, index),
			PrecipitationMM: finiteAt(precipitation, index), RelativeHumidityPC: finiteAt(humidity, index),
			RainProbability: probabilityAt(probability, index), WindMS: finiteAt(winds, index), ET0MM: finiteAt(et0, index),
			SoilTemperatureC: finiteAt(soilTemperature, index), ModeledSoilMoistureM3M3: modeledMoistureAt(soilMoisture, index),
		}
		groups[date] = append(groups[date], point)
	}
	if len(groups) == 0 {
		return nil, &KijaniError{Kind: KijaniNoUsableData, Err: errors.New("Kijani forecast contains no samples in the current five-day horizon")}
	}
	var modelRun *string
	if rawModelRun, ok := findString(raw, "model_run", "provider_observed_at", "observed_at", "timestamp"); ok {
		if parsed, err := parseKijaniTime(rawModelRun, location); err == nil {
			value := parsed.UTC().Format(time.RFC3339)
			modelRun = &value
		}
	}
	days := groupedTimelineDays(groups, "FORECAST", "KIJANISPACE", modelRun)
	for index := range days {
		if days[index].Date == today {
			days[index].Kind = "CURRENT"
		}
	}
	return days, nil
}

func groupedTimelineDays(groups map[string][]domain.TimelineHourlyWeather, kind, source string, modelRun *string) []domain.TimelineWeatherDay {
	dates := make([]string, 0, len(groups))
	for date := range groups {
		dates = append(dates, date)
	}
	sort.Strings(dates)
	days := make([]domain.TimelineWeatherDay, 0, len(dates))
	for _, date := range dates {
		hourly := groups[date]
		days = append(days, domain.TimelineWeatherDay{Date: date, Kind: kind, Source: source, ProviderModelRunAt: modelRun, Summary: summarizeTimeline(hourly), Hourly: hourly})
	}
	return days
}

func summarizeTimeline(hourly []domain.TimelineHourlyWeather) domain.TimelineDailySummary {
	return domain.TimelineDailySummary{
		TMinC:                   minPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.TemperatureC }),
		TMaxC:                   maxPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.TemperatureC }),
		RainMM:                  sumPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.PrecipitationMM }),
		RainProbability:         maxPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.RainProbability }),
		ET0MM:                   sumPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.ET0MM }),
		MeanRelativeHumidityPC:  meanPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.RelativeHumidityPC }),
		MeanWindMS:              meanPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.WindMS }),
		MeanSoilTemperatureC:    meanPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.SoilTemperatureC }),
		MeanModeledSoilMoisture: meanPointers(hourly, func(point domain.TimelineHourlyWeather) *float64 { return point.ModeledSoilMoistureM3M3 }),
	}
}

func floatAt(values []*float64, index int) *float64 {
	if index >= len(values) || values[index] == nil || !finiteWeather(*values[index]) {
		return nil
	}
	value := *values[index]
	return &value
}

func intAt(values []*int, index int) *int {
	if index >= len(values) || values[index] == nil {
		return nil
	}
	value := *values[index]
	return &value
}

func finiteAt(values []float64, index int) *float64 {
	if index >= len(values) || !finiteWeather(values[index]) {
		return nil
	}
	value := values[index]
	return &value
}

func probabilityAt(values []float64, index int) *float64 {
	value := finiteAt(values, index)
	if value == nil {
		return nil
	}
	if *value > 1 {
		*value /= 100
	}
	*value = math.Max(0, math.Min(1, *value))
	return value
}

func modeledMoistureAt(values []float64, index int) *float64 {
	value := finiteAt(values, index)
	if value != nil && *value > 1 {
		*value /= 100
	}
	return value
}

func valuesFrom(hourly []domain.TimelineHourlyWeather, field func(domain.TimelineHourlyWeather) *float64) []float64 {
	values := make([]float64, 0, len(hourly))
	for _, point := range hourly {
		if value := field(point); value != nil && finiteWeather(*value) {
			values = append(values, *value)
		}
	}
	return values
}

func minPointers(hourly []domain.TimelineHourlyWeather, field func(domain.TimelineHourlyWeather) *float64) *float64 {
	values := valuesFrom(hourly, field)
	if len(values) == 0 {
		return nil
	}
	value := minSlice(values)
	return &value
}

func maxPointers(hourly []domain.TimelineHourlyWeather, field func(domain.TimelineHourlyWeather) *float64) *float64 {
	values := valuesFrom(hourly, field)
	if len(values) == 0 {
		return nil
	}
	value := maxSlice(values)
	return &value
}

func sumPointers(hourly []domain.TimelineHourlyWeather, field func(domain.TimelineHourlyWeather) *float64) *float64 {
	values := valuesFrom(hourly, field)
	if len(values) == 0 {
		return nil
	}
	value := sumSlice(values)
	return &value
}

func meanPointers(hourly []domain.TimelineHourlyWeather, field func(domain.TimelineHourlyWeather) *float64) *float64 {
	values := valuesFrom(hourly, field)
	if len(values) == 0 {
		return nil
	}
	value := meanSlice(values)
	return &value
}
