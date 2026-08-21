import { Link, useNavigate } from 'react-router-dom'
import { AppHeader, Card, EmptyState, Page, SketchCrop } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import { cropAgeDays, deriveStage } from '../utils'

export default function PlotsPage() {
  const { plots, catalog, selectedPlot, selectPlot, reload } = useAxis()
  const navigate = useNavigate()

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Delete this plot and its local recommendation/history data?')) return
    await repos.removePlot(id)
    await reload()
  }

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow="My Farm"
        title="My Crops"
        action={
          <Link className="button compact primary add-crop-btn" to="/app/plots/new">
            + Add Crop
          </Link>
        }
      />

      {plots.length === 0 ? (
        <EmptyState
          title="No crops yet"
          text="Add your first crop to start receiving precision irrigation guidance."
          action={<Link className="button primary" to="/app/plots/new">Add a Crop</Link>}
        />
      ) : (
        <div className="crop-card-list">
          {plots.map(plot => {
            const crop = catalog?.crops.find(item => item.id === plot.cropId)
            const ageDays = cropAgeDays(plot.plantingDate)
            const stage = crop ? deriveStage(crop, ageDays) : undefined
            const stageLabel = catalog?.stages.find(item => item.id === stage?.id)?.display_name ?? 'Stage unavailable'
            const pct = crop ? Math.min(100, Math.round((ageDays / crop.total_days) * 100)) : 0

            return (
              <Card
                key={plot.id}
                className="my-crop-card"
                onClick={() => {
                  void selectPlot(plot.id)
                  navigate(`/app/plots/${plot.id}/details`)
                }}
              >
                <div className="crop-card-left">
                  <div className="crop-big-icon">
                    <SketchCrop size={28} color="#1b5e20" />
                  </div>
                  <div className="crop-card-info">
                    <h2>{plot.name}</h2>
                    <p className="crop-sub-detail">Planted: <strong>{new Date(plot.plantingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></p>
                    <p className="crop-sub-detail">Crop: <strong>{crop?.display_name ?? plot.cropId}</strong></p>
                    <p className="crop-sub-detail">Stage: <strong>{stageLabel}</strong></p>
                  </div>
                </div>

                <div className="crop-card-right">
                  <div className="mini-circle-progress" style={{ background: `conic-gradient(#2e7d32 ${pct * 3.6}deg, #e5e7eb 0deg)` }}>
                    <div className="mini-circle-inner">{pct}%</div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Page>
  )
}
