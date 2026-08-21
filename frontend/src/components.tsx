import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, type ReactNode, type FormEvent } from 'react'
import { createInsight, type InsightHistoryItem } from './api'
import { repos } from './db'
import type { Plot, Recommendation } from './types'
import { dateDaysAgo } from './utils'




export function NetworkStatusDot({ online }: { online: boolean }) {
  return (
    <div
      className={`header-network-pill ${online ? 'online' : 'offline'}`}
      title={online ? 'Online — Weather & AI active' : 'Offline — Showing saved local advice'}
      role="status"
    >
      <span className="net-dot" />
      <span className="net-label">{online ? 'Online' : 'Offline'}</span>
    </div>
  )
}


export function AxisMark({ compact = false }: { compact?: boolean }) {

  return (
    <NavLink to="/" className="brand-logo-link" style={{ textDecoration: 'none' }}>
      <div className="brand">
        <div className="brand-icon-circle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="none">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.1 2 9 0 4.9-4 9-9 9z" />
          </svg>
        </div>
        <div>
          <strong className="bold-brand">AXIS</strong>
          {!compact && <span className="brand-subtitle">Agricultural Excellence in Irrigation Schemes</span>}
        </div>
      </div>
    </NavLink>
  )
}

export function SketchWaterDrop({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  )
}

export function SketchCrop({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <path d="M12 22V12M12 12C12 7 7 4 2 6c0 6 5 9 10 6M12 12c0-5 5-8 10-6 0 6-5 9-10 6" />
    </svg>
  )
}

export function SketchSun({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

export function SketchRain({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 2 14.9" />
      <line x1="8" y1="19" x2="8" y2="21" />
      <line x1="12" y1="19" x2="12" y2="21" />
      <line x1="16" y1="19" x2="16" y2="21" />
    </svg>
  )
}

export function SketchGear({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function SketchChart({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

export function SketchTarget({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

export function SketchMeter({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="12" y2="13" />
    </svg>
  )
}

export function SketchEdit({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export function SketchLock({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function SketchThermometer({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  )
}

export function SketchCheck({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sketch-icon">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function AppHeader({
  title,
  eyebrow,
  showBack = false,
  action,
}: {
  title: string
  eyebrow?: string
  showBack?: boolean
  action?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="app-header">
      <div className="header-left">
        {showBack && (
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        )}
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
      </div>
      {action && <div className="header-action">{action}</div>}
    </header>
  )
}

const nav = [
  {
    to: '/app',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    end: true,
  },
  {
    to: '/app/plots',
    label: 'Crops',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V10" />
        <path d="M12 14c-3-2.5-6-2.5-8 0 0-4.5 3.5-8 8-8s8 3.5 8 8c-2-2.5-5-2.5-8 0" />
      </svg>
    ),
  },
  {
    to: '/app/history',
    label: 'History',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: '/app/alerts',
    label: 'Alerts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    to: '/app/more',
    label: 'More',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
    ),
  },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {nav.map(item => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="page">{children}</main>
}
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: (event: React.MouseEvent<HTMLElement>) => void }) {
  return <section className={`card ${className}`} onClick={onClick}>{children}</section>
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'good' | 'warn' | 'muted' | 'info' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <Card className="empty">
      <div className="empty-mark">🌱</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </Card>
  )
}
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner-row">
      <span className="spinner" />
      {label}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'good'; title: string; children: ReactNode }) {
  return (
    <div className={`alert ${tone}`}>
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  )
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  time: string
  label?: string
}

export function AIChatAssistant({
  recommendation: initialRec,
  history: initialHistory = [],
  selectedPlot,
  online,
  aiEnabled = true
}: {
  recommendation?: Recommendation
  history?: InsightHistoryItem[]
  selectedPlot?: Plot
  online: boolean
  aiEnabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeRec, setActiveRec] = useState<Recommendation | undefined>(initialRec)
  const [historyItems, setHistoryItems] = useState<InsightHistoryItem[]>(initialHistory)

  useEffect(() => {
    if (initialRec) {
      setActiveRec(initialRec)
      return
    }
    if (!selectedPlot) return
    let active = true
    void (async () => {
      const [rec, events] = await Promise.all([
        repos.latestRecommendation(selectedPlot.id),
        repos.eventsForPlot(selectedPlot.id, dateDaysAgo(7))

      ])
      if (active) {
        if (rec) setActiveRec(rec)
        setHistoryItems(events.map(e => ({ date: e.date, recommended_litres: e.recommendedLitres ?? 0, applied_litres: e.litres })))
      }
    })()
    return () => { active = false }
  }, [initialRec, selectedPlot?.id])

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: activeRec
        ? `Habari! I am your AXIS AI Assistant. Grounded in your deterministic advice (${activeRec.decision.litres} Litres for ${activeRec.crop_stage.display_name} stage). Ask me any question about your field!`
        : 'Hello! I am your AXIS AI Assistant. Ask me any question about daily water demand, rainfall forecasts, or crop growth stages.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      label: 'AI-Generated Explanation'
    }
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState<'en' | 'sw'>('en')

  const suggestions = [
    'Why did my water volume change today?',
    'How did rain forecast affect my plot?',
    'Explain crop growth stage water needs'
  ]

/**
 * Deterministically generates grounded agronomic explanations from local recommendations
 * when network is offline or AI server endpoint is disabled.
 */
function generateGroundedFallback(query: string, rec?: Recommendation, lang: 'en' | 'sw' = 'en'): string {

  if (!rec) {
    return lang === 'sw'
      ? 'Tafadhali chagua shamba kwenye dashibodi ili AI ionyeshe maelezo kulingana na vipimo vyako.'
      : 'Please select an active plot on the dashboard so AXIS AI can ground its explanation in your exact plot data.'
  }

  const q = query.toLowerCase()
  const litres = rec.decision.litres
  const minutes = rec.decision.duration_minutes
  const rainAvoided = rec.decision.rain_adjustment_litres ?? 0
  const stage = rec.crop_stage.display_name
  const age = rec.crop_stage.crop_age_days
  const rainForecast = rec.weather.rain_next_24h_mm
  const summary = rec.explanation.summary

  if (q.includes('rain') || q.includes('mvua')) {
    if (rainAvoided > 0) {
      return lang === 'sw'
        ? `Utabiri wa mvua ni mm ${rainForecast}. AXIS imehesabu mkopo wa mvua na kuokoa Lita ${rainAvoided.toLocaleString()} za maji ("Maji yaliyoepukwa kwa sababu mvua ilizingatiwa").`
        : `Forecast rainfall is ${rainForecast} mm. AXIS credited the forecast rain and saved ${rainAvoided.toLocaleString()} Litres of water ("Water avoided because rain was considered").`
    } else {
      return lang === 'sw'
        ? `Utabiri wa mvua ni mm ${rainForecast}. Mvua iko chini ya kizingiti, kwa hivyo unahitaji Lita ${litres.toLocaleString()} za maji leo.`
        : `Forecast rainfall is ${rainForecast} mm, which is below the credit threshold. Full daily requirement of ${litres.toLocaleString()} Litres is prescribed.`
    }
  }

  if (q.includes('change') || q.includes('volume') || q.includes('badiliko') || q.includes('kiwango') || q.includes('why')) {
    return lang === 'sw'
      ? `Pendekezo la leo ni Lita ${litres.toLocaleString()}${minutes ? ` (${minutes} min)` : ''} kwa hatua ya ${stage}. ${summary}`
      : `Today's recommendation is ${litres.toLocaleString()} Litres${minutes ? ` (${minutes} min runtime)` : ''} for the ${stage} stage. ${summary}`
  }

  if (q.includes('stage') || q.includes('crop') || q.includes('hatua') || q.includes('mmea')) {
    return lang === 'sw'
      ? `Mmea wako uko katika hatua ya ${stage} (Siku ya ${age}). Mahitaji ya maji yanahesabiwa kulingana na uvukizaji wa siku na ufanisi wa mfumo.`
      : `Your crop is currently in the ${stage} growth stage (Day ${age}). Daily water replacement is calculated using crop evapotranspiration.`
  }

  return lang === 'sw'
    ? `${summary} Kipimo halisi cha leo ni Lita ${litres.toLocaleString()}.`
    : `${summary} Prescribed application for today is ${litres.toLocaleString()} Litres.`
}

  async function handleSend(textToSend?: string) {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      if (online && activeRec) {
        try {
          const response = await createInsight(activeRec, historyItems, language)
          setMessages(prev => [
            ...prev,
            {
              id: crypto.randomUUID(),
              sender: 'assistant',
              text: `${response.summary} ${response.observations.length > 0 ? ' • ' + response.observations.join(' ') : ''}`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              label: response.label || 'AI-Generated Explanation'
            }
          ])
          return
        } catch {
          // Server AI endpoint disabled or offline -> fallback to grounded agronomic explanation
        }
      }

      // Grounded Agronomic Fallback Explanation
      const fallbackText = generateGroundedFallback(query, activeRec, language)
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: fallbackText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          label: online ? 'AI-Generated Explanation' : 'Grounded Offline Summary'
        }
      ])
    } finally {
      setLoading(false)
    }
  }


  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void handleSend()
  }

  if (!isOpen) {
    return (
      <div className="ai-floating-trigger-container">
        <button
          type="button"
          className="ai-chat-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Ask AXIS AI Assistant"
        >
          <span className="fab-icon">🤖</span>
          <span className="fab-label">Ask AXIS AI</span>
          <span className={`fab-status-dot ${online ? 'online' : 'offline'}`} />
        </button>
      </div>
    )
  }


  return (
    <div className="ai-floating-overlay">
      <Card className="ai-chat-card ai-chat-card-floating">
        <div className="ai-chat-header">
          <div className="ai-chat-title-group">
            <div className="ai-icon-badge">🤖</div>
            <div>
              <h3>AXIS AI Assistant</h3>
              <p className="ai-subtitle">Grounded agronomic Q&A</p>
            </div>
          </div>
          <div className="ai-header-actions">
            <div className="lang-toggle-mini">
              <button
                type="button"
                className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-btn ${language === 'sw' ? 'active' : ''}`}
                onClick={() => setLanguage('sw')}
              >
                SW
              </button>
            </div>
            <button
              type="button"
              className="ai-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close Assistant"
            >
              ×
            </button>
          </div>
        </div>

        {!online && (
          <div className="offline-ai-banner">
            <span>⚡ Network Offline — Connect to internet to ask live AI questions.</span>
          </div>
        )}

        <div className="ai-chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`ai-message-row ${msg.sender}`}>
              <div className="ai-msg-bubble">
                <p className="ai-msg-text">{msg.text}</p>
                <div className="ai-msg-footer">
                  <span className="ai-msg-time">{msg.time}</span>
                  {msg.label && <span className="ai-msg-label">{msg.label}</span>}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="ai-message-row assistant">
              <div className="ai-msg-bubble loading">
                <span className="typing-dots">Generating explanation...</span>
              </div>
            </div>
          )}
        </div>

        <div className="ai-suggest-chips">
          <span className="chips-label">Quick Questions:</span>
          {suggestions.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className="suggest-chip-btn"
              disabled={loading || !online}
              onClick={() => void handleSend(chip)}
            >
              💬 {chip}
            </button>
          ))}
        </div>

        <form className="ai-chat-input-row" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={online ? 'Ask AXIS AI a question...' : 'Offline — connect to chat'}
            disabled={loading || !online}
          />
          <button type="submit" className="button primary compact" disabled={loading || !online || !input.trim()}>
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </form>

        <p className="ai-disclaimer-footer">
          Deterministic advice is authoritative. AI explanations are non-binding summaries.
        </p>
      </Card>
    </div>
  )
}



