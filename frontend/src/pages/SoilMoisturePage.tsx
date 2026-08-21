import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Card, EmptyState, Page, Badge } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { SoilMoistureReading } from '../types'

export default function SoilMoisturePage() {
  const { selectedPlot, reload } = useAxis()
  const [reading, setReading] = useState<SoilMoistureReading>()
  const [selectedFarm, setSelectedFarm] = useState('My Farm')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!selectedPlot) return
    void repos.latestSensorReading(selectedPlot.id).then(setReading)
  }, [selectedPlot?.id])

  async function handleRefresh() {
    setRefreshing(true)
    await reload()
    if (selectedPlot) {
      const latest = await repos.latestSensorReading(selectedPlot.id)
      setReading(latest)
    }
    setTimeout(() => setRefreshing(false), 500)
  }

  if (!selectedPlot) {
    return (
      <Page>
        <AppHeader showBack eyebrow="Soil" title="Soil Moisture" />
        <EmptyState title="Add a plot first" text="Soil moisture readings are tracked per plot." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} />
      </Page>
    )
  }

  const zones = [
    { name: 'Zone A', pct: 32, status: 'Adequate', color: '#2e7d32' },
    { name: 'Zone B', pct: 19, status: 'Low', color: '#d97706' },
    { name: 'Zone C', pct: 41, status: 'Adequate', color: '#2e7d32' },
  ]

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow="Sensor Context"
        title="Soil Moisture"
        action={
          <button className={`icon-button ${refreshing ? 'spinning' : ''}`} onClick={() => void handleRefresh()} aria-label="Refresh soil moisture">
            ↻
          </button>
        }
      />

      {/* Farm Dropdown */}
      <div className="farm-selector-row">
        <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)}>
          <option value="My Farm">My Farm</option>
          <option value="North Field">North Field</option>
          <option value="South Plot">South Plot</option>
        </select>
      </div>

      {/* Zone Moisture Progress Bars */}
      <Card className="soil-zones-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">{selectedFarm}</p>
            <h2>Soil Moisture Zones</h2>
          </div>
        </div>

        <div className="zones-list">
          {zones.map(z => (
            <div key={z.name} className="zone-row">
              <div className="zone-name">{z.name}</div>
              <div className="zone-bar-track">
                <div className="zone-bar-fill" style={{ width: `${z.pct}%`, backgroundColor: z.color }} />
              </div>
              <div className="zone-pct-wrap">
                <span className="zone-pct">{z.pct}%</span>
                <span className="zone-status" style={{ color: z.color }}>{z.status}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tip Card */}
      <Card className="soil-tip-banner">
        <div className="tip-icon-circle">
          💡
        </div>
        <div className="tip-text-content">
          <strong>Tip</strong>
          <p>Zone B moisture is low (19%). Irrigation recommended.</p>
        </div>
      </Card>
    </Page>
  )
}
