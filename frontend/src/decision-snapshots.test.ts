import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AxisDatabase, createRepositories, type AxisRepositories } from './db'
import { DecisionSnapshotService, finalSnapshotId, nairobiHour } from './decision-snapshots'
import { sampleRecommendation } from './test-fixtures'
import type { IrrigationEvent, Plot, SoilMoistureReading, StoredRecommendation } from './types'
import { nairobiDate } from './utils'

let database: AxisDatabase
let repositories: AxisRepositories
let service: DecisionSnapshotService

const plot = (id = 'plot-1'): Plot => ({
  id, name: id, lat: -0.09, lon: 34.76, areaM2: 1000, cropId: 'tomato', plantingDate: '2026-06-01',
  plantingDateEstimated: false, irrigationMethodId: 'drip', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-08-22T00:00:00Z'
})

function storedRecommendation(plotId = 'plot-1', date = '2026-08-22', rain = 2): StoredRecommendation {
  const value = sampleRecommendation()
  return {
    ...value,
    plot_id: plotId,
    date,
    id: `${plotId}:${date}`,
    savedAt: `${date}T06:05:00Z`,
    weather: { ...value.weather, rain_next_24h_mm: rain, provider_observed_at: `${date}T05:00:00Z` }
  }
}

function event(id: string, litres: number, createdAt = '2026-08-22T07:10:00Z'): IrrigationEvent {
  return { id, plotId: 'plot-1', date: '2026-08-22', litres, source: 'MANUAL', createdAt }
}

beforeEach(async () => {
  database = new AxisDatabase(`axis-snapshots-${crypto.randomUUID()}`)
  repositories = createRepositories(database)
  service = new DecisionSnapshotService(database, repositories)
  await repositories.savePlot(plot())
  await database.recommendations.put(storedRecommendation())
})

afterEach(async () => {
  await database.delete()
})

describe('irrigation decision snapshots', () => {
  it('atomically saves an event with its authoritative post-event balance', async () => {
    const snapshot = await service.recordIrrigationEvent(event('event-1', 1000), storedRecommendation(), plot())

    expect(await database.irrigationEvents.get('event-1')).toBeDefined()
    expect(snapshot.waterBalance).toMatchObject({
      dailyTargetLitres: 2850,
      appliedBeforeEventLitres: 0,
      eventAppliedLitres: 1000,
      cumulativeAppliedLitres: 1000,
      remainingLitres: 1850,
      action: 'REDUCED'
    })
    expect(snapshot.weather.rain_next_24h_mm).toBe(2)
    expect(snapshot.recommendation).not.toHaveProperty('weather')
  })

  it('preserves multiple event snapshots and earlier forecast issuance state', async () => {
    await service.recordIrrigationEvent(event('event-1', 1000), storedRecommendation(), plot())
    const refreshed = storedRecommendation('plot-1', '2026-08-22', 7)
    refreshed.savedAt = '2026-08-22T11:45:00Z'
    await database.recommendations.put(refreshed)
    await service.recordIrrigationEvent(event('event-2', 700, '2026-08-22T11:20:00Z'), refreshed, plot())

    const snapshots = await repositories.snapshotsForDate('plot-1', '2026-08-22')
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].weather.rain_next_24h_mm).toBe(2)
    expect(snapshots[1].weather.rain_next_24h_mm).toBe(7)
    expect(snapshots[1].waterBalance).toMatchObject({ appliedBeforeEventLitres: 1000, cumulativeAppliedLitres: 1700, remainingLitres: 1150 })
  })

  it('copies soil moisture when present and works without it', async () => {
    const reading: SoilMoistureReading = {
      id: 'reading-1', plotId: 'plot-1', sensorId: 'sensor-1', observedAt: '2026-08-22T07:00:00Z',
      volumetricWaterContentPct: 28, fieldCapacityPct: 40, connection: 'MANUAL_IMPORT'
    }
    await repositories.saveSensorReading(reading)
    const withReading = await service.recordIrrigationEvent(event('event-1', 100), storedRecommendation(), plot())
    const withoutReading = await service.recordIrrigationEvent(event('event-2', 100, '2026-08-22T06:00:00Z'), storedRecommendation(), plot())

    expect(withReading.latestSoilMoisture).toEqual(reading)
    expect(withoutReading.latestSoilMoisture).toBeUndefined()
  })

  it('rolls back the event when its immutable snapshot cannot be added', async () => {
    const value = event('event-1', 100)
    const existing = await service.recordIrrigationEvent(value, storedRecommendation(), plot())
    await database.irrigationEvents.delete(value.id)

    await expect(service.recordIrrigationEvent(value, storedRecommendation(), plot())).rejects.toMatchObject({ name: 'ConstraintError' })
    expect(await database.irrigationEvents.get(value.id)).toBeUndefined()
    expect(await database.decisionSnapshots.get(existing.id)).toBeDefined()
  })
})

describe('daily finalization', () => {
  it('finalizes every eligible plot once during the final Nairobi hour', async () => {
    await repositories.savePlot(plot('plot-2'))
    await database.recommendations.put(storedRecommendation('plot-2'))
    const now = new Date('2026-08-22T20:30:00Z')
    const [first, concurrent] = await Promise.all([service.finalizeEligibleDays(now), service.finalizeEligibleDays(now)])

    expect(first).toHaveLength(2)
    expect(concurrent).toEqual(first)
    expect(await database.decisionSnapshots.count()).toBe(2)
    expect(await repositories.hasEndOfDaySnapshot('plot-1', '2026-08-22')).toBe(true)
    expect(await repositories.hasEndOfDaySnapshot('plot-2', '2026-08-22')).toBe(true)
    expect((await database.decisionSnapshots.get(finalSnapshotId('plot-1', '2026-08-22')))?.trigger).toBe('END_OF_DAY')
  })

  it('creates truthful catch-up snapshots for every unfinished past date', async () => {
    await database.recommendations.put(storedRecommendation('plot-1', '2026-08-21'))
    const now = new Date('2026-08-24T09:00:00Z')
    const snapshots = await service.finalizeEligibleDays(now)

    expect(snapshots.map(snapshot => snapshot.localDate)).toEqual(['2026-08-21', '2026-08-22'])
    expect(snapshots.every(snapshot => snapshot.trigger === 'END_OF_DAY_CATCHUP')).toBe(true)
    expect(snapshots.every(snapshot => snapshot.capturedAt === now.toISOString())).toBe(true)
  })

  it('uses Africa/Nairobi date and hour boundaries', async () => {
    expect(nairobiDate(new Date('2026-08-22T19:59:59Z'))).toBe('2026-08-22')
    expect(nairobiHour(new Date('2026-08-22T19:59:59Z'))).toBe(22)
    expect(await service.finalizeEligibleDays(new Date('2026-08-22T19:59:59Z'))).toEqual([])
    expect(nairobiHour(new Date('2026-08-22T20:00:00Z'))).toBe(23)
    expect(await service.finalizeEligibleDays(new Date('2026-08-22T20:00:00Z'))).toHaveLength(1)
    expect(nairobiDate(new Date('2026-08-22T21:00:00Z'))).toBe('2026-08-23')
    expect(nairobiHour(new Date('2026-08-22T21:00:00Z'))).toBe(0)
  })
})

describe('IndexedDB migration', () => {
  it('opens version 1 data at version 2 without deleting existing records', async () => {
    await database.delete()
    const name = `axis-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      plots: 'id, updatedAt, cropId',
      recommendations: 'id, plot_id, date, savedAt, [plot_id+date]',
      irrigationEvents: 'id, plotId, date, createdAt, [plotId+date]',
      catalog: 'id, savedAt', settings: 'id', insights: 'id, plotId, date, generatedAt', sensorReadings: 'id, plotId, observedAt'
    })
    await legacy.table('plots').put(plot())
    await legacy.table('recommendations').put(storedRecommendation())
    await legacy.table('irrigationEvents').put(event('legacy-event', 50))
    await legacy.table('settings').put({ id: 'app', areaUnit: 'acre', language: 'en' })
    await legacy.table('insights').put({ id: 'plot-1:2026-08-22', plotId: 'plot-1', date: '2026-08-22', summary: 'Saved', observations: [], language: 'en', generatedAt: '2026-08-22T08:00:00Z', label: 'AI-generated' })
    await legacy.table('sensorReadings').put({ id: 'legacy-reading', plotId: 'plot-1', sensorId: 'sensor-1', observedAt: '2026-08-22T07:00:00Z', volumetricWaterContentPct: 25, connection: 'MANUAL_IMPORT' })
    legacy.close()

    database = new AxisDatabase(name)
    await database.open()
    expect(await database.plots.count()).toBe(1)
    expect(await database.recommendations.count()).toBe(1)
    expect(await database.irrigationEvents.count()).toBe(1)
    expect(await database.settings.count()).toBe(1)
    expect(await database.insights.count()).toBe(1)
    expect(await database.sensorReadings.count()).toBe(1)
    expect(await database.decisionSnapshots.count()).toBe(0)
    expect(await database.timelineWeather.count()).toBe(0)
  })
})
