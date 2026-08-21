import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Card, EmptyState, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { IrrigationEvent } from '../types'
import { dateDaysAgo, formatLitres, nairobiDate } from '../utils'

export default function WaterUsagePage() {
  const { selectedPlot, catalog, plots } = useAxis()
  const [events, setEvents] = useState<IrrigationEvent[]>([])

  useEffect(() => {
    void Promise.all(plots.map(plot => repos.eventsForPlot(plot.id, dateDaysAgo(6))))
      .then(values => setEvents(values.flat()))
  }, [plots])

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const offset = 6 - index
    const date = dateDaysAgo(offset)
    return {
      date,
      label: new Intl.DateTimeFormat('en-KE', { weekday: 'short' }).format(new Date(`${date}T12:00:00Z`)),
      litres: events.filter(event => event.date === date).reduce((sum, event) => sum + event.litres, 0)
    }
  }), [events])
  const totalUsageLitres = events.reduce((sum, event) => sum + event.litres, 0)
  const maxLitres = Math.max(1, ...days.map(day => day.litres))
  const cropBreakdown = useMemo(() => {
    const values = new Map<string, number>()
    for (const event of events) {
      const plot = plots.find(item => item.id === event.plotId)
      if (!plot) continue
      values.set(plot.cropId, (values.get(plot.cropId) ?? 0) + event.litres)
    }
    return [...values.entries()].map(([cropId, litres]) => ({
      cropId,
      label: catalog?.crops.find(crop => crop.id === cropId)?.display_name ?? cropId,
      litres,
      percent: totalUsageLitres > 0 ? Math.round((litres / totalUsageLitres) * 100) : 0
    })).sort((a, b) => b.litres - a.litres)
  }, [catalog, events, plots, totalUsageLitres])

  if (!selectedPlot) {
    return <Page><AppHeader showBack eyebrow="Water Usage" title="Analytics" /><EmptyState title="Add a plot first" text="Water usage tracking is kept locally for each plot." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} /></Page>
  }

  return (
    <Page>
      <AppHeader showBack eyebrow="Last seven days" title="Water Usage" />

      <Card className="total-water-card">
        <p className="eyebrow">Actual water logged on this device</p>
        <h2 className="big-water-val">{formatLitres(totalUsageLitres)}</h2>
        <p>{totalUsageLitres > 0 ? `${events.length} irrigation ${events.length === 1 ? 'event' : 'events'} through ${nairobiDate()}` : 'No irrigation logged this week'}</p>
      </Card>

      {events.length === 0 ? (
        <EmptyState title="No irrigation logged this week" text="Log applied water from Today to populate daily usage and crop totals." />
      ) : (
        <>
          <Card className="daily-chart-card">
            <div className="section-head"><div><p className="eyebrow">Recorded events</p><h2>Daily Usage (Litres)</h2></div></div>
            <div className="chart-wrapper">
              <div className="bar-chart-container">
                {days.map(day => (
                  <div key={day.date} className="bar-column">
                    <div className="bar-wrapper"><div className="chart-bar" style={{ height: `${(day.litres / maxLitres) * 100}%` }} title={`${day.label}: ${day.litres} L`} /></div>
                    <span className="day-label">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="by-crop-card">
            <div className="section-head"><div><p className="eyebrow">Actual logged volume</p><h2>By Crop</h2></div></div>
            <div className="by-crop-list">
              {cropBreakdown.map(item => (
                <div className="by-crop-row" key={item.cropId}>
                  <div className="crop-label-wrap"><strong>{item.label}</strong></div>
                  <div className="crop-bar-wrap"><div className="crop-bar-track"><div className="crop-bar-fill green-fill" style={{ width: `${item.percent}%` }} /></div></div>
                  <div className="crop-val-wrap"><strong>{formatLitres(item.litres)}</strong><small>({item.percent}%)</small></div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </Page>
  )
}
