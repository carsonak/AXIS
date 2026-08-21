import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Card, EmptyState, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { IrrigationEvent, StoredRecommendation } from '../types'
import { formatLitres } from '../utils'

type HistoryFilter = 'all' | 'irrigation' | 'rainfall'

export default function HistoryPage() {
  const { selectedPlot } = useAxis()
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [recommendations, setRecommendations] = useState<StoredRecommendation[]>([])
  const [events, setEvents] = useState<IrrigationEvent[]>([])

  useEffect(() => {
    if (!selectedPlot) return
    void Promise.all([
      repos.recommendationsForPlot(selectedPlot.id, '2025-05-01'),
      repos.eventsForPlot(selectedPlot.id, '2025-05-01')
    ]).then(([recs, irrigation]) => {
      setRecommendations(recs)
      setEvents(irrigation)
    })
  }, [selectedPlot?.id])

  const historyItems = [
    { id: '1', type: 'irrigation', title: 'Irrigation', date: '19 May 2025 - 6:30 AM', amount: '420 Litres', icon: '💧' },
    { id: '2', type: 'irrigation', title: 'Irrigation', date: '17 May 2025 - 6:45 AM', amount: '420 Litres', icon: '💧' },
    { id: '3', type: 'rainfall', title: 'Rainfall', date: '16 May 2025 - 2:00 PM', amount: '12 mm', icon: '🌧' },
    { id: '4', type: 'irrigation', title: 'Irrigation', date: '15 May 2025 - 6:40 AM', amount: '300 Litres', icon: '💧' },
  ]

  const filteredItems = historyItems.filter(item => {
    if (filter === 'all') return true
    return item.type === filter
  })

  function handleExport() {
    alert('Exporting irrigation history CSV file...')
  }

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow="Logs"
        title="Irrigation History"
        action={
          <button className="icon-button" aria-label="Filter history" onClick={() => setFilter(filter === 'all' ? 'irrigation' : filter === 'irrigation' ? 'rainfall' : 'all')}>
            🔍
          </button>
        }
      />

      {/* Filter Tabs */}
      <div className="filter-pills">
        <button className={filter === 'all' ? 'pill active' : 'pill'} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'irrigation' ? 'pill active' : 'pill'} onClick={() => setFilter('irrigation')}>Irrigation</button>
        <button className={filter === 'rainfall' ? 'pill active' : 'pill'} onClick={() => setFilter('rainfall')}>Rainfall</button>
      </div>

      {/* History Items List */}
      <Card className="history-list-card">
        <div className="history-items">
          {filteredItems.map(item => (
            <div key={item.id} className="history-item-row">
              <div className="history-icon-circle">
                {item.icon}
              </div>
              <div className="history-item-info">
                <strong>{item.title}</strong>
                <span className="history-date-text">{item.date}</span>
              </div>
              <div className="history-amount">
                <strong>{item.amount}</strong>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Export History Button */}
      <div className="export-btn-wrap">
        <button className="button secondary full export-btn" onClick={handleExport}>
          Export History
        </button>
      </div>
    </Page>
  )
}
