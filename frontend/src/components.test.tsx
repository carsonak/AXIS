import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AIChatAssistant } from './components'
import { createInsight } from './api'
import { sampleRecommendation } from './test-fixtures'

vi.mock('./db', () => ({ repos: { recommendationsForPlot: vi.fn().mockResolvedValue([]), eventsForPlot: vi.fn().mockResolvedValue([]) } }))
vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, createInsight: vi.fn() }
})

const plot = { id: 'plot-1', name: 'North plot', lat: 0, lon: 35, areaM2: 1000, cropId: 'tomato', plantingDate: '2026-06-01', plantingDateEstimated: false, irrigationMethodId: 'drip', createdAt: 'now', updatedAt: 'now' }
const mockedInsight = vi.mocked(createInsight)

function openAssistant(online = true) {
  render(<AIChatAssistant recommendation={sampleRecommendation()} recommendationReady selectedPlot={plot} online={online} aiEnabled />)
  fireEvent.click(screen.getByRole('button', { name: /ask axis ai assistant/i }))
}

describe('AI assistant behavior', () => {
  beforeEach(() => mockedInsight.mockReset())
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('uses deterministic quick questions and collapses the disclosure', () => {
    openAssistant()
    fireEvent.click(screen.getByRole('button', { name: /rain forecast/i }))
    expect(mockedInsight).not.toHaveBeenCalled()
    expect(screen.getByText('Deterministic AXIS explanation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand quick questions/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('routes an unmatched custom question to AI', async () => {
    mockedInsight.mockResolvedValue({ summary: 'A simple grounded answer.', observations: [], language: 'en', generated_at: 'now', label: 'AI-generated explanation' })
    openAssistant()
    const input = screen.getByPlaceholderText('Ask AXIS a question…')
    fireEvent.change(input, { target: { value: 'Explain this recommendation to me like I am 12 years old.' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(mockedInsight).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('A simple grounded answer.')).toBeInTheDocument()
  })

  it('shows an explicit error and retries without a canned substitution', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockedInsight.mockRejectedValueOnce(new Error('provider failed')).mockResolvedValueOnce({ summary: 'Recovered answer.', observations: [], language: 'en', generated_at: 'now', label: 'AI-generated explanation' })
    openAssistant()
    const input = screen.getByPlaceholderText('Ask AXIS a question…')
    fireEvent.change(input, { target: { value: 'Explain this recommendation simply.' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('AXIS AI is temporarily unavailable. Your irrigation recommendation is unchanged.')).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()
    expect(screen.queryByText('Deterministic AXIS explanation')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Recovered answer.')).toBeInTheDocument()
  })

  it('disables custom input offline while keeping quick questions usable', () => {
    openAssistant(false)
    expect(screen.getByPlaceholderText('AI questions are unavailable offline')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /crop growth stage/i }))
    expect(screen.getByText('Deterministic AXIS explanation')).toBeInTheDocument()
  })

  it('localizes chrome without rewriting existing messages', () => {
    openAssistant()
    expect(screen.getByText(/You are asking about North plot/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'SW' }))
    expect(screen.getByText('Msaidizi wa AXIS AI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Funga Msaidizi' })).toBeInTheDocument()
    expect(screen.getByText(/You are asking about North plot/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kwa nini kiasi cha maji/ })).toBeInTheDocument()
  })

  it('shows the contextual sensor question only for a fresh no-increase result', () => {
    const recommendation = sampleRecommendation()
    const response = { status: 'NO_INCREASE' as const, irrigation_logged_at: '2026-08-22T08:00:00Z', irrigation_litres: 2000, before_observed_at: '2026-08-22T07:00:00Z', after_observed_at: '2026-08-22T09:00:00Z', before_water_content_pct: 24, after_water_content_pct: 24, change_percentage_points: 0, observation: 'No increase.' }
    recommendation.sensor_context = { soil_moisture_connected: true, used_for_adjustment: false, status: 'UNCALIBRATED', irrigation_response: response }
    render(<AIChatAssistant recommendation={recommendation} recommendationReady selectedPlot={plot} online aiEnabled />)
    fireEvent.click(screen.getByRole('button', { name: /ask axis ai assistant/i }))
    expect(screen.getByRole('button', { name: /soil moisture change after irrigation/i })).toBeInTheDocument()
  })
})
