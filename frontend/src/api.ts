import type { APIError, CatalogResponse, Plot, Recommendation, SoilMoistureReading } from './types'

export interface HealthResponse {
  status: string; version: string; engine_version: string; weather_mode: 'live' | 'fixture'; ai_insights_enabled: boolean
  sensor_support: { soil_moisture_context: boolean; flow_meter_events: boolean }
}

export async function getHealth(): Promise<HealthResponse> { return request('/api/v1/health') }
export async function getCatalog(): Promise<CatalogResponse> { return request('/api/v1/catalog') }

export async function createRecommendation(plot: Plot, date: string, previous?: Recommendation, soil?: SoilMoistureReading): Promise<Recommendation> {
  return request('/api/v1/recommendations', {
    method: 'POST',
    body: JSON.stringify({
      plot: {
        id: plot.id, name: plot.name, lat: plot.lat, lon: plot.lon, area_m2: plot.areaM2,
        crop_id: plot.cropId, planting_date: plot.plantingDate, planting_date_estimated: plot.plantingDateEstimated,
        irrigation_method_id: plot.irrigationMethodId, flow_rate_lpm: plot.flowRateLpm,
        soil_moisture: soil ? {
          sensor_id: soil.sensorId, observed_at: soil.observedAt, volumetric_water_content_pct: soil.volumetricWaterContentPct,
          field_capacity_pct: soil.fieldCapacityPct, wilting_point_pct: soil.wiltingPointPct, root_zone_depth_mm: soil.rootZoneDepthMm
        } : undefined
      },
      date,
      previous_recommendation: previous ? {
        date: previous.date, litres_exact: previous.decision.litres_exact, et0_mm: previous.weather.et0_mm,
        rain_mm: previous.weather.rain_next_24h_mm, stage_id: previous.crop_stage.id
      } : undefined
    })
  })
}

export interface InsightHistoryItem { date: string; recommended_litres: number; applied_litres?: number; rain_adjustment_litres?: number }
export interface InsightResponse { summary: string; observations: string[]; language: string; generated_at: string; label: string }
export async function createInsight(recommendation: Recommendation, history: InsightHistoryItem[], language: string): Promise<InsightResponse> {
  return request('/api/v1/insights', { method: 'POST', body: JSON.stringify({ recommendation, history: history.slice(0, 7), language }) })
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
