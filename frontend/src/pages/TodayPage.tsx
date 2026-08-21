import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createInsight, type InsightHistoryItem } from '../api'
import { Alert, Badge, Card, EmptyState, Modal, Page, Spinner, SketchCrop, SketchWaterDrop, SketchRain } from '../components'

import { useAxis } from '../context'
import { repos } from '../db'
import { useRecommendationRefresh } from '../recommendation-refresh'
import { measuredLitres } from '../sensors'
import type { IrrigationEvent, StoredInsight, StoredRecommendation } from '../types'
import { cropAgeDays, deriveStage, formatLitres, formatWindow, freshness, friendlyDate, nairobiDate, recommendationChange, relativeDataAge } from '../utils'

export default function TodayPage() {
  const { selectedPlot, plots, catalog, online, health, settings } = useAxis()
  const { recommendation, localReady, refreshing, error: refreshError, now, refresh } = useRecommendationRefresh()
  const navigate = useNavigate()
  const [latestEvent, setLatestEvent] = useState<IrrigationEvent>()
  const [weeklyWaterLitres, setWeeklyWaterLitres] = useState(0)
  const [averageSoilMoisture, setAverageSoilMoisture] = useState<number>()
  const [insight, setInsight] = useState<StoredInsight>()
  const [insightLoading, setInsightLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [showWhy, setShowWhy] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const loadLocal = useCallback(async () => {
    setLatestEvent(undefined)
    setShowLog(false)
    if (!selectedPlot) return
    const [event, savedInsight, plotEvents, sensorReadings] = await Promise.all([
      repos.latestEvent(selectedPlot.id),
      repos.getInsight(selectedPlot.id, nairobiDate()),
      Promise.all(plots.map(plot => repos.eventsForPlot(plot.id, dateSevenDaysAgo()))),
      Promise.all(plots.map(plot => repos.latestSensorReading(plot.id)))
    ])
    const readings = sensorReadings.filter(reading => reading !== undefined)
    setLatestEvent(event?.date === nairobiDate() ? event : undefined)
    setInsight(savedInsight)
    setWeeklyWaterLitres(plotEvents.flat().reduce((sum, item) => sum + item.litres, 0))
    setAverageSoilMoisture(readings.length > 0 ? readings.reduce((sum, item) => sum + item.volumetricWaterContentPct, 0) / readings.length : undefined)
  }, [selectedPlot?.id, plots])

  useEffect(() => { void loadLocal() }, [loadLocal])

  if (!selectedPlot) return (
    <Page>
      <div className="top-brand-header">
        <button className="icon-menu-btn" aria-label="Menu">☰</button>
        <div className="brand-text-center">
          <strong className="bold-brand">AXIS</strong>
          <span className="brand-subtitle">Agricultural Excellence in Irrigation Schemes</span>
        </div>
        <Link to="/app/alerts" className="icon-button header-bell" aria-label="Alerts">
          🔔
        </Link>
      </div>
      <EmptyState
        title="Set up your farm"
        text="Add your crop, area, irrigation method, and location to receive precision recommendations."
        action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>}
      />
    </Page>
  )

  const activePlot = selectedPlot
  const status = freshness(recommendation, now)
  const change = recommendation ? recommendationChange(recommendation) : undefined

  async function generateInsight() {
    if (!recommendation || !health?.ai_insights_enabled) return
    setInsightLoading(true); setPageError('')
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
    } catch (err) { setPageError(err instanceof Error ? err.message : 'AI explanation is unavailable.') }
    finally { setInsightLoading(false) }
  }

  // Calculate Farm Overview stats
  const totalCropsCount = plots.length
  const totalAcres = plots.reduce((sum, p) => sum + (p.areaM2 / 4046.8564224), 0).toFixed(1)

  return (
    <Page>
      {/* Screen 1 Header: Hamburger Menu, AXIS brand, Bell with badge */}
      <div className="top-dashboard-header">
        <button className="icon-menu-btn" onClick={() => navigate('/app/more')} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Link to="/" className="dash-brand-title" style={{ textDecoration: 'none' }}>
          <strong className="bold-brand">AXIS</strong>
          <span className="dash-brand-sub">Agricultural Excellence in Irrigation Schemes</span>
        </Link>

        <Link to="/app/alerts" className="dash-bell-btn" aria-label="View alerts">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </Link>
      </div>

      {/* Greeting & Location bar */}
      <div className="greeting-row">
        <div>
          <h2 className="greeting-text">Hello, Farmer 👋</h2>
          <p className="location-text">{activePlot.lat.toFixed(4)}, {activePlot.lon.toFixed(4)}</p>
        </div>
        <Link to="/app/weather" className="weather-pill-btn">
          <span>☀️</span>
          <strong>{recommendation ? `${Math.round(recommendation.weather.t_max_c)}°C` : 'Weather unavailable'}</strong>
        </Link>
      </div>

      {!online && <Alert tone="warn" title="You’re offline">Saved advice and irrigation logging still work. Reconnect for new weather.</Alert>}
      {refreshError && <Alert tone="warn" title="Couldn’t refresh">{refreshError}</Alert>}
      {pageError && <Alert tone="warn" title="Couldn’t generate insight">{pageError}</Alert>}

      {recommendation && (
        <div className="refresh-status-row">
          <span title={`Saved ${recommendation.savedAt}`}>Refreshed {relativeDataAge(recommendation.savedAt, now)}</span>
          <button className="button secondary compact" disabled={!online || refreshing} onClick={() => void refresh()}>
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      )}

      {/* Today's Recommendation Card */}
      <Card className="dashboard-rec-card">
        <div className="rec-card-head">
          <p className="eyebrow">Today's Recommendation</p>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        {recommendation ? <Link to="/app/recommendations" className="rec-card-body">
          <div className="rec-left-icon">
            <div className="drop-circle">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
          </div>
          <div className="rec-content">
            <h3 className="rec-action-title">
              {recommendation.decision.action === 'SKIP' ? 'Skip Today' : recommendation.decision.action === 'REDUCED' ? 'Rain-Adjusted' : 'Irrigate Today'}
            </h3>
            <div className="rec-litres-big">{formatLitres(recommendation.decision.litres)}</div>
            <p className="rec-time-sub">Best time: {formatWindow(recommendation.decision.recommended_window)}</p>
          </div>
          <div className="rec-chevron">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link> : (
          <div className="rec-card-body">
            <div className="rec-content">
              <h3 className="rec-action-title">Weather is needed first</h3>
              <p className="rec-time-sub">
                {online ? 'Get today’s weather to calculate a deterministic recommendation.' : 'Reconnect once to obtain weather and generate your first recommendation.'}
              </p>
            </div>
          </div>
        )}

        <div className="rec-card-footer">
          {recommendation ? (
            <>
              <button className="button primary compact" onClick={() => setShowLog(true)}>Log Irrigation</button>
              <button className="button secondary compact" onClick={() => setShowWhy(true)}>Why this amount?</button>
            </>
          ) : (
            <button className="button primary compact" disabled={!online || refreshing || !localReady} onClick={() => void refresh()}>
              {refreshing ? 'Calculating…' : "Get today's advice"}
            </button>
          )}
        </div>
      </Card>

      {/* Farm Overview Section */}
      <div className="farm-overview-section">
        <div className="section-head">
          <h2>Farm Overview</h2>
        </div>
        <div className="overview-stats-grid">
          <Link to="/app/plots" className="overview-stat-card">
            <strong className="stat-num">{totalCropsCount}</strong>
            <span className="stat-label">Crops</span>
          </Link>
          <Link to="/app/more" className="overview-stat-card">
            <strong className="stat-num">{totalAcres} ac</strong>
            <span className="stat-label">Farm Size</span>
          </Link>
          <Link to="/app/soil" className="overview-stat-card">
            <strong className="stat-num">{averageSoilMoisture === undefined ? 'No readings yet' : `${Math.round(averageSoilMoisture)}%`}</strong>
            <span className="stat-label">Avg. Soil Moisture</span>
          </Link>
          <Link to="/app/water" className="overview-stat-card wide-stat">
            <strong className="stat-num">{weeklyWaterLitres > 0 ? formatLitres(weeklyWaterLitres) : 'No irrigation logged'}</strong>
            <span className="stat-label">Water Used (Last 7 Days)</span>
          </Link>
        </div>
      </div>

      {/* My Crops Section */}
      <div className="my-crops-section">
        <div className="section-head">
          <h2>My Crops</h2>
          <Link to="/app/plots" className="view-all-link">View all &gt;</Link>
        </div>

        <div className="my-crops-list">
          {plots.length > 0 ? (
            plots.map(p => {
              const c = catalog?.crops.find(item => item.id === p.cropId)
              const age = cropAgeDays(p.plantingDate)
              const stg = c ? deriveStage(c, age) : undefined
              const stgName = catalog?.stages.find(item => item.id === stg?.id)?.display_name ?? 'Stage unavailable'
              const pct = c ? Math.min(100, Math.round((age / c.total_days) * 100)) : 0

              return (
                <div key={p.id} className="crop-summary-row" onClick={() => navigate(`/app/plots/${p.id}/details`)}>
                  <div className="crop-row-icon">
                    <SketchCrop size={22} color="#1b5e20" />
                  </div>
                  <div className="crop-row-info">
                    <strong>{p.name}</strong>
                    <span className="crop-stage-text">{stgName}</span>
                    <div className="crop-row-bar-track">
                      <span className="crop-row-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="crop-row-pct">{pct}%</div>
                </div>
              )
            })
          ) : <p>No crops added yet.</p>}
        </div>
      </div>

      {recommendation && recommendation.decision.rain_adjustment_litres > 0 && (
        <Alert tone="good" title="Rain is doing part of the work">
          AXIS reduced today’s application by {formatLitres(recommendation.decision.rain_adjustment_litres)} compared with the same calculation without forecast rain.
        </Alert>
      )}

      {change && <Alert title="Changed since last advice">{change}. Open “Why?” to compare the calculation inputs.</Alert>}

      {/* Dedicated Log Irrigation Card */}
      {recommendation && <Card className="log-irrigation-card">
        <div className="log-card-head">
          <div>
            <p className="eyebrow">Water Record</p>
            <h2>Log Today's Irrigation</h2>
          </div>
          <Badge tone={latestEvent ? 'good' : 'warn'}>
            {latestEvent ? '✓ Recorded Today' : 'Pending Log'}
          </Badge>
        </div>

        {latestEvent ? (
          <div className="logged-event-body">
            <div className="logged-stat-row">
              <div className="logged-icon-circle">✓</div>
              <div className="logged-details">
                <strong>{formatLitres(latestEvent.litres)} Applied</strong>
                <span>{friendlyDate(latestEvent.date)} · Source: {latestEvent.source.replaceAll('_', ' ').toLowerCase()}</span>
              </div>
            </div>
            <div className="log-card-actions mt-3">
              <button className="button secondary compact" onClick={() => setShowLog(true)}>
                ✏️ Edit or Log Again
              </button>
              <Link to="/app/history" className="button ghost compact">
                📜 View History &gt;
              </Link>
            </div>
          </div>
        ) : (
          <div className="unlogged-event-body">
            <p className="log-prompt-text">
              Prescribed for today: <strong>{formatLitres(recommendation.decision.litres)}</strong>{recommendation.decision.duration_minutes !== undefined ? ` (${recommendation.decision.duration_minutes} min)` : ''}. Record actual applied volume to update your weekly water history.
            </p>
            <div className="log-card-actions">
              <button className="button primary full" onClick={() => setShowLog(true)}>
                💧 Log Applied Water
              </button>
            </div>
          </div>
        )}
      </Card>}


      {health?.ai_insights_enabled && (
        <Card className="ai-card">
          <Badge tone="info">Bonus · AI insights</Badge>
          <h2>Explain the pattern, not the litres</h2>
          {insight ? (
            <>
              <p>{insight.summary}</p>
              <small>{insight.label}. The deterministic AXIS recommendation remains authoritative.</small>
            </>
          ) : (
            <>
              <p>Ask AI to simplify today’s calculation and summarize up to seven days of your selected local history.</p>
              <button className="button secondary" disabled={insightLoading || !online} onClick={() => void generateInsight()}>
                Generate an insight
              </button>
            </>
          )}
        </Card>
      )}

      {(refreshing || insightLoading) && <Spinner label={refreshing ? 'Refreshing weather and advice…' : 'Generating insight…'} />}
      {showWhy && recommendation && <ExplanationModal recommendation={recommendation} onClose={() => setShowWhy(false)} />}
      {showLog && recommendation && <IrrigationModal recommendation={recommendation} plotId={activePlot.id} onClose={() => setShowLog(false)} onSaved={event => { setLatestEvent(event); setWeeklyWaterLitres(value => value + event.litres); setShowLog(false) }} />}
    </Page>
  )
}

function ExplanationModal({ recommendation, onClose }: { recommendation: StoredRecommendation; onClose(): void }) {
  const rainAvoided = recommendation.decision.rain_adjustment_litres ?? 0

  return (
    <Modal title="Why this amount?" onClose={onClose}>
      <div className="explanation-modal-body">
        <div className="why-summary-card">
          <div className="why-card-header">
            <div className="why-header-icon">
              <SketchWaterDrop size={22} color="#1b5e20" />
            </div>
            <div>
              <strong>Agronomic Reason</strong>
              <p className="modal-intro-text">{recommendation.explanation.summary}</p>
            </div>
          </div>
        </div>

        {rainAvoided > 0 && (
          <div className="rain-avoided-callout">
            <span className="rain-avoided-icon"><SketchRain size={22} color="#1b5e20" /></span>
            <div>
              <strong>Water avoided because rain was considered:</strong>
              <span>Saved {formatLitres(rainAvoided)} due to forecast rainfall credit.</span>
            </div>
          </div>
        )}

        <div className="confidence-box">
          <div className="confidence-head">
            <Badge tone={recommendation.confidence.level === 'LOW' ? 'warn' : recommendation.confidence.level === 'HIGH' ? 'good' : 'info'}>
              {recommendation.confidence.level} Confidence
            </Badge>
            <span className="confidence-sub">Weather & Agronomic Source Quality</span>
          </div>
          <ul className="confidence-reasons-list">
            {recommendation.confidence.reasons.map(reason => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>

        <p className="disclaimer">
          AXIS estimates daily crop-water replacement. It does not measure the field’s complete soil-water deficit unless a calibrated sensor adjustment has been locally validated.
        </p>
      </div>
    </Modal>
  )
}



function IrrigationModal({ recommendation, plotId, onClose, onSaved }: { recommendation: StoredRecommendation; plotId: string; onClose(): void; onSaved(event: IrrigationEvent): void }) {
  const [source, setSource] = useState<IrrigationEvent['source']>('FOLLOWED_RECOMMENDATION')
  const [litres, setLitres] = useState(String(recommendation.decision.litres))
  const [meterId, setMeterId] = useState('')
  const [meterStart, setMeterStart] = useState('')
  const [meterEnd, setMeterEnd] = useState('')
  const [error, setError] = useState('')

  const calculatedFlowMeterLitres = source === 'FLOW_METER' && Number.isFinite(Number(meterEnd) - Number(meterStart)) ? Math.max(0, Number(meterEnd) - Number(meterStart)) : 0
  const activeAppliedVolume = source === 'FLOW_METER' ? calculatedFlowMeterLitres : (Number(litres) || 0)
  const targetVolume = recommendation.decision.litres
  const diffVolume = activeAppliedVolume - targetVolume

  async function save() {
    try {
      if (source === 'FLOW_METER' && (!meterId.trim() || !meterStart.trim() || !meterEnd.trim())) throw new Error('Enter the meter identifier and both cumulative readings.')
      if (source === 'MANUAL' && !litres.trim()) throw new Error('Enter the actual applied water volume.')
      const measured = source === 'FLOW_METER' ? measuredLitres({ meterId, observedAt: new Date().toISOString(), startLitres: Number(meterStart), endLitres: Number(meterEnd) }) : Number(litres)
      if (!Number.isFinite(measured) || measured < 0) throw new Error('Enter a valid applied water volume in litres.')
      const event: IrrigationEvent = {
        id: crypto.randomUUID(),
        plotId,
        date: nairobiDate(),
        litres: measured,
        recommendedLitres: recommendation.decision.litres_exact,
        source,
        createdAt: new Date().toISOString(),
        meterId: source === 'FLOW_METER' ? meterId : undefined,
        meterStartLitres: source === 'FLOW_METER' ? Number(meterStart) : undefined,
        meterEndLitres: source === 'FLOW_METER' ? Number(meterEnd) : undefined
      }
      await repos.saveEvent(event)
      onSaved(event)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save irrigation record.')
    }
  }

  return (
    <Modal title="Log Irrigation Event 💧" onClose={onClose}>
      <p className="modal-intro">Confirm the exact volume applied today. This record is saved directly to your device’s local IndexedDB.</p>

      <div className="log-source-tabs">
        <button
          type="button"
          className={`source-tab-btn ${source === 'FOLLOWED_RECOMMENDATION' ? 'active' : ''}`}
          onClick={() => { setSource('FOLLOWED_RECOMMENDATION'); setLitres(String(recommendation.decision.litres)); }}
        >
          🎯 Followed Advice
        </button>
        <button
          type="button"
          className={`source-tab-btn ${source === 'FLOW_METER' ? 'active' : ''}`}
          onClick={() => setSource('FLOW_METER')}
        >
          📟 Flow Meter
        </button>
        <button
          type="button"
          className={`source-tab-btn ${source === 'MANUAL' ? 'active' : ''}`}
          onClick={() => { setSource('MANUAL'); setLitres('') }}
        >
          ✏️ Manual Volume
        </button>
      </div>

      {source === 'FLOW_METER' ? (
        <div className="flow-meter-form-box">
          <div className="form-group">
            <label htmlFor="meterId">Meter Identifier</label>
            <input id="meterId" value={meterId} onChange={event => setMeterId(event.target.value)} placeholder="e.g. Drip Line Flow Meter 1" />
          </div>
          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="meterStart">Start Reading (Litres)</label>
              <input id="meterStart" inputMode="decimal" value={meterStart} onChange={event => setMeterStart(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="meterEnd">End Reading (Litres)</label>
              <input id="meterEnd" inputMode="decimal" value={meterEnd} onChange={event => setMeterEnd(event.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="manual-volume-box">
          <div className="form-group">
            <label htmlFor="appliedWater">Applied Water (Litres)</label>
            <input id="appliedWater" inputMode="decimal" value={litres} onChange={event => setLitres(event.target.value)} />
          </div>
        </div>
      )}

      {/* Applied vs Prescribed Live Preview Box */}
      <div className="log-volume-preview-banner">
        <div className="preview-stat-col">
          <span className="preview-label">Applied Volume</span>
          <strong className="preview-val-applied">{formatLitres(activeAppliedVolume)}</strong>
        </div>
        <div className="preview-divider" />
        <div className="preview-stat-col">
          <span className="preview-label">Prescribed Target</span>
          <strong className="preview-val-target">{formatLitres(targetVolume)}</strong>
        </div>
        <div className="preview-divider" />
        <div className="preview-stat-col">
          <span className="preview-label">Variance</span>
          <strong className={`preview-val-diff ${diffVolume === 0 ? 'good' : diffVolume > 0 ? 'over' : 'under'}`}>
            {diffVolume === 0 ? 'Exact match' : `${diffVolume > 0 ? '+' : ''}${diffVolume} L`}
          </strong>
        </div>
      </div>

      <div className="offline-notice-badge">
        <span>🔒 100% Offline-First Record</span>
      </div>

      {error && <p className="field-error">{error}</p>}
      <button className="button primary full" onClick={() => void save()}>Save Irrigation Record</button>
    </Modal>
  )
}


function dateSevenDaysAgo() { const date = new Date(); date.setDate(date.getDate() - 6); return nairobiDate(date) }
