import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, Card, Page } from '../components'

export default function AlertsPage() {
  const alertItems = [
    {
      id: '1',
      type: 'warning',
      icon: '💧',
      title: 'Low Soil Moisture',
      detail: 'Zone B moisture is low (19%). Irrigation recommended.',
      time: 'Today, 6:30 AM',
      color: '#d97706',
      bg: '#fef3c7',
    },
    {
      id: '2',
      type: 'info',
      icon: '🌧',
      title: 'Rain Expected',
      detail: 'Rain expected on Thu and Fri. Consider skipping irrigation.',
      time: 'Today, 6:00 AM',
      color: '#0284c7',
      bg: '#e0f2fe',
    },
    {
      id: '3',
      type: 'success',
      icon: '✓',
      title: 'Irrigation Logged',
      detail: '420 Litres logged successfully.',
      time: '19 May, 6:30 AM',
      color: '#2e7d32',
      bg: '#dcfce7',
    },
  ]

  return (
    <Page>
      <AppHeader
        showBack
        eyebrow="Notifications"
        title="Alerts"
        action={
          <button className="icon-button" aria-label="Search alerts">
            🔍
          </button>
        }
      />

      <div className="alerts-card-list">
        {alertItems.map(item => (
          <Card key={item.id} className="wireframe-alert-card">
            <div className="alert-badge-icon" style={{ backgroundColor: item.bg, color: item.color }}>
              {item.icon}
            </div>
            <div className="alert-card-content">
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
              <span className="alert-time">{item.time}</span>
            </div>
            <div className="alert-arrow">&gt;</div>
          </Card>
        ))}
      </div>

      <div className="view-all-alerts-wrap">
        <button className="button secondary full" onClick={() => alert('All alerts up to date.')}>
          View All Alerts
        </button>
      </div>
    </Page>
  )
}
