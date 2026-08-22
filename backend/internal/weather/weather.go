package weather

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"math"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"axis/backend/internal/domain"
)

type Provider interface {
	Daily(ctx context.Context, lat, lon float64, date time.Time) (domain.WeatherSnapshot, error)
}

type KijaniFailureKind string

const (
	KijaniConfiguration KijaniFailureKind = "CONFIGURATION"
	KijaniTimeout       KijaniFailureKind = "TIMEOUT"
	KijaniRequest       KijaniFailureKind = "REQUEST"
	KijaniHTTPStatus    KijaniFailureKind = "HTTP_STATUS"
	KijaniDecode        KijaniFailureKind = "DECODE"
	KijaniTimestamp     KijaniFailureKind = "TIMESTAMP"
	KijaniNoUsableData  KijaniFailureKind = "NO_USABLE_DATA"
)

type KijaniError struct {
	Kind       KijaniFailureKind
	StatusCode int
	Err        error
}

func (e *KijaniError) Error() string {
	switch e.Kind {
	case KijaniConfiguration:
		return "Kijani configuration failed: KIJANISPACE_API_KEY is not configured"
	case KijaniTimeout:
		return "Kijani request timed out"
	case KijaniHTTPStatus:
		return fmt.Sprintf("Kijani request failed: HTTP %d", e.StatusCode)
	case KijaniDecode:
		return fmt.Sprintf("Kijani response decode failed: %v", e.Err)
	case KijaniTimestamp:
		return fmt.Sprintf("Kijani forecast timestamp failed: %v", e.Err)
	case KijaniNoUsableData:
		return fmt.Sprintf("Kijani forecast contains no usable samples for requested window: %v", e.Err)
	default:
		return fmt.Sprintf("Kijani request failed: %v", e.Err)
	}
}

func (e *KijaniError) Unwrap() error { return e.Err }

func KijaniFailureCategory(err error) string {
	var failure *KijaniError
	if errors.As(err, &failure) {
		return string(failure.Kind)
	}
	return "UNKNOWN"
}

type FixtureProvider struct{}

func (FixtureProvider) Daily(_ context.Context, _, _ float64, date time.Time) (domain.WeatherSnapshot, error) {
	observed := time.Date(date.Year(), date.Month(), date.Day(), 12, 0, 0, 0, time.UTC).Format(time.RFC3339)
	probability := 0.55
	return domain.WeatherSnapshot{
		Source: "DEMO_FIXTURE", ProviderObservedAt: &observed,
		TMinC: 17.4, TMaxC: 28.8, RainNext24HMM: 4, RainProbability: &probability,
	}, nil
}

type KijaniProvider struct {
	Endpoint string
	APIKey   string
	Client   *http.Client
}

func NewKijani(endpoint, apiKey string) *KijaniProvider {
	if endpoint == "" {
		endpoint = "https://api.kijanispace.eu/v1/agro_climate/land"
	}
	return &KijaniProvider{Endpoint: endpoint, APIKey: apiKey, Client: &http.Client{Timeout: 3 * time.Second}}
}

func (p *KijaniProvider) Daily(ctx context.Context, lat, lon float64, requestedAt time.Time) (domain.WeatherSnapshot, error) {
	if p.APIKey == "" {
		return domain.WeatherSnapshot{}, &KijaniError{Kind: KijaniConfiguration}
	}
	u, err := url.Parse(p.Endpoint)
	if err != nil {
		return domain.WeatherSnapshot{}, err
	}
	q := u.Query()
	q.Set("lat", strconv.FormatFloat(lat, 'f', 6, 64))
	q.Set("lon", strconv.FormatFloat(lon, 'f', 6, 64))
	u.RawQuery = q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return domain.WeatherSnapshot{}, err
	}
	req.Header.Set("Accept", "application/json")
	if strings.HasPrefix(p.APIKey, "Basic ") {
		req.Header.Set("Authorization", p.APIKey)
	} else if strings.HasPrefix(p.APIKey, "Bearer ") {
		req.Header.Set("Authorization", p.APIKey)
	} else if parts := strings.SplitN(p.APIKey, ":", 2); len(parts) == 2 {
		req.SetBasicAuth(parts[0], parts[1])
	} else {
		req.Header.Set("Authorization", "Bearer "+p.APIKey)
		req.Header.Set("X-API-Key", p.APIKey)
	}
	resp, err := p.Client.Do(req)
	if err != nil {
		var networkError net.Error
		if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &networkError) && networkError.Timeout()) {
			return domain.WeatherSnapshot{}, &KijaniError{Kind: KijaniTimeout, Err: err}
		}
		return domain.WeatherSnapshot{}, &KijaniError{Kind: KijaniRequest, Err: err}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return domain.WeatherSnapshot{}, &KijaniError{Kind: KijaniHTTPStatus, StatusCode: resp.StatusCode}
	}
	var raw any
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&raw); err != nil {
		return domain.WeatherSnapshot{}, &KijaniError{Kind: KijaniDecode, Err: err}
	}
	value, err := mapKijani(raw, requestedAt)
	if err == nil {
		return value, nil
	}
	var failure *KijaniError
	if errors.As(err, &failure) {
		return domain.WeatherSnapshot{}, err
	}
	return domain.WeatherSnapshot{}, &KijaniError{Kind: KijaniNoUsableData, Err: err}
}

func mapKijani(raw any, requestedAt time.Time) (domain.WeatherSnapshot, error) {
	// Check for hourly forecast arrays (meteoblue / Kijani standard format)
	tArr, okTArr := findNumberArray(raw, "temperature", "temp")
	rArr, okRArr := findNumberArray(raw, "precipitation", "precipitation_mm", "rain", "rainfall", "rain_mm")
	times, okTimes := findStringArray(raw, "time")
	if okTArr && okRArr && okTimes && len(tArr) > 0 && len(rArr) > 0 && len(times) > 0 {
		location := kijaniLocation(raw, requestedAt.Location())
		start, end, err := forecastWindow(times, requestedAt, location, len(tArr), len(rArr))
		if err != nil {
			return domain.WeatherSnapshot{}, err
		}
		usableTemperatures := make([]float64, 0, end-start)
		usableRain := make([]float64, 0, end-start)
		for index := start; index < end; index++ {
			if !finiteWeather(tArr[index]) || !finiteWeather(rArr[index]) {
				continue
			}
			usableTemperatures = append(usableTemperatures, tArr[index])
			usableRain = append(usableRain, rArr[index])
		}
		if len(usableTemperatures) == 0 {
			return domain.WeatherSnapshot{}, errors.New("required temperature and precipitation arrays contain no aligned numeric samples")
		}
		tMin := minSlice(usableTemperatures)
		tMax := maxSlice(usableTemperatures)
		rain := math.Max(0, sumSlice(usableRain))

		result := domain.WeatherSnapshot{Source: "KIJANISPACE", TMinC: tMin, TMaxC: tMax, RainNext24HMM: rain}
		if pArr, ok := findNumberArray(raw, "precipitation_probability", "probability_of_precipitation", "pop", "rain_probability"); ok && len(pArr) >= end {
			probabilities := finiteWeatherSlice(pArr[start:end])
			if len(probabilities) > 0 {
				maxP := maxSlice(probabilities)
				if maxP > 1 {
					maxP /= 100
				}
				maxP = math.Max(0, math.Min(1, maxP))
				result.RainProbability = &maxP
			}
		}
		if wArr, ok := findNumberArray(raw, "windspeed", "wind_speed", "wind_ms"); ok && len(wArr) >= end {
			winds := finiteWeatherSlice(wArr[start:end])
			if len(winds) > 0 {
				meanW := meanSlice(winds)
				result.WindMS = &meanW
			}
		}
		if eArr, ok := findNumberArray(raw, "potentialevapotranspiration", "evapotranspiration", "et0_mm", "eto"); ok && len(eArr) >= end {
			et0Values := finiteWeatherSlice(eArr[start:end])
			sumE := sumSlice(et0Values)
			if len(et0Values) > 0 && sumE >= 0 {
				result.ET0MM = &sumE
				result.ET0Method = "PROVIDER"
			}
		}
		observed := time.Now().UTC().Format(time.RFC3339)
		if value, ok := findString(raw, "model_run", "provider_observed_at", "observed_at", "timestamp"); ok {
			if parsed, err := parseKijaniTime(value, location); err == nil {
				observed = parsed.UTC().Format(time.RFC3339)
			}
		}
		result.ProviderObservedAt = &observed
		return result, nil
	}

	// Fallback to scalar fields
	tMin, okMin := findNumber(raw, "t_min_c", "tmin", "temperature_min", "min_temperature", "temp_min")
	tMax, okMax := findNumber(raw, "t_max_c", "tmax", "temperature_max", "max_temperature", "temp_max")
	rain, okRain := findNumber(raw, "rain_next_24h_mm", "precipitation", "precipitation_mm", "rain", "rainfall", "rain_mm")
	if !okMin || !okMax || !okRain {
		return domain.WeatherSnapshot{}, errors.New("KijaniSpace response is missing mapped minimum temperature, maximum temperature, or precipitation")
	}
	result := domain.WeatherSnapshot{Source: "KIJANISPACE", TMinC: tMin, TMaxC: tMax, RainNext24HMM: math.Max(0, rain)}
	if value, ok := findNumber(raw, "rain_probability", "precipitation_probability", "probability_of_precipitation", "pop"); ok {
		if value > 1 {
			value /= 100
		}
		value = math.Max(0, math.Min(1, value))
		result.RainProbability = &value
	}
	if value, ok := findNumber(raw, "wind_ms", "windspeed", "wind_speed"); ok {
		result.WindMS = &value
	}
	if value, ok := findNumber(raw, "et0_mm", "eto", "reference_et", "reference_evapotranspiration"); ok && value >= 0 {
		result.ET0MM = &value
		result.ET0Method = "PROVIDER"
	}
	observed := time.Now().UTC().Format(time.RFC3339)
	if value, ok := findString(raw, "provider_observed_at", "observed_at", "timestamp", "time"); ok {
		if parsed, err := parseKijaniTime(value, kijaniLocation(raw, requestedAt.Location())); err == nil {
			observed = parsed.UTC().Format(time.RFC3339)
		}
	}
	result.ProviderObservedAt = &observed
	return result, nil
}

func forecastWindow(times []string, requestedAt time.Time, location *time.Location, requiredLengths ...int) (int, int, error) {
	start := -1
	for index, value := range times {
		parsed, err := parseKijaniTime(value, location)
		if err != nil {
			return 0, 0, &KijaniError{Kind: KijaniTimestamp, Err: fmt.Errorf("parse forecast time %q: %w", value, err)}
		}
		if start < 0 && !parsed.Before(requestedAt) {
			start = index
		}
	}
	if start < 0 {
		return 0, 0, errors.New("KijaniSpace forecast has no sample at or after the requested time")
	}
	end := min(start+24, len(times))
	for _, length := range requiredLengths {
		end = min(end, length)
	}
	if end <= start {
		return 0, 0, errors.New("KijaniSpace forecast arrays have no aligned samples at the requested time")
	}
	return start, end, nil
}

func kijaniLocation(raw any, fallback *time.Location) *time.Location {
	if fallback == nil {
		fallback = time.UTC
	}
	value, ok := findString(raw, "timezone")
	if !ok {
		return fallback
	}
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "EAT":
		return time.FixedZone("EAT", 3*60*60)
	case "UTC", "GMT":
		return time.UTC
	default:
		return fallback
	}
}

func parseKijaniTime(value string, location *time.Location) (time.Time, error) {
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, nil
	}
	if location == nil {
		location = time.UTC
	}
	return time.ParseInLocation("2006-01-02 15:04", value, location)
}

func findNumberArray(value any, aliases ...string) ([]float64, bool) {
	for _, alias := range aliases {
		if result, ok := findNumberArrayAlias(value, normalize(alias)); ok {
			return result, true
		}
	}
	return nil, false
}

func findNumberArrayAlias(value any, wanted string) ([]float64, bool) {
	var walk func(any) ([]float64, bool)
	walk = func(current any) ([]float64, bool) {
		switch typed := current.(type) {
		case map[string]any:
			for key, item := range typed {
				if wanted == normalize(key) {
					if arr, ok := toFloatSlice(item); ok && len(arr) > 0 {
						return arr, true
					}
				}
			}
			for _, item := range typed {
				if v, ok := walk(item); ok {
					return v, true
				}
			}
		}
		return nil, false
	}
	return walk(value)
}

func findStringArray(value any, aliases ...string) ([]string, bool) {
	wanted := make(map[string]bool, len(aliases))
	for _, alias := range aliases {
		wanted[normalize(alias)] = true
	}
	var walk func(any) ([]string, bool)
	walk = func(current any) ([]string, bool) {
		switch typed := current.(type) {
		case map[string]any:
			for key, item := range typed {
				if wanted[normalize(key)] {
					if arr, ok := toStringSlice(item); ok && len(arr) > 0 {
						return arr, true
					}
				}
			}
			for _, item := range typed {
				if result, ok := walk(item); ok {
					return result, true
				}
			}
		}
		return nil, false
	}
	return walk(value)
}

func toStringSlice(value any) ([]string, bool) {
	items, ok := value.([]any)
	if !ok {
		return nil, false
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		text, ok := item.(string)
		if !ok {
			return nil, false
		}
		result = append(result, text)
	}
	return result, true
}

func toFloatSlice(value any) ([]float64, bool) {
	items, ok := value.([]any)
	if !ok {
		return nil, false
	}
	res := make([]float64, 0, len(items))
	for _, item := range items {
		switch num := item.(type) {
		case nil:
			res = append(res, math.NaN())
		case float64:
			res = append(res, num)
		case json.Number:
			v, err := num.Float64()
			if err != nil {
				return nil, false
			}
			res = append(res, v)
		case string:
			v, err := strconv.ParseFloat(num, 64)
			if err != nil {
				return nil, false
			}
			res = append(res, v)
		default:
			return nil, false
		}
	}
	return res, true
}

func finiteWeather(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func finiteWeatherSlice(values []float64) []float64 {
	result := make([]float64, 0, len(values))
	for _, value := range values {
		if finiteWeather(value) {
			result = append(result, value)
		}
	}
	return result
}

func minSlice(vals []float64) float64 {
	m := vals[0]
	for _, v := range vals[1:] {
		if v < m {
			m = v
		}
	}
	return m
}

func maxSlice(vals []float64) float64 {
	m := vals[0]
	for _, v := range vals[1:] {
		if v > m {
			m = v
		}
	}
	return m
}

func sumSlice(vals []float64) float64 {
	s := 0.0
	for _, v := range vals {
		s += v
	}
	return s
}

func meanSlice(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	return sumSlice(vals) / float64(len(vals))
}

func findNumber(value any, aliases ...string) (float64, bool) {
	wanted := make(map[string]bool, len(aliases))
	for _, alias := range aliases {
		wanted[normalize(alias)] = true
	}
	var walk func(any) (float64, bool)
	walk = func(current any) (float64, bool) {
		switch typed := current.(type) {
		case map[string]any:
			for key, item := range typed {
				if wanted[normalize(key)] {
					switch number := item.(type) {
					case float64:
						return number, true
					case json.Number:
						v, err := number.Float64()
						return v, err == nil
					case string:
						v, err := strconv.ParseFloat(number, 64)
						return v, err == nil
					}
				}
			}
			for _, item := range typed {
				if v, ok := walk(item); ok {
					return v, true
				}
			}
		case []any:
			for _, item := range typed {
				if v, ok := walk(item); ok {
					return v, true
				}
			}
		}
		return 0, false
	}
	return walk(value)
}

func findString(value any, aliases ...string) (string, bool) {
	for _, alias := range aliases {
		if result, ok := findStringAlias(value, normalize(alias)); ok {
			return result, true
		}
	}
	return "", false
}

func findStringAlias(value any, wanted string) (string, bool) {
	var walk func(any) (string, bool)
	walk = func(current any) (string, bool) {
		switch typed := current.(type) {
		case map[string]any:
			for key, item := range typed {
				if wanted == normalize(key) {
					if s, ok := item.(string); ok {
						return s, true
					}
				}
			}
			for _, item := range typed {
				if v, ok := walk(item); ok {
					return v, true
				}
			}
		case []any:
			for _, item := range typed {
				if v, ok := walk(item); ok {
					return v, true
				}
			}
		}
		return "", false
	}
	return walk(value)
}

func normalize(value string) string {
	return strings.ToLower(strings.NewReplacer("-", "", "_", "", " ", "").Replace(value))
}

type climatologyFile struct {
	Regions []climateRegion `json:"regions"`
}
type climateRegion struct {
	ID       string         `json:"id"`
	LatRange [2]float64     `json:"lat_range"`
	LonRange [2]float64     `json:"lon_range"`
	Monthly  []climateMonth `json:"monthly"`
}
type climateMonth struct {
	Month     int     `json:"month"`
	TMinC     float64 `json:"t_min_c"`
	TMaxC     float64 `json:"t_max_c"`
	RainMMDay float64 `json:"rain_mm_day"`
}

type ClimatologyProvider struct{ data climatologyFile }

func LoadClimatology(files fs.FS, name string) (*ClimatologyProvider, error) {
	b, err := fs.ReadFile(files, name)
	if err != nil {
		return nil, err
	}
	var data climatologyFile
	if err := json.Unmarshal(b, &data); err != nil {
		return nil, err
	}
	if len(data.Regions) == 0 {
		return nil, errors.New("climatology has no regions")
	}
	return &ClimatologyProvider{data: data}, nil
}

func (p *ClimatologyProvider) Daily(_ context.Context, lat, lon float64, date time.Time) (domain.WeatherSnapshot, error) {
	for _, region := range p.data.Regions {
		if lat < region.LatRange[0] || lat > region.LatRange[1] || lon < region.LonRange[0] || lon > region.LonRange[1] {
			continue
		}
		for _, month := range region.Monthly {
			if month.Month == int(date.Month()) {
				return domain.WeatherSnapshot{Source: "CLIMATOLOGY", TMinC: month.TMinC, TMaxC: month.TMaxC, RainNext24HMM: month.RainMMDay}, nil
			}
		}
	}
	return domain.WeatherSnapshot{}, errors.New("location is outside the embedded Kenya climatology coverage")
}

type cacheEntry struct {
	value   domain.WeatherSnapshot
	expires time.Time
}
type Cache struct {
	mu     sync.Mutex
	ttl    time.Duration
	values map[string]cacheEntry
}

func NewCache(ttl time.Duration) *Cache { return &Cache{ttl: ttl, values: map[string]cacheEntry{}} }
func (c *Cache) key(lat, lon float64, date time.Time) string {
	return fmt.Sprintf("%.2f:%.2f:%s", lat, lon, date.Format("2006-01-02"))
}
func (c *Cache) Get(lat, lon float64, date time.Time) (domain.WeatherSnapshot, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.values[c.key(lat, lon, date)]
	if !ok || time.Now().After(entry.expires) {
		return domain.WeatherSnapshot{}, false
	}
	entry.value.Source = "MEMORY_CACHE"
	return entry.value, true
}
func (c *Cache) Put(lat, lon float64, date time.Time, value domain.WeatherSnapshot) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.values[c.key(lat, lon, date)] = cacheEntry{value: value, expires: time.Now().Add(c.ttl)}
}

type Chain struct {
	Live     Provider
	Cache    *Cache
	Fallback Provider
	Logger   *slog.Logger
}

func (p Chain) Daily(ctx context.Context, lat, lon float64, date time.Time) (domain.WeatherSnapshot, error) {
	if p.Live != nil {
		if value, err := p.Live.Daily(ctx, lat, lon, date); err == nil {
			if p.Cache != nil {
				p.Cache.Put(lat, lon, date, value)
			}
			return value, nil
		} else if p.Logger != nil {
			p.Logger.Warn("Kijani live weather failed", "category", KijaniFailureCategory(err), "error", err)
		}
	}
	if p.Cache != nil {
		if value, ok := p.Cache.Get(lat, lon, date); ok {
			if p.Logger != nil {
				p.Logger.Info("weather fallback selected", "source", "MEMORY_CACHE")
			}
			return value, nil
		}
	}
	if p.Fallback != nil {
		value, err := p.Fallback.Daily(ctx, lat, lon, date)
		if err == nil && p.Logger != nil {
			p.Logger.Warn("weather fallback selected", "source", "CLIMATOLOGY")
		}
		return value, err
	}
	return domain.WeatherSnapshot{}, errors.New("all weather providers failed")
}
