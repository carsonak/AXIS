import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createInsight, createRecommendation, type InsightHistoryItem } from '../api'
import { Alert, AppHeader, AxisMark, Badge, Card, EmptyState, Modal, Page, Spinner } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import { measuredLitres } from '../sensors'
import type { IrrigationEvent, StoredInsight, StoredRecommendation } from '../types'
import { formatLitres, formatWindow, freshness, friendlyDate, nairobiDate, recommendationChange } from '../utils'

const stageOrder = ['establishing', 'developing', 'productive', 'maturing'] as const

export default function TodayPage() {
  const { selectedPlot, catalog, online, health, settings } = useAxis()
  const [recommendation, setRecommendation] = useState<StoredRecommendation>()
  const [latestEvent, setLatestEvent] = useState<IrrigationEvent>()
  const [insight, setInsight] = useState<StoredInsight>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showWhy, setShowWhy] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const loadLocal = useCallback(async () => {
    if (!selectedPlot) { setRecommendation(undefined); return }
    const [rec, event, savedInsight] = await Promise.all([
      repos.latestRecommendation(selectedPlot.id), repos.latestEvent(selectedPlot.id), repos.getInsight(selectedPlot.id, nairobiDate())
    ])
    setRecommendation(rec); setLatestEvent(event); setInsight(savedInsight)
  }, [selectedPlot?.id])

  const refresh = useCallback(async () => {
    if (!selectedPlot || !online) return
    setLoading(true); setError('')
    try {
      const date = nairobiDate()
      const previous = await repos.previousRecommendation(selectedPlot.id, date)
      const sensor = await repos.latestSensorReading(selectedPlot.id)
      const result = await createRecommendation(selectedPlot, date, previous, sensor)
      const saved = await repos.saveRecommendation(result)
      setRecommendation(saved)
    } catch (err) { setError(err instanceof Error ? err.message : 'Recommendation refresh failed.') }
    finally { setLoading(false) }
  }, [selectedPlot, online])

  useEffect(() => { void loadLocal() }, [loadLocal])
  useEffect(() => {
    if (selectedPlot && online && recommendation?.date !== nairobiDate() && !loading) void refresh()
  }, [selectedPlot?.id, online, recommendation?.date])

  if (!selectedPlot) return <Page><div className="top-brand"><AxisMark /></div><AppHeader eyebrow="Today" title="Your irrigation plan" /><EmptyState title="Set up your first plot" text="Add the crop, area, irrigation method, and location. AXIS will turn today’s weather into an explainable action." action={<Link className="button primary" to="/plots/new">Add a plot</Link>} /></Page>

  const activePlot = selectedPlot
  const crop = catalog?.crops.find(item => item.id === activePlot.cropId)
  const status = freshness(recommendation)
  const change = recommendation ? recommendationChange(recommendation) : undefined
  const rainProbability = recommendation?.weather.rain_probability

  async function generateInsight() {
    if (!recommendation || !health?.ai_insights_enabled) return
    setLoading(true); setError('')
    try {
      const [recs, events] = await Promise.all([repos.recommendationsForPlot(activePlot.id, dateSevenDaysAgo()), repos.eventsForPlot(activePlot.id, dateSevenDaysAgo())])
      const history: InsightHistoryItem[] = recs.slice(0, 7).map(rec => ({
        date: rec.date, recommended_litres: rec.decision.litres_exact,
        applied_litres: events.find(event => event.date === rec.date)?.litres,
        rain_adjustment_litres: rec.decision.rain_adjustment_litres
      }))
      const result = await createInsight(recommendation, history, settings.language)
      const stored: StoredInsight = { id: `${activePlot.id}:${recommendation.date}`, plotId: activePlot.id, date: recommendation.date, summary: result.summary, observations: result.observations, language: result.language, generatedAt: result.generated_at, label: result.label }
      await repos.saveInsight(stored); setInsight(stored)
    } catch (err) { setError(err instanceof Error ? err.message : 'AI explanation is unavailable.') }
    finally { setLoading(false) }
  }

  return <Page>
    <div className="top-brand"><AxisMark /></div>
    <AppHeader eyebrow="Today" title={selectedPlot.name} action={<button className="icon-button refresh" onClick={() => void refresh()} disabled={!online || loading} aria-label="Refresh recommendation">↻</button>} />
    {!online && <Alert tone="warn" title="You’re offline">Saved advice and irrigation logging still work. Reconnect for new weather.</Alert>}
    {error && <Alert tone="warn" title="Couldn’t refresh">{error}</Alert>}
    {recommendation ? <>
      <Card className={`hero ${recommendation.decision.action.toLowerCase()}`}>
        <div className="hero-top"><Badge tone={recommendation.decision.action === 'SKIP' ? 'good' : recommendation.decision.action === 'REDUCED' ? 'info' : 'warn'}>{recommendation.decision.action === 'SKIP' ? 'Skip today' : recommendation.decision.action === 'REDUCED' ? 'Rain-adjusted' : 'Irrigate today'}</Badge><Badge tone={status.tone}>{status.label}</Badge></div>
        <div className="droplet">◒</div>
        <p className="hero-kicker">Estimated daily requirement</p>
        <strong className="hero-number">{formatLitres(recommendation.decision.litres)}</strong>
        {recommendation.decision.duration_minutes !== undefined && <p className="hero-duration">About <strong>{recommendation.decision.duration_minutes} minutes</strong> at {selectedPlot.flowRateLpm} L/min</p>}
        <p className="hero-window">Best window · {formatWindow(recommendation.decision.recommended_window)}</p>
        <div className="hero-actions"><button className="button primary" onClick={() => setShowLog(true)}>I irrigated</button><button className="button secondary" onClick={() => setShowWhy(true)}>Why this amount?</button></div>
      </Card>

      <section className="metric-grid">
        <Card><span className="metric-icon">☂</span><small>Expected rain</small><strong>{recommendation.weather.rain_next_24h_mm.toFixed(1)} mm</strong><span>{rainProbability !== undefined ? `${Math.round(rainProbability * 100)}% chance` : 'Probability unavailable'}</span></Card>
        <Card><span className="metric-icon">☀</span><small>Temperature</small><strong>{Math.round(recommendation.weather.t_min_c)}–{Math.round(recommendation.weather.t_max_c)}°C</strong><span>{recommendation.weather.et0_method} ETo</span></Card>
        <Card><span className="metric-icon">↘</span><small>Rain adjustment</small><strong>{formatLitres(recommendation.decision.rain_adjustment_litres)}</strong><span>Water avoided today</span></Card>
      </section>

      <Card className="growth-card">
        <div className="section-head"><div><p className="eyebrow">Crop growth</p><h2>{crop?.display_name ?? selectedPlot.cropId}</h2></div><Badge tone="good">Day {recommendation.crop_stage.crop_age_days}</Badge></div>
        <div className="stage-track">{stageOrder.map((stage, index) => { const current = stageOrder.indexOf(recommendation.crop_stage.id); return <div key={stage} className={index < current ? 'done' : index === current ? 'current' : ''}><span>{index < current ? '✓' : index + 1}</span><small>{stage === 'productive' ? 'Peak growth' : stage}</small></div> })}</div>
        <p className="stage-summary"><strong>{recommendation.crop_stage.display_name}</strong> · Stage day {recommendation.crop_stage.stage_day}</p>
      </Card>

      {recommendation.decision.rain_adjustment_litres > 0 && <Alert tone="good" title="Rain is doing part of the work">AXIS reduced today’s application by {formatLitres(recommendation.decision.rain_adjustment_litres)} compared with the same calculation without forecast rain.</Alert>}
      {change && <Alert title="Changed since last advice">{change}. Open “Why?” to compare the calculation inputs.</Alert>}
      {recommendation.sensor_context?.soil_moisture_connected && <Alert title="Soil reading available as context">{recommendation.sensor_context.reason ?? 'This preview reading does not change the deterministic recommendation.'}</Alert>}
      {recommendation.warnings.map(warning => <Alert key={warning} tone="warn" title="Check this input">{warning}</Alert>)}

      {latestEvent && <Card className="recent-event"><div><p className="eyebrow">Latest irrigation</p><h2>{formatLitres(latestEvent.litres)} recorded</h2><span>{friendlyDate(latestEvent.date)} · {latestEvent.source.replaceAll('_', ' ').toLowerCase()}</span></div><span className="event-check">✓</span></Card>}

      {health?.ai_insights_enabled && <Card className="ai-card"><Badge tone="info">Bonus · AI insights</Badge><h2>Explain the pattern, not the litres</h2>{insight ? <><p>{insight.summary}</p><small>{insight.label}. The deterministic AXIS recommendation remains authoritative.</small></> : <><p>Ask AI to simplify today’s calculation and summarize up to seven days of your selected local history.</p><button className="button secondary" disabled={loading || !online} onClick={() => void generateInsight()}>Generate an insight</button></>}</Card>}
    </> : <EmptyState title={loading ? 'Calculating today’s plan' : 'No saved recommendation yet'} text={online ? 'AXIS needs today’s weather to calculate the estimated irrigation requirement.' : 'Reconnect once to calculate and save advice for this plot.'} action={online ? <button className="button primary" disabled={loading} onClick={() => void refresh()}>{loading ? 'Calculating…' : 'Get today’s advice'}</button> : undefined} />}
    {loading && recommendation && <Spinner label="Refreshing weather and advice…" />}
    {showWhy && recommendation && <ExplanationModal recommendation={recommendation} onClose={() => setShowWhy(false)} />}
    {showLog && recommendation && <IrrigationModal recommendation={recommendation} plotId={selectedPlot.id} onClose={() => setShowLog(false)} onSaved={event => { setLatestEvent(event); setShowLog(false) }} />}
  </Page>
}

function ExplanationModal({ recommendation, onClose }: { recommendation: StoredRecommendation; onClose(): void }) {
  return <Modal title="Why this amount?" onClose={onClose}><p className="modal-intro">{recommendation.explanation.summary}</p><div className="equation-list">{recommendation.explanation.steps.map((step, index) => <div key={step.key}><span>{index + 1}</span><div><strong>{step.label}</strong>{step.note && <small>{step.note}</small>}</div><b>{step.value.toLocaleString()} {step.unit}</b></div>)}</div>{recommendation.comparison && <div className="comparison-box"><p className="eyebrow">Why different?</p><strong>{recommendation.comparison.summary}</strong><ul>{recommendation.comparison.factors.filter(factor => factor.key !== 'litres').map(factor => <li key={factor.key}><span>{factor.label}</span><b>{factor.note ?? `${factor.change !== undefined && factor.change > 0 ? '+' : ''}${factor.change ?? ''} ${factor.unit ?? ''}`}</b></li>)}</ul></div>}<div className="confidence-box"><Badge tone={recommendation.confidence.level === 'LOW' ? 'warn' : recommendation.confidence.level === 'HIGH' ? 'good' : 'info'}>{recommendation.confidence.level} confidence</Badge><ul>{recommendation.confidence.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div><p className="disclaimer">AXIS estimates daily replacement demand. It does not measure the field’s complete soil-water deficit unless a validated sensor adjustment is available.</p></Modal>
}

function IrrigationModal({ recommendation, plotId, onClose, onSaved }: { recommendation: StoredRecommendation; plotId: string; onClose(): void; onSaved(event: IrrigationEvent): void }) {
  const [source, setSource] = useState<IrrigationEvent['source']>('FOLLOWED_RECOMMENDATION')
  const [litres, setLitres] = useState(String(recommendation.decision.litres))
  const [meterId, setMeterId] = useState('')
  const [meterStart, setMeterStart] = useState('')
  const [meterEnd, setMeterEnd] = useState('')
  const [error, setError] = useState('')

  async function save() {
    try {
      const measured = source === 'FLOW_METER' ? measuredLitres({ meterId, observedAt: new Date().toISOString(), startLitres: Number(meterStart), endLitres: Number(meterEnd) }) : Number(litres)
      if (!Number.isFinite(measured) || measured < 0) throw new Error('Enter a valid applied volume.')
      const event: IrrigationEvent = { id: crypto.randomUUID(), plotId, date: nairobiDate(), litres: measured, recommendedLitres: recommendation.decision.litres_exact, source, createdAt: new Date().toISOString(), meterId: source === 'FLOW_METER' ? meterId : undefined, meterStartLitres: source === 'FLOW_METER' ? Number(meterStart) : undefined, meterEndLitres: source === 'FLOW_METER' ? Number(meterEnd) : undefined }
      await repos.saveEvent(event); onSaved(event)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save irrigation.') }
  }
  return <Modal title="Record irrigation" onClose={onClose}><p className="modal-intro">Confirm what was actually applied. This record stays on this device and works offline.</p><label>Measurement source<select value={source} onChange={event => setSource(event.target.value as IrrigationEvent['source'])}><option value="FOLLOWED_RECOMMENDATION">Followed AXIS recommendation</option><option value="MANUAL">Manual estimate</option><option value="FLOW_METER">Flow meter reading</option></select></label>{source === 'FLOW_METER' ? <div className="form-grid"><label className="wide">Meter identifier<input value={meterId} onChange={event => setMeterId(event.target.value)} placeholder="e.g. Pump meter 1" /></label><label>Start reading (L)<input inputMode="decimal" value={meterStart} onChange={event => setMeterStart(event.target.value)} /></label><label>End reading (L)<input inputMode="decimal" value={meterEnd} onChange={event => setMeterEnd(event.target.value)} /></label></div> : <label>Applied water (litres)<input inputMode="decimal" value={litres} onChange={event => setLitres(event.target.value)} /></label>}{error && <p className="field-error">{error}</p>}<button className="button primary full" onClick={() => void save()}>Save irrigation record</button></Modal>
}

function dateSevenDaysAgo() { const date = new Date(); date.setDate(date.getDate() - 6); return nairobiDate(date) }
