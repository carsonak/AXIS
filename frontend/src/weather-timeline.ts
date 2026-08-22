import type { DecisionSnapshot, IrrigationEvent, Plot, StoredRecommendation, TimelineWeatherDay, TimelineWeatherRecord } from './types'

// Historical reanalysis changes rarely; forecasts are deliberately short-lived. Retention and freshness are separate.
export const HISTORICAL_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const FORECAST_TTL_MS = 60 * 60 * 1000
export const HISTORICAL_RETENTION_DAYS = 180
export const FORECAST_RETENTION_DAYS = 14

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00+03:00`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function timelineWeatherId(plot: Plot, day: TimelineWeatherDay): string {
  return [plot.id, plot.lat.toFixed(5), plot.lon.toFixed(5), day.date, day.kind, day.source].join(':')
}

/** Adds plot/location cache identity and source-specific freshness metadata to API days. */
export function recordsForTimelineDays(plot: Plot, days: TimelineWeatherDay[], fetchedAt = new Date()): TimelineWeatherRecord[] {
  return days.map(day => {
    const ttl = day.kind === 'HISTORICAL' ? HISTORICAL_TTL_MS : FORECAST_TTL_MS
    return {
      ...structuredClone(day), id: timelineWeatherId(plot, day), plotId: plot.id, lat: plot.lat, lon: plot.lon,
      fetchedAt: fetchedAt.toISOString(), expiresAt: new Date(fetchedAt.getTime() + ttl).toISOString()
    }
  })
}

/** Collapses stale duplicates by date while returning API-shaped values without IndexedDB metadata. */
export function cachedTimelineDays(records: TimelineWeatherRecord[]): TimelineWeatherDay[] {
  const newest = new Map<string, TimelineWeatherRecord>()
  for (const record of records) {
    const current = newest.get(record.date)
    if (!current || current.fetchedAt < record.fetchedAt) newest.set(record.date, record)
  }
  return [...newest.values()].sort((a, b) => a.date.localeCompare(b.date)).map(record => ({
    date: record.date, kind: record.kind, source: record.source, provider_model_run_at: record.provider_model_run_at,
    summary: structuredClone(record.summary), hourly: structuredClone(record.hourly), recommendation: record.recommendation ? structuredClone(record.recommendation) : undefined,
    planning_unavailable: record.planning_unavailable
  }))
}

export function mergeTimelineDays(current: TimelineWeatherDay[], incoming: TimelineWeatherDay[]): TimelineWeatherDay[] {
  const values = new Map(current.map(day => [day.date, day]))
  for (const day of incoming) values.set(day.date, day)
  return [...values.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function freshDates(records: TimelineWeatherRecord[], now = Date.now()): Set<string> {
  return new Set(records.filter(record => Date.parse(record.expiresAt) > now).map(record => record.date))
}

export type LocalTimelineItem =
  | { id: string; at: string; type: 'RECOMMENDATION'; recommendation: StoredRecommendation }
  | { id: string; at: string; type: 'IRRIGATION'; event: IrrigationEvent; snapshot?: DecisionSnapshot }
  | { id: string; at: string; type: 'SNAPSHOT'; snapshot: DecisionSnapshot }

/** Merges local audit records without copying farmer data into provider weather cache rows. */
export function buildLocalTimelineItems(date: string, recommendations: StoredRecommendation[], events: IrrigationEvent[], snapshots: DecisionSnapshot[]): LocalTimelineItem[] {
  const datedRecommendations = recommendations.filter(value => value.date === date)
  const datedEvents = events.filter(value => value.date === date)
  const datedSnapshots = snapshots.filter(value => value.localDate === date)
  const byEvent = new Map(datedSnapshots.filter(value => value.irrigationEventId).map(value => [value.irrigationEventId, value]))
  const matchedSnapshots = new Set(byEvent.values())
  const items: LocalTimelineItem[] = [
    ...datedRecommendations.map(recommendation => ({ id: `recommendation:${recommendation.id}`, at: recommendation.savedAt, type: 'RECOMMENDATION' as const, recommendation })),
    ...datedEvents.map(event => ({ id: `irrigation:${event.id}`, at: event.createdAt, type: 'IRRIGATION' as const, event, snapshot: byEvent.get(event.id) })),
    ...datedSnapshots.filter(snapshot => !matchedSnapshots.has(snapshot)).map(snapshot => ({ id: `snapshot:${snapshot.id}`, at: snapshot.capturedAt, type: 'SNAPSHOT' as const, snapshot }))
  ]
  return items.sort((a, b) => a.at.localeCompare(b.at))
}
