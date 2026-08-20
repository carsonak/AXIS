import Dexie, { type EntityTable } from 'dexie'
import type { CatalogResponse, IrrigationEvent, Plot, Recommendation, Settings, SoilMoistureReading, StoredInsight, StoredRecommendation } from './types'

interface CatalogRecord { id: 'catalog'; value: CatalogResponse; savedAt: string }

class AxisDatabase extends Dexie {
  plots!: EntityTable<Plot, 'id'>
  recommendations!: EntityTable<StoredRecommendation, 'id'>
  irrigationEvents!: EntityTable<IrrigationEvent, 'id'>
  catalog!: EntityTable<CatalogRecord, 'id'>
  settings!: EntityTable<Settings, 'id'>
  insights!: EntityTable<StoredInsight, 'id'>
  sensorReadings!: EntityTable<SoilMoistureReading, 'id'>

  constructor() {
    super('axis')
    this.version(1).stores({
      plots: 'id, updatedAt, cropId',
      recommendations: 'id, plot_id, date, savedAt, [plot_id+date]',
      irrigationEvents: 'id, plotId, date, createdAt, [plotId+date]',
      catalog: 'id, savedAt',
      settings: 'id',
      insights: 'id, plotId, date, generatedAt',
      sensorReadings: 'id, plotId, observedAt'
    })
  }
}

export const db = new AxisDatabase()

export const repos = {
  async getSettings(): Promise<Settings> {
    return (await db.settings.get('app')) ?? { id: 'app', areaUnit: 'acre', language: 'en' }
  },
  async saveSettings(value: Settings) { await db.settings.put(value) },
  async getCatalog() { return (await db.catalog.get('catalog'))?.value },
  async saveCatalog(value: CatalogResponse) { await db.catalog.put({ id: 'catalog', value, savedAt: new Date().toISOString() }) },
  async listPlots() { return db.plots.orderBy('updatedAt').reverse().toArray() },
  async getPlot(id: string) { return db.plots.get(id) },
  async savePlot(value: Plot) { await db.plots.put(value) },
  async removePlot(id: string) {
    await db.transaction('rw', [db.plots, db.recommendations, db.irrigationEvents, db.insights, db.sensorReadings], async () => {
      await db.plots.delete(id)
      await db.recommendations.where('plot_id').equals(id).delete()
      await db.irrigationEvents.where('plotId').equals(id).delete()
      await db.insights.where('plotId').equals(id).delete()
      await db.sensorReadings.where('plotId').equals(id).delete()
    })
  },
  async saveRecommendation(value: Recommendation) {
    const stored: StoredRecommendation = { ...value, id: `${value.plot_id}:${value.date}`, savedAt: new Date().toISOString() }
    await db.recommendations.put(stored)
    return stored
  },
  async latestRecommendation(plotId: string) {
    const values = await db.recommendations.where('plot_id').equals(plotId).toArray()
    return values.sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))[0]
  },
  async previousRecommendation(plotId: string, beforeDate: string) {
    const values = await db.recommendations.where('plot_id').equals(plotId).toArray()
    return values.filter(v => v.date < beforeDate).sort((a, b) => b.date.localeCompare(a.date))[0]
  },
  async recommendationsForPlot(plotId: string, since: string) {
    const values = await db.recommendations.where('plot_id').equals(plotId).toArray()
    return values.filter(v => v.date >= since).sort((a, b) => b.date.localeCompare(a.date))
  },
  async saveEvent(value: IrrigationEvent) { await db.irrigationEvents.put(value) },
  async eventsForPlot(plotId: string, since: string) {
    const values = await db.irrigationEvents.where('plotId').equals(plotId).toArray()
    return values.filter(v => v.date >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async latestEvent(plotId: string) {
    const values = await db.irrigationEvents.where('plotId').equals(plotId).toArray()
    return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  },
  async saveInsight(value: StoredInsight) { await db.insights.put(value) },
  async getInsight(plotId: string, date: string) { return db.insights.get(`${plotId}:${date}`) },
  async saveSensorReading(value: SoilMoistureReading) { await db.sensorReadings.put(value) },
  async latestSensorReading(plotId: string) {
    const values = await db.sensorReadings.where('plotId').equals(plotId).toArray()
    return values.sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]
  }
}
