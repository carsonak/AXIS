import { Link } from 'react-router-dom'
import { Alert, AppHeader, Badge, Card, EmptyState, Page, Spinner } from '../components'
import { useAxis } from '../context'
import { useRecommendationRefresh } from '../recommendation-refresh'
import { friendlyDate, nairobiDateTime, relativeDataAge } from '../utils'

export default function WeatherPage() {
  const { selectedPlot, online } = useAxis()
  const { recommendation, localReady: loaded, refreshing, error, now, refresh } = useRecommendationRefresh()

  if (!selectedPlot) {
    return <Page><AppHeader showBack eyebrow="Weather" title="Next 24 Hours" /><EmptyState title="Add a plot first" text="AXIS needs plot coordinates to request local weather." action={<Link className="button primary" to="/app/plots/new">Add a plot</Link>} /></Page>
  }

  if (!loaded) return <Page><AppHeader showBack eyebrow="Weather" title="Next 24 Hours" /><Spinner label="Opening saved weather…" /></Page>

  if (!recommendation) {
    return (
      <Page>
        <AppHeader showBack eyebrow="Weather" title="Next 24 Hours" />
        {!online && <Alert tone="warn" title="You’re offline">Reconnect once to obtain weather for this plot.</Alert>}
        <EmptyState title="No saved weather yet" text="Weather is saved with today’s deterministic recommendation." action={online ? <Link className="button primary" to="/app">Get today’s advice</Link> : undefined} />
      </Page>
    )
  }

  const weather = recommendation.weather
  const probability = weather.rain_probability === undefined ? 'Unavailable' : `${Math.round(weather.rain_probability * 100)}%`
  const sourceLabel = weather.source === 'KIJANISPACE' ? 'KijaniSpace' : weather.source === 'MEMORY_CACHE' ? 'KijaniSpace memory cache' : weather.source === 'CLIMATOLOGY' ? 'Seasonal climatology fallback' : 'Demo fixture'
  const observedLabel = weather.source === 'KIJANISPACE' || weather.source === 'MEMORY_CACHE' ? 'Kijani model' : weather.source === 'DEMO_FIXTURE' ? 'Fixture timestamp' : 'Provider timestamp'

  return (
    <Page>
      <AppHeader showBack eyebrow="Weather" title="Next 24 Hours" />
      {error && <Alert tone="warn" title="Couldn’t refresh">{error}</Alert>}
      {!online && <Alert tone="warn" title="Saved weather">You’re viewing the weather stored with this recommendation. Reconnect to refresh it.</Alert>}

      <Card className="weather-refresh-card">
        <div>
          <strong>AXIS refreshed {relativeDataAge(recommendation.savedAt, now)}</strong>
          <span>{nairobiDateTime(recommendation.savedAt)} EAT</span>
          <small>
            {weather.provider_observed_at
              ? `${observedLabel}: ${relativeDataAge(weather.provider_observed_at, now)} · ${nairobiDateTime(weather.provider_observed_at)} EAT`
              : 'Provider model time unavailable for this weather source.'}
          </small>
        </div>
        <button className="button secondary compact" disabled={!online || refreshing} onClick={() => void refresh()}>
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </Card>

      <Card className="weather-location-bar">
        <div className="location-info">
          <span className="location-pin">📍</span>
          <strong>{selectedPlot.name} · {selectedPlot.lat.toFixed(4)}, {selectedPlot.lon.toFixed(4)}</strong>
        </div>
        <Badge tone={weather.source === 'KIJANISPACE' || weather.source === 'MEMORY_CACHE' ? 'good' : 'warn'}>{sourceLabel}</Badge>
      </Card>

      <Card className="forecast-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Saved for {friendlyDate(recommendation.date)}</p>
            <h2>Supported weather window: next 24 hours</h2>
          </div>
        </div>
        <div className="key-info-grid">
          <div className="key-info-item"><span>Minimum temperature</span><strong>{weather.t_min_c.toFixed(1)}°C</strong></div>
          <div className="key-info-item"><span>Maximum temperature</span><strong>{weather.t_max_c.toFixed(1)}°C</strong></div>
          <div className="key-info-item"><span>{weather.source === 'CLIMATOLOGY' ? 'Seasonal rainfall input' : 'Rain next 24 hours'}</span><strong>{weather.rain_next_24h_mm.toFixed(1)} mm</strong></div>
          <div className="key-info-item"><span>Rain probability</span><strong>{probability}</strong></div>
          <div className="key-info-item"><span>Reference ET₀</span><strong>{weather.et0_mm.toFixed(1)} mm · {weather.et0_method}</strong></div>
          <div className="key-info-item"><span>Wind</span><strong>{weather.wind_ms === undefined ? 'Unavailable' : `${weather.wind_ms.toFixed(1)} m/s`}</strong></div>
        </div>
      </Card>

      {weather.source === 'CLIMATOLOGY' && <Alert tone="warn" title="Forecast unavailable">This is a low-confidence seasonal fallback, not a rainfall forecast. AXIS does not credit climatological rainfall against today’s requirement.</Alert>}
      {refreshing && <Spinner label="Refreshing weather and advice…" />}
      <p className="disclaimer standalone">The current Kijani integration and AXIS contract provide one daily/next-24-hour snapshot. AXIS does not manufacture additional forecast days.</p>
    </Page>
  )
}
