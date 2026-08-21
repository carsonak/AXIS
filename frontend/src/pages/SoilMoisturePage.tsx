import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Badge, Card, EmptyState, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { SoilMoistureReading } from '../types'

export default function SoilMoisturePage() {
  const { selectedPlot } = useAxis()
  const [reading, setReading] = useState<SoilMoistureReading>()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setReading(undefined)
    if (!selectedPlot) { setLoaded(true); return }
    void repos.latestSensorReading(selectedPlot.id).then(value => { setReading(value); setLoaded(true) })
  }, [selectedPlot?.id])

  if (!selectedPlot) {
    return <Page><AppHeader showBack eyebrow="Soil" title="Soil Moisture" /><EmptyState title="Add a plot first" text="Soil moisture readings are tracked per plot." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} /></Page>
  }

  return (
    <Page>
      <AppHeader showBack eyebrow="Sensor Context" title="Soil Moisture" />
      <Card className="soil-zones-card">
        <div className="section-head">
          <div><p className="eyebrow">{selectedPlot.name}</p><h2>Latest contextual reading</h2></div>
          <Badge tone={reading ? 'info' : 'muted'}>{reading ? 'Context only' : 'Sensor not connected'}</Badge>
        </div>
        {!loaded ? <p>Opening saved readings…</p> : reading ? (
          <div className="key-info-grid">
            <div className="key-info-item"><span>Volumetric water content</span><strong>{reading.volumetricWaterContentPct}%</strong></div>
            <div className="key-info-item"><span>Observed</span><strong>{new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(reading.observedAt))}</strong></div>
            <div className="key-info-item"><span>Connection</span><strong>{reading.connection.replaceAll('_', ' ').toLowerCase()}</strong></div>
            <div className="key-info-item"><span>Field capacity</span><strong>{reading.fieldCapacityPct === undefined ? 'Not provided' : `${reading.fieldCapacityPct}%`}</strong></div>
          </div>
        ) : <p>No readings yet. Add a manual contextual reading from Settings when a real observation is available.</p>}
      </Card>
      <Card className="soil-tip-banner">
        <div className="tip-icon-circle">ⓘ</div>
        <div className="tip-text-content"><strong>Context, not an adjustment</strong><p>Soil-humidity observations do not change litres or minutes until a calibrated adjustment model has been locally and agronomically validated.</p></div>
      </Card>
    </Page>
  )
}
