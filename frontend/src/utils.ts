import type { CatalogCrop, Recommendation, StageId, StoredRecommendation } from './types'

export function nairobiDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function dateDaysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return nairobiDate(date)
}

export function plantingDateFromAge(value: number, unit: 'days' | 'weeks'): string {
  const date = new Date(`${nairobiDate()}T12:00:00+03:00`)
  date.setUTCDate(date.getUTCDate() - value * (unit === 'weeks' ? 7 : 1))
  return nairobiDate(date)
}

export function cropAgeDays(plantingDate: string): number {
  const today = new Date(`${nairobiDate()}T00:00:00Z`)
  const planted = new Date(`${plantingDate}T00:00:00Z`)
  return Math.max(0, Math.floor((today.getTime() - planted.getTime()) / 86_400_000))
}

export function deriveStage(crop: CatalogCrop, age: number): { id: StageId; day: number; progress: number } {
  const stages: Array<[StageId, number]> = [
    ['establishing', crop.stage_days.establishing], ['developing', crop.stage_days.developing],
    ['productive', crop.stage_days.productive], ['maturing', crop.stage_days.maturing]
  ]
  let start = 0
  for (const [id, length] of stages) {
    if (age < start + length || id === 'maturing') {
      const day = age - start + 1
      return { id, day, progress: Math.min(100, Math.max(0, (day / length) * 100)) }
    }
    start += length
  }
  return { id: 'maturing', day: 1, progress: 100 }
}

export function formatLitres(value: number): string { return `${Math.round(value).toLocaleString()} L` }
export function formatWindow(value: string): string { return value.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) }

export function freshness(rec?: StoredRecommendation): { label: string; tone: 'good' | 'warn' | 'muted' } {
  if (!rec) return { label: 'No saved advice', tone: 'muted' }
  if (rec.weather.source === 'CLIMATOLOGY') return { label: 'Seasonal estimate', tone: 'warn' }
  if (rec.weather.source === 'DEMO_FIXTURE') return { label: 'Demo weather', tone: 'warn' }
  if (rec.date < nairobiDate()) return { label: `Saved from ${friendlyDate(rec.date)}`, tone: 'warn' }
  const minutes = (Date.now() - new Date(rec.savedAt).getTime()) / 60_000
  return minutes < 15 ? { label: 'Updated just now', tone: 'good' } : { label: 'Saved earlier today', tone: 'muted' }
}

export function friendlyDate(value: string): string {
  return new Intl.DateTimeFormat('en-KE', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
}

export function recommendationChange(rec: Recommendation): string | undefined {
  const value = rec.decision.previous_recommendation_delta_litres
  if (value === undefined) return undefined
  if (Math.abs(value) < 10) return 'About the same as the previous recommendation'
  return `${formatLitres(Math.abs(value))} ${value > 0 ? 'more' : 'less'} than the previous recommendation`
}
