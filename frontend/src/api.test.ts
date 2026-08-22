import { describe, expect, it } from 'vitest'
import { toAPIRecommendation } from './api'
import { sampleRecommendation } from './test-fixtures'
import type { StoredRecommendation } from './types'

describe('insight API serialization', () => {
  it('removes IndexedDB and future local metadata', () => {
    const stored = { ...sampleRecommendation(), id: 'plot-1:2026-08-22', savedAt: 'now', futureLocalFlag: true } as StoredRecommendation & { futureLocalFlag: boolean }
    const serialized = JSON.parse(JSON.stringify(toAPIRecommendation(stored))) as Record<string, unknown>
    expect(serialized).not.toHaveProperty('id')
    expect(serialized).not.toHaveProperty('savedAt')
    expect(serialized).not.toHaveProperty('futureLocalFlag')
    expect(serialized.decision).toMatchObject({ daily_target_litres_exact: 2850, applied_today_litres: 2000, litres_exact: 850 })
  })
})
