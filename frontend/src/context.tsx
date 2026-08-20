import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCatalog as fetchCatalog, getHealth, type HealthResponse } from './api'
import { repos } from './db'
import type { CatalogResponse, Plot, Settings } from './types'

interface AxisContextValue {
  ready: boolean; online: boolean; catalog?: CatalogResponse; plots: Plot[]; settings: Settings; selectedPlot?: Plot; health?: HealthResponse
  reload(): Promise<void>; selectPlot(id: string): Promise<void>; saveSettings(settings: Settings): Promise<void>
}
const AxisContext = createContext<AxisContextValue | undefined>(undefined)

export function AxisProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [catalog, setCatalog] = useState<CatalogResponse>()
  const [plots, setPlots] = useState<Plot[]>([])
  const [settings, setSettingsState] = useState<Settings>({ id: 'app', areaUnit: 'acre', language: 'en' })
  const [health, setHealth] = useState<HealthResponse>()

  async function reload() {
    const [savedSettings, localCatalog, localPlots] = await Promise.all([repos.getSettings(), repos.getCatalog(), repos.listPlots()])
    setSettingsState(savedSettings); setCatalog(localCatalog); setPlots(localPlots)
    if (navigator.onLine) {
      const [remoteCatalog, remoteHealth] = await Promise.allSettled([fetchCatalog(), getHealth()])
      if (remoteCatalog.status === 'fulfilled') { await repos.saveCatalog(remoteCatalog.value); setCatalog(remoteCatalog.value) }
      if (remoteHealth.status === 'fulfilled') setHealth(remoteHealth.value)
    }
    setReady(true)
  }

  useEffect(() => { void reload() }, [])
  useEffect(() => {
    const handleOnline = () => { setOnline(true); void reload() }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  async function selectPlot(id: string) { const next = { ...settings, selectedPlotId: id }; await repos.saveSettings(next); setSettingsState(next) }
  async function saveSettings(next: Settings) { await repos.saveSettings(next); setSettingsState(next) }
  const selectedPlot = plots.find(plot => plot.id === settings.selectedPlotId) ?? plots[0]
  const value = useMemo(() => ({ ready, online, catalog, plots, settings, selectedPlot, health, reload, selectPlot, saveSettings }), [ready, online, catalog, plots, settings, selectedPlot, health])
  return <AxisContext.Provider value={value}>{children}</AxisContext.Provider>
}

export function useAxis() {
  const value = useContext(AxisContext)
  if (!value) throw new Error('useAxis must be used within AxisProvider')
  return value
}
