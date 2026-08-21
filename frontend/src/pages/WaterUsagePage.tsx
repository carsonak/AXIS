import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Badge, Card, EmptyState, Page } from '../components'
import { useAxis } from '../context'
import { repos } from '../db'
import type { IrrigationEvent, StoredRecommendation } from '../types'
import { dateDaysAgo, formatLitres, friendlyDate } from '../utils'

type PeriodType = 'this_week' | 'last_week' | 'this_month'

export default function WaterUsagePage() {
  const { selectedPlot, catalog, plots } = useAxis()
  const [period, setPeriod] = useState<PeriodType>('this_week')
  const [recommendations, setRecommendations] = useState<StoredRecommendation[]>([])
  const [events, setEvents] = useState<IrrigationEvent[]>([])

  useEffect(() => {
    if (!selectedPlot) return
    void Promise.all([
      repos.recommendationsForPlot(selectedPlot.id, dateDaysAgo(6)),
      repos.eventsForPlot(selectedPlot.id, dateDaysAgo(6))
    ]).then(([recs, irrigation]) => { setRecommendations(recs); setEvents(irrigation) })
  }, [selectedPlot?.id])

  const totalUsageLitres = 1370
  const maxLitres = Math.max(600, ...recommendations.map(rec => rec.decision.litres_exact), ...events.map(ev => ev.litres))

  if (!selectedPlot) {
    return (
      <Page>
        <AppHeader showBack eyebrow="Water Usage" title="Analytics" />
        <EmptyState title="Add a plot first" text="Water usage tracking is kept locally for each plot." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} />
      </Page>
    )
  }

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const mockDailyHeights = [240, 420, 310, 520, 290, 450, 380]

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow="Analytics"
        title="Water Usage"
        action={
          <button className="icon-button" aria-label="Calendar filter">
            📅
          </button>
        }
      />

      {/* Period Dropdown */}
      <div className="period-selector-row">
        <select value={period} onChange={e => setPeriod(e.target.value as PeriodType)}>
          <option value="this_week">This Week</option>
          <option value="last_week">Last Week</option>
          <option value="this_month">This Month</option>
        </select>
      </div>

      {/* Total Water Used Card */}
      <Card className="total-water-card">
        <p className="eyebrow">Total Water Used</p>
        <h2 className="big-water-val">1,370 Litres</h2>
        <div className="water-trend-badge">
          <span>↑ 12% vs last week</span>
        </div>
      </Card>

      {/* Daily Usage Bar Chart */}
      <Card className="daily-chart-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Daily Usage</p>
            <h2>Daily Usage (Litres)</h2>
          </div>
        </div>

        <div className="chart-wrapper">
          <div className="y-axis-labels">
            <span>600</span>
            <span>400</span>
            <span>200</span>
            <span>0</span>
          </div>

          <div className="bar-chart-container">
            {daysOfWeek.map((day, i) => (
              <div key={day} className="bar-column">
                <div className="bar-wrapper">
                  <div
                    className="chart-bar"
                    style={{ height: `${(mockDailyHeights[i] / 600) * 100}%` }}
                    title={`${day}: ${mockDailyHeights[i]} L`}
                  />
                </div>
                <span className="day-label">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* By Crop Breakdown */}
      <Card className="by-crop-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Breakdown</p>
            <h2>By Crop</h2>
          </div>
        </div>

        <div className="by-crop-list">
          <div className="by-crop-row">
            <div className="crop-label-wrap">
              <span className="crop-emoji">🍅</span>
              <strong>Tomatoes</strong>
            </div>
            <div className="crop-bar-wrap">
              <div className="crop-bar-track">
                <div className="crop-bar-fill green-fill" style={{ width: '45%' }} />
              </div>
            </div>
            <div className="crop-val-wrap">
              <strong>620 L</strong>
              <small>(45%)</small>
            </div>
          </div>

          <div className="by-crop-row">
            <div className="crop-label-wrap">
              <span className="crop-emoji">🌽</span>
              <strong>Maize</strong>
            </div>
            <div className="crop-bar-wrap">
              <div className="crop-bar-track">
                <div className="crop-bar-fill green-fill" style={{ width: '33%' }} />
              </div>
            </div>
            <div className="crop-val-wrap">
              <strong>450 L</strong>
              <small>(33%)</small>
            </div>
          </div>

          <div className="by-crop-row">
            <div className="crop-label-wrap">
              <span className="crop-emoji">🥬</span>
              <strong>Kales</strong>
            </div>
            <div className="crop-bar-wrap">
              <div className="crop-bar-track">
                <div className="crop-bar-fill green-fill" style={{ width: '22%' }} />
              </div>
            </div>
            <div className="crop-val-wrap">
              <strong>300 L</strong>
              <small>(22%)</small>
            </div>
          </div>
        </div>
      </Card>
    </Page>
  )
}
