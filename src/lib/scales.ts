import type { BodyCatalogEntry } from '../types'

export const DISTANCE_SCALE = 1 / 1_000_000

export function scaleDistanceKm(distanceKm: number): number {
  return distanceKm * DISTANCE_SCALE
}

export function getRenderRadius(body: BodyCatalogEntry): number {
  const physicalRadius = scaleDistanceKm(body.radiiKm.mean)

  if (body.kind === 'sun') {
    return Math.max(physicalRadius * 1.05, 6)
  }

  if (body.kind === 'planet') {
    return Math.max(physicalRadius * 1.3, body.system === 'earth' || body.system === 'mars' ? 0.08 : 0.12)
  }

  return Math.max(physicalRadius * 2.2, body.radiiKm.mean > 200 ? 0.03 : 0.012)
}

export function getFocusDistance(body: BodyCatalogEntry): number {
  const radius = getRenderRadius(body)

  if (body.kind === 'sun') {
    return 80
  }

  if (body.kind === 'planet') {
    return Math.max(radius * 12, 3.5)
  }

  return Math.max(radius * 18, 0.6)
}
