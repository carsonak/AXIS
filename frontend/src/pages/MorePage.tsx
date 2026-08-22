import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader, Card, Modal, Page } from '../components'
import { useAxis } from '../context'

export default function MorePage() {
  const navigate = useNavigate()
  const { catalog, settings, saveSettings, online } = useAxis()
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showUnitsModal, setShowUnitsModal] = useState(false)

  const settingsItems = [
    { label: '🏠 Landing Page / Home', action: () => navigate('/') },
    { label: 'My Farm', action: () => navigate('/app/plots') },
    { label: 'Crops', action: () => navigate('/app/plots') },
    { label: 'Weather Timeline', action: () => navigate('/app/weather') },
    { label: 'Irrigation Methods', action: () => navigate('/app/recommendations') },
    { label: 'Units (L, litres, °C)', action: () => setShowUnitsModal(true) },
    { label: 'Notifications', action: () => navigate('/app/alerts') },
    { label: 'Local & Offline Status', action: () => alert(online ? 'Online. Farmer data remains stored locally on this device.' : 'Offline. Saved advice and farmer records remain available on this device.') },
    { label: 'Help & Support', action: () => navigate('/') },
    { label: 'About AXIS', action: () => setShowAboutModal(true) },
  ]


  return (
    <Page>
      <AppHeader showBack eyebrow="Preferences" title="Settings" />

      <Card className="wireframe-settings-card">
        <div className="settings-menu-list">
          {settingsItems.map(item => (
            <div key={item.label} className="settings-menu-item" onClick={item.action}>
              <span className="menu-item-label">{item.label}</span>
              <span className="menu-item-chevron">&gt;</span>
            </div>
          ))}
        </div>
      </Card>

      {showAboutModal && (
        <Modal title="About AXIS" onClose={() => setShowAboutModal(false)}>
          <div className="about-modal-body">
            <div className="about-logo-group">
              <strong className="bold-brand" style={{ fontSize: '1.8rem', color: '#1b5e20' }}>AXIS</strong>
              <p className="brand-subtitle">Agricultural Excellence in Irrigation Schemes</p>
            </div>
            <p className="about-desc">
              AXIS is a precision irrigation schedule generator and crop-water requirement tracker built for smallholder farmers.
            </p>
            <div className="about-meta-list">
              <div><span>Version:</span> <strong>1.0.0</strong></div>
              <div><span>Engine:</span> <strong>{catalog?.engine_version ?? 'Unavailable'}</strong></div>
              <div><span>Offline persistence:</span> <strong>Dexie / IndexedDB</strong></div>
            </div>
          </div>
        </Modal>
      )}

      {showUnitsModal && (
        <Modal title="Unit Settings" onClose={() => setShowUnitsModal(false)}>
          <div className="units-modal-body">
            <label>
              Area Unit
              <select value={settings.areaUnit} onChange={e => void saveSettings({ ...settings, areaUnit: e.target.value as typeof settings.areaUnit })}>
                <option value="acre">Acres</option>
                <option value="hectare">Hectares</option>
                <option value="m2">Square metres</option>
              </select>
            </label>
            <label>
              Language
              <select value={settings.language} onChange={e => void saveSettings({ ...settings, language: e.target.value as typeof settings.language })}>
                <option value="en">English</option>
                <option value="sw">Kiswahili</option>
              </select>
            </label>
          </div>
        </Modal>
      )}
    </Page>
  )
}
