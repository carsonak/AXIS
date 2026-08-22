import type { APIError, CatalogResponse, IrrigationSensorContext, Plot, Recommendation, SoilMoistureReading, WeatherTimelineResponse } from './types'

export interface HealthResponse {
  status: string; version: string; engine_version: string; weather_mode: 'live' | 'fixture'; ai_insights_enabled: boolean
  sensor_support: { soil_moisture_context: boolean; flow_meter_events: boolean }
}

export async function getHealth(): Promise<HealthResponse> { return request('/api/v1/health') }
export async function getCatalog(): Promise<CatalogResponse> { return request('/api/v1/catalog') }

function apiSoil(reading?: SoilMoistureReading) {
  return reading ? {
    sensor_id: reading.sensorId, observed_at: reading.observedAt, volumetric_water_content_pct: reading.volumetricWaterContentPct,
    field_capacity_pct: reading.fieldCapacityPct, wilting_point_pct: reading.wiltingPointPct, root_zone_depth_mm: reading.rootZoneDepthMm
  } : undefined
}

function apiPlot(plot: Plot) {
  return {
    id: plot.id, name: plot.name, lat: plot.lat, lon: plot.lon, area_m2: plot.areaM2,
    crop_id: plot.cropId, planting_date: plot.plantingDate, planting_date_estimated: plot.plantingDateEstimated,
    irrigation_method_id: plot.irrigationMethodId, flow_rate_lpm: plot.flowRateLpm
  }
}

export async function createRecommendation(plot: Plot, date: string, previous?: Recommendation, soil?: SoilMoistureReading, appliedTodayLitres = 0, context?: IrrigationSensorContext): Promise<Recommendation> {
  return request('/api/v1/recommendations', {
    method: 'POST',
    body: JSON.stringify({
      plot: { ...apiPlot(plot), soil_moisture: apiSoil(soil) },
      date,
      applied_today_litres: appliedTodayLitres,
      irrigation_context: context ? {
        logged_at: context.event.createdAt, litres: context.event.litres,
        sensor_before: apiSoil(context.before), sensor_after: apiSoil(context.after)
      } : undefined,
      previous_recommendation: previous ? {
        date: previous.date, litres_exact: previous.decision.litres_exact, et0_mm: previous.weather.et0_mm,
        daily_target_litres_exact: previous.decision.daily_target_litres_exact,
        rain_mm: previous.weather.rain_next_24h_mm, stage_id: previous.crop_stage.id
      } : undefined
    })
  })
}

export async function getHistoricalWeather(lat: number, lon: number, startDate: string, endDate: string): Promise<WeatherTimelineResponse> {
  const query = new URLSearchParams({ latitude: String(lat), longitude: String(lon), start_date: startDate, end_date: endDate })
  return request(`/api/v1/weather/history?${query}`)
}

export async function getForecastTimeline(plot: Plot): Promise<WeatherTimelineResponse> {
  return request('/api/v1/weather/forecast', { method: 'POST', body: JSON.stringify({ plot: apiPlot(plot) }) })
}

export interface InsightHistoryItem { date: string; recommended_litres: number; applied_litres?: number; rain_adjustment_litres?: number }
export interface InsightResponse { summary: string; observations: string[]; language: string; generated_at: string; label: string }

/** Explicit API boundary: persisted IndexedDB metadata is never serialized. */
export function toAPIRecommendation(rec: Recommendation): Recommendation {
  const decision = rec.decision
  const sensor = rec.sensor_context
  const applied = decision.applied_today_litres ?? 0
  const targetExact = decision.daily_target_litres_exact ?? decision.litres_exact + applied
  return {
    plot_id: rec.plot_id, date: rec.date, generated_at: rec.generated_at, engine_version: rec.engine_version,
    crop_stage: { id: rec.crop_stage.id, display_name: rec.crop_stage.display_name, crop_age_days: rec.crop_stage.crop_age_days, stage_day: rec.crop_stage.stage_day },
    decision: {
      action: decision.action, litres: decision.litres, litres_exact: decision.litres_exact,
      daily_target_litres: decision.daily_target_litres ?? decision.litres, daily_target_litres_exact: targetExact,
      applied_today_litres: applied, gross_depth_mm: decision.gross_depth_mm,
      modeled_gross_depth_before_threshold_mm: decision.modeled_gross_depth_before_threshold_mm,
      duration_minutes: decision.duration_minutes, recommended_window: decision.recommended_window, headline: decision.headline,
      baseline_litres_no_rain: decision.baseline_litres_no_rain, rain_adjustment_litres: decision.rain_adjustment_litres,
      previous_recommendation_delta_litres: decision.previous_recommendation_delta_litres
    },
    weather: {
      source: rec.weather.source, provider_observed_at: rec.weather.provider_observed_at, t_min_c: rec.weather.t_min_c,
      t_max_c: rec.weather.t_max_c, wind_ms: rec.weather.wind_ms, rain_next_24h_mm: rec.weather.rain_next_24h_mm,
      rain_probability: rec.weather.rain_probability, et0_mm: rec.weather.et0_mm, et0_method: rec.weather.et0_method
    },
    explanation: { summary: rec.explanation.summary, steps: rec.explanation.steps.map(step => ({ key: step.key, label: step.label, value: step.value, unit: step.unit, note: step.note })) },
    confidence: { level: rec.confidence.level, reasons: [...rec.confidence.reasons] },
    sensor_context: sensor ? {
      soil_moisture_connected: sensor.soil_moisture_connected, used_for_adjustment: sensor.used_for_adjustment,
      status: sensor.status, reason: sensor.reason,
      irrigation_response: sensor.irrigation_response ? { ...sensor.irrigation_response } : undefined
    } : undefined,
    comparison: rec.comparison ? { summary: rec.comparison.summary, factors: rec.comparison.factors.map(factor => ({ ...factor })) } : undefined,
    warnings: [...rec.warnings]
  }
}
/**
 * Requests grounded AI qualitative explanation of deterministic irrigation recommendations.
 * Enforces a maximum of 7 history items per system safety invariants.
 */
export async function createInsight(question: string, recommendation: Recommendation, history: InsightHistoryItem[], language: string): Promise<InsightResponse> {
  return request('/api/v1/insights', { method: 'POST', body: JSON.stringify({ question, recommendation: toAPIRecommendation(recommendation), history: history.slice(0, 7), language }) })
}


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(path, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
    const body = await response.json() as T | APIError
    if (!response.ok) throw new Error('error' in (body as object) ? (body as APIError).error.message : `Request failed (${response.status})`)
    return body as T
  } finally { window.clearTimeout(timer) }
}
