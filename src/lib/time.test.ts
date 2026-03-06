import { describe, expect, it } from 'vitest'
import {
  MAX_UTC_MS,
  MIN_UTC_MS,
  clampSimulationTime,
  formatLocalDateTimeInput,
  julianDateFromUtcMillis,
  parseLocalDateTimeInput,
  sliderValueToSpeed,
  speedToSliderValue,
} from './time'

describe('time helpers', () => {
  it('clamps values to the supported simulation window', () => {
    expect(clampSimulationTime(MIN_UTC_MS - 1)).toBe(MIN_UTC_MS)
    expect(clampSimulationTime(MAX_UTC_MS + 1)).toBe(MAX_UTC_MS)
  })

  it('round-trips a local datetime input value', () => {
    const utcMillis = Date.UTC(2026, 2, 6, 12, 30, 0, 0)
    const inputValue = formatLocalDateTimeInput(utcMillis)
    const parsed = parseLocalDateTimeInput(inputValue)
    expect(parsed).not.toBeNull()
  })

  it('converts UTC millis into Julian dates', () => {
    expect(julianDateFromUtcMillis(0)).toBeCloseTo(2440587.5, 6)
  })

  it('maps speed slider values logarithmically', () => {
    const speed = sliderValueToSpeed(2)
    expect(speed).toBeCloseTo(100, 8)
    expect(speedToSliderValue(speed)).toBeCloseTo(2, 8)
  })
})
