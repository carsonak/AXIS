import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export function AxisMark({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><img src="/axis-mark.svg" alt="" /><div><strong>AXIS</strong>{!compact && <span>Agricultural Excellence in Irrigation Schemes</span>}</div></div>
}
export function AppHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return <header className="app-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{action}</header>
}

const nav = [
  { to: '/', label: 'Today', icon: '◉', end: true },
  { to: '/plots', label: 'Plots', icon: '⌁' },
  { to: '/history', label: 'History', icon: '▥' },
  { to: '/more', label: 'More', icon: '•••' }
]
export function BottomNav() {
  return <nav className="bottom-nav" aria-label="Primary navigation">{nav.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'active' : ''}><span>{item.icon}</span>{item.label}</NavLink>)}</nav>
}

export function Page({ children }: { children: ReactNode }) { return <main className="page">{children}</main> }
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section> }
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'good' | 'warn' | 'muted' | 'info' }) { return <span className={`badge ${tone}`}>{children}</span> }
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <Card className="empty"><div className="empty-mark">♧</div><h2>{title}</h2><p>{text}</p>{action}</Card> }
export function Spinner({ label = 'Loading' }: { label?: string }) { return <div className="spinner-row"><span className="spinner" />{label}</div> }

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'good'; title: string; children: ReactNode }) {
  return <div className={`alert ${tone}`}><strong>{title}</strong><span>{children}</span></div>
}
