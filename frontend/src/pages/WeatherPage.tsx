import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getForecastTimeline, getHistoricalWeather } from '../api'
import { Alert, AppHeader, Badge, Card, EmptyState, Page, Spinner } from '../components'
import { repos } from '../db'
import { useAxis } from '../context'
import { useRecommendationRefresh } from '../recommendation-refresh'
import type { DecisionSnapshot, IrrigationEvent, Recommendation, StoredRecommendation, TimelineWeatherDay, TimelineWeatherRecord } from '../types'
import { formatLitres, formatWindow, friendlyDate, nairobiDate, nairobiDateTime } from '../utils'
import {
  buildLocalTimelineItems, cachedTimelineDays, FORECAST_RETENTION_DAYS, freshDates, HISTORICAL_RETENTION_DAYS,
  mergeTimelineDays, recordsForTimelineDays, shiftDate, type LocalTimelineItem
} from '../weather-timeline'

const INITIAL_HISTORY_DAYS = 5
const HISTORY_PAGE_DAYS = 10

export default function WeatherPage() {
  const { selectedPlot, online } = useAxis()
  const { recommendation, localReady, refreshing, error: recommendationError, refresh } = useRecommendationRefresh()
  const today = nairobiDate()
  const [days, setDays] = useState<TimelineWeatherDay[]>([])
  const [cachedRecords, setCachedRecords] = useState<TimelineWeatherRecord[]>([])
  const [recommendations, setRecommendations] = useState<StoredRecommendation[]>([])
  const [events, setEvents] = useState<IrrigationEvent[]>([])
  const [snapshots, setSnapshots] = useState<DecisionSnapshot[]>([])
  const [visiblePastStart, setVisiblePastStart] = useState(shiftDate(today, -INITIAL_HISTORY_DAYS))
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [historyError, setHistoryError] = useState<string>()
  const [forecastError, setForecastError] = useState<string>()
  const topSentinel = useRef<HTMLDivElement>(null)
  const todayCard = useRef<HTMLElement>(null)
  const centered = useRef(false)
  const olderInFlight = useRef(false)

  const persist = useCallback(async (incoming: TimelineWeatherDay[]) => {
    if (!selectedPlot || incoming.length === 0) return
    const records = recordsForTimelineDays(selectedPlot, incoming)
    await repos.saveTimelineWeather(records)
    await repos.pruneTimelineWeather(selectedPlot.id, shiftDate(today, -HISTORICAL_RETENTION_DAYS), shiftDate(today, -FORECAST_RETENTION_DAYS))
    setCachedRecords(current => {
      const byID = new Map(current.map(value => [value.id, value]))
      for (const value of records) byID.set(value.id, value)
      return [...byID.values()]
    })
    setDays(current => mergeTimelineDays(current, incoming))
  }, [selectedPlot, today])

  useEffect(() => {
    centered.current = false
    setVisiblePastStart(shiftDate(today, -INITIAL_HISTORY_DAYS))
    setHistoryError(undefined)
    setForecastError(undefined)
    if (!selectedPlot) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    const load = async () => {
      const since = shiftDate(today, -HISTORICAL_RETENTION_DAYS)
      const [storedWeather, storedRecommendations, storedEvents, storedSnapshots] = await Promise.all([
        repos.timelineWeatherForPlot(selectedPlot.id, selectedPlot.lat, selectedPlot.lon),
        repos.recommendationsForPlot(selectedPlot.id, since), repos.eventsForPlot(selectedPlot.id, since), repos.snapshotsForPlot(selectedPlot.id)
      ])
      if (cancelled) return
      setCachedRecords(storedWeather)
      setDays(cachedTimelineDays(storedWeather))
      setRecommendations(storedRecommendations)
      setEvents(storedEvents)
      setSnapshots(storedSnapshots)
      setLoading(false)
      if (!online) return

      const freshness = freshDates(storedWeather)
      const historyDates = Array.from({ length: INITIAL_HISTORY_DAYS }, (_, index) => shiftDate(today, index - INITIAL_HISTORY_DAYS))
      const requests: Promise<void>[] = []
      if (!historyDates.every(date => freshness.has(date))) {
        requests.push(getHistoricalWeather(selectedPlot.lat, selectedPlot.lon, historyDates[0], shiftDate(today, -1))
          .then(response => cancelled ? undefined : persist(response.days)).catch(() => { if (!cancelled) setHistoryError('Historical weather is unavailable. Saved AXIS activity is still shown.') }))
      }
      if (!freshness.has(today)) {
        requests.push(getForecastTimeline(selectedPlot).then(response => cancelled ? undefined : persist(response.days))
          .catch(() => { if (!cancelled) setForecastError('The multi-day KijaniSpace forecast is unavailable. AXIS has not created substitute forecast days.') }))
      }
      await Promise.all(requests)
    }
    void load().catch(() => { if (!cancelled) { setLoading(false); setHistoryError('Saved timeline data could not be opened.') } })
    return () => { cancelled = true }
  }, [online, persist, selectedPlot, today])

  useEffect(() => {
    if (!recommendation || recommendation.plot_id !== selectedPlot?.id) return
    const stored = recommendation as StoredRecommendation
    if (!('savedAt' in stored)) return
    setRecommendations(current => [stored, ...current.filter(value => value.id !== stored.id)])
  }, [recommendation, selectedPlot?.id])

  useEffect(() => {
    if (loading || centered.current || !todayCard.current) return
    centered.current = true
    todayCard.current.scrollIntoView({ block: 'center' })
  }, [loading, days])

  const loadOlder = useCallback(async () => {
    if (!selectedPlot || olderInFlight.current) return
    olderInFlight.current = true
    setLoadingOlder(true)
    setHistoryError(undefined)
    const nextStart = shiftDate(visiblePastStart, -HISTORY_PAGE_DAYS)
    const nextEnd = shiftDate(visiblePastStart, -1)
    const oldHeight = document.documentElement.scrollHeight
    const oldY = window.scrollY
    try {
      const cached = cachedTimelineDays(cachedRecords).filter(day => day.kind === 'HISTORICAL' && day.date >= nextStart && day.date <= nextEnd)
      if (cached.length > 0) {
        setDays(current => mergeTimelineDays(current, cached))
        setVisiblePastStart(nextStart)
      }
      if (!online) {
        if (cached.length === 0) setHistoryError('You’re offline and no older historical weather is cached on this device.')
        return
      }
      const response = await getHistoricalWeather(selectedPlot.lat, selectedPlot.lon, nextStart, nextEnd)
      await persist(response.days)
      setVisiblePastStart(nextStart)
    } catch {
      setHistoryError('Older historical weather could not load. Pull up again to retry.')
    } finally {
      window.requestAnimationFrame(() => window.scrollTo({ top: oldY + document.documentElement.scrollHeight - oldHeight }))
      olderInFlight.current = false
      setLoadingOlder(false)
    }
  }, [cachedRecords, online, persist, selectedPlot, visiblePastStart])

  useEffect(() => {
    const node = topSentinel.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (centered.current && entries.some(entry => entry.isIntersecting)) void loadOlder()
    }, { rootMargin: '220px 0px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadOlder])

  const displayDates = useMemo(() => {
    const values = new Set<string>([today])
    for (let date = visiblePastStart; date < today; date = shiftDate(date, 1)) values.add(date)
    for (const day of days) if (day.date <= today || day.kind === 'FORECAST') values.add(day.date)
    for (const value of recommendations) if (value.date >= visiblePastStart && value.date <= today) values.add(value.date)
    for (const value of events) if (value.date >= visiblePastStart && value.date <= today) values.add(value.date)
    for (const value of snapshots) if (value.localDate >= visiblePastStart && value.localDate <= today) values.add(value.localDate)
    return [...values].sort()
  }, [days, events, recommendations, snapshots, today, visiblePastStart])

  if (!selectedPlot) {
    return <Page><AppHeader showBack eyebrow="Weather timeline" title="Weather & Water History" /><EmptyState title="Add a plot first" text="AXIS needs plot coordinates to retrieve local weather and calculate future irrigation plans." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} /></Page>
  }

  return (
    <Page>
      <AppHeader showBack eyebrow="Weather timeline" title="Weather & Water History" action={<button className="button secondary compact" disabled={!online || refreshing} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh today'}</button>} />
      <Card className="timeline-location-card"><div><strong>📍 {selectedPlot.name}</strong><span>{selectedPlot.lat.toFixed(4)}, {selectedPlot.lon.toFixed(4)} · Africa/Nairobi</span></div><Badge tone={online ? 'good' : 'warn'}>{online ? 'Live + saved' : 'Saved offline'}</Badge></Card>
      <p className="timeline-intro">See reconstructed past weather, what AXIS recommended, water you applied, and the real forecast days available for planning.</p>
      {recommendationError && <Alert tone="warn" title="Today’s advice could not refresh">{recommendationError}</Alert>}
      {historyError && <Alert tone="warn" title="Historical weather unavailable">{historyError}</Alert>}
      {forecastError && <Alert tone="warn" title="Forecast unavailable">{forecastError}</Alert>}
      {!online && <Alert tone="warn" title="Offline timeline">Showing locally cached weather and farmer records. Uncached dates cannot load until you reconnect.</Alert>}
      {loading && !localReady ? <Spinner label="Opening saved weather and farm history…" /> : <div className="weather-timeline" aria-label="Agricultural weather and irrigation timeline">
        <div ref={topSentinel} className="timeline-load-sentinel"><button className="button secondary compact" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? 'Loading older weather…' : 'Load older history'}</button></div>
        {displayDates.map(date => {
          const day = days.find(value => value.date === date)
          const localItems = buildLocalTimelineItems(date, recommendations, events, snapshots)
          const currentRecommendation = date === today && recommendation?.plot_id === selectedPlot.id ? recommendation : undefined
          return <DailyTimelineCard key={date} date={date} day={day} localItems={localItems} currentRecommendation={currentRecommendation} today={today} ref={date === today ? todayCard : undefined} />
        })}
      </div>}
      <p className="disclaimer standalone">Open-Meteo history is gridded reanalysis, not a measurement at this field. KijaniSpace values are model forecasts. Sensor observations and farmer irrigation are labeled separately.</p>
    </Page>
  )
}

export const DailyTimelineCard = forwardRef<HTMLElement, { date: string; day?: TimelineWeatherDay; localItems: LocalTimelineItem[]; currentRecommendation?: Recommendation; today: string }>(function DailyTimelineCard({ date, day, localItems, currentRecommendation, today }, ref) {
  const planning = date === today ? currentRecommendation : day?.recommendation
  const kind = date === today ? 'CURRENT' : day?.kind ?? 'HISTORICAL'
  const source = day?.source === 'OPEN_METEO' ? 'Open-Meteo reanalysis' : day?.source === 'KIJANISPACE' ? 'KijaniSpace model' : 'Weather unavailable'
  const summary = day?.summary
  return <article ref={ref} className={`timeline-day-card ${date === today ? 'today' : ''}`} data-date={date}>
    <div className="timeline-rail"><span /></div>
    <Card className="timeline-day-content">
      <div className="timeline-day-head"><div><p className="eyebrow">{date === today ? 'TODAY' : friendlyDate(date)}</p><h2>{date}</h2></div><div className="timeline-badges"><Badge tone={kind === 'FORECAST' ? 'info' : kind === 'CURRENT' ? 'good' : 'muted'}>{kind}</Badge><Badge tone={day ? 'muted' : 'warn'}>{source}</Badge></div></div>
      {summary ? <div className="timeline-summary-grid"><Metric label="Rain" value={numberUnit(summary.rain_mm, 'mm')} /><Metric label="Temperature" value={temperatureRange(summary.t_min_c, summary.t_max_c)} /><Metric label="ET₀ demand" value={numberUnit(summary.et0_mm, 'mm')} /><Metric label="Humidity" value={numberUnit(summary.mean_relative_humidity_pct, '%', 0)} /><Metric label="Wind" value={numberUnit(summary.mean_wind_ms, 'm/s')} /><Metric label="Modeled shallow soil" value={summary.mean_modeled_soil_moisture_m3_m3 === undefined ? 'Unavailable' : `${Math.round(summary.mean_modeled_soil_moisture_m3_m3 * 100)}%`} /></div> : <p className="timeline-unavailable">Historical weather unavailable for this date. Local AXIS and farmer records remain below.</p>}
      {planning && <div className="timeline-plan"><div><span>AXIS irrigation plan</span><strong>{planning.decision.action === 'SKIP' ? 'Skip · 0 L' : `${planning.decision.action} · ${formatLitres(planning.decision.litres)}`}</strong></div><div><span>Best time</span><strong>{formatWindow(planning.decision.recommended_window)}</strong></div>{planning.decision.duration_minutes !== undefined && <div><span>Expected runtime</span><strong>{planning.decision.duration_minutes} min</strong></div>}{date > today && <small>Future plan uses this day’s forecast and assumes 0 L already applied.</small>}</div>}
      {day?.planning_unavailable && <Alert tone="warn" title="Irrigation planning unavailable">{day.planning_unavailable}</Alert>}
      {localItems.length > 0 && <div className="timeline-local-events"><h3>AXIS & farm activity</h3>{localItems.map(item => <LocalEvent key={item.id} item={item} />)}</div>}
      {day && day.hourly.length > 0 && <details className="timeline-hourly"><summary>View {day.hourly.length} hourly weather rows</summary><div className="timeline-hourly-list">{day.hourly.map(hour => <div className="timeline-hour-row" key={hour.time}><time>{new Date(hour.time).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false })}</time><span>{hour.temperature_c === undefined ? '—' : `${hour.temperature_c.toFixed(1)}°C`}</span><span>Rain {numberUnit(hour.precipitation_mm, 'mm')}</span><span>RH {numberUnit(hour.relative_humidity_pct, '%', 0)}</span><span>Wind {numberUnit(hour.wind_ms, 'm/s')}</span></div>)}</div></details>}
    </Card>
  </article>
})

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }

function LocalEvent({ item }: { item: LocalTimelineItem }) {
  const time = nairobiDateTime(item.at).split(',').at(-1)?.trim() ?? nairobiDateTime(item.at)
  if (item.type === 'RECOMMENDATION') return <div className="timeline-local-row"><time>{time}</time><div><Badge tone="info">AXIS SNAPSHOT</Badge><strong>Recommendation saved · {formatLitres(item.recommendation.decision.daily_target_litres)}</strong><span>Remaining {formatLitres(item.recommendation.decision.litres)}</span></div></div>
  if (item.type === 'IRRIGATION') return <div className="timeline-local-row"><time>{time}</time><div><Badge tone="good">FARMER IRRIGATION</Badge><strong>Applied {formatLitres(item.event.litres)}</strong>{item.snapshot && <span>Remaining after event {formatLitres(item.snapshot.waterBalance.remainingLitres)}</span>}</div></div>
  const endOfDay = item.snapshot.trigger === 'END_OF_DAY' || item.snapshot.trigger === 'END_OF_DAY_CATCHUP'
  return <div className="timeline-local-row"><time>{time}</time><div><Badge tone="muted">AXIS SNAPSHOT</Badge><strong>{endOfDay ? 'End-of-day balance' : 'Decision snapshot'}</strong><span>Applied {formatLitres(item.snapshot.waterBalance.cumulativeAppliedLitres)} · Remaining {formatLitres(item.snapshot.waterBalance.remainingLitres)}</span>{item.snapshot.latestSoilMoisture && <span>SENSOR OBSERVATION · {item.snapshot.latestSoilMoisture.volumetricWaterContentPct.toFixed(1)}%</span>}</div></div>
}

function numberUnit(value: number | undefined, unit: string, digits = 1): string { return value === undefined ? 'Unavailable' : `${value.toFixed(digits)} ${unit}` }
function temperatureRange(minimum?: number, maximum?: number): string { return minimum === undefined || maximum === undefined ? 'Unavailable' : `${minimum.toFixed(1)}–${maximum.toFixed(1)}°C` }
