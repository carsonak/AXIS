import Dexie, { type EntityTable } from 'dexie'
import type { CatalogResponse, DecisionSnapshot, IrrigationEvent, IrrigationSensorContext, Plot, Recommendation, Settings, SoilMoistureReading, StoredInsight, StoredRecommendation, TimelineWeatherRecord } from './types'

interface CatalogRecord { id: 'catalog'; value: CatalogResponse; savedAt: string }

/** Device-local system of record for farmer data and cached server-derived data. */
export class AxisDatabase extends Dexie {
  plots!: EntityTable<Plot, 'id'>
  recommendations!: EntityTable<StoredRecommendation, 'id'>
  irrigationEvents!: EntityTable<IrrigationEvent, 'id'>
  catalog!: EntityTable<CatalogRecord, 'id'>
  settings!: EntityTable<Settings, 'id'>
  insights!: EntityTable<StoredInsight, 'id'>
  sensorReadings!: EntityTable<SoilMoistureReading, 'id'>
  decisionSnapshots!: EntityTable<DecisionSnapshot, 'id'>
  timelineWeather!: EntityTable<TimelineWeatherRecord, 'id'>

  constructor(name = 'axis') {
    super(name)
    // Dexie schemas are append-only migrations: keep old versions so existing devices upgrade in place.
    this.version(1).stores({
      plots: 'id, updatedAt, cropId',
      recommendations: 'id, plot_id, date, savedAt, [plot_id+date]',
      irrigationEvents: 'id, plotId, date, createdAt, [plotId+date]',
      catalog: 'id, savedAt',
      settings: 'id',
      insights: 'id, plotId, date, generatedAt',
      sensorReadings: 'id, plotId, observedAt'
    })
    this.version(2).stores({
      plots: 'id, updatedAt, cropId',
      recommendations: 'id, plot_id, date, savedAt, [plot_id+date]',
      irrigationEvents: 'id, plotId, date, createdAt, [plotId+date]',
      catalog: 'id, savedAt',
      settings: 'id',
      insights: 'id, plotId, date, generatedAt',
      sensorReadings: 'id, plotId, observedAt',
      decisionSnapshots: 'id, plotId, localDate, capturedAt, trigger, irrigationEventId, [plotId+localDate], [plotId+localDate+capturedAt], [plotId+localDate+trigger]'
    })
    this.version(3).stores({
      plots: 'id, updatedAt, cropId', recommendations: 'id, plot_id, date, savedAt, [plot_id+date]',
      irrigationEvents: 'id, plotId, date, createdAt, [plotId+date]', catalog: 'id, savedAt', settings: 'id',
      insights: 'id, plotId, date, generatedAt', sensorReadings: 'id, plotId, observedAt',
      decisionSnapshots: 'id, plotId, localDate, capturedAt, trigger, irrigationEventId, [plotId+localDate], [plotId+localDate+capturedAt], [plotId+localDate+trigger]',
      timelineWeather: 'id, plotId, date, kind, source, fetchedAt, [plotId+date]'
    })
  }
}

export const db = new AxisDatabase()

/** Creates the persistence boundary used by UI services and permits isolated databases in tests. */
export function createRepositories(database: AxisDatabase) {
  return {
  async getSettings(): Promise<Settings> {
    return (await database.settings.get('app')) ?? { id: 'app', areaUnit: 'acre', language: 'en' }
  },
  async saveSettings(value: Settings) { await database.settings.put(value) },
  async getCatalog() { return (await database.catalog.get('catalog'))?.value },
  async saveCatalog(value: CatalogResponse) { await database.catalog.put({ id: 'catalog', value, savedAt: new Date().toISOString() }) },
  async listPlots() { return database.plots.orderBy('updatedAt').reverse().toArray() },
  async getPlot(id: string) { return database.plots.get(id) },
  async savePlot(value: Plot) { await database.plots.put(value) },
  // Plot deletion owns the local cascade because IndexedDB does not provide foreign keys.
  async removePlot(id: string) {
    await database.transaction('rw', [database.plots, database.recommendations, database.irrigationEvents, database.insights, database.sensorReadings, database.decisionSnapshots, database.timelineWeather], async () => {
      await database.plots.delete(id)
      await database.recommendations.where('plot_id').equals(id).delete()
      await database.irrigationEvents.where('plotId').equals(id).delete()
      await database.insights.where('plotId').equals(id).delete()
      await database.sensorReadings.where('plotId').equals(id).delete()
      await database.decisionSnapshots.where('plotId').equals(id).delete()
      await database.timelineWeather.where('plotId').equals(id).delete()
    })
  },
  async saveRecommendation(value: Recommendation) {
    const stored: StoredRecommendation = { ...value, id: `${value.plot_id}:${value.date}`, savedAt: new Date().toISOString() }
    await database.recommendations.put(stored)
    return stored
  },
  async latestRecommendation(plotId: string) {
    const values = await database.recommendations.where('plot_id').equals(plotId).toArray()
    return values.sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))[0]
  },
  async previousRecommendation(plotId: string, beforeDate: string) {
    const values = await database.recommendations.where('plot_id').equals(plotId).toArray()
    return values.filter(v => v.date < beforeDate).sort((a, b) => b.date.localeCompare(a.date))[0]
  },
  async recommendationsForPlot(plotId: string, since: string) {
    const values = await database.recommendations.where('plot_id').equals(plotId).toArray()
    return values.filter(v => v.date >= since).sort((a, b) => b.date.localeCompare(a.date))
  },
  async recommendationForPlotDate(plotId: string, date: string) { return database.recommendations.get(`${plotId}:${date}`) },
  async allRecommendations() { return database.recommendations.toArray() },
  async saveEvent(value: IrrigationEvent) { await database.irrigationEvents.put(value) },
  async eventsForPlot(plotId: string, since: string) {
    const values = await database.irrigationEvents.where('plotId').equals(plotId).toArray()
    return values.filter(v => v.date >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async eventsForPlotDate(plotId: string, date: string) {
    return database.irrigationEvents.where('[plotId+date]').equals([plotId, date]).sortBy('createdAt')
  },
  async appliedForPlotDate(plotId: string, date: string) {
    const events = await database.irrigationEvents.where('[plotId+date]').equals([plotId, date]).toArray()
    return sumAppliedEvents(events, plotId, date)
  },
  async latestEvent(plotId: string) {
    const values = await database.irrigationEvents.where('plotId').equals(plotId).toArray()
    return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  },
  async saveInsight(value: StoredInsight) { await database.insights.put(value) },
  async getInsight(plotId: string, date: string) { return database.insights.get(`${plotId}:${date}`) },
  async saveSensorReading(value: SoilMoistureReading) { await database.sensorReadings.put(value) },
  async latestSensorReading(plotId: string) {
    const values = await database.sensorReadings.where('plotId').equals(plotId).toArray()
    return values.sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]
  },
  async latestSensorReadingAtOrBefore(plotId: string, timestamp: string) {
    const values = await database.sensorReadings.where('plotId').equals(plotId).toArray()
    const cutoff = Date.parse(timestamp)
    return values.filter(value => Date.parse(value.observedAt) <= cutoff).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]
  },
  async irrigationSensorContext(plotId: string, date: string): Promise<IrrigationSensorContext | undefined> {
    const [events, readings] = await Promise.all([
      database.irrigationEvents.where('[plotId+date]').equals([plotId, date]).toArray(),
      database.sensorReadings.where('plotId').equals(plotId).toArray()
    ])
    const event = events.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
    if (!event) return undefined
    const eventTime = Date.parse(event.createdAt)
    const before = readings.filter(reading => Date.parse(reading.observedAt) <= eventTime).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]
    if (!before) return { event }
    const after = readings
      .filter(reading => reading.sensorId === before.sensorId && Date.parse(reading.observedAt) >= eventTime)
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]
    return { event, before, after }
  },
  // Snapshots are immutable audit rows; add() deliberately rejects an existing deterministic ID.
  async saveSnapshot(value: DecisionSnapshot) { await database.decisionSnapshots.add(structuredClone(value)); return value },
  async snapshotsForPlot(plotId: string) {
    const values = await database.decisionSnapshots.where('plotId').equals(plotId).toArray()
    return values.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  },
  async snapshotsForDate(plotId: string, date: string) {
    return database.decisionSnapshots.where('[plotId+localDate]').equals([plotId, date]).sortBy('capturedAt')
  },
  async latestSnapshotForDate(plotId: string, date: string) {
    const values = await database.decisionSnapshots.where('[plotId+localDate]').equals([plotId, date]).toArray()
    return values.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]
  },
  async hasEndOfDaySnapshot(plotId: string, date: string) {
    const value = await database.decisionSnapshots.where('[plotId+localDate]').equals([plotId, date])
      .filter(snapshot => snapshot.trigger === 'END_OF_DAY' || snapshot.trigger === 'END_OF_DAY_CATCHUP').first()
    return Boolean(value)
  },
  async saveTimelineWeather(values: TimelineWeatherRecord[]) { await database.timelineWeather.bulkPut(values.map(value => structuredClone(value))) },
  // Coordinates are part of cache identity so an edited/moved plot cannot reuse weather for its old location.
  async timelineWeatherForPlot(plotId: string, lat: number, lon: number) {
    const values = await database.timelineWeather.where('plotId').equals(plotId).toArray()
    return values.filter(value => value.lat === lat && value.lon === lon).sort((a, b) => a.date.localeCompare(b.date))
  },
  async pruneTimelineWeather(plotId: string, historicalBefore: string, forecastBefore: string) {
    const values = await database.timelineWeather.where('plotId').equals(plotId).toArray()
    const expired = values.filter(value => value.kind === 'HISTORICAL' ? value.date < historicalBefore : value.date < forecastBefore)
    await database.timelineWeather.bulkDelete(expired.map(value => value.id))
  }
}
}

export type AxisRepositories = ReturnType<typeof createRepositories>
export const repos = createRepositories(db)

export function sumAppliedEvents(events: IrrigationEvent[], plotId: string, date: string) {
  return events.filter(event => event.plotId === plotId && event.date === date).reduce((sum, event) => sum + event.litres, 0)
}
