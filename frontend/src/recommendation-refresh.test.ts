import { describe, expect, it } from 'vitest'
import { sumAppliedEvents } from './db'
import { applyLocalIrrigationFeedback } from './irrigation-feedback'
import { sampleRecommendation } from './test-fixtures'
import type { IrrigationEvent, StoredRecommendation } from './types'

const event = (plotId: string, date: string, litres: number): IrrigationEvent => ({ id: crypto.randomUUID(), plotId, date, litres, source: 'MANUAL', createdAt: `${date}T08:00:00Z` })

describe('local irrigation feedback', () => {
  it('sums only matching plot and date', () => {
    const events = [event('plot-1', '2026-08-22', 800), event('plot-1', '2026-08-22', 600), event('plot-2', '2026-08-22', 900), event('plot-1', '2026-08-21', 500)]
    expect(sumAppliedEvents(events, 'plot-1', '2026-08-22')).toBe(1400)
  })

  it('uses the saved daily target and clamps remaining water', () => {
    const stored = { ...sampleRecommendation(), id: 'id', savedAt: 'saved' } as StoredRecommendation
    expect(applyLocalIrrigationFeedback(stored, 2200, 1000).decision.litres_exact).toBe(650)
    const complete = applyLocalIrrigationFeedback(stored, 3000, 1000)
    expect(complete.decision.litres_exact).toBe(0)
    expect(complete.decision.action).toBe('SKIP')
  })

  it('backfills legacy recommendations from their last known remaining value', () => {
    const stored = { ...sampleRecommendation(), id: 'id', savedAt: 'saved' } as StoredRecommendation
    const legacy = { ...stored, decision: { ...stored.decision, daily_target_litres: undefined, daily_target_litres_exact: undefined, applied_today_litres: undefined } } as unknown as StoredRecommendation
    expect(applyLocalIrrigationFeedback(legacy, 200, 1000).decision.litres_exact).toBe(650)
  })
})
