import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppHeader, Badge, Card, Page, Spinner } from '../components'

import { useAxis } from '../context'
import { cropAgeDays, deriveStage } from '../utils'

type TabType = 'overview' | 'growth' | 'irrigation' | 'notes'

export default function CropDetailsPage() {
  const { plotId } = useParams<{ plotId: string }>()
  const navigate = useNavigate()
  const { plots, catalog } = useAxis()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const plot = plots.find(p => p.id === plotId) || plots[0]
  const crop = catalog?.crops.find(item => item.id === plot?.cropId)
  const ageDays = plot ? cropAgeDays(plot.plantingDate) : 45
  const stage = crop ? deriveStage(crop, ageDays) : undefined
  const stageLabel = catalog?.stages.find(item => item.id === stage?.id)?.display_name || 'Flowering Stage'
  const progressPct = crop ? Math.min(100, Math.round((ageDays / crop.total_days) * 100)) : 65

  if (!plot) {
    return (
      <Page>
        <AppHeader showBack title="Crop Details" />
        <Card><p>Plot not found.</p></Card>
      </Page>
    )
  }

  const stagesList = [
    { id: 'establishing', label: 'Seedling' },
    { id: 'developing', label: 'Vegetative' },
    { id: 'productive', label: 'Flowering' },
    { id: 'maturing', label: 'Fruiting' },
    { id: 'harvest', label: 'Harvest' },
  ]

  const currentStageIndex = stage?.id === 'establishing' ? 0 : stage?.id === 'developing' ? 1 : stage?.id === 'productive' ? 2 : 3

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow="Crop Details & Growth"
        title={plot.name}
        action={
          <button className="icon-button" onClick={() => navigate(`/app/plots/${plot.id}`)} aria-label="Edit plot">
            ⋮
          </button>
        }
      />

      <div className="tab-switcher">
        <button className={activeTab === 'overview' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={activeTab === 'growth' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('growth')}>Growth</button>
        <button className={activeTab === 'irrigation' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('irrigation')}>Irrigation</button>
        <button className={activeTab === 'notes' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('notes')}>Notes</button>
      </div>

      {/* Growth Progress Card */}
      <Card className="crop-progress-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Growth Progress</p>
            <h2>{stageLabel}</h2>
          </div>
          <Badge tone="good">Healthy</Badge>
        </div>

        <div className="progress-circle-wrapper">
          <div className="circle-progress" style={{ background: `conic-gradient(#2e7d32 ${progressPct * 3.6}deg, #e5e7eb 0deg)` }}>
            <div className="circle-inner">
              <span className="pct-val">{progressPct}%</span>
            </div>
          </div>
          <div className="progress-meta">
            <p>Planted: <strong>{new Date(plot.plantingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></p>
            <p>Days since planting: <strong>{ageDays}</strong></p>
          </div>
        </div>
      </Card>

      {/* Growth Timeline */}
      <Card className="growth-timeline-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Growth Timeline</p>
            <h2>Lifecycle Stages</h2>
          </div>
        </div>

        <div className="timeline-stepper">
          {stagesList.map((st, idx) => {
            const isCompleted = idx < currentStageIndex
            const isCurrent = idx === currentStageIndex
            return (
              <div key={st.id} className={`step-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                <div className="step-dot">
                  {isCompleted ? '✓' : isCurrent ? '' : ''}
                </div>
                <span className="step-label">{st.label}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Key Info Grid */}
      <Card className="key-info-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Key Info</p>
            <h2>Plot Details</h2>
          </div>
        </div>
        <div className="key-info-grid">
          <div className="key-info-item">
            <span>Variety</span>
            <strong>{plot.cropId === 'tomato' ? 'Rio Grande' : plot.cropId === 'maize' ? 'H614' : 'Sukuma'}</strong>
          </div>
          <div className="key-info-item">
            <span>Area</span>
            <strong>{(plot.areaM2 / 4046.8564224).toFixed(1)} Acres</strong>
          </div>
          <div className="key-info-item">
            <span>Spacing</span>
            <strong>75cm x 30cm</strong>
          </div>
          <div className="key-info-item">
            <span>Expected Harvest</span>
            <strong>{new Date(new Date(plot.plantingDate).getTime() + (crop?.total_days || 90) * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
          </div>
        </div>
      </Card>

      {/* Health Indicators */}
      <Card className="health-indicators-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Health Indicators</p>
            <h2>Risk Assessment</h2>
          </div>
        </div>
        <div className="health-grid">
          <div className="health-item">
            <span className="health-icon">🐛</span>
            <div>
              <small>Pest Pressure</small>
              <strong>Low</strong>
            </div>
          </div>
          <div className="health-item">
            <span className="health-icon">🦠</span>
            <div>
              <small>Disease Risk</small>
              <strong>Low</strong>
            </div>
          </div>
        </div>
      </Card>
    </Page>
  )
}
