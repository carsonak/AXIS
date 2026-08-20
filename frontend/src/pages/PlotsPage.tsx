import { Link, useNavigate } from 'react-router-dom'
import { AppHeader, Badge, Card, EmptyState, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import { cropAgeDays, deriveStage } from '../utils'

export default function PlotsPage() {
  const { plots, catalog, selectedPlot, selectPlot, reload } = useAxis()
  const navigate = useNavigate()
  async function remove(id: string) {
    if (!window.confirm('Delete this plot and its local recommendation/history data?')) return
    await repos.removePlot(id); await reload()
  }
  return <Page><AppHeader eyebrow="Your farm" title="Plots" action={<Link className="button compact primary" to="/plots/new">+ Add plot</Link>} />
    {plots.length === 0 ? <EmptyState title="No plots yet" text="Add a field to start receiving crop- and weather-specific irrigation guidance." action={<Link className="button primary" to="/plots/new">Add a plot</Link>} /> : <div className="plot-list">{plots.map(plot => {
      const crop = catalog?.crops.find(item => item.id === plot.cropId)
      const stage = crop ? deriveStage(crop, cropAgeDays(plot.plantingDate)) : undefined
      const stageLabel = catalog?.stages.find(item => item.id === stage?.id)?.display_name
      return <Card key={plot.id} className={selectedPlot?.id === plot.id ? 'plot-card selected' : 'plot-card'}><button className="plot-select" onClick={() => void selectPlot(plot.id)}><div className="crop-glyph">{plot.cropId === 'tomato' ? '●' : plot.cropId === 'maize' ? '♒' : '♣'}</div><div><h2>{plot.name}</h2><p>{crop?.display_name ?? plot.cropId} · {(plot.areaM2 / 4046.8564224).toFixed(2)} acres</p><span>{stageLabel ?? 'Stage unavailable'}{stage ? ` · day ${cropAgeDays(plot.plantingDate)}` : ''}</span></div>{selectedPlot?.id === plot.id && <Badge tone="good">Active</Badge>}</button><div className="plot-card-actions"><button className="text-button" onClick={() => navigate(`/plots/${plot.id}`)}>Edit</button><button className="text-button danger" onClick={() => void remove(plot.id)}>Delete</button></div></Card>
    })}</div>}
  </Page>
}
