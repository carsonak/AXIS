import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Card, EmptyState, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { IrrigationEvent } from '../types'
import { formatLitres } from '../utils'

type HistoryFilter = 'all' | IrrigationEvent['source']

export default function HistoryPage() {
  const { selectedPlot } = useAxis()
  const selectedPlotID = selectedPlot?.id
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [events, setEvents] = useState<IrrigationEvent[]>([])

  useEffect(() => {
    setEvents([])
    if (!selectedPlotID) return
    void repos.eventsForPlot(selectedPlotID, '0000-01-01').then(setEvents)
  }, [selectedPlotID])

  if (!selectedPlot) {
    return <Page><AppHeader showBack eyebrow="Logs" title="Irrigation History" /><EmptyState title="Add a plot first" text="History is kept locally for each plot." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} /></Page>
  }

  const selectedPlotId = selectedPlot.id
  const filteredEvents = filter === 'all' ? events : events.filter(event => event.source === filter)

  function handleExport() {
    if (events.length === 0) return
    const header = 'date,created_at,litres,source,recommended_litres,meter_id,meter_start_litres,meter_end_litres'
    const rows = events.map(event => [event.date, event.createdAt, event.litres, event.source, event.recommendedLitres ?? '', event.meterId ?? '', event.meterStartLitres ?? '', event.meterEndLitres ?? ''].map(csvCell).join(','))
    const url = URL.createObjectURL(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `axis-${selectedPlotId}-irrigation.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Page>
      <AppHeader showBack eyebrow="Local records" title="Irrigation History" />

      <div className="filter-pills">
        <button className={filter === 'all' ? 'pill active' : 'pill'} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'FOLLOWED_RECOMMENDATION' ? 'pill active' : 'pill'} onClick={() => setFilter('FOLLOWED_RECOMMENDATION')}>Followed Advice</button>
        <button className={filter === 'MANUAL' ? 'pill active' : 'pill'} onClick={() => setFilter('MANUAL')}>Manual</button>
        <button className={filter === 'FLOW_METER' ? 'pill active' : 'pill'} onClick={() => setFilter('FLOW_METER')}>Flow Meter</button>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState title={events.length === 0 ? 'No irrigation logged yet' : 'No records match this filter'} text="Applied water records saved on this device will appear here." />
      ) : (
        <Card className="history-list-card">
          <div className="history-items">
            {filteredEvents.map(event => (
              <div key={event.id} className="history-item-row">
                <div className="history-icon-circle">💧</div>
                <div className="history-item-info">
                  <strong>{event.source === 'FOLLOWED_RECOMMENDATION' ? 'Followed AXIS advice' : event.source === 'FLOW_METER' ? 'Manual flow-meter reading' : 'Manual farmer entry'}</strong>
                  <span className="history-date-text">{new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}</span>
                  {event.recommendedLitres !== undefined && <span>Prescribed: {formatLitres(event.recommendedLitres)}</span>}
                </div>
                <div className="history-amount"><strong>{formatLitres(event.litres)}</strong></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="export-btn-wrap"><button className="button secondary full export-btn" disabled={events.length === 0} onClick={handleExport}>Export History</button></div>
    </Page>
  )
}

function csvCell(value: string | number) {
  const text = String(value)
  return `"${text.replaceAll('"', '""')}"`
}
