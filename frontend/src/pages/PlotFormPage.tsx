import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, AppHeader, Card, Page, Spinner } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { Plot } from '../types'
import { cropAgeDays, deriveStage, plantingDateFromAge } from '../utils'

export default function PlotFormPage() {
  const { plotId } = useParams()
  const navigate = useNavigate()
  const { catalog, settings, reload, selectPlot } = useAxis()
  const [existing, setExisting] = useState<Plot>()
  const [name, setName] = useState('Tomato plot')
  const [nameEdited, setNameEdited] = useState(false)
  const [lat, setLat] = useState('-0.0917')
  const [lon, setLon] = useState('34.7680')
  const [area, setArea] = useState('0.25')
  const [areaUnit, setAreaUnit] = useState(settings.areaUnit)
  const [cropId, setCropId] = useState('tomato')
  const [ageMode, setAgeMode] = useState<'age' | 'date'>('age')
  const [age, setAge] = useState('10')
  const [ageUnit, setAgeUnit] = useState<'days' | 'weeks'>('weeks')
  const [plantingDate, setPlantingDate] = useState('')
  const [methodId, setMethodId] = useState(settings.defaultIrrigationMethodId ?? 'drip')
  const [flowRate, setFlowRate] = useState('45')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!plotId) return
    void repos.getPlot(plotId).then(plot => {
      if (!plot) return
      setExisting(plot); setNameEdited(true); setName(plot.name); setLat(String(plot.lat)); setLon(String(plot.lon)); setCropId(plot.cropId)
      setPlantingDate(plot.plantingDate); setAgeMode('date'); setMethodId(plot.irrigationMethodId); setFlowRate(plot.flowRateLpm ? String(plot.flowRateLpm) : '')
      setAreaUnit(settings.areaUnit); setArea(String(fromM2(plot.areaM2, settings.areaUnit)))
    })
  }, [plotId])

  const resolvedPlantingDate = ageMode === 'date' ? plantingDate : plantingDateFromAge(Number(age || 0), ageUnit)
  const crop = catalog?.crops.find(item => item.id === cropId)
  const stage = useMemo(() => crop && resolvedPlantingDate ? deriveStage(crop, cropAgeDays(resolvedPlantingDate)) : undefined, [crop, resolvedPlantingDate])

  function cropLabel(id: string) { return catalog?.crops.find(item => item.id === id)?.display_name ?? 'New' }
  function chooseCrop(id: string) {
    setCropId(id)
    if (!nameEdited) setName(`${cropLabel(id)} plot`)
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    try {
      const areaM2 = toM2(Number(area), areaUnit)
      const finalName = name.trim() || `${cropLabel(cropId)} plot`
      if (!finalName.trim()) throw new Error('Give this plot a name.')
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) throw new Error('Enter a valid location or use device location.')
      if (!Number.isFinite(areaM2) || areaM2 <= 0) throw new Error('Area must be greater than zero.')
      if (!resolvedPlantingDate || resolvedPlantingDate > new Date().toISOString().slice(0, 10)) throw new Error('Planting date cannot be in the future.')
      const now = new Date().toISOString()
      const plot: Plot = {
        id: existing?.id ?? crypto.randomUUID(), name: finalName, lat: Number(lat), lon: Number(lon), areaM2,
        cropId, plantingDate: resolvedPlantingDate, plantingDateEstimated: ageMode === 'age', irrigationMethodId: methodId,
        flowRateLpm: flowRate ? Number(flowRate) : undefined, createdAt: existing?.createdAt ?? now, updatedAt: now
      }
      if (plot.flowRateLpm !== undefined && (!Number.isFinite(plot.flowRateLpm) || plot.flowRateLpm <= 0)) throw new Error('Flow rate must be a positive number when supplied.')
      await repos.savePlot(plot); await selectPlot(plot.id); await reload(); navigate('/')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save plot.') }
  }

  function locate() {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Enter coordinates manually.'); return }
    setLocating(true); setError('')
    navigator.geolocation.getCurrentPosition(position => { setLat(position.coords.latitude.toFixed(6)); setLon(position.coords.longitude.toFixed(6)); setLocating(false) }, () => { setError('Location permission was denied. Enter coordinates manually or use the Kisumu demo location.'); setLocating(false) }, { enableHighAccuracy: true, timeout: 8000 })
  }

  if (!catalog) return <Page><AppHeader eyebrow="Plot setup" title="Connect once to finish setup" /><Card><Spinner label="Waiting for the AXIS crop catalog…" /><p>Once loaded, the catalog is stored on this device for offline editing.</p></Card></Page>

  return <Page><AppHeader eyebrow={existing ? 'Edit plot' : 'New plot'} title={existing ? existing.name : 'Tell AXIS about the field'} />
    <form className="plot-form" onSubmit={submit}>
      <Card><h2>1. Plot and location</h2><label>Plot name<input value={name} onChange={event => { setName(event.target.value); setNameEdited(true) }} maxLength={80} /></label><div className="location-actions"><button type="button" className="button secondary" onClick={locate} disabled={locating}>{locating ? 'Finding location…' : 'Use my location'}</button><button type="button" className="text-button" onClick={() => { setLat('-0.0917'); setLon('34.7680') }}>Use Kisumu demo location</button></div><div className="form-grid"><label>Latitude<input inputMode="decimal" value={lat} onChange={event => setLat(event.target.value)} /></label><label>Longitude<input inputMode="decimal" value={lon} onChange={event => setLon(event.target.value)} /></label></div></Card>
      <Card><h2>2. Crop and age</h2><label>Crop<select value={cropId} onChange={event => chooseCrop(event.target.value)}>{catalog.crops.map(item => <option key={item.id} value={item.id}>{item.display_name}{item.display_name_sw ? ` · ${item.display_name_sw}` : ''}</option>)}</select></label><div className="segmented"><button type="button" className={ageMode === 'age' ? 'active' : ''} onClick={() => setAgeMode('age')}>Enter crop age</button><button type="button" className={ageMode === 'date' ? 'active' : ''} onClick={() => setAgeMode('date')}>Planting date</button></div>{ageMode === 'age' ? <div className="form-grid"><label>Crop age<input inputMode="numeric" value={age} onChange={event => setAge(event.target.value)} /></label><label>Unit<select value={ageUnit} onChange={event => setAgeUnit(event.target.value as 'days' | 'weeks')}><option value="weeks">Weeks</option><option value="days">Days</option></select></label></div> : <label>Planting or transplanting date<input type="date" value={plantingDate} onChange={event => setPlantingDate(event.target.value)} /></label>}{stage && <div className="stage-preview"><span>{Math.round(stage.progress)}%</span><div><strong>{catalog.stages.find(item => item.id === stage.id)?.display_name}</strong><small>Automatically derived · stage day {stage.day}</small></div></div>}</Card>
      <Card><h2>3. Area and irrigation</h2><div className="form-grid"><label>Plot area<input inputMode="decimal" value={area} onChange={event => setArea(event.target.value)} /></label><label>Unit<select value={areaUnit} onChange={event => setAreaUnit(event.target.value as typeof areaUnit)}><option value="acre">Acres</option><option value="hectare">Hectares</option><option value="m2">Square metres</option></select></label></div><label>Irrigation method<select value={methodId} onChange={event => setMethodId(event.target.value)}>{catalog.irrigation_methods.map(method => <option key={method.id} value={method.id}>{method.display_name} · {Math.round(method.efficiency * 100)}% efficient</option>)}</select></label><label>System flow rate <span className="optional">optional</span><div className="input-suffix"><input inputMode="decimal" value={flowRate} onChange={event => setFlowRate(event.target.value)} placeholder="e.g. 45" /><span>L/min</span></div></label><p className="form-note">Flow rate lets AXIS translate litres into practical pump runtime.</p></Card>
      {error && <Alert tone="warn" title="Check the form">{error}</Alert>}
      <button className="button primary full" type="submit">{existing ? 'Save changes' : 'Create plot and calculate'}</button>
    </form>
  </Page>
}

function toM2(value: number, unit: 'acre' | 'hectare' | 'm2') { return unit === 'acre' ? value * 4046.8564224 : unit === 'hectare' ? value * 10000 : value }
function fromM2(value: number, unit: 'acre' | 'hectare' | 'm2') { const result = unit === 'acre' ? value / 4046.8564224 : unit === 'hectare' ? value / 10000 : value; return Math.round(result * 1000) / 1000 }
