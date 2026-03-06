import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { BODY_INDEX, REFERENCE_STATES } from '../data/catalog'
import { computeAbsolutePosition, computeRelativePosition, getOrbitPeriodDays, solveKepler } from './orbits'
import { julianDateFromUtcMillis } from './time'

const TOLERANCES_KM: Record<string, number> = {
  earth: 5_000_000,
  moon: 2_500_000,
  mars: 5_000_000,
  io: 6_000_000,
  titan: 12_000_000,
  triton: 15_000_000,
  himalia: 45_000_000,
  ymir: 90_000_000,
  caliban: 60_000_000,
  nereid: 40_000_000,
}

function parseReferenceDate(value: string): number {
  return Date.parse(value.replace(' ', 'T') + ':00Z')
}

describe('orbit engine', () => {
  it('solves Kepler equations for low eccentricity orbits', () => {
    const anomaly = solveKepler(0.05, Math.PI / 3)
    expect(anomaly).toBeGreaterThan(0)
    expect(anomaly).toBeLessThan(Math.PI)
  })

  it('computes finite relative positions for the full catalog', () => {
    const julianDate = julianDateFromUtcMillis(Date.UTC(2026, 2, 6, 0, 0, 0, 0))
    for (const body of BODY_INDEX.values()) {
      const position = computeRelativePosition(body, julianDate)
      expect(Number.isFinite(position.x)).toBe(true)
      expect(Number.isFinite(position.y)).toBe(true)
      expect(Number.isFinite(position.z)).toBe(true)
    }
  })

  it('matches the generated JPL reference snapshot within broad visual tolerances', () => {
    for (const [bodyId, cases] of Object.entries(REFERENCE_STATES)) {
      for (const [dateText, reference] of Object.entries(cases)) {
        const julianDate = julianDateFromUtcMillis(parseReferenceDate(dateText))
        const computed = computeAbsolutePosition(bodyId, julianDate)
        const errorKm = computed.distanceTo(new Vector3(reference.xKm, reference.yKm, reference.zKm))
        expect(errorKm).toBeLessThan(TOLERANCES_KM[bodyId])
      }
    }
  })

  it('exposes sensible orbital periods for planets and moons', () => {
    expect(getOrbitPeriodDays(BODY_INDEX.get('earth')!)).toBeCloseTo(365.26, 0)
    expect(getOrbitPeriodDays(BODY_INDEX.get('moon')!)).toBeCloseTo(27.322, 2)
  })
})
