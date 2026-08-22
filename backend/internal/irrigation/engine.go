package irrigation

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"axis/backend/internal/catalog"
	"axis/backend/internal/domain"
)

var ErrValidation = errors.New("validation failed")

type ValidationError struct {
	Code    string
	Field   string
	Message string
}

func (e ValidationError) Error() string { return e.Message }
func (e ValidationError) Unwrap() error { return ErrValidation }

func Compute(req domain.RecommendationRequest, weather domain.WeatherSnapshot, cat domain.Catalog, generatedAt time.Time) (domain.IrrigationRecommendation, error) {
	plot := req.Plot
	if strings.TrimSpace(plot.ID) == "" {
		return domain.IrrigationRecommendation{}, invalid("VALIDATION_FAILED", "plot.id", "plot id is required")
	}
	if strings.TrimSpace(plot.Name) == "" || len(plot.Name) > 80 {
		return domain.IrrigationRecommendation{}, invalid("VALIDATION_FAILED", "plot.name", "plot name must be between 1 and 80 characters")
	}
	if plot.Lat < -90 || plot.Lat > 90 || plot.Lon < -180 || plot.Lon > 180 {
		return domain.IrrigationRecommendation{}, invalid("VALIDATION_FAILED", "plot.location", "latitude or longitude is outside the valid range")
	}
	if plot.AreaM2 <= 0 || plot.AreaM2 > 100000 {
		return domain.IrrigationRecommendation{}, invalid("VALIDATION_FAILED", "plot.area_m2", "area must be greater than zero and at most 100,000 m²")
	}
	if plot.FlowRateLPM != nil && (*plot.FlowRateLPM <= 0 || *plot.FlowRateLPM > 10000) {
		return domain.IrrigationRecommendation{}, invalid("VALIDATION_FAILED", "plot.flow_rate_lpm", "flow rate must be greater than zero and at most 10,000 L/min")
	}
	if !finite(req.AppliedTodayLitres) || req.AppliedTodayLitres < 0 {
		return domain.IrrigationRecommendation{}, invalid("VALIDATION_FAILED", "applied_today_litres", "applied water must be a non-negative number")
	}
	crop, ok := catalog.FindCrop(cat, plot.CropID)
	if !ok {
		return domain.IrrigationRecommendation{}, invalid("UNKNOWN_CROP", "plot.crop_id", "crop is not in the AXIS catalog")
	}
	method, ok := catalog.FindMethod(cat, plot.IrrigationMethodID)
	if !ok {
		return domain.IrrigationRecommendation{}, invalid("UNKNOWN_IRRIGATION_METHOD", "plot.irrigation_method_id", "irrigation method is not in the AXIS catalog")
	}
	calculationDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return domain.IrrigationRecommendation{}, invalid("INVALID_DATE", "date", "date must use YYYY-MM-DD")
	}
	plantingDate, err := time.Parse("2006-01-02", plot.PlantingDate)
	if err != nil {
		return domain.IrrigationRecommendation{}, invalid("INVALID_DATE", "plot.planting_date", "planting date must use YYYY-MM-DD")
	}
	age := int(calculationDate.Sub(plantingDate).Hours() / 24)
	if age < 0 {
		return domain.IrrigationRecommendation{}, invalid("INVALID_DATE", "plot.planting_date", "planting date cannot be in the future")
	}
	if age > 400 {
		return domain.IrrigationRecommendation{}, invalid("INVALID_DATE", "plot.planting_date", "crop age is outside the supported range")
	}
	if weather.TMaxC < weather.TMinC || !finite(weather.TMinC) || !finite(weather.TMaxC) {
		return domain.IrrigationRecommendation{}, invalid("INVALID_WEATHER_INPUT", "weather", "weather temperature inputs are invalid")
	}

	stageID, stageDay, stageStart, warnings := deriveStage(age, crop)
	kc := interpolateKC(age, stageID, stageStart, crop)
	et0, et0Method, etoWarning := referenceET0(weather, calculationDate, plot.Lat, cat.Constants)
	if etoWarning != "" {
		warnings = append(warnings, etoWarning)
	}
	weather.ET0MM = &et0
	weather.ET0Method = et0Method

	etc := kc * et0
	rainCredit, rainReduced, probabilityMissing := effectiveRainfall(weather, etc, cat.Constants)
	netDepth := math.Max(0, etc-rainCredit)
	baselineDepth := etc / method.Efficiency
	grossDepthBeforeThreshold := netDepth / method.Efficiency
	baselineLitres := baselineDepth * plot.AreaM2
	dailyTargetExact := grossDepthBeforeThreshold * plot.AreaM2
	action := "IRRIGATE"
	if rainReduced && dailyTargetExact > 0 {
		action = "REDUCED"
	}
	if grossDepthBeforeThreshold < cat.Constants.SkipThresholdMM {
		action = "SKIP"
		dailyTargetExact = 0
	}
	remainingExact := math.Max(0, dailyTargetExact-req.AppliedTodayLitres)
	if dailyTargetExact > 0 && remainingExact == 0 {
		action = "SKIP"
	}
	grossDepth := 0.0
	if plot.AreaM2 > 0 {
		grossDepth = remainingExact / plot.AreaM2
	}
	litres := roundLitres(remainingExact)
	dailyTargetLitres := roundLitres(dailyTargetExact)
	rainAdjustment := 0.0
	if rainReduced {
		rainAdjustment = math.Max(0, baselineLitres-dailyTargetExact)
	}

	var duration *int
	if plot.FlowRateLPM != nil && remainingExact > 0 {
		value := roundToInt(remainingExact/(*plot.FlowRateLPM), 5)
		if value == 0 {
			value = 5
		}
		duration = &value
	}
	var previousDelta *float64
	var comparison *domain.PreviousComparison
	if req.PreviousRecommendation != nil {
		previousTarget := req.PreviousRecommendation.LitresExact
		if req.PreviousRecommendation.DailyTargetLitresExact != nil {
			previousTarget = *req.PreviousRecommendation.DailyTargetLitresExact
		}
		value := dailyTargetExact - previousTarget
		previousDelta = &value
		comparison = buildComparison(value, et0, weather.RainNext24HMM, stageID, *req.PreviousRecommendation)
	}

	confidence, reasons := confidence(weather, crop, plot.PlantingDateEstimated, probabilityMissing, et0Method)
	if probabilityMissing && weather.Source != "CLIMATOLOGY" {
		warnings = append(warnings, "Rain probability was unavailable; AXIS conservatively credited 50% of qualifying forecast rain.")
	}
	sensorContext, sensorWarnings, err := evaluateSensorContext(plot.SoilMoisture, generatedAt)
	if err != nil {
		return domain.IrrigationRecommendation{}, err
	}
	warnings = append(warnings, sensorWarnings...)
	if err := addIrrigationSensorResponse(sensorContext, req.IrrigationContext, generatedAt); err != nil {
		return domain.IrrigationRecommendation{}, err
	}

	stageName := stageDisplayName(cat, stageID)
	decision := domain.Decision{
		Action:                            action,
		Litres:                            litres,
		LitresExact:                       round(remainingExact, 1),
		DailyTargetLitres:                 dailyTargetLitres,
		DailyTargetLitresExact:            round(dailyTargetExact, 1),
		AppliedTodayLitres:                round(req.AppliedTodayLitres, 1),
		GrossDepthMM:                      round(grossDepth, 1),
		ModeledGrossDepthBeforeThreshold:  round(grossDepthBeforeThreshold, 2),
		DurationMinutes:                   duration,
		RecommendedWindow:                 method.PreferredWindow,
		Headline:                          headline(action, litres, method.PreferredWindow, dailyTargetExact > 0 && remainingExact == 0),
		BaselineLitresNoRain:              round(baselineLitres, 1),
		RainAdjustmentLitres:              round(rainAdjustment, 1),
		PreviousRecommendationDeltaLitres: previousDelta,
	}
	if previousDelta != nil {
		v := round(*previousDelta, 1)
		decision.PreviousRecommendationDeltaLitres = &v
	}

	steps := []domain.ExplanationStep{
		{Key: "et0", Label: "Weather water demand", Value: round(et0, 2), Unit: "mm"},
		{Key: "kc", Label: "Crop factor", Value: round(kc, 2), Unit: ""},
		{Key: "etc", Label: "Estimated crop water use", Value: round(etc, 2), Unit: "mm"},
		{Key: "rain", Label: "Forecast rain credited", Value: round(rainCredit, 2), Unit: "mm"},
		{Key: "efficiency", Label: method.DisplayName + " efficiency", Value: round(method.Efficiency*100, 0), Unit: "%"},
		{Key: "area", Label: "Plot area", Value: round(plot.AreaM2, 1), Unit: "m²"},
		{Key: "baseline", Label: "Without forecast rain", Value: round(baselineLitres, 1), Unit: "L"},
		{Key: "daily_target", Label: "Today's adjusted target", Value: round(dailyTargetExact, 1), Unit: "L"},
		{Key: "applied_today", Label: "Already irrigated today", Value: round(req.AppliedTodayLitres, 1), Unit: "L"},
		{Key: "litres", Label: "Remaining amount to apply", Value: round(remainingExact, 1), Unit: "L"},
	}
	if dailyTargetExact == 0 {
		steps[len(steps)-1].Note = fmt.Sprintf("Modeled depth %.2f mm is below the %.1f mm action threshold.", grossDepthBeforeThreshold, cat.Constants.SkipThresholdMM)
	} else if remainingExact == 0 {
		steps[len(steps)-1].Note = "Logged irrigation meets or exceeds today's adjusted target; no additional irrigation is recommended."
	}

	return domain.IrrigationRecommendation{
		PlotID:        plot.ID,
		Date:          calculationDate.Format("2006-01-02"),
		GeneratedAt:   generatedAt.UTC(),
		EngineVersion: domain.EngineVersion,
		CropStage: domain.CropStageState{
			ID: stageID, DisplayName: stageName, CropAgeDays: age, StageDay: stageDay,
		},
		Decision: decision,
		Weather:  weather,
		Explanation: domain.Explanation{
			Summary: "AXIS calculates today's crop-water target from weather, crop stage, area, and irrigation efficiency, then subtracts water already logged today to show the remaining amount.",
			Steps:   steps,
		},
		Confidence:    domain.ConfidenceInfo{Level: confidence, Reasons: reasons},
		SensorContext: sensorContext,
		Comparison:    comparison,
		Warnings:      warnings,
	}, nil
}

func buildComparison(litresDelta, currentET0, currentRain float64, currentStage string, previous domain.PreviousRecommendation) *domain.PreviousComparison {
	direction := func(value float64) string {
		if value > .01 {
			return "INCREASED"
		}
		if value < -.01 {
			return "DECREASED"
		}
		return "UNCHANGED"
	}
	factors := []domain.ComparisonFactor{{Key: "litres", Label: "Recommended water", Change: round(litresDelta, 1), Unit: "L", Direction: direction(litresDelta)}}
	if previous.ET0MM > 0 {
		delta := currentET0 - previous.ET0MM
		factors = append(factors, domain.ComparisonFactor{Key: "et0", Label: "Weather demand", Change: round(delta, 2), Unit: "mm", Direction: direction(delta)})
	}
	deltaRain := currentRain - previous.RainMM
	factors = append(factors, domain.ComparisonFactor{Key: "rain", Label: "Forecast rain", Change: round(deltaRain, 2), Unit: "mm", Direction: direction(deltaRain)})
	if previous.StageID != "" {
		note, changed := "Crop stage is unchanged.", "UNCHANGED"
		if previous.StageID != currentStage {
			changed = "CHANGED"
			note = fmt.Sprintf("Crop moved from %s to %s.", previous.StageID, currentStage)
		}
		factors = append(factors, domain.ComparisonFactor{Key: "stage", Label: "Crop stage", Direction: changed, Note: note})
	}
	summary := "Today is about the same as the previous saved recommendation."
	if math.Abs(litresDelta) >= 10 {
		word := "more"
		if litresDelta < 0 {
			word = "less"
		}
		summary = fmt.Sprintf("Today needs about %s litres %s than the previous saved recommendation.", formatInt(int(math.Round(math.Abs(litresDelta)))), word)
	}
	return &domain.PreviousComparison{Summary: summary, Factors: factors}
}

func deriveStage(age int, crop domain.Crop) (string, int, int, []string) {
	a, d, p := crop.StageDays.Establishing, crop.StageDays.Developing, crop.StageDays.Productive
	stage, start := "maturing", a+d+p
	switch {
	case age < a:
		stage, start = "establishing", 0
	case age < a+d:
		stage, start = "developing", a
	case age < a+d+p:
		stage, start = "productive", a+d
	}
	warnings := []string{}
	if age >= crop.TotalDays {
		warnings = append(warnings, "Crop age is beyond the catalog's expected harvest duration; review the planting date or start a new crop cycle.")
	}
	return stage, age - start + 1, start, warnings
}

func interpolateKC(age int, stage string, stageStart int, crop domain.Crop) float64 {
	switch stage {
	case "establishing":
		return crop.KC.Establishing
	case "developing":
		progress := float64(age-stageStart) / float64(max(1, crop.StageDays.Developing))
		return crop.KC.Establishing + progress*(crop.KC.Productive-crop.KC.Establishing)
	case "productive":
		return crop.KC.Productive
	default:
		progress := math.Min(1, float64(age-stageStart)/float64(max(1, crop.StageDays.Maturing)))
		return crop.KC.Productive + progress*(crop.KC.Maturing-crop.KC.Productive)
	}
}

func referenceET0(weather domain.WeatherSnapshot, date time.Time, latitude float64, constants domain.Constants) (float64, string, string) {
	if weather.ET0MM != nil && *weather.ET0MM >= 0.5 && *weather.ET0MM <= 12 {
		return *weather.ET0MM, "PROVIDER", ""
	}
	j := float64(date.YearDay())
	phi := latitude * math.Pi / 180
	dr := 1 + 0.033*math.Cos(2*math.Pi*j/365)
	delta := 0.409 * math.Sin(2*math.Pi*j/365-1.39)
	arg := -math.Tan(phi) * math.Tan(delta)
	arg = math.Max(-1, math.Min(1, arg))
	ws := math.Acos(arg)
	raMJ := (24 * 60 / math.Pi) * constants.SolarConstantMJ * dr * (ws*math.Sin(phi)*math.Sin(delta) + math.Cos(phi)*math.Cos(delta)*math.Sin(ws))
	raMM := constants.MJToMMConversion * raMJ
	tmean := (weather.TMinC + weather.TMaxC) / 2
	rangeC := math.Max(0, weather.TMaxC-weather.TMinC)
	eto := constants.HargreavesCoefficient * (tmean + constants.HargreavesTemperatureOffset) * math.Sqrt(rangeC) * raMM
	warning := ""
	if eto < 0.5 || eto > 12 || rangeC == 0 {
		eto = math.Max(0.5, math.Min(12, eto))
		warning = "Calculated Hargreaves ETo was outside the expected range and was bounded."
	}
	return eto, "HARGREAVES", warning
}

func effectiveRainfall(weather domain.WeatherSnapshot, etc float64, constants domain.Constants) (float64, bool, bool) {
	if weather.Source == "CLIMATOLOGY" || weather.RainNext24HMM < constants.EffectiveRainfallMinimumMM {
		return 0, false, false
	}
	if weather.RainProbability != nil {
		if *weather.RainProbability < constants.ForecastProbabilityThreshold {
			return 0, false, false
		}
		credit := math.Min(etc, weather.RainNext24HMM*constants.RainFactorWithProbability)
		return credit, credit > 0, false
	}
	credit := math.Min(etc, weather.RainNext24HMM*constants.RainFactorWithoutProbability)
	return credit, credit > 0, true
}

func confidence(weather domain.WeatherSnapshot, crop domain.Crop, estimated, probabilityMissing bool, et0Method string) (string, []string) {
	level := "HIGH"
	reasons := []string{}
	if weather.Source == "CLIMATOLOGY" {
		return "LOW", []string{"Seasonal temperature fallback", "No forecast rainfall credited"}
	}
	if weather.Source == "DEMO_FIXTURE" {
		return "LOW", []string{"Deterministic demo weather"}
	}
	if weather.Source == "MEMORY_CACHE" {
		level = "MEDIUM"
		reasons = append(reasons, "Recent cached weather")
	} else {
		reasons = append(reasons, "Live KijaniSpace weather")
	}
	if et0Method == "HARGREAVES" {
		level = lower(level, "MEDIUM")
		reasons = append(reasons, "Hargreaves reference ETo")
	}
	if estimated {
		level = lower(level, "MEDIUM")
		reasons = append(reasons, "Planting date estimated from crop age")
	} else {
		reasons = append(reasons, "Planting date known")
	}
	if probabilityMissing {
		level = lower(level, "MEDIUM")
	}
	if crop.Confidence == "LOW" {
		level = "LOW"
	} else if crop.Confidence == "MEDIUM" {
		level = lower(level, "MEDIUM")
	}
	return level, reasons
}

func evaluateSensorContext(obs *domain.SoilMoistureObservation, now time.Time) (*domain.SensorContext, []string, error) {
	if obs == nil {
		return &domain.SensorContext{Status: "NOT_CONNECTED", UsedForAdjustment: false, Reason: "AXIS is operating in sensor-free model mode."}, nil, nil
	}
	if obs.VolumetricWaterContentPC < 0 || obs.VolumetricWaterContentPC > 100 {
		return nil, nil, invalid("VALIDATION_FAILED", "plot.soil_moisture.volumetric_water_content_pct", "soil moisture must be between 0 and 100 percent")
	}
	observedAt, err := time.Parse(time.RFC3339, obs.ObservedAt)
	if err != nil {
		return nil, nil, invalid("VALIDATION_FAILED", "plot.soil_moisture.observed_at", "sensor observation time must be RFC3339")
	}
	if now.Sub(observedAt) > 6*time.Hour {
		return &domain.SensorContext{SoilMoistureConnected: true, UsedForAdjustment: false, Status: "STALE", Reason: "Reading is older than six hours."}, []string{"Soil-moisture reading was stale and did not change the recommendation."}, nil
	}
	calibrated := obs.FieldCapacityPC != nil && obs.WiltingPointPC != nil && obs.RootZoneDepthMM != nil && *obs.FieldCapacityPC > *obs.WiltingPointPC && *obs.RootZoneDepthMM > 0
	if !calibrated {
		return &domain.SensorContext{SoilMoistureConnected: true, UsedForAdjustment: false, Status: "UNCALIBRATED", Reason: "Field capacity, wilting point, and root-zone calibration are required."}, []string{"Soil-moisture reading is visible as context but did not change litres because calibration is incomplete."}, nil
	}
	return &domain.SensorContext{SoilMoistureConnected: true, UsedForAdjustment: false, Status: "CALIBRATED_PREVIEW", Reason: "Calibration is valid; the adjustment model remains feature-gated pending agronomic validation."}, []string{"Calibrated sensor detected. Sensor adjustment is in preview and did not change the deterministic recommendation."}, nil
}

func addIrrigationSensorResponse(sensorContext *domain.SensorContext, input *domain.IrrigationContext, now time.Time) error {
	if input == nil {
		return nil
	}
	if !finite(input.Litres) || input.Litres < 0 {
		return invalid("VALIDATION_FAILED", "irrigation_context.litres", "logged irrigation must be a non-negative number")
	}
	loggedAt, err := time.Parse(time.RFC3339, input.LoggedAt)
	if err != nil {
		return invalid("VALIDATION_FAILED", "irrigation_context.logged_at", "irrigation time must be RFC3339")
	}
	if input.SensorBefore == nil || input.SensorAfter == nil {
		return nil
	}
	before, after := input.SensorBefore, input.SensorAfter
	if before.SensorID == "" || before.SensorID != after.SensorID {
		return invalid("VALIDATION_FAILED", "irrigation_context.sensor_after.sensor_id", "before and after readings must come from the same sensor")
	}
	for field, observation := range map[string]*domain.SoilMoistureObservation{"sensor_before": before, "sensor_after": after} {
		if !finite(observation.VolumetricWaterContentPC) || observation.VolumetricWaterContentPC < 0 || observation.VolumetricWaterContentPC > 100 {
			return invalid("VALIDATION_FAILED", "irrigation_context."+field+".volumetric_water_content_pct", "soil moisture must be between 0 and 100 percent")
		}
	}
	beforeAt, err := time.Parse(time.RFC3339, before.ObservedAt)
	if err != nil {
		return invalid("VALIDATION_FAILED", "irrigation_context.sensor_before.observed_at", "sensor observation time must be RFC3339")
	}
	afterAt, err := time.Parse(time.RFC3339, after.ObservedAt)
	if err != nil {
		return invalid("VALIDATION_FAILED", "irrigation_context.sensor_after.observed_at", "sensor observation time must be RFC3339")
	}
	if beforeAt.After(loggedAt) || afterAt.Before(loggedAt) {
		return invalid("VALIDATION_FAILED", "irrigation_context", "sensor readings must surround the logged irrigation time")
	}
	change := after.VolumetricWaterContentPC - before.VolumetricWaterContentPC
	status := "INCREASED"
	observation := "The latest soil-moisture reading after irrigation is higher than the last reading before irrigation."
	if now.Sub(afterAt) > 6*time.Hour {
		status = "STALE"
		observation = "The post-irrigation soil-moisture reading is older than six hours, so AXIS does not draw a strong conclusion from it."
	} else if change <= 0 {
		status = "NO_INCREASE"
		observation = "The latest available sensor reading after irrigation does not show an increase in soil moisture; check the setup and conditions before drawing a conclusion."
	}
	sensorContext.SoilMoistureConnected = true
	sensorContext.IrrigationResponse = &domain.SensorIrrigationResponse{
		Status: status, IrrigationLoggedAt: loggedAt.UTC().Format(time.RFC3339), IrrigationLitres: round(input.Litres, 1),
		BeforeObservedAt: beforeAt.UTC().Format(time.RFC3339), AfterObservedAt: afterAt.UTC().Format(time.RFC3339),
		BeforeWaterContentPC: round(before.VolumetricWaterContentPC, 2), AfterWaterContentPC: round(after.VolumetricWaterContentPC, 2),
		ChangePercentagePoints: round(change, 2), Observation: observation,
	}
	return nil
}

func stageDisplayName(cat domain.Catalog, id string) string {
	for _, stage := range cat.StageModel.CanonicalStages {
		if stage.ID == id {
			return stage.DisplayName
		}
	}
	return strings.Title(id)
}

func headline(action string, litres int, window string, alreadyApplied bool) string {
	if action == "SKIP" {
		if alreadyApplied {
			return "No additional irrigation is recommended; today's logged water meets or exceeds the adjusted target."
		}
		return "Skip irrigation today; the modeled requirement is below the action threshold."
	}
	verb := "Apply"
	if action == "REDUCED" {
		verb = "Apply a rain-adjusted"
	}
	return fmt.Sprintf("%s %s litres today, preferably %s.", verb, formatInt(litres), strings.ToLower(strings.ReplaceAll(window, "_", " ")))
}

func invalid(code, field, message string) error {
	return ValidationError{Code: code, Field: field, Message: message}
}

func roundLitres(value float64) int {
	if value <= 0 {
		return 0
	}
	if value < 1000 {
		return roundToInt(value, 10)
	}
	return roundToInt(value, 50)
}

func roundToInt(value float64, step int) int { return int(math.Round(value/float64(step))) * step }
func round(value float64, decimals int) float64 {
	p := math.Pow10(decimals)
	return math.Round(value*p) / p
}
func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func lower(current, candidate string) string {
	rank := map[string]int{"LOW": 0, "MEDIUM": 1, "HIGH": 2}
	if rank[candidate] < rank[current] {
		return candidate
	}
	return current
}
func formatInt(value int) string {
	s := fmt.Sprintf("%d", value)
	for i := len(s) - 3; i > 0; i -= 3 {
		s = s[:i] + "," + s[i:]
	}
	return s
}
