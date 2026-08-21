import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, AppHeader, Card, Page, Spinner, SketchCrop } from '../components'

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
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [area, setArea] = useState('')
  const [areaUnit, setAreaUnit] = useState(settings.areaUnit)
  const [cropId, setCropId] = useState('tomato')
  const [ageMode, setAgeMode] = useState<'age' | 'date'>('age')
  const [age, setAge] = useState('')
  const [ageUnit, setAgeUnit] = useState<'days' | 'weeks'>('weeks')
  const [plantingDate, setPlantingDate] = useState('')
  const [methodId, setMethodId] = useState(settings.defaultIrrigationMethodId ?? 'drip')
  const [flowRate, setFlowRate] = useState('')
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
      if (!lat.trim() || !lon.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) throw new Error('Enter a valid location or use device location.')
      if (!Number.isFinite(areaM2) || areaM2 <= 0) throw new Error('Area must be greater than zero.')
      if (ageMode === 'age' && (!age.trim() || !Number.isFinite(Number(age)) || Number(age) < 0)) throw new Error('Crop age must be zero or greater.')
      if (!resolvedPlantingDate || resolvedPlantingDate > new Date().toISOString().slice(0, 10)) throw new Error('Planting date cannot be in the future.')
      const now = new Date().toISOString()
      const plot: Plot = {
        id: existing?.id ?? crypto.randomUUID(), name: finalName, lat: Number(lat), lon: Number(lon), areaM2,
        cropId, plantingDate: resolvedPlantingDate, plantingDateEstimated: ageMode === 'age', irrigationMethodId: methodId,
        flowRateLpm: flowRate ? Number(flowRate) : undefined, createdAt: existing?.createdAt ?? now, updatedAt: now
      }
      if (plot.flowRateLpm !== undefined && (!Number.isFinite(plot.flowRateLpm) || plot.flowRateLpm <= 0)) throw new Error('Flow rate must be a positive number when supplied.')
      await repos.savePlot(plot); await selectPlot(plot.id); await reload(); navigate('/app')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save plot.') }
  }

  function locate() {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Enter coordinates manually.'); return }
    setLocating(true); setError('')
    navigator.geolocation.getCurrentPosition(position => { setLat(position.coords.latitude.toFixed(6)); setLon(position.coords.longitude.toFixed(6)); setLocating(false) }, () => { setError('Location permission was denied. Enter coordinates manually or use the Kisumu demo location.'); setLocating(false) }, { enableHighAccuracy: true, timeout: 8000 })
  }

  if (!catalog) return <Page><AppHeader eyebrow="Plot setup" title="Connect once to finish setup" /><Card><Spinner label="Waiting for the AXIS crop catalog…" /><p>Once loaded, the catalog is stored on this device for offline editing.</p></Card></Page>

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow={existing ? 'Field Configuration' : 'New Field Setup'}
        title={existing ? `Edit ${existing.name}` : 'Create New Farm Plot'}
      />

      <form className="plot-form" onSubmit={submit}>
        {/* Card 1: Plot & Location */}
        <Card className="plot-form-card">
          <div className="card-header-row">
            <div className="card-header-icon"><SketchCrop size={22} color="#1b5e20" /></div>
            <div>
              <h2>1. Plot & Field Location</h2>
              <p className="card-subtitle">Name your plot and set geographical coordinates for weather tracking.</p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="plotName">Plot Name</label>
            <input
              id="plotName"
              value={name}
              onChange={event => { setName(event.target.value); setNameEdited(true) }}
              placeholder="e.g. North Block Tomatoes"
              maxLength={80}
            />
          </div>

          <div className="location-action-bar">
            <button type="button" className="button secondary compact" onClick={locate} disabled={locating}>
              📍 {locating ? 'Finding location…' : 'Use My GPS Location'}
            </button>
            <button type="button" className="text-button" onClick={() => { setLat('-0.0917'); setLon('34.7680') }}>
              📌 Use Kisumu Demo Coordinates
            </button>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="lat">Latitude</label>
              <input id="lat" inputMode="decimal" value={lat} onChange={event => setLat(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="lon">Longitude</label>
              <input id="lon" inputMode="decimal" value={lon} onChange={event => setLon(event.target.value)} />
            </div>
          </div>
        </Card>

        {/* Card 2: Crop Variety & Age */}
        <Card className="plot-form-card">
          <div className="card-header-row">
            <div className="card-header-icon"><SketchCrop size={22} color="#1b5e20" /></div>
            <div>
              <h2>2. Crop Variety & Growth Stage</h2>
              <p className="card-subtitle">Select crop type and age to derive stage-specific water requirements.</p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cropSelect">Crop Variety</label>
            <select id="cropSelect" value={cropId} onChange={event => chooseCrop(event.target.value)}>
              {catalog.crops.map(item => (
                <option key={item.id} value={item.id}>
                  {item.display_name}{item.display_name_sw ? ` · ${item.display_name_sw}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="segmented-toggle-bar">
            <button
              type="button"
              className={`segmented-btn ${ageMode === 'age' ? 'active' : ''}`}
              onClick={() => setAgeMode('age')}
            >
              Enter Crop Age
            </button>
            <button
              type="button"
              className={`segmented-btn ${ageMode === 'date' ? 'active' : ''}`}
              onClick={() => setAgeMode('date')}
            >
              Set Planting Date
            </button>
          </div>

          {ageMode === 'age' ? (
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="cropAge">Current Crop Age</label>
                <input id="cropAge" inputMode="numeric" value={age} onChange={event => setAge(event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="ageUnit">Age Unit</label>
                <select id="ageUnit" value={ageUnit} onChange={event => setAgeUnit(event.target.value as 'days' | 'weeks')}>
                  <option value="weeks">Weeks</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="plantingDate">Planting or Transplanting Date</label>
              <input id="plantingDate" type="date" value={plantingDate} onChange={event => setPlantingDate(event.target.value)} />
            </div>
          )}

          {stage && (
            <div className="stage-preview-card">
              <div className="stage-preview-head">
                <strong>{catalog.stages.find(item => item.id === stage.id)?.display_name}</strong>
                <span className="stage-pct-badge">{Math.round(stage.progress)}% Complete</span>
              </div>
              <p className="stage-preview-sub">Automatically calculated · Stage Day {stage.day}</p>
              <div className="crop-row-bar-track mt-2">
                <span className="crop-row-bar-fill" style={{ width: `${Math.min(100, Math.round(stage.progress))}%` }} />
              </div>
            </div>
          )}
        </Card>

        {/* Card 3: Area & Irrigation Method */}
        <Card className="plot-form-card">
          <div className="card-header-row">
            <div className="card-header-icon"><SketchCrop size={22} color="#1b5e20" /></div>
            <div>
              <h2>3. Field Area & Irrigation System</h2>
              <p className="card-subtitle">Set field size and system flow rate for irrigation runtime calculations.</p>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="plotArea">Plot Area</label>
              <input id="plotArea" inputMode="decimal" value={area} onChange={event => setArea(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="areaUnit">Measurement Unit</label>
              <select id="areaUnit" value={areaUnit} onChange={event => setAreaUnit(event.target.value as typeof areaUnit)}>
                <option value="acre">Acres</option>
                <option value="hectare">Hectares</option>
                <option value="m2">Square metres</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="methodSelect">Irrigation Method</label>
            <select id="methodSelect" value={methodId} onChange={event => setMethodId(event.target.value)}>
              {catalog.irrigation_methods.map(method => (
                <option key={method.id} value={method.id}>
                  {method.display_name} · {Math.round(method.efficiency * 100)}% application efficiency
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="flowRate">
              System Flow Rate <span className="optional">(optional)</span>
            </label>
            <div className="input-suffix">
              <input id="flowRate" inputMode="decimal" value={flowRate} onChange={event => setFlowRate(event.target.value)} placeholder="e.g. 45" />
              <span>L/min</span>
            </div>
            <p className="form-note mt-1">Flow rate enables AXIS to accurately translate required volume into pump runtime minutes.</p>
          </div>
        </Card>

        {error && <Alert tone="warn" title="Check the form">{error}</Alert>}
        <button className="button primary full" type="submit">
          {existing ? 'Save Plot Changes' : 'Create Plot'}
        </button>
      </form>
    </Page>
  )

}

function toM2(value: number, unit: 'acre' | 'hectare' | 'm2') { return unit === 'acre' ? value * 4046.8564224 : unit === 'hectare' ? value * 10000 : value }
function fromM2(value: number, unit: 'acre' | 'hectare' | 'm2') { const result = unit === 'acre' ? value / 4046.8564224 : unit === 'hectare' ? value / 10000 : value; return Math.round(result * 1000) / 1000 }
