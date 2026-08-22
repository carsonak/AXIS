import type { Recommendation } from './types'

export function sampleRecommendation(): Recommendation {
  return {
    plot_id: 'plot-1', date: '2026-08-22', generated_at: '2026-08-22T08:00:00Z', engine_version: '0.1.0',
    crop_stage: { id: 'productive', display_name: 'Productive', crop_age_days: 70, stage_day: 1 },
    decision: { action: 'IRRIGATE', litres: 850, litres_exact: 850, daily_target_litres: 2850, daily_target_litres_exact: 2850, applied_today_litres: 2000, gross_depth_mm: .85, recommended_window: 'EARLY_MORNING', headline: 'Apply 850 litres.', baseline_litres_no_rain: 3200, rain_adjustment_litres: 350 },
    weather: { source: 'KIJANISPACE', t_min_c: 17, t_max_c: 29, rain_next_24h_mm: 2, et0_mm: 4.6, et0_method: 'HARGREAVES' },
    explanation: { summary: 'Grounded.', steps: [] }, confidence: { level: 'MEDIUM', reasons: ['Live weather'] }, warnings: []
  }
}
