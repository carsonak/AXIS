import type { StoredRecommendation } from './types'

export function applyLocalIrrigationFeedback(rec: StoredRecommendation, appliedToday: number, areaM2?: number): StoredRecommendation {
  const previousApplied = rec.decision.applied_today_litres ?? 0
  const target = rec.decision.daily_target_litres_exact ?? rec.decision.litres_exact + previousApplied
  const remaining = Math.max(0, target - appliedToday)
  const alreadyApplied = target > 0 && remaining === 0
  const action = alreadyApplied || target === 0 ? 'SKIP' : rec.decision.rain_adjustment_litres > 0 ? 'REDUCED' : 'IRRIGATE'
  const litres = roundDisplayLitres(remaining)
  const duration = remaining > 0 && rec.decision.duration_minutes !== undefined && rec.decision.litres_exact > 0
    ? Math.max(5, Math.round((rec.decision.duration_minutes * remaining / rec.decision.litres_exact) / 5) * 5)
    : undefined
  const window = rec.decision.recommended_window.toLowerCase().replaceAll('_', ' ')
  const headline = alreadyApplied
    ? "No additional irrigation is recommended; today's logged water meets or exceeds the adjusted target."
    : remaining === 0
      ? rec.decision.headline
      : `Apply${action === 'REDUCED' ? ' a rain-adjusted' : ''} ${litres.toLocaleString()} litres today, preferably ${window}.`
  const steps = rec.explanation.steps.map(step => {
    if (step.key === 'daily_target') return { ...step, value: Math.round(target * 10) / 10 }
    if (step.key === 'applied_today') return { ...step, value: Math.round(appliedToday * 10) / 10 }
    if (step.key === 'litres') return { ...step, value: Math.round(remaining * 10) / 10, note: alreadyApplied ? "Logged irrigation meets or exceeds today's adjusted target; no additional irrigation is recommended." : step.note }
    return step
  })
  return {
    ...rec,
    decision: {
      ...rec.decision,
      action,
      litres,
      litres_exact: Math.round(remaining * 10) / 10,
      daily_target_litres: rec.decision.daily_target_litres ?? roundDisplayLitres(target),
      daily_target_litres_exact: Math.round(target * 10) / 10,
      applied_today_litres: Math.round(appliedToday * 10) / 10,
      gross_depth_mm: areaM2 ? Math.round((remaining / areaM2) * 10) / 10 : rec.decision.gross_depth_mm,
      duration_minutes: duration,
      headline
    },
    explanation: { ...rec.explanation, steps }
  }
}

function roundDisplayLitres(value: number) {
  if (value <= 0) return 0
  const step = value < 1000 ? 10 : 50
  return Math.round(value / step) * step
}
