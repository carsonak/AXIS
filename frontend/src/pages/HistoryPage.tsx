import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Badge, Card, EmptyState, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { IrrigationEvent, StoredRecommendation } from '../types'
import { dateDaysAgo, formatLitres, friendlyDate } from '../utils'

export default function HistoryPage() {
  const { selectedPlot } = useAxis()
  const [recommendations, setRecommendations] = useState<StoredRecommendation[]>([])
  const [events, setEvents] = useState<IrrigationEvent[]>([])
  useEffect(() => {
    if (!selectedPlot) return
    void Promise.all([repos.recommendationsForPlot(selectedPlot.id, dateDaysAgo(6)), repos.eventsForPlot(selectedPlot.id, dateDaysAgo(6))]).then(([recs, irrigation]) => { setRecommendations(recs); setEvents(irrigation) })
  }, [selectedPlot?.id])
  const rows = useMemo(() => recommendations.map(rec => ({ rec, event: events.find(event => event.date === rec.date) })), [recommendations, events])
  const max = Math.max(1, ...rows.flatMap(row => [row.rec.decision.litres_exact, row.event?.litres ?? 0]))
  const avoided = recommendations.reduce((sum, rec) => sum + rec.decision.rain_adjustment_litres, 0)
  const applied = events.reduce((sum, event) => sum + event.litres, 0)
  if (!selectedPlot) return <Page><AppHeader eyebrow="Last seven days" title="Irrigation history" /><EmptyState title="Add a plot first" text="History is kept locally for each plot." action={<Link className="button primary" to="/plots/new">Add a plot</Link>} /></Page>
  return <Page><AppHeader eyebrow="Last seven days" title={`${selectedPlot.name} history`} />
    <section className="metric-grid history-metrics"><Card><small>Applied</small><strong>{formatLitres(applied)}</strong><span>Recorded on this device</span></Card><Card><small>Rain adjustment</small><strong>{formatLitres(avoided)}</strong><span>Avoided because rain was considered</span></Card></section>
    {rows.length === 0 ? <EmptyState title="No recommendation history yet" text="Refresh Today to save advice. Recording irrigation will add the actual amount alongside it." /> : <Card className="chart-card"><div className="section-head"><div><p className="eyebrow">Recommended vs applied</p><h2>Seven-day view</h2></div><div className="chart-legend"><span className="recommended">Recommended</span><span className="applied">Applied</span></div></div><div className="bar-chart">{[...rows].reverse().map(({ rec, event }) => <div className="bar-group" key={rec.date}><div className="bars"><span className="recommended" style={{ height: `${Math.max(2, rec.decision.litres_exact / max * 100)}%` }} title={`Recommended ${rec.decision.litres_exact} L`} /><span className="applied" style={{ height: `${event ? Math.max(2, event.litres / max * 100) : 0}%` }} title={event ? `Applied ${event.litres} L` : 'No applied volume recorded'} /></div><small>{friendlyDate(rec.date)}</small></div>)}</div></Card>}
    <div className="history-list">{rows.map(({ rec, event }) => <Card key={rec.date} className="history-row"><div><strong>{friendlyDate(rec.date)}</strong><span>{rec.crop_stage.display_name}</span></div><div><small>Recommended</small><strong>{formatLitres(rec.decision.litres_exact)}</strong></div><div><small>Applied</small><strong>{event ? formatLitres(event.litres) : 'Not logged'}</strong></div><Badge tone={rec.decision.action === 'SKIP' ? 'good' : rec.decision.action === 'REDUCED' ? 'info' : 'warn'}>{rec.decision.action}</Badge></Card>)}</div>
  </Page>
}
