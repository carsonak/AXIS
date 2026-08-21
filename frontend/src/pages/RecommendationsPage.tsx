import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, AppHeader, Badge, Card, EmptyState, Modal, Page, Spinner, SketchWaterDrop, SketchRain } from '../components'

import { useAxis } from '../context'
import { repos } from '../db'
import { useRecommendationRefresh } from '../recommendation-refresh'
import { measuredLitres } from '../sensors'
import type { IrrigationEvent, StoredRecommendation } from '../types'
import { formatLitres, formatWindow, freshness, nairobiDate } from '../utils'

export default function RecommendationsPage() {
  const { selectedPlot, catalog, online } = useAxis()
  const { recommendation, localReady: loaded, now } = useRecommendationRefresh()
  const navigate = useNavigate()
  const [showLogModal, setShowLogModal] = useState(false)

  if (!selectedPlot) {
    return (
      <Page>
        <AppHeader showBack eyebrow="Recommendations" title="Advice" />
        <EmptyState title="No plot selected" text="Add a plot to view recommendations." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} />
      </Page>
    )
  }

  if (!loaded) return <Page><AppHeader showBack eyebrow="Recommendations" title="Irrigation Guide" /><Spinner label="Opening saved advice…" /></Page>

  if (!recommendation) {
    return (
      <Page>
        <AppHeader showBack eyebrow="Recommendations" title="Irrigation Guide" />
        {!online && <Alert tone="warn" title="You’re offline">Reconnect once to obtain weather and generate the first recommendation.</Alert>}
        <EmptyState
          title="No recommendation yet"
          text={online ? "Generate today's advice from the dashboard using this plot and current weather." : 'No saved advice is available for this plot while offline.'}
          action={online ? <Link className="button primary" to="/app">Get today’s advice</Link> : undefined}
        />
      </Page>
    )
  }

  const method = catalog?.irrigation_methods.find(item => item.id === selectedPlot.irrigationMethodId)
  const acres = (selectedPlot.areaM2 / 4046.8564224).toFixed(1)
  const status = freshness(recommendation, now)

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow="Recommendations"
        title="Irrigation Guide"
        action={
          <button className="icon-button" aria-label="Share recommendation" onClick={() => alert('Sharing recommendation details...')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        }
      />

      {!online && <Alert tone="warn" title="Saved offline advice">This recommendation remains available. Reconnect to refresh today’s weather.</Alert>}
      <Badge tone={status.tone}>{status.label}</Badge>

      {/* Recommendation Card */}
      <Card className="recommendation-hero-card">
        <div className="rec-icon-circle">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
        </div>
        <h2 className="rec-action">
          {recommendation.decision.action === 'SKIP' ? 'Skip Irrigation Today' : recommendation.decision.action === 'REDUCED' ? 'Rain-Adjusted Irrigation' : 'Irrigate Today'}
        </h2>
        <div className="rec-volume">{formatLitres(recommendation.decision.litres)}</div>
        <p className="rec-window">Best time: {formatWindow(recommendation.decision.recommended_window)}</p>
      </Card>


      {/* Why this recommendation? */}
      <Card className="why-rec-card">
        <div className="why-card-top">
          <div className="why-card-header">
            <div className="why-header-icon">
              <SketchWaterDrop size={22} color="#1b5e20" />
            </div>
            <div>
              <p className="eyebrow">Agronomic Reason</p>
              <h2>Why this water volume?</h2>
            </div>
          </div>
          <Badge tone={recommendation.confidence.level === 'LOW' ? 'warn' : recommendation.confidence.level === 'HIGH' ? 'good' : 'info'}>
            {recommendation.confidence.level} Confidence
          </Badge>
        </div>

        <div className="why-summary-box">
          <p className="why-summary-text">
            {recommendation.explanation.summary}
          </p>
        </div>

        {recommendation && recommendation.decision.rain_adjustment_litres > 0 && (
          <div className="rain-avoided-callout">
            <span className="rain-avoided-icon"><SketchRain size={20} color="#1b5e20" /></span>
            <div>
              <strong>Water avoided because rain was considered:</strong>
              <span>Saved {formatLitres(recommendation.decision.rain_adjustment_litres)} due to forecast rainfall credit.</span>
            </div>
          </div>
        )}
      </Card>



      {/* Irrigation Guide */}
      <Card className="guide-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Parameters</p>
            <h2>Irrigation Guide</h2>
          </div>
        </div>
        <div className="guide-grid">
          <div className="guide-row">
            <span>Method</span>
            <strong>{method?.display_name ?? 'Unavailable'}</strong>
          </div>
          <div className="guide-row">
            <span>Duration</span>
            <strong>{recommendation.decision.duration_minutes !== undefined ? `${recommendation.decision.duration_minutes} minutes` : 'Not available'}</strong>
          </div>
          <div className="guide-row">
            <span>Flow Rate</span>
            <strong>{selectedPlot.flowRateLpm !== undefined ? `${selectedPlot.flowRateLpm} L/min` : 'Not configured'}</strong>
          </div>
          <div className="guide-row">
            <span>Area</span>
            <strong>{acres} Acres</strong>
          </div>
        </div>

        <button className="button primary full log-btn" onClick={() => setShowLogModal(true)}>
          Log Irrigation
        </button>
      </Card>

      {showLogModal && recommendation && (
        <IrrigationModal
          recommendation={recommendation}
          plotId={selectedPlot.id}
          onClose={() => setShowLogModal(false)}
          onSaved={() => {
            setShowLogModal(false)
            navigate('/app/history')
          }}
        />
      )}
    </Page>
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
            <label htmlFor="recMeterId">Meter Identifier</label>
            <input id="recMeterId" value={meterId} onChange={event => setMeterId(event.target.value)} placeholder="e.g. Drip Line Flow Meter 1" />
          </div>
          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="recMeterStart">Start Reading (Litres)</label>
              <input id="recMeterStart" inputMode="decimal" value={meterStart} onChange={event => setMeterStart(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="recMeterEnd">End Reading (Litres)</label>
              <input id="recMeterEnd" inputMode="decimal" value={meterEnd} onChange={event => setMeterEnd(event.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="manual-volume-box">
          <div className="form-group">
            <label htmlFor="recAppliedWater">Applied Water (Litres)</label>
            <input id="recAppliedWater" inputMode="decimal" value={litres} onChange={event => setLitres(event.target.value)} />
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
