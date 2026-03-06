export type CameraMode = 'focus-orbit' | 'free-fly'
export type BodyKind = 'sun' | 'planet' | 'moon'

export interface OrbitalElements {
  semiMajorAxisKm: number
  eccentricity: number
  inclinationDeg: number
  longitudeAscendingNodeDeg: number
  argumentPeriapsisDeg?: number
  longitudePerihelionDeg?: number
  meanLongitudeDeg?: number
  meanAnomalyDeg?: number
}

export interface MeanLongitudeTerms {
  b: number
  c: number
  s: number
  f: number
}

export interface PrecessionTerms {
  periapsisYears: number | null
  nodeYears: number | null
}

export interface FramePole {
  raDeg: number
  decDeg: number
  tiltDeg: number | null
}

export interface OrbitModel {
  referenceFrame: string
  epochJulianDate: number
  approximationClass: string
  validFrom: string
  validTo: string
  elements: OrbitalElements
  elementRates?: Partial<Record<
    | 'semiMajorAxisKmPerCentury'
    | 'eccentricityPerCentury'
    | 'inclinationDegPerCentury'
    | 'longitudeAscendingNodeDegPerCentury'
    | 'longitudePerihelionDegPerCentury'
    | 'meanLongitudeDegPerCentury',
    number
  >>
  meanLongitudeTerms?: MeanLongitudeTerms
  periodDays?: number
  precession?: PrecessionTerms
  framePole?: FramePole | null
}

export interface RotationModel {
  rotationPeriodHours: number
  obliquityDeg: number
  axialTiltDeg: number
}

export interface RingSet {
  innerRadiusKm: number
  outerRadiusKm: number
  textureFamily: string
}

export interface TextureSet {
  kind: string
  textureFamily: string
  colorHint: string
  curatedPath: string | null
}

export interface BodyCatalogEntry {
  id: string
  name: string
  code: string
  parentId: string | null
  kind: BodyKind
  system: string
  radiiKm: {
    mean: number
  }
  rotationModel: RotationModel
  orbitModel: OrbitModel | null
  textureSet: TextureSet
  ringSet: RingSet | null
  dataSnapshotDate: string
}

export interface CatalogFile {
  snapshotDate: string
  bodies: BodyCatalogEntry[]
}

export interface ReferenceStatesFile {
  snapshotDate: string
  referenceStates: Record<
    string,
    Record<
      string,
      {
        xKm: number
        yKm: number
        zKm: number
      }
    >
  >
}

export interface SimulationState {
  instantUtcMs: number
  isPlaying: boolean
  speedDaysPerSecond: number
  selectedBodyId: string
  cameraMode: CameraMode
  showLabels: boolean
  showOrbits: boolean
}
