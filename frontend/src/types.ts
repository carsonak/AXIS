export type StageId = 'establishing' | 'developing' | 'productive' | 'maturing'
export type WeatherSource = 'KIJANISPACE' | 'MEMORY_CACHE' | 'CLIMATOLOGY' | 'DEMO_FIXTURE'

export interface StageDays { establishing: number; developing: number; productive: number; maturing: number }
export interface CatalogCrop {
  id: string; display_name: string; display_name_sw?: string; total_days: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; stage_days: StageDays
}
export interface IrrigationMethod {
  id: string; display_name: string; display_name_sw?: string; efficiency: number; preferred_window: 'EARLY_MORNING' | 'EVENING' | 'ANY'
}
export interface CatalogResponse {
  schema_version: string; engine_version: string
  stages: Array<{ id: StageId; display_name: string; display_name_sw?: string }>
  crops: CatalogCrop[]; irrigation_methods: IrrigationMethod[]
}

export interface Plot {
  id: string; name: string; lat: number; lon: number; areaM2: number; cropId: string
  plantingDate: string; plantingDateEstimated: boolean; irrigationMethodId: string
  flowRateLpm?: number; createdAt: string; updatedAt: string
}

export interface SoilMoistureReading {
  id: string; plotId: string; sensorId: string; observedAt: string
  volumetricWaterContentPct: number; fieldCapacityPct?: number; wiltingPointPct?: number; rootZoneDepthMm?: number
  connection: 'MANUAL_IMPORT' | 'BLUETOOTH_ADAPTER' | 'GATEWAY'
}

export interface WeatherSummary {
  source: WeatherSource; provider_observed_at?: string; t_min_c: number; t_max_c: number; wind_ms?: number
  rain_next_24h_mm: number; rain_probability?: number; et0_mm: number; et0_method: 'PROVIDER' | 'HARGREAVES'
}
export interface Recommendation {
  plot_id: string; date: string; generated_at: string; engine_version: string
  crop_stage: { id: StageId; display_name: string; crop_age_days: number; stage_day: number }
  decision: {
    action: 'IRRIGATE' | 'REDUCED' | 'SKIP'; litres: number; litres_exact: number; gross_depth_mm: number
    modeled_gross_depth_before_threshold_mm?: number; duration_minutes?: number; recommended_window: string; headline: string
    baseline_litres_no_rain: number; rain_adjustment_litres: number; previous_recommendation_delta_litres?: number
  }
  weather: WeatherSummary
  explanation: { summary: string; steps: Array<{ key: string; label: string; value: number; unit: string; note?: string }> }
  confidence: { level: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[] }
  sensor_context?: { soil_moisture_connected: boolean; used_for_adjustment: boolean; status: string; reason?: string }
  comparison?: { summary: string; factors: Array<{ key: string; label: string; change?: number; unit?: string; direction: string; note?: string }> }
  warnings: string[]
}

export interface StoredRecommendation extends Recommendation { id: string; savedAt: string }

export interface IrrigationEvent {
  id: string; plotId: string; date: string; litres: number; recommendedLitres?: number
  source: 'FOLLOWED_RECOMMENDATION' | 'MANUAL' | 'FLOW_METER'
  createdAt: string; meterId?: string; meterStartLitres?: number; meterEndLitres?: number
}

export interface Settings {
  id: 'app'; selectedPlotId?: string; areaUnit: 'acre' | 'hectare' | 'm2'; language: 'en' | 'sw'; defaultIrrigationMethodId?: string
}

export interface StoredInsight {
  id: string; plotId: string; date: string; summary: string; observations: string[]; language: string; generatedAt: string; label: string
}

export interface APIError { error: { code: string; message: string; field?: string } }
