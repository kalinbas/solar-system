import { Vector3 } from 'three'
import type { BodyCatalogEntry, OrbitModel } from '../types'
import { BODY_INDEX } from '../data/catalog'
import { J2000_JULIAN_DATE, centuriesSinceJ2000, daysSinceJulianDate } from './time'

const DEG_TO_RAD = Math.PI / 180
const J2000_OBLIQUITY_RAD = 23.43928 * DEG_TO_RAD
const EQUATOR_POLE = new Vector3(0, 0, 1)

function normalizeDegrees(value: number): number {
  const wrapped = value % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export function solveKepler(eccentricity: number, meanAnomalyRad: number): number {
  let eccentricAnomaly = meanAnomalyRad

  for (let index = 0; index < 12; index += 1) {
    const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomalyRad) / (1 - eccentricity * Math.cos(eccentricAnomaly))
    eccentricAnomaly -= delta
    if (Math.abs(delta) < 1e-10) {
      break
    }
  }

  return eccentricAnomaly
}

function rotateEquatorialToEcliptic(vector: Vector3): Vector3 {
  return vector.clone().applyAxisAngle(new Vector3(1, 0, 0), -J2000_OBLIQUITY_RAD)
}

function buildReferenceBasis(orbitModel: OrbitModel): { x: Vector3; y: Vector3; z: Vector3 } {
  if (orbitModel.referenceFrame === 'laplace' && orbitModel.framePole) {
    const ra = orbitModel.framePole.raDeg * DEG_TO_RAD
    const dec = orbitModel.framePole.decDeg * DEG_TO_RAD
    const poleEquatorial = new Vector3(
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
    )
    const pole = rotateEquatorialToEcliptic(poleEquatorial).normalize()
    let xAxisEquatorial = new Vector3().crossVectors(EQUATOR_POLE, poleEquatorial)
    if (xAxisEquatorial.lengthSq() === 0) {
      xAxisEquatorial = new Vector3(1, 0, 0)
    }
    const xAxis = rotateEquatorialToEcliptic(xAxisEquatorial).normalize()
    const yAxis = new Vector3().crossVectors(pole, xAxis).normalize()
    return { x: xAxis, y: yAxis, z: pole }
  }

  return {
    x: new Vector3(1, 0, 0),
    y: new Vector3(0, 1, 0),
    z: new Vector3(0, 0, 1),
  }
}

function perifocalToReferenceFrame(
  xPrime: number,
  yPrime: number,
  argumentPeriapsisDeg: number,
  inclinationDeg: number,
  longitudeAscendingNodeDeg: number,
): Vector3 {
  const omega = argumentPeriapsisDeg * DEG_TO_RAD
  const inclination = inclinationDeg * DEG_TO_RAD
  const ascendingNode = longitudeAscendingNodeDeg * DEG_TO_RAD

  const cosOmega = Math.cos(omega)
  const sinOmega = Math.sin(omega)
  const cosI = Math.cos(inclination)
  const sinI = Math.sin(inclination)
  const cosNode = Math.cos(ascendingNode)
  const sinNode = Math.sin(ascendingNode)

  return new Vector3(
    (cosOmega * cosNode - sinOmega * sinNode * cosI) * xPrime + (-sinOmega * cosNode - cosOmega * sinNode * cosI) * yPrime,
    (cosOmega * sinNode + sinOmega * cosNode * cosI) * xPrime + (-sinOmega * sinNode + cosOmega * cosNode * cosI) * yPrime,
    (sinOmega * sinI) * xPrime + (cosOmega * sinI) * yPrime,
  )
}

function transformFromReferenceToWorld(vectorInReference: Vector3, orbitModel: OrbitModel): Vector3 {
  const basis = buildReferenceBasis(orbitModel)
  return new Vector3()
    .addScaledVector(basis.x, vectorInReference.x)
    .addScaledVector(basis.y, vectorInReference.y)
    .addScaledVector(basis.z, vectorInReference.z)
}

function getMeanMotionDegPerDay(orbitModel: OrbitModel): number {
  if (orbitModel.periodDays) {
    return 360 / orbitModel.periodDays
  }

  const ratePerCentury = orbitModel.elementRates?.meanLongitudeDegPerCentury ?? 0
  return ratePerCentury / 36_525
}

export function getOrbitPeriodDays(body: BodyCatalogEntry): number | null {
  if (!body.orbitModel) {
    return null
  }

  if (body.orbitModel.periodDays) {
    return body.orbitModel.periodDays
  }

  const meanMotionDegPerDay = getMeanMotionDegPerDay(body.orbitModel)
  if (meanMotionDegPerDay <= 0) {
    return null
  }

  return 360 / meanMotionDegPerDay
}

export function getBodySpinAngle(body: BodyCatalogEntry, julianDate: number): number {
  const rotationPeriodDays = body.rotationModel.rotationPeriodHours / 24
  if (!Number.isFinite(rotationPeriodDays) || rotationPeriodDays === 0) {
    return 0
  }

  return ((julianDate - J2000_JULIAN_DATE) / rotationPeriodDays) * Math.PI * 2
}

export function computePlanetRelativePosition(body: BodyCatalogEntry, julianDate: number): Vector3 {
  if (!body.orbitModel) {
    return new Vector3()
  }

  const { elements, elementRates = {}, meanLongitudeTerms = { b: 0, c: 0, s: 0, f: 0 } } = body.orbitModel
  const T = centuriesSinceJ2000(julianDate)
  const semiMajorAxisKm = elements.semiMajorAxisKm + (elementRates.semiMajorAxisKmPerCentury ?? 0) * T
  const eccentricity = elements.eccentricity + (elementRates.eccentricityPerCentury ?? 0) * T
  const inclinationDeg = elements.inclinationDeg + (elementRates.inclinationDegPerCentury ?? 0) * T
  const ascendingNodeDeg = elements.longitudeAscendingNodeDeg + (elementRates.longitudeAscendingNodeDegPerCentury ?? 0) * T
  const longitudePerihelionDeg = (elements.longitudePerihelionDeg ?? 0) + (elementRates.longitudePerihelionDegPerCentury ?? 0) * T
  const meanLongitudeDeg =
    (elements.meanLongitudeDeg ?? 0) +
    (elementRates.meanLongitudeDegPerCentury ?? 0) * T +
    meanLongitudeTerms.b * T * T +
    meanLongitudeTerms.c * Math.cos(meanLongitudeTerms.f * T * DEG_TO_RAD) +
    meanLongitudeTerms.s * Math.sin(meanLongitudeTerms.f * T * DEG_TO_RAD)

  const argumentPeriapsisDeg = normalizeDegrees(longitudePerihelionDeg - ascendingNodeDeg)
  const meanAnomalyDeg = normalizeDegrees(meanLongitudeDeg - longitudePerihelionDeg)
  const meanAnomalyRad = meanAnomalyDeg * DEG_TO_RAD
  const eccentricAnomaly = solveKepler(eccentricity, meanAnomalyRad)

  const xPrime = semiMajorAxisKm * (Math.cos(eccentricAnomaly) - eccentricity)
  const yPrime = semiMajorAxisKm * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly)

  return perifocalToReferenceFrame(
    xPrime,
    yPrime,
    argumentPeriapsisDeg,
    inclinationDeg,
    ascendingNodeDeg,
  )
}

export function computeMoonRelativePosition(body: BodyCatalogEntry, julianDate: number): Vector3 {
  if (!body.orbitModel) {
    return new Vector3()
  }

  const orbitModel = body.orbitModel
  const elapsedDays = daysSinceJulianDate(julianDate, orbitModel.epochJulianDate)
  const meanMotionDegPerDay = getMeanMotionDegPerDay(orbitModel)
  const meanAnomalyDeg = normalizeDegrees((orbitModel.elements.meanAnomalyDeg ?? 0) + elapsedDays * meanMotionDegPerDay)

  let ascendingNodeDeg = orbitModel.elements.longitudeAscendingNodeDeg
  let argumentPeriapsisDeg = orbitModel.elements.argumentPeriapsisDeg ?? 0

  if (orbitModel.precession?.nodeYears && orbitModel.precession.nodeYears > 0.001) {
    ascendingNodeDeg = normalizeDegrees(
      ascendingNodeDeg + (elapsedDays / (orbitModel.precession.nodeYears * 365.25)) * 360,
    )
  }

  if (orbitModel.precession?.periapsisYears && orbitModel.precession.periapsisYears > 0.001) {
    argumentPeriapsisDeg = normalizeDegrees(
      argumentPeriapsisDeg + (elapsedDays / (orbitModel.precession.periapsisYears * 365.25)) * 360,
    )
  }

  const eccentricAnomaly = solveKepler(orbitModel.elements.eccentricity, meanAnomalyDeg * DEG_TO_RAD)
  const xPrime = orbitModel.elements.semiMajorAxisKm * (Math.cos(eccentricAnomaly) - orbitModel.elements.eccentricity)
  const yPrime =
    orbitModel.elements.semiMajorAxisKm *
    Math.sqrt(1 - orbitModel.elements.eccentricity * orbitModel.elements.eccentricity) *
    Math.sin(eccentricAnomaly)

  const vectorInReference = perifocalToReferenceFrame(
    xPrime,
    yPrime,
    argumentPeriapsisDeg,
    orbitModel.elements.inclinationDeg,
    ascendingNodeDeg,
  )

  return transformFromReferenceToWorld(vectorInReference, orbitModel)
}

export function computeRelativePosition(body: BodyCatalogEntry, julianDate: number): Vector3 {
  if (body.kind === 'planet') {
    return computePlanetRelativePosition(body, julianDate)
  }

  if (body.kind === 'moon') {
    return computeMoonRelativePosition(body, julianDate)
  }

  return new Vector3()
}

export function computeAbsolutePosition(bodyId: string, julianDate: number, cache = new Map<string, Vector3>()): Vector3 {
  const cached = cache.get(bodyId)
  if (cached) {
    return cached.clone()
  }

  const body = BODY_INDEX.get(bodyId)
  if (!body) {
    throw new Error(`Unknown body ${bodyId}`)
  }

  let position = new Vector3()
  if (body.parentId) {
    position = computeAbsolutePosition(body.parentId, julianDate, cache).add(computeRelativePosition(body, julianDate))
  }

  cache.set(bodyId, position.clone())
  return position
}

export function sampleOrbitPoints(body: BodyCatalogEntry, julianDate: number, samples: number): Vector3[] {
  const periodDays = getOrbitPeriodDays(body)
  if (!periodDays || !body.orbitModel) {
    return []
  }

  const points: Vector3[] = []
  for (let index = 0; index <= samples; index += 1) {
    const sampleDate = julianDate + (periodDays * index) / samples
    points.push(computeRelativePosition(body, sampleDate))
  }
  return points
}
