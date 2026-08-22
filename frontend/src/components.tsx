import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import { createInsight, type InsightHistoryItem } from './api'
import { assistantText, deterministicAnswer, matchAssistantIntent, type AssistantIntent, type AssistantLanguage } from './assistant'
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

function chatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function initialChatMessages(plot?: Plot, language: AssistantLanguage = 'en'): ChatMessage[] {
  return [{ id: crypto.randomUUID(), sender: 'assistant', text: assistantText[language].greeting(plot), time: chatTime() }]
}

/** Generate an explanation from fields already present in a saved deterministic recommendation. */
function generateGroundedFallback(
  intent: AssistantIntent,
  rec: Recommendation | undefined,
  plot: Plot | undefined,
  recommendationReady: boolean,
  language: AssistantLanguage
): string {
  if (!plot) {
    return language === 'sw'
      ? 'Chagua shamba kwanza ili AXIS iweze kutumia data sahihi ya umwagiliaji.'
      : 'Select a plot first so AXIS can use the correct irrigation data.'
  }
  if (!recommendationReady) {
    return language === 'sw'
      ? `AXIS bado inafungua pendekezo lililohifadhiwa la ${plot.name}. Jaribu tena baada ya muda mfupi.`
      : `AXIS is still opening the saved recommendation for ${plot.name}. Please try again in a moment.`
  }
  if (!rec) {
    return language === 'sw'
      ? `${plot.name} haina pendekezo lililohifadhiwa. Unganisha intaneti na utengeneze pendekezo kwanza ili maelezo ya ndani yapatikane.`
      : `${plot.name} has no saved recommendation. Connect and generate one first so local explanations are available.`
  }
  return deterministicAnswer(intent, rec, language)
}

export function AIChatAssistant({
  recommendation,
  recommendationReady,
  selectedPlot,
  online,
  aiEnabled
}: {
  recommendation?: Recommendation
  recommendationReady: boolean
  selectedPlot?: Plot
  online: boolean
  aiEnabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<InsightHistoryItem[]>([])
  const [historyPlotID, setHistoryPlotID] = useState<string>()
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialChatMessages(selectedPlot))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState<AssistantLanguage>('en')
  const [quickOpen, setQuickOpen] = useState(true)
  const [failedQuery, setFailedQuery] = useState<string>()
  const contextGenerationRef = useRef(0)
  const previousPlotIDRef = useRef(selectedPlot?.id)
  const selectedPlotIDRef = useRef(selectedPlot?.id)
  const languageRef = useRef(language)

  selectedPlotIDRef.current = selectedPlot?.id
  languageRef.current = language
  if (previousPlotIDRef.current !== selectedPlot?.id) {
    previousPlotIDRef.current = selectedPlot?.id
    contextGenerationRef.current += 1
  }

  useEffect(() => {
    const plot = selectedPlot
    const generation = contextGenerationRef.current
    let cancelled = false
    setHistoryItems([])
    setHistoryPlotID(undefined)
    setMessages(initialChatMessages(plot, languageRef.current))
    setInput('')
    setLoading(false)
    setFailedQuery(undefined)
    setQuickOpen(true)
    if (!plot) return () => { cancelled = true }

    void Promise.all([
      repos.recommendationsForPlot(plot.id, dateDaysAgo(7)),
      repos.eventsForPlot(plot.id, dateDaysAgo(7))
    ]).then(([recommendations, events]) => {
      if (cancelled || contextGenerationRef.current !== generation || selectedPlotIDRef.current !== plot.id) return
      setHistoryItems(recommendations.slice(0, 7).map(rec => ({
        date: rec.date,
        recommended_litres: rec.decision.daily_target_litres_exact ?? rec.decision.litres_exact,
        applied_litres: events.filter(event => event.date === rec.date).reduce((sum, event) => sum + event.litres, 0) || undefined,
        rain_adjustment_litres: rec.decision.rain_adjustment_litres
      })))
      setHistoryPlotID(plot.id)
    }).catch(() => {
      if (cancelled || contextGenerationRef.current !== generation || selectedPlotIDRef.current !== plot.id) return
      setHistoryItems([])
      setHistoryPlotID(plot.id)
    })
    return () => { cancelled = true }
  }, [selectedPlot])

  const t = assistantText[language]
  const suggestions: Array<{ intent: AssistantIntent; label: string }> = [
    { intent: 'volume', label: t.questions.volume },
    { intent: 'rain', label: t.questions.rain },
    { intent: 'stage', label: t.questions.stage }
  ]
  if (recommendation?.sensor_context?.irrigation_response?.status === 'NO_INCREASE') {
    suggestions.push({ intent: 'sensor', label: t.questions.sensor })
  }
  const customEnabled = online && aiEnabled === true && recommendation?.plot_id === selectedPlot?.id

  async function handleSend(textToSend?: string, knownIntent?: AssistantIntent) {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const intent = knownIntent ?? matchAssistantIntent(query)
    if (!intent && !customEnabled) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: query,
      time: chatTime()
    }

    setMessages(prev => [...prev, userMsg])
    if (!textToSend) setInput('')
    setFailedQuery(undefined)
    if (intent) {
      const fallbackText = generateGroundedFallback(intent, recommendation, selectedPlot, recommendationReady, language)
      setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'assistant', text: fallbackText, time: chatTime(), label: t.localLabel }])
      setQuickOpen(false)
      return
    }

    setLoading(true)
    const generation = contextGenerationRef.current
    const plotID = selectedPlot?.id
    const currentRecommendation = recommendation?.plot_id === plotID ? recommendation : undefined
    const currentHistory = historyPlotID === plotID ? historyItems : []

    const stillCurrent = () => contextGenerationRef.current === generation && selectedPlotIDRef.current === plotID

    try {
      const response = await createInsight(query, currentRecommendation!, currentHistory, language)
      if (!stillCurrent()) return
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: `${response.summary}${response.observations.length > 0 ? ' • ' + response.observations.join(' ') : ''}`,
          time: chatTime(),
          label: t.aiLabel
        }
      ])
    } catch (error) {
      if (!stillCurrent()) return
      if (import.meta.env.DEV) console.error('AXIS AI request failed', error)
      setFailedQuery(query)
      setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'assistant', text: t.error, time: chatTime() }])
    } finally {
      if (stillCurrent()) setLoading(false)
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
          aria-label={t.fabAria}
        >
          <span className="fab-icon">🤖</span>
          <span className="fab-label">{t.fabLabel}</span>
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
              <h3>{t.title}</h3>
              <p className="ai-subtitle">{t.subtitle}</p>
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
              aria-label={t.close}
            >
              ×
            </button>
          </div>
        </div>

        {(!online || aiEnabled !== true) && (
          <div className="offline-ai-banner">
            <span>{!online ? t.offline : t.unavailable}</span>
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
                <span className="typing-dots">{t.loading}</span>
              </div>
            </div>
          )}
        </div>

        <div className="ai-suggest-chips">
          <button type="button" className="chips-label quick-toggle" aria-expanded={quickOpen} aria-label={quickOpen ? t.collapse : t.expand} onClick={() => setQuickOpen(value => !value)}>
            {t.quick} {quickOpen ? '▾' : '▸'}
          </button>
          {quickOpen && suggestions.map(chip => (
            <button
              key={chip.intent}
              type="button"
              className="suggest-chip-btn"
              disabled={loading}
              onClick={() => void handleSend(chip.label, chip.intent)}
            >
              💬 {chip.label}
            </button>
          ))}
        </div>

        {failedQuery && <button type="button" className="button secondary compact ai-retry" disabled={loading || !customEnabled} onClick={() => void handleSend(failedQuery)}>{t.retry}</button>}

        <form className="ai-chat-input-row" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={!online ? t.offlinePlaceholder : aiEnabled === true ? t.placeholder : t.unavailablePlaceholder}
            disabled={loading || !customEnabled}
          />
          <button type="submit" className="button primary compact" disabled={loading || !customEnabled || !input.trim()}>
            {loading ? t.thinking : t.send}
          </button>
        </form>

        <p className="ai-disclaimer-footer">
          {t.disclaimer}
        </p>
      </Card>
    </div>
  )
}
