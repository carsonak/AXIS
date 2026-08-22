import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createRecommendation } from './api'
import { useAxis } from './context'
import { repos } from './db'
import { applyLocalIrrigationFeedback } from './irrigation-feedback'
import type { StoredRecommendation } from './types'
import { nairobiDate } from './utils'

const REFRESH_INTERVAL_MS = 60 * 60 * 1000

interface RecommendationRefreshValue {
  recommendation?: StoredRecommendation
  localReady: boolean
  refreshing: boolean
  error: string
  now: number
  feedbackPending: boolean
  refresh(): Promise<void>
}

const RecommendationRefreshContext = createContext<RecommendationRefreshValue | undefined>(undefined)

/**
 * Owns the IndexedDB-first recommendation lifecycle shared by Today, Weather, and Recommendations.
 * Network results become visible only after being persisted with their matching weather snapshot.
 */
export function RecommendationRefreshProvider({ children }: { children: ReactNode }) {
  const { selectedPlot, online } = useAxis()
  const selectedPlotID = selectedPlot?.id
  const [storedRecommendation, setStoredRecommendation] = useState<StoredRecommendation>()
  const [appliedToday, setAppliedToday] = useState(0)
  const [feedbackPending, setFeedbackPending] = useState(false)
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
    setStoredRecommendation(undefined)
    setAppliedToday(0)
    setFeedbackPending(false)
    setError('')
    if (!selectedPlotID) {
      setLocalReady(true)
      return () => { active = false }
    }
    void Promise.all([repos.latestRecommendation(selectedPlotID), repos.appliedForPlotDate(selectedPlotID, nairobiDate())]).then(([value, applied]) => {
      if (!active) return
      setStoredRecommendation(value)
      setAppliedToday(applied)
      setFeedbackPending(Boolean(value && value.date === nairobiDate() && applied !== (value.decision.applied_today_litres ?? 0)))
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
    if (!selectedPlot || refreshingRef.current) return
    const plotID = selectedPlot.id
    refreshingRef.current = true
    setRefreshing(true)
    setError('')
    try {
      const date = nairobiDate()
      const [applied, context] = await Promise.all([repos.appliedForPlotDate(plotID, date), repos.irrigationSensorContext(plotID, date)])
      if (selectedPlotIDRef.current === plotID) {
        setAppliedToday(applied)
        setFeedbackPending(true)
      }
      if (!online) return
      const [previous, sensor] = await Promise.all([repos.previousRecommendation(plotID, date), repos.latestSensorReading(plotID)])
      const result = await createRecommendation(selectedPlot, date, previous, sensor, applied, context)
      const saved = await repos.saveRecommendation(result)
      if (selectedPlotIDRef.current === plotID) {
        setStoredRecommendation(saved)
        setFeedbackPending(false)
      }
    } catch (reason) {
      if (selectedPlotIDRef.current === plotID) setError(reason instanceof Error ? reason.message : 'Recommendation refresh failed.')
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }, [selectedPlot, online])

  useEffect(() => {
    if (!localReady || !selectedPlotID || !online || !storedRecommendation) return
    let cancelled = false
    let timer: number | undefined
    const savedAt = Date.parse(storedRecommendation.savedAt)
    const previousDay = storedRecommendation.date !== nairobiDate()
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
  }, [localReady, selectedPlotID, online, storedRecommendation, refresh])

  useEffect(() => {
    if (!localReady || !online || !storedRecommendation) return
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return
      const savedAt = Date.parse(storedRecommendation.savedAt)
      if (storedRecommendation.date !== nairobiDate() || !Number.isFinite(savedAt) || Date.now() - savedAt >= REFRESH_INTERVAL_MS || feedbackPending) void refresh()
    }
    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('focus', refreshIfStale)
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.removeEventListener('focus', refreshIfStale)
    }
  }, [localReady, online, storedRecommendation, feedbackPending, refresh])

  const selectedStoredRecommendation = storedRecommendation?.plot_id === selectedPlotID ? storedRecommendation : undefined
  const selectedRecommendation = useMemo(
    () => selectedStoredRecommendation && selectedStoredRecommendation.date === nairobiDate()
      ? applyLocalIrrigationFeedback(selectedStoredRecommendation, appliedToday, selectedPlot?.areaM2)
      : selectedStoredRecommendation,
    [selectedStoredRecommendation, appliedToday, selectedPlot?.areaM2]
  )
  const selectedLocalReady = localReady && loadedPlotID === selectedPlotID
  const value = useMemo(
    () => ({ recommendation: selectedRecommendation, localReady: selectedLocalReady, refreshing, error, now, feedbackPending, refresh }),
    [selectedRecommendation, selectedLocalReady, refreshing, error, now, feedbackPending, refresh]
  )
  return <RecommendationRefreshContext.Provider value={value}>{children}</RecommendationRefreshContext.Provider>
}


export function useRecommendationRefresh() {
  const value = useContext(RecommendationRefreshContext)
  if (!value) throw new Error('useRecommendationRefresh must be used within RecommendationRefreshProvider')
  return value
}
