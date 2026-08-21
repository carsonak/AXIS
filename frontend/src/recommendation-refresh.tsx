import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createRecommendation } from './api'
import { useAxis } from './context'
import { repos } from './db'
import type { StoredRecommendation } from './types'
import { nairobiDate } from './utils'

const REFRESH_INTERVAL_MS = 60 * 60 * 1000

interface RecommendationRefreshValue {
  recommendation?: StoredRecommendation
  localReady: boolean
  refreshing: boolean
  error: string
  now: number
  refresh(): Promise<void>
}

const RecommendationRefreshContext = createContext<RecommendationRefreshValue | undefined>(undefined)

export function RecommendationRefreshProvider({ children }: { children: ReactNode }) {
  const { selectedPlot, online } = useAxis()
  const selectedPlotID = selectedPlot?.id
  const [recommendation, setRecommendation] = useState<StoredRecommendation>()
  const [localReady, setLocalReady] = useState(false)
  const [loadedPlotID, setLoadedPlotID] = useState<string>()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const refreshingRef = useRef(false)
  const selectedPlotIDRef = useRef(selectedPlotID)

  useEffect(() => { selectedPlotIDRef.current = selectedPlotID }, [selectedPlotID])

  useEffect(() => {
    let active = true
    setLocalReady(false)
    setLoadedPlotID(undefined)
    setRecommendation(undefined)
    setError('')
    if (!selectedPlotID) {
      setLocalReady(true)
      return () => { active = false }
    }
    void repos.latestRecommendation(selectedPlotID).then(value => {
      if (!active) return
      setRecommendation(value)
      setLoadedPlotID(selectedPlotID)
      setLocalReady(true)
    }).catch(reason => {
      if (!active) return
      setError(reason instanceof Error ? reason.message : 'Saved recommendation could not be opened.')
      setLoadedPlotID(selectedPlotID)
      setLocalReady(true)
    })
    return () => { active = false }
  }, [selectedPlotID])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = useCallback(async () => {
    if (!selectedPlot || !online || refreshingRef.current) return
    const plotID = selectedPlot.id
    refreshingRef.current = true
    setRefreshing(true)
    setError('')
    try {
      const date = nairobiDate()
      const previous = await repos.previousRecommendation(plotID, date)
      const sensor = await repos.latestSensorReading(plotID)
      const result = await createRecommendation(selectedPlot, date, previous, sensor)
      const saved = await repos.saveRecommendation(result)
      if (selectedPlotIDRef.current === plotID) setRecommendation(saved)
    } catch (reason) {
      if (selectedPlotIDRef.current === plotID) setError(reason instanceof Error ? reason.message : 'Recommendation refresh failed.')
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }, [selectedPlot, online])

  useEffect(() => {
    if (!localReady || !selectedPlotID || !online || !recommendation) return
    let cancelled = false
    let timer: number | undefined
    const savedAt = Date.parse(recommendation.savedAt)
    const previousDay = recommendation.date !== nairobiDate()
    const delay = previousDay || !Number.isFinite(savedAt) ? 0 : Math.max(0, savedAt + REFRESH_INTERVAL_MS - Date.now())

    const run = async () => {
      if (refreshingRef.current) {
        if (!cancelled) timer = window.setTimeout(run, 1_000)
        return
      }
      await refresh()
      if (!cancelled) timer = window.setTimeout(run, REFRESH_INTERVAL_MS)
    }
    timer = window.setTimeout(run, delay)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [localReady, selectedPlotID, online, recommendation, refresh])

  useEffect(() => {
    if (!localReady || !online || !recommendation) return
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return
      const savedAt = Date.parse(recommendation.savedAt)
      if (recommendation.date !== nairobiDate() || !Number.isFinite(savedAt) || Date.now() - savedAt >= REFRESH_INTERVAL_MS) void refresh()
    }
    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('focus', refreshIfStale)
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.removeEventListener('focus', refreshIfStale)
    }
  }, [localReady, online, recommendation, refresh])

  const selectedRecommendation = recommendation?.plot_id === selectedPlotID ? recommendation : undefined
  const selectedLocalReady = localReady && loadedPlotID === selectedPlotID
  const value = useMemo(
    () => ({ recommendation: selectedRecommendation, localReady: selectedLocalReady, refreshing, error, now, refresh }),
    [selectedRecommendation, selectedLocalReady, refreshing, error, now, refresh]
  )
  return <RecommendationRefreshContext.Provider value={value}>{children}</RecommendationRefreshContext.Provider>
}

export function useRecommendationRefresh() {
  const value = useContext(RecommendationRefreshContext)
  if (!value) throw new Error('useRecommendationRefresh must be used within RecommendationRefreshProvider')
  return value
}
