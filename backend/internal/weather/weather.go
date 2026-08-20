package weather

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"math"
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
		endpoint = "https://api.kijanispace.eu/v1/agro_climate/water"
	}
	return &KijaniProvider{Endpoint: endpoint, APIKey: apiKey, Client: &http.Client{Timeout: 3 * time.Second}}
}

func (p *KijaniProvider) Daily(ctx context.Context, lat, lon float64, _ time.Time) (domain.WeatherSnapshot, error) {
	if p.APIKey == "" {
		return domain.WeatherSnapshot{}, errors.New("KIJANISPACE_API_KEY is not configured")
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
	req.Header.Set("Authorization", "Bearer "+p.APIKey)
	req.Header.Set("X-API-Key", p.APIKey)
	resp, err := p.Client.Do(req)
	if err != nil {
		return domain.WeatherSnapshot{}, fmt.Errorf("KijaniSpace request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return domain.WeatherSnapshot{}, fmt.Errorf("KijaniSpace returned %s", resp.Status)
	}
	var raw any
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&raw); err != nil {
		return domain.WeatherSnapshot{}, fmt.Errorf("decode KijaniSpace response: %w", err)
	}
	return mapKijani(raw)
}

func mapKijani(raw any) (domain.WeatherSnapshot, error) {
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
		if parsed, err := time.Parse(time.RFC3339, value); err == nil {
			observed = parsed.UTC().Format(time.RFC3339)
		}
	}
	result.ProviderObservedAt = &observed
	return result, nil
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
	wanted := make(map[string]bool, len(aliases))
	for _, alias := range aliases {
		wanted[normalize(alias)] = true
	}
	var walk func(any) (string, bool)
	walk = func(current any) (string, bool) {
		switch typed := current.(type) {
		case map[string]any:
			for key, item := range typed {
				if wanted[normalize(key)] {
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
}

func (p Chain) Daily(ctx context.Context, lat, lon float64, date time.Time) (domain.WeatherSnapshot, error) {
	if p.Live != nil {
		if value, err := p.Live.Daily(ctx, lat, lon, date); err == nil {
			if p.Cache != nil {
				p.Cache.Put(lat, lon, date, value)
			}
			return value, nil
		}
	}
	if p.Cache != nil {
		if value, ok := p.Cache.Get(lat, lon, date); ok {
			return value, nil
		}
	}
	if p.Fallback != nil {
		return p.Fallback.Daily(ctx, lat, lon, date)
	}
	return domain.WeatherSnapshot{}, errors.New("all weather providers failed")
}
