import { useEffect, useState } from 'react'
import { Alert, AppHeader, Badge, Card, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { SoilMoistureReading } from '../types'

export default function MorePage() {
  const { settings, saveSettings, health, selectedPlot, catalog } = useAxis()
  const [sensor, setSensor] = useState<SoilMoistureReading>()
  const [showSensorForm, setShowSensorForm] = useState(false)
  const [vwc, setVwc] = useState('')
  const [fieldCapacity, setFieldCapacity] = useState('')
  const [wiltingPoint, setWiltingPoint] = useState('')
  const [rootDepth, setRootDepth] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { if (selectedPlot) void repos.latestSensorReading(selectedPlot.id).then(setSensor) }, [selectedPlot?.id])

  async function saveSensor() {
    if (!selectedPlot) return
    const value = Number(vwc)
    if (!Number.isFinite(value) || value < 0 || value > 100) { setMessage('Enter soil moisture between 0 and 100%.'); return }
    const reading: SoilMoistureReading = {
      id: crypto.randomUUID(), plotId: selectedPlot.id, sensorId: 'manual-calibration-preview', observedAt: new Date().toISOString(),
      volumetricWaterContentPct: value, fieldCapacityPct: fieldCapacity ? Number(fieldCapacity) : undefined,
      wiltingPointPct: wiltingPoint ? Number(wiltingPoint) : undefined, rootZoneDepthMm: rootDepth ? Number(rootDepth) : undefined,
      connection: 'MANUAL_IMPORT'
    }
    await repos.saveSensorReading(reading); setSensor(reading); setShowSensorForm(false); setMessage('Sensor reading saved as context. Refresh Today to include its calibration status.')
  }

  return <Page><AppHeader eyebrow="Preferences and integrations" title="More" />
    {message && <Alert title="Updated">{message}</Alert>}
    <Card><div className="section-head"><div><p className="eyebrow">Preferences</p><h2>Display</h2></div></div><label>Area unit<select value={settings.areaUnit} onChange={event => void saveSettings({ ...settings, areaUnit: event.target.value as typeof settings.areaUnit })}><option value="acre">Acres</option><option value="hectare">Hectares</option><option value="m2">Square metres</option></select></label><label>Language<select value={settings.language} onChange={event => void saveSettings({ ...settings, language: event.target.value as typeof settings.language })}><option value="en">English</option><option value="sw">Kiswahili labels</option></select></label><label>Default irrigation method<select value={settings.defaultIrrigationMethodId ?? ''} onChange={event => void saveSettings({ ...settings, defaultIrrigationMethodId: event.target.value || undefined })}><option value="">Choose per plot</option>{catalog?.irrigation_methods.map(method => <option key={method.id} value={method.id}>{settings.language === 'sw' && method.display_name_sw ? method.display_name_sw : method.display_name}</option>)}</select></label></Card>
    <Card><div className="section-head"><div><p className="eyebrow">Bonus hardware preview</p><h2>Soil humidity sensor</h2></div><Badge tone="muted">Preview only</Badge></div><p>A timestamped volumetric-water-content reading can be saved as context. It never changes the recommendation until its calibration and adjustment model have been agronomically validated.</p>{sensor && <div className="sensor-reading"><strong>{sensor.volumetricWaterContentPct}% VWC</strong><span>{sensor.fieldCapacityPct && sensor.wiltingPointPct && sensor.rootZoneDepthMm ? 'Calibration metadata present · adjustment remains validation-gated' : 'Context only · add calibration before agronomic adjustment'}</span></div>}<button className="button secondary" disabled={!selectedPlot} onClick={() => setShowSensorForm(value => !value)}>{showSensorForm ? 'Cancel' : sensor ? 'Add newer reading' : 'Add sensor reading'}</button>{showSensorForm && <div className="sensor-form"><label>Volumetric water content (%)<input inputMode="decimal" value={vwc} onChange={event => setVwc(event.target.value)} /></label><div className="form-grid"><label>Field capacity (%)<input inputMode="decimal" value={fieldCapacity} onChange={event => setFieldCapacity(event.target.value)} /></label><label>Wilting point (%)<input inputMode="decimal" value={wiltingPoint} onChange={event => setWiltingPoint(event.target.value)} /></label></div><label>Root-zone depth (mm)<input inputMode="decimal" value={rootDepth} onChange={event => setRootDepth(event.target.value)} /></label><button className="button primary" onClick={() => void saveSensor()}>Save contextual reading</button></div>}</Card>
    <Card><div className="section-head"><div><p className="eyebrow">Measured irrigation</p><h2>Water flow meters</h2></div><Badge tone="info">Manual readings</Badge></div><p>When logging irrigation, enter cumulative start and end meter readings manually. AXIS stores their difference as measured applied volume; automatic hardware ingestion remains a future adapter.</p><div className="integration-flow"><span>Start/end readings</span><b>→</b><span>Measured litres</span><b>→</b><span>Local history</span></div></Card>
    <Card><div className="section-head"><div><p className="eyebrow">System status</p><h2>AXIS capabilities</h2></div></div><ul className="status-list"><li><span>Weather mode</span><Badge tone={health?.weather_mode === 'fixture' ? 'warn' : 'good'}>{health?.weather_mode ?? 'Saved/offline'}</Badge></li><li><span>AI explanations</span><Badge tone={health?.ai_insights_enabled ? 'info' : 'muted'}>{health?.ai_insights_enabled ? 'Bonus enabled' : 'Disabled safely'}</Badge></li><li><span>Farmer data</span><Badge tone="good">On this device</Badge></li></ul></Card>
    <p className="disclaimer standalone">AXIS provides estimated irrigation guidance. Validate crop assumptions and sensor calibration with an agronomist before production use.</p>
  </Page>
}
