package irrigation

import (
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"testing"
	"time"

	axisassets "axis"
	"axis/backend/internal/catalog"
	"axis/backend/internal/domain"
)

var fixedNow = time.Date(2026, 8, 20, 15, 10, 0, 0, time.UTC)

func testCatalog(t *testing.T) domain.Catalog {
	t.Helper()
	cat, err := catalog.Load(axisassets.Files, "crops.json")
	if err != nil {
		t.Fatal(err)
	}
	return cat
}

func baseRequest() domain.RecommendationRequest {
	flow := 45.0
	return domain.RecommendationRequest{
		Date: "2026-08-20",
		Plot: domain.PlotCalculationInput{ID: "plot-1", Name: "Tomato plot", Lat: -0.0917, Lon: 34.7680, AreaM2: 1011.714, CropID: "tomato", PlantingDate: "2026-06-07", IrrigationMethodID: "drip", FlowRateLPM: &flow},
	}
}

func dryWeather() domain.WeatherSnapshot {
	return domain.WeatherSnapshot{Source: "KIJANISPACE", TMinC: 17.4, TMaxC: 28.8, RainNext24HMM: 0}
}

func TestHargreavesKisumuAndProductiveStage(t *testing.T) {
	rec, err := Compute(baseRequest(), dryWeather(), testCatalog(t), fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if rec.CropStage.ID != "productive" || rec.CropStage.StageDay != 5 || rec.CropStage.CropAgeDays != 74 {
		t.Fatalf("unexpected stage: %+v", rec.CropStage)
	}
	if math.Abs(*rec.Weather.ET0MM-4.66) > 0.08 {
		t.Fatalf("ETo = %.3f, want about 4.66", *rec.Weather.ET0MM)
	}
	if rec.Confidence.Level != "MEDIUM" {
		t.Fatalf("confidence = %s, Hargreaves must cap it at MEDIUM", rec.Confidence.Level)
	}
	if rec.EngineVersion == "" {
		t.Fatal("engine version is required")
	}
}

func TestStageBoundariesAreOneBased(t *testing.T) {
	cat := testCatalog(t)
	crop, _ := catalog.FindCrop(cat, "tomato")
	cases := []struct {
		age int
		id  string
		day int
	}{{0, "establishing", 1}, {29, "establishing", 30}, {30, "developing", 1}, {69, "developing", 40}, {70, "productive", 1}, {109, "productive", 40}, {110, "maturing", 1}, {135, "maturing", 26}}
	for _, tc := range cases {
		id, day, _, _ := deriveStage(tc.age, crop)
		if id != tc.id || day != tc.day {
			t.Errorf("age %d: got %s day %d, want %s day %d", tc.age, id, day, tc.id, tc.day)
		}
	}
}

func TestRainRulesAndAnalytics(t *testing.T) {
	cat := testCatalog(t)
	probability := .55
	wet := dryWeather()
	wet.RainNext24HMM = 4
	wet.RainProbability = &probability
	wetRec, err := Compute(baseRequest(), wet, cat, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	dryRec, err := Compute(baseRequest(), dryWeather(), cat, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if wetRec.Decision.Action != "REDUCED" {
		t.Fatalf("action = %s", wetRec.Decision.Action)
	}
	if wetRec.Decision.LitresExact >= dryRec.Decision.LitresExact {
		t.Fatal("qualifying rain did not reduce litres")
	}
	if math.Abs(wetRec.Decision.BaselineLitresNoRain-dryRec.Decision.LitresExact) > .2 {
		t.Fatal("no-rain baseline does not equal dry recommendation")
	}
	if math.Abs(wetRec.Decision.RainAdjustmentLitres-(wetRec.Decision.BaselineLitresNoRain-wetRec.Decision.LitresExact)) > .2 {
		t.Fatal("rain adjustment is inconsistent")
	}

	belowMinimum := dryWeather()
	belowMinimum.RainNext24HMM = 1.99
	belowMinimum.RainProbability = &probability
	belowRec, _ := Compute(baseRequest(), belowMinimum, cat, fixedNow)
	if belowRec.Decision.LitresExact != dryRec.Decision.LitresExact {
		t.Fatal("sub-2 mm rain should not be credited")
	}

	lowProbability := dryWeather()
	lowProbability.RainNext24HMM = 10
	p := .39
	lowProbability.RainProbability = &p
	lowRec, _ := Compute(baseRequest(), lowProbability, cat, fixedNow)
	if lowRec.Decision.LitresExact != dryRec.Decision.LitresExact {
		t.Fatal("low-probability rain should not be credited")
	}

	missingProbability := dryWeather()
	missingProbability.RainNext24HMM = 4
	missingRec, _ := Compute(baseRequest(), missingProbability, cat, fixedNow)
	if missingRec.Decision.LitresExact >= dryRec.Decision.LitresExact {
		t.Fatal("missing probability should credit 50% of qualifying rain")
	}
	if len(missingRec.Warnings) == 0 {
		t.Fatal("missing probability should add a warning")
	}
}

func TestClimatologyNeverCreditsAverageRain(t *testing.T) {
	climate := dryWeather()
	climate.Source = "CLIMATOLOGY"
	climate.RainNext24HMM = 20
	rec, err := Compute(baseRequest(), climate, testCatalog(t), fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if rec.Decision.RainAdjustmentLitres != 0 {
		t.Fatal("climatology rain must not reduce the recommendation")
	}
	if rec.Confidence.Level != "LOW" {
		t.Fatal("climatology confidence must be LOW")
	}
}

func TestEfficiencyFlowRoundingAndDeterminism(t *testing.T) {
	cat := testCatalog(t)
	drip, err := Compute(baseRequest(), dryWeather(), cat, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	request := baseRequest()
	request.Plot.IrrigationMethodID = "furrow"
	furrow, err := Compute(request, dryWeather(), cat, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if furrow.Decision.LitresExact <= drip.Decision.LitresExact {
		t.Fatal("lower-efficiency furrow must require more gross water")
	}
	if drip.Decision.DurationMinutes == nil || *drip.Decision.DurationMinutes%5 != 0 {
		t.Fatal("flow runtime must be present and rounded to five minutes")
	}
	again, _ := Compute(baseRequest(), dryWeather(), cat, fixedNow)
	if again.Decision.LitresExact != drip.Decision.LitresExact || *again.Weather.ET0MM != *drip.Weather.ET0MM {
		t.Fatal("identical inputs are not deterministic")
	}
}

func TestSkipReturnsZeroApplication(t *testing.T) {
	weather := dryWeather()
	weather.RainNext24HMM = 100
	p := 1.0
	weather.RainProbability = &p
	rec, err := Compute(baseRequest(), weather, testCatalog(t), fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if rec.Decision.Action != "SKIP" || rec.Decision.Litres != 0 || rec.Decision.LitresExact != 0 || rec.Decision.GrossDepthMM != 0 {
		t.Fatalf("unexpected skip decision: %+v", rec.Decision)
	}
	if rec.Decision.ModeledGrossDepthBeforeThreshold < 0 {
		t.Fatal("modeled pre-threshold depth must remain explainable")
	}
}

func TestValidationAndUnknownLookup(t *testing.T) {
	request := baseRequest()
	request.Plot.CropID = "invented"
	_, err := Compute(request, dryWeather(), testCatalog(t), fixedNow)
	var validation ValidationError
	if !errors.As(err, &validation) || validation.Code != "UNKNOWN_CROP" {
		t.Fatalf("unexpected error: %v", err)
	}
	request = baseRequest()
	request.Plot.AreaM2 = 0
	_, err = Compute(request, dryWeather(), testCatalog(t), fixedNow)
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("unexpected area error: %v", err)
	}
}

func TestSensorContextIsValidatedButDoesNotSilentlyChangeLitres(t *testing.T) {
	cat := testCatalog(t)
	baseline, _ := Compute(baseRequest(), dryWeather(), cat, fixedNow)
	fc, wp, root := 35.0, 15.0, 400.0
	request := baseRequest()
	request.Plot.SoilMoisture = &domain.SoilMoistureObservation{SensorID: "sensor-1", ObservedAt: fixedNow.Add(-time.Hour).Format(time.RFC3339), VolumetricWaterContentPC: 22, FieldCapacityPC: &fc, WiltingPointPC: &wp, RootZoneDepthMM: &root}
	withSensor, err := Compute(request, dryWeather(), cat, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if withSensor.SensorContext == nil || withSensor.SensorContext.Status != "CALIBRATED_PREVIEW" || withSensor.SensorContext.UsedForAdjustment {
		t.Fatalf("unexpected sensor context: %+v", withSensor.SensorContext)
	}
	if withSensor.Decision.LitresExact != baseline.Decision.LitresExact {
		t.Fatal("preview sensor must not silently change litres")
	}
	request.Plot.SoilMoisture.ObservedAt = fixedNow.Add(-7 * time.Hour).Format(time.RFC3339)
	stale, err := Compute(request, dryWeather(), cat, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if stale.SensorContext.Status != "STALE" {
		t.Fatalf("status = %s", stale.SensorContext.Status)
	}
}

func TestPreviousRecommendationComparisonUsesDeterministicInputs(t *testing.T) {
	request := baseRequest()
	request.PreviousRecommendation = &domain.PreviousRecommendation{Date: "2026-08-19", LitresExact: 3000, ET0MM: 4.2, RainMM: 1, StageID: "developing"}
	rec, err := Compute(request, dryWeather(), testCatalog(t), fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if rec.Comparison == nil || len(rec.Comparison.Factors) < 4 {
		t.Fatalf("comparison missing factors: %+v", rec.Comparison)
	}
	if rec.Decision.PreviousRecommendationDeltaLitres == nil {
		t.Fatal("litre delta is missing")
	}
	foundStage := false
	for _, factor := range rec.Comparison.Factors {
		if factor.Key == "stage" && factor.Direction == "CHANGED" {
			foundStage = true
		}
	}
	if !foundStage {
		t.Fatal("stage change was not identified")
	}
}

func TestGoldenFixtureMatchesEngine(t *testing.T) {
	data, err := axisassets.Files.ReadFile("fixtures/recommendations/tomato.json")
	if err != nil {
		t.Fatal(err)
	}
	var golden domain.IrrigationRecommendation
	if err := json.Unmarshal(data, &golden); err != nil {
		t.Fatal(err)
	}
	flow, probability := 45.0, .55
	request := domain.RecommendationRequest{Date: "2026-08-20", Plot: domain.PlotCalculationInput{ID: "local-uuid", Name: "Tomato plot", Lat: -.0917, Lon: 34.768, AreaM2: 1011.714, CropID: "tomato", PlantingDate: "2026-06-07", IrrigationMethodID: "drip", FlowRateLPM: &flow}}
	weather := domain.WeatherSnapshot{Source: "DEMO_FIXTURE", TMinC: 17.4, TMaxC: 28.8, RainNext24HMM: 4, RainProbability: &probability}
	actual, err := Compute(request, weather, testCatalog(t), fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(actual.Decision, golden.Decision) || actual.CropStage != golden.CropStage || actual.Confidence.Level != golden.Confidence.Level {
		t.Fatalf("golden fixture drifted\nactual: %+v\ngolden: %+v", actual.Decision, golden.Decision)
	}
}
