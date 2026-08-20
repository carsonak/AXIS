import type { SoilMoistureReading } from './types'

export interface SoilMoistureAdapter {
  readonly id: string
  readonly displayName: string
  read(plotId: string): Promise<SoilMoistureReading>
}
export interface FlowMeterReading {
  meterId: string; observedAt: string; startLitres: number; endLitres: number
}

export interface FlowMeterAdapter {
  readonly id: string
  readonly displayName: string
  read(): Promise<FlowMeterReading>
}

export function measuredLitres(reading: FlowMeterReading): number {
  if (!Number.isFinite(reading.startLitres) || !Number.isFinite(reading.endLitres) || reading.endLitres < reading.startLitres) {
    throw new Error('Flow-meter readings must be cumulative and the ending value cannot be lower than the starting value.')
  }
  return Math.round((reading.endLitres - reading.startLitres) * 10) / 10
}
