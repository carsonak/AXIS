import { useParams, useNavigate } from 'react-router-dom'
import { AppHeader, Card, Page } from '../components'
import { useAxis } from '../context'
import { cropAgeDays, deriveStage } from '../utils'
import type { StageId } from '../types'

const stageIds: StageId[] = ['establishing', 'developing', 'productive', 'maturing']

export default function CropDetailsPage() {
  const { plotId } = useParams<{ plotId: string }>()
  const navigate = useNavigate()
  const { plots, catalog } = useAxis()
  const plot = plots.find(item => item.id === plotId)

  if (!plot) return <Page><AppHeader showBack title="Crop Details" /><Card><p>Plot not found.</p></Card></Page>

  const crop = catalog?.crops.find(item => item.id === plot.cropId)
  const ageDays = cropAgeDays(plot.plantingDate)
  const stage = crop ? deriveStage(crop, ageDays) : undefined
  const stageLabel = catalog?.stages.find(item => item.id === stage?.id)?.display_name ?? 'Stage unavailable'
  const progressPct = crop ? Math.min(100, Math.round((ageDays / crop.total_days) * 100)) : 0
  const currentStageIndex = stage ? stageIds.indexOf(stage.id) : -1
  const configuredCycleEnd = crop ? new Date(new Date(`${plot.plantingDate}T12:00:00Z`).getTime() + crop.total_days * 86_400_000) : undefined

  return (
    <Page>
      <AppHeader showBack eyebrow="Crop Details & Growth" title={plot.name} action={<button className="icon-button" onClick={() => navigate(`/app/plots/${plot.id}`)} aria-label="Edit plot">⋮</button>} />

      <Card className="crop-progress-card">
        <div className="section-head"><div><p className="eyebrow">Growth Progress</p><h2>{stageLabel}</h2></div></div>
        <div className="progress-circle-wrapper">
          <div className="circle-progress" style={{ background: `conic-gradient(#2e7d32 ${progressPct * 3.6}deg, #e5e7eb 0deg)` }}><div className="circle-inner"><span className="pct-val">{progressPct}%</span></div></div>
          <div className="progress-meta">
            <p>Planted: <strong>{new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date(`${plot.plantingDate}T12:00:00Z`))}</strong></p>
            <p>Days since planting: <strong>{ageDays}</strong></p>
            {stage && <p>Current stage day: <strong>{stage.day}</strong></p>}
          </div>
        </div>
      </Card>

      <Card className="growth-timeline-card">
        <div className="section-head"><div><p className="eyebrow">Configured crop model</p><h2>Lifecycle Stages</h2></div></div>
        <div className="timeline-stepper">
          {stageIds.map((id, index) => {
            const label = catalog?.stages.find(item => item.id === id)?.display_name ?? id
            return <div key={id} className={`step-item ${index < currentStageIndex ? 'completed' : ''} ${index === currentStageIndex ? 'current' : ''}`}><div className="step-dot">{index < currentStageIndex ? '✓' : ''}</div><span className="step-label">{label}</span></div>
          })}
        </div>
      </Card>

      <Card className="key-info-card">
        <div className="section-head"><div><p className="eyebrow">Stored plot data</p><h2>Plot Details</h2></div></div>
        <div className="key-info-grid">
          <div className="key-info-item"><span>Crop</span><strong>{crop?.display_name ?? plot.cropId}</strong></div>
          <div className="key-info-item"><span>Area</span><strong>{(plot.areaM2 / 4046.8564224).toFixed(2)} Acres</strong></div>
          <div className="key-info-item"><span>Coordinates</span><strong>{plot.lat.toFixed(4)}, {plot.lon.toFixed(4)}</strong></div>
          <div className="key-info-item"><span>Configured cycle end</span><strong>{configuredCycleEnd ? new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(configuredCycleEnd) : 'Unavailable'}</strong></div>
        </div>
      </Card>

      {crop && ageDays >= crop.total_days && <p className="disclaimer standalone">This crop is beyond its configured duration. AXIS keeps it in the maturing stage and flags this in generated advice.</p>}
    </Page>
  )
}
