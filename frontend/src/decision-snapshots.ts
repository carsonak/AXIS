import { db, repos, type AxisDatabase, type AxisRepositories } from './db'
import { applyLocalIrrigationFeedback } from './irrigation-feedback'
import type { DecisionSnapshot, DecisionSnapshotTrigger, IrrigationEvent, Plot, Recommendation, SoilMoistureReading, StoredRecommendation } from './types'
import { nairobiDate } from './utils'

export const irrigationSnapshotId = (eventId: string) => `decision:event:${eventId}`
export const finalSnapshotId = (plotId: string, date: string) => `decision:final:${plotId}:${date}`

export function nairobiHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).find(part => part.type === 'hour')?.value
  return Number(hour ?? 0)
}

function recommendationWithoutWeather(value: StoredRecommendation): Omit<Recommendation, 'weather'> {
  const copy = structuredClone(value) as StoredRecommendation & { weather?: StoredRecommendation['weather']; id?: string; savedAt?: string }
  Reflect.deleteProperty(copy, 'weather')
  Reflect.deleteProperty(copy, 'id')
  Reflect.deleteProperty(copy, 'savedAt')
  return copy
}

function snapshotFromState({
  id,
  localDate,
  recommendation,
  capturedAt,
  trigger,
  appliedBeforeEventLitres,
  event,
  cumulativeAppliedLitres,
  reconciled,
  latestSoilMoisture
}: {
  id: string
  localDate?: string
  recommendation: StoredRecommendation
  capturedAt: string
  trigger: DecisionSnapshotTrigger
  appliedBeforeEventLitres: number
  event?: IrrigationEvent
  cumulativeAppliedLitres: number
  reconciled: StoredRecommendation
  latestSoilMoisture?: SoilMoistureReading
}): DecisionSnapshot {
  const snapshot: DecisionSnapshot = {
    id,
    plotId: recommendation.plot_id,
    localDate: localDate ?? recommendation.date,
    capturedAt,
    trigger,
    irrigationEventId: event?.id,
    recommendation: recommendationWithoutWeather(recommendation),
    weather: structuredClone(recommendation.weather),
    waterBalance: {
      dailyTargetLitres: reconciled.decision.daily_target_litres_exact,
      appliedBeforeEventLitres,
      eventAppliedLitres: event?.litres,
      cumulativeAppliedLitres,
      remainingLitres: reconciled.decision.litres_exact,
      action: reconciled.decision.action,
      durationMinutes: reconciled.decision.duration_minutes
    },
    latestSoilMoisture: latestSoilMoisture ? structuredClone(latestSoilMoisture) : undefined,
    sourceMetadata: {
      recommendationGeneratedAt: recommendation.generated_at,
      recommendationSavedAt: recommendation.savedAt,
      weatherProviderObservedAt: recommendation.weather.provider_observed_at,
      weatherSource: recommendation.weather.source
    }
  }
  return structuredClone(snapshot)
}

export class DecisionSnapshotService {
  private finalization?: Promise<DecisionSnapshot[]>

  constructor(private database: AxisDatabase, private repositories: AxisRepositories) {}

  async recordIrrigationEvent(event: IrrigationEvent, recommendation: StoredRecommendation, plot: Pick<Plot, 'id' | 'areaM2'>): Promise<DecisionSnapshot> {
    if (event.plotId !== plot.id || recommendation.plot_id !== plot.id) {
      throw new Error('The irrigation event does not match the saved plot recommendation.')
    }

    return this.database.transaction('rw', [this.database.irrigationEvents, this.database.decisionSnapshots, this.database.sensorReadings], async () => {
      await this.database.irrigationEvents.add(structuredClone(event))
      const cumulativeAppliedLitres = await this.repositories.appliedForPlotDate(event.plotId, event.date)
      const reconciled = applyLocalIrrigationFeedback(recommendation, cumulativeAppliedLitres, plot.areaM2)
      const latestSoilMoisture = await this.repositories.latestSensorReadingAtOrBefore(event.plotId, event.createdAt)
      const snapshot = snapshotFromState({
        id: irrigationSnapshotId(event.id),
        localDate: event.date,
        recommendation,
        capturedAt: event.createdAt,
        trigger: 'IRRIGATION_EVENT',
        appliedBeforeEventLitres: Math.max(0, cumulativeAppliedLitres - event.litres),
        event,
        cumulativeAppliedLitres,
        reconciled,
        latestSoilMoisture
      })
      await this.repositories.saveSnapshot(snapshot)
      return snapshot
    })
  }

  finalizeEligibleDays(now = new Date()): Promise<DecisionSnapshot[]> {
    if (this.finalization) return this.finalization
    this.finalization = this.finalize(now).finally(() => { this.finalization = undefined })
    return this.finalization
  }

  private async finalize(now: Date): Promise<DecisionSnapshot[]> {
    const currentDate = nairobiDate(now)
    const currentHour = nairobiHour(now)
    const recommendations = await this.repositories.allRecommendations()
    const eligible = recommendations
      .filter(recommendation => recommendation.date < currentDate || (recommendation.date === currentDate && currentHour === 23))
      .sort((a, b) => a.date.localeCompare(b.date) || a.plot_id.localeCompare(b.plot_id))
    const snapshots: DecisionSnapshot[] = []

    for (const recommendation of eligible) {
      if (await this.repositories.hasEndOfDaySnapshot(recommendation.plot_id, recommendation.date)) continue
      const plot = await this.repositories.getPlot(recommendation.plot_id)
      if (!plot) continue
      const trigger: DecisionSnapshotTrigger = recommendation.date === currentDate ? 'END_OF_DAY' : 'END_OF_DAY_CATCHUP'
      const capturedAt = now.toISOString()
      const sensorCutoff = trigger === 'END_OF_DAY' ? capturedAt : endOfNairobiDate(recommendation.date)
      const [cumulativeAppliedLitres, latestSoilMoisture] = await Promise.all([
        this.repositories.appliedForPlotDate(recommendation.plot_id, recommendation.date),
        this.repositories.latestSensorReadingAtOrBefore(recommendation.plot_id, sensorCutoff)
      ])
      const reconciled = applyLocalIrrigationFeedback(recommendation, cumulativeAppliedLitres, plot.areaM2)
      const snapshot = snapshotFromState({
        id: finalSnapshotId(recommendation.plot_id, recommendation.date),
        recommendation,
        capturedAt,
        trigger,
        appliedBeforeEventLitres: cumulativeAppliedLitres,
        cumulativeAppliedLitres,
        reconciled,
        latestSoilMoisture
      })
      try {
        await this.repositories.saveSnapshot(snapshot)
        snapshots.push(snapshot)
      } catch (error) {
        if (!isConstraintError(error)) throw error
      }
    }
    return snapshots
  }
}

function endOfNairobiDate(date: string): string {
  return new Date(`${date}T23:59:59.999+03:00`).toISOString()
}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConstraintError'
}

// Keep the singleton at the application boundary while allowing isolated databases in tests.
export const decisionSnapshotService = new DecisionSnapshotService(db, repos)
