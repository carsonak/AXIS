import { useState } from 'react'
import { AppHeader, Card, Page } from '../components'

export default function WeatherPage() {
  const [daysCount, setDaysCount] = useState('5')

  const forecastData = [
    { day: 'Today', date: '20 May', icon: '☀️', high: 29, low: 18, rainProb: 15 },
    { day: 'Wed', date: '21 May', icon: '⛅', high: 28, low: 17, rainProb: 10 },
    { day: 'Thu', date: '22 May', icon: '🌧', high: 26, low: 17, rainProb: 60 },
    { day: 'Fri', date: '23 May', icon: '🌧', high: 24, low: 16, rainProb: 80 },
    { day: 'Sat', date: '24 May', icon: '⛅', high: 25, low: 17, rainProb: 30 },
  ]

  return (
    <Page>
      <AppHeader showBack eyebrow="Forecast" title="Weather" />

      {/* Location & Days Filter */}
      <Card className="weather-location-bar">
        <div className="location-info">
          <span className="location-pin">📍</span>
          <strong>Kisumu, Kenya</strong>
        </div>
        <select value={daysCount} onChange={e => setDaysCount(e.target.value)}>
          <option value="5">5 Days</option>
          <option value="7">7 Days</option>
          <option value="14">14 Days</option>
        </select>
      </Card>

      {/* Forecast List */}
      <Card className="forecast-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Forecast</p>
            <h2>5-Day Forecast</h2>
          </div>
        </div>

        <div className="forecast-rows">
          {forecastData.map(f => (
            <div key={f.day} className="forecast-item">
              <span className="forecast-day-name">{f.day}</span>
              <span className="forecast-weather-icon">{f.icon}</span>
              <span className="forecast-temps"><strong>{f.high}°</strong> / {f.low}°</span>
              <span className="forecast-rain-prob">💧 {f.rainProb}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Weather Insight Card */}
      <Card className="weather-insight-box">
        <div className="section-head">
          <div>
            <p className="eyebrow">Analytics</p>
            <h2>Weather Insight</h2>
          </div>
        </div>
        <p className="weather-insight-desc">
          Rainfall expected on Thu and Fri. Consider skipping irrigation on those days to save water.
        </p>
      </Card>
    </Page>
  )
}
