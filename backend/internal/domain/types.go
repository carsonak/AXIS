package domain

import "time"

const (
	Version       = "0.1.0"
	EngineVersion = "0.1.0"
)

type StageDays struct {
	Establishing int `json:"establishing"`
	Developing   int `json:"developing"`
	Productive   int `json:"productive"`
	Maturing     int `json:"maturing"`
}

type CropCoefficient struct {
	Establishing float64 `json:"establishing"`
	Productive   float64 `json:"productive"`
	Maturing     float64 `json:"maturing"`
}

type Crop struct {
	ID            string          `json:"id"`
	DisplayName   string          `json:"display_name"`
	DisplayNameSW string          `json:"display_name_sw,omitempty"`
	KC            CropCoefficient `json:"kc"`
	StageDays     StageDays       `json:"stage_days"`
	TotalDays     int             `json:"total_days"`
	Confidence    string          `json:"confidence"`
	Source        string          `json:"source,omitempty"`
	Note          string          `json:"note,omitempty"`
}

type IrrigationMethod struct {
	ID              string  `json:"id"`
	DisplayName     string  `json:"display_name"`
	DisplayNameSW   string  `json:"display_name_sw,omitempty"`
	Efficiency      float64 `json:"efficiency"`
	PreferredWindow string  `json:"preferred_window"`
	Source          string  `json:"source,omitempty"`
	Note            string  `json:"note,omitempty"`
}

type Constants struct {
	SolarConstantMJ              float64 `json:"solar_constant_mj_m2_min"`
	HargreavesCoefficient        float64 `json:"hargreaves_coefficient"`
	HargreavesTemperatureOffset  float64 `json:"hargreaves_temp_offset"`
	MJToMMConversion             float64 `json:"mj_to_mm_conversion"`
	M2PerAcre                    float64 `json:"m2_per_acre"`
	M2PerHectare                 float64 `json:"m2_per_hectare"`
	LitresPerMMPerM2             float64 `json:"litres_per_mm_per_m2"`
	EffectiveRainfallMinimumMM   float64 `json:"effective_rainfall_min_mm"`
	ForecastProbabilityThreshold float64 `json:"forecast_probability_threshold"`
	SkipThresholdMM              float64 `json:"skip_threshold_mm"`
	KenyaUTCOffsetHours          int     `json:"kenya_utc_offset_hours"`
	RainFactorWithProbability    float64 `json:"effective_rainfall_factor_with_probability"`
	RainFactorWithoutProbability float64 `json:"effective_rainfall_factor_without_probability"`
}

type StageCatalogItem struct {
	ID            string `json:"id"`
	DisplayName   string `json:"display_name"`
	DisplayNameSW string `json:"display_name_sw,omitempty"`
	FAO56Stage    string `json:"fao56_stage,omitempty"`
}

type StageModel struct {
	AgeInputRule    string             `json:"age_input_rule"`
	CanonicalStages []StageCatalogItem `json:"canonical_stages"`
}

type Catalog struct {
	SchemaVersion     string             `json:"schema_version"`
	EngineVersion     string             `json:"engine_version"`
	Crops             []Crop             `json:"crops"`
	IrrigationMethods []IrrigationMethod `json:"irrigation_methods"`
	Constants         Constants          `json:"constants"`
	StageModel        StageModel         `json:"stage_model"`
}

type PlotCalculationInput struct {
	ID                    string                   `json:"id"`
	Name                  string                   `json:"name"`
	Lat                   float64                  `json:"lat"`
	Lon                   float64                  `json:"lon"`
	AreaM2                float64                  `json:"area_m2"`
	CropID                string                   `json:"crop_id"`
	PlantingDate          string                   `json:"planting_date"`
	PlantingDateEstimated bool                     `json:"planting_date_estimated"`
	IrrigationMethodID    string                   `json:"irrigation_method_id"`
	FlowRateLPM           *float64                 `json:"flow_rate_lpm,omitempty"`
	SoilMoisture          *SoilMoistureObservation `json:"soil_moisture,omitempty"`
}

type SoilMoistureObservation struct {
	SensorID                 string   `json:"sensor_id"`
	ObservedAt               string   `json:"observed_at"`
	VolumetricWaterContentPC float64  `json:"volumetric_water_content_pct"`
	FieldCapacityPC          *float64 `json:"field_capacity_pct,omitempty"`
	WiltingPointPC           *float64 `json:"wilting_point_pct,omitempty"`
	RootZoneDepthMM          *float64 `json:"root_zone_depth_mm,omitempty"`
}

type PreviousRecommendation struct {
	Date        string  `json:"date"`
	LitresExact float64 `json:"litres_exact"`
	ET0MM       float64 `json:"et0_mm,omitempty"`
	RainMM      float64 `json:"rain_mm,omitempty"`
	StageID     string  `json:"stage_id,omitempty"`
}

type RecommendationRequest struct {
	Plot                   PlotCalculationInput    `json:"plot"`
	Date                   string                  `json:"date,omitempty"`
	PreviousRecommendation *PreviousRecommendation `json:"previous_recommendation,omitempty"`
}

type WeatherSnapshot struct {
	Source             string   `json:"source"`
	ProviderObservedAt *string  `json:"provider_observed_at,omitempty"`
	TMinC              float64  `json:"t_min_c"`
	TMaxC              float64  `json:"t_max_c"`
	WindMS             *float64 `json:"wind_ms,omitempty"`
	RainNext24HMM      float64  `json:"rain_next_24h_mm"`
	RainProbability    *float64 `json:"rain_probability,omitempty"`
	ET0MM              *float64 `json:"et0_mm,omitempty"`
	ET0Method          string   `json:"et0_method,omitempty"`
}

type CropStageState struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	CropAgeDays int    `json:"crop_age_days"`
	StageDay    int    `json:"stage_day"`
}

type Decision struct {
	Action                            string   `json:"action"`
	Litres                            int      `json:"litres"`
	LitresExact                       float64  `json:"litres_exact"`
	GrossDepthMM                      float64  `json:"gross_depth_mm"`
	ModeledGrossDepthBeforeThreshold  float64  `json:"modeled_gross_depth_before_threshold_mm,omitempty"`
	DurationMinutes                   *int     `json:"duration_minutes,omitempty"`
	RecommendedWindow                 string   `json:"recommended_window"`
	Headline                          string   `json:"headline"`
	BaselineLitresNoRain              float64  `json:"baseline_litres_no_rain"`
	RainAdjustmentLitres              float64  `json:"rain_adjustment_litres"`
	PreviousRecommendationDeltaLitres *float64 `json:"previous_recommendation_delta_litres,omitempty"`
}

type ExplanationStep struct {
	Key   string  `json:"key"`
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
	Note  string  `json:"note,omitempty"`
}

type Explanation struct {
	Summary string            `json:"summary"`
	Steps   []ExplanationStep `json:"steps"`
}

type ConfidenceInfo struct {
	Level   string   `json:"level"`
	Reasons []string `json:"reasons"`
}

type SensorContext struct {
	SoilMoistureConnected bool   `json:"soil_moisture_connected"`
	UsedForAdjustment     bool   `json:"used_for_adjustment"`
	Status                string `json:"status"`
	Reason                string `json:"reason,omitempty"`
}

type ComparisonFactor struct {
	Key       string  `json:"key"`
	Label     string  `json:"label"`
	Change    float64 `json:"change,omitempty"`
	Unit      string  `json:"unit,omitempty"`
	Direction string  `json:"direction"`
	Note      string  `json:"note,omitempty"`
}

type PreviousComparison struct {
	Summary string             `json:"summary"`
	Factors []ComparisonFactor `json:"factors"`
}

type IrrigationRecommendation struct {
	PlotID        string              `json:"plot_id"`
	Date          string              `json:"date"`
	GeneratedAt   time.Time           `json:"generated_at"`
	EngineVersion string              `json:"engine_version"`
	CropStage     CropStageState      `json:"crop_stage"`
	Decision      Decision            `json:"decision"`
	Weather       WeatherSnapshot     `json:"weather"`
	Explanation   Explanation         `json:"explanation"`
	Confidence    ConfidenceInfo      `json:"confidence"`
	SensorContext *SensorContext      `json:"sensor_context,omitempty"`
	Comparison    *PreviousComparison `json:"comparison,omitempty"`
	Warnings      []string            `json:"warnings"`
}

type ErrorEnvelope struct {
	Error APIError `json:"error"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type InsightHistoryItem struct {
	Date              string   `json:"date"`
	RecommendedLitres float64  `json:"recommended_litres"`
	AppliedLitres     *float64 `json:"applied_litres,omitempty"`
	RainAdjustment    float64  `json:"rain_adjustment_litres,omitempty"`
}

type InsightRequest struct {
	Recommendation IrrigationRecommendation `json:"recommendation"`
	History        []InsightHistoryItem     `json:"history"`
	Language       string                   `json:"language,omitempty"`
}

type InsightResponse struct {
	Summary      string    `json:"summary"`
	Observations []string  `json:"observations"`
	Language     string    `json:"language"`
	GeneratedAt  time.Time `json:"generated_at"`
	Label        string    `json:"label"`
}
