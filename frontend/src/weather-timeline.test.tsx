import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DailyTimelineCard } from './pages/WeatherPage'
import { sampleRecommendation } from './test-fixtures'
import type { DecisionSnapshot, IrrigationEvent, Plot, StoredRecommendation, TimelineWeatherDay } from './types'
import { buildLocalTimelineItems, cachedTimelineDays, freshDates, mergeTimelineDays, recordsForTimelineDays, shiftDate } from './weather-timeline'

const plot: Plot = { id: 'plot-1', name: 'North plot', lat: -.0917, lon: 34.768, areaM2: 1000, cropId: 'tomato', plantingDate: '2026-06-01', plantingDateEstimated: false, irrigationMethodId: 'drip', flowRateLpm: 45, createdAt: 'now', updatedAt: 'now' }

function day(date: string, kind: TimelineWeatherDay['kind'] = 'HISTORICAL'): TimelineWeatherDay {
  return { date, kind, source: kind === 'HISTORICAL' ? 'OPEN_METEO' : 'KIJANISPACE', summary: { t_min_c: 18, t_max_c: 29, rain_mm: 2, et0_mm: 4.2 }, hourly: [{ time: `${date}T06:00:00+03:00`, temperature_c: 18, precipitation_mm: 0, relative_humidity_pct: 82 }] }
}

describe('weather timeline dates and cache', () => {
  it('defines the default five-day historical window without duplicating merged dates', () => {
    const today = '2026-08-22'
    expect(Array.from({ length: 5 }, (_, index) => shiftDate(today, index - 5))).toEqual(['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'])
    expect(mergeTimelineDays([day('2026-08-20')], [day('2026-08-20'), day('2026-08-21')]).map(value => value.date)).toEqual(['2026-08-20', '2026-08-21'])
  })

  it('keys cache records by selected plot coordinates and renders expired records offline', () => {
    const records = recordsForTimelineDays(plot, [day('2026-08-20')], new Date('2026-08-22T00:00:00Z'))
    expect(records[0]).toMatchObject({ plotId: 'plot-1', lat: -.0917, lon: 34.768, kind: 'HISTORICAL', source: 'OPEN_METEO' })
    expect(records[0].id).toContain('-0.09170:34.76800')
    expect(freshDates(records, new Date('2026-10-01').getTime())).toEqual(new Set())
    expect(cachedTimelineDays(records)).toEqual([day('2026-08-20')])
  })
})

describe('local AXIS activity', () => {
  it('sorts recommendation, irrigation, and end-of-day snapshots chronologically and enriches the irrigation row', () => {
    const recommendation = { ...sampleRecommendation(), id: 'plot-1:2026-08-22', date: '2026-08-22', savedAt: '2026-08-22T03:00:00Z' } as StoredRecommendation
    const event: IrrigationEvent = { id: 'event-1', plotId: 'plot-1', date: '2026-08-22', litres: 500, source: 'MANUAL', createdAt: '2026-08-22T04:00:00Z' }
    const irrigationSnapshot = { id: 'snapshot-1', plotId: 'plot-1', localDate: '2026-08-22', capturedAt: event.createdAt, trigger: 'IRRIGATION_EVENT', irrigationEventId: event.id } as DecisionSnapshot
    const finalSnapshot = { id: 'snapshot-2', plotId: 'plot-1', localDate: '2026-08-22', capturedAt: '2026-08-22T20:00:00Z', trigger: 'END_OF_DAY' } as DecisionSnapshot
    const items = buildLocalTimelineItems('2026-08-22', [recommendation], [event], [finalSnapshot, irrigationSnapshot])
    expect(items.map(item => item.type)).toEqual(['RECOMMENDATION', 'IRRIGATION', 'SNAPSHOT'])
    expect(items[1]).toMatchObject({ type: 'IRRIGATION', snapshot: irrigationSnapshot })
  })
})

describe('daily timeline card', () => {
  it('distinguishes forecast source, expands hourly weather, and shows the authoritative future plan', () => {
    const forecast = day('2026-08-23', 'FORECAST')
    forecast.recommendation = { ...sampleRecommendation(), date: '2026-08-23', decision: { ...sampleRecommendation().decision, applied_today_litres: 0 } }
    render(<DailyTimelineCard date="2026-08-23" day={forecast} localItems={[]} today="2026-08-22" />)
    expect(screen.getByText('KijaniSpace model')).toBeInTheDocument()
    expect(screen.getByText(/Future plan uses this day’s forecast and assumes 0 L already applied/)).toBeInTheDocument()
    const summary = screen.getByText('View 1 hourly weather rows')
    fireEvent.click(summary)
    expect(summary.closest('details')).toHaveAttribute('open')
    expect(screen.getByText('Rain 0.0 mm')).toBeInTheDocument()
  })
})
