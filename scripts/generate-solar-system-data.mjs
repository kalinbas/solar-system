import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import * as cheerio from 'cheerio'

const AU_IN_KM = 149_597_870.7
const OUTPUT_DIR = path.resolve(process.cwd(), 'src/data/generated')
const PLANETARY_SYSTEMS = new Set([
  'Mercury',
  'Venus',
  'Earth',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
])

const PLANET_CONFIG = {
  Mercury: {
    id: 'mercury',
    kind: 'planet',
    system: 'mercury',
    radiusKm: 2439.7,
    rotationPeriodHours: 1407.6,
    obliquityDeg: 0.034,
    textureFamily: 'rocky-gray',
    colorHint: '#8f8b83',
  },
  Venus: {
    id: 'venus',
    kind: 'planet',
    system: 'venus',
    radiusKm: 6051.8,
    rotationPeriodHours: -5832.5,
    obliquityDeg: 177.36,
    textureFamily: 'clouded-amber',
    colorHint: '#d4b47c',
  },
  Earth: {
    id: 'earth',
    kind: 'planet',
    system: 'earth',
    radiusKm: 6371.0,
    rotationPeriodHours: 23.9345,
    obliquityDeg: 23.4393,
    textureFamily: 'earthlike',
    colorHint: '#4f87db',
  },
  Mars: {
    id: 'mars',
    kind: 'planet',
    system: 'mars',
    radiusKm: 3389.5,
    rotationPeriodHours: 24.6229,
    obliquityDeg: 25.19,
    textureFamily: 'rust',
    colorHint: '#b55e3f',
  },
  Jupiter: {
    id: 'jupiter',
    kind: 'planet',
    system: 'jupiter',
    radiusKm: 69911,
    rotationPeriodHours: 9.925,
    obliquityDeg: 3.13,
    textureFamily: 'gas-bands-warm',
    colorHint: '#cfb38b',
  },
  Saturn: {
    id: 'saturn',
    kind: 'planet',
    system: 'saturn',
    radiusKm: 58232,
    rotationPeriodHours: 10.656,
    obliquityDeg: 26.73,
    textureFamily: 'gas-bands-pale',
    colorHint: '#d7c38f',
  },
  Uranus: {
    id: 'uranus',
    kind: 'planet',
    system: 'uranus',
    radiusKm: 25362,
    rotationPeriodHours: -17.24,
    obliquityDeg: 97.77,
    textureFamily: 'ice-bands',
    colorHint: '#80d5e0',
  },
  Neptune: {
    id: 'neptune',
    kind: 'planet',
    system: 'neptune',
    radiusKm: 24622,
    rotationPeriodHours: 16.11,
    obliquityDeg: 28.32,
    textureFamily: 'ice-bands-deep',
    colorHint: '#3865d8',
  },
}

const ADDITIONAL_MOON_RADII = {
  Adrastea: 8.2,
  Albiorix: 16.0,
  Amalthea: 83.5,
  Ananke: 14.0,
  Ariel: 578.9,
  Bianca: 25.7,
  Caliban: 36.0,
  Callirrhoe: 4.3,
  Calypso: 10.6,
  Carme: 23.0,
  Cordelia: 20.1,
  Cressida: 41.0,
  Cupid: 9.0,
  Daphnis: 4.0,
  Desdemona: 32.0,
  Elara: 43.0,
  Epimetheus: 58.0,
  Erriapus: 5.0,
  Himalia: 69.8,
  Hippocamp: 17.0,
  Hyperion: 135.0,
  Ijiraq: 6.0,
  Janus: 89.5,
  Juliet: 53.0,
  Larissa: 97.0,
  Leda: 10.0,
  Lysithea: 18.0,
  Mab: 12.0,
  Megaclite: 2.7,
  Metis: 21.5,
  Miranda: 235.8,
  Nereid: 170.0,
  Neso: 30.0,
  Ophelia: 21.4,
  Paaliaq: 11.0,
  Pallene: 2.2,
  Pasiphae: 30.0,
  Perdita: 15.0,
  Portia: 67.6,
  Praxidike: 3.5,
  Prospero: 15.0,
  Puck: 81.0,
  Rosalind: 36.0,
  Setebos: 24.0,
  Sinope: 19.0,
  Stephano: 16.0,
  Sycorax: 75.0,
  Tarvos: 7.5,
  Telesto: 12.4,
  Themisto: 4.0,
  Thrymr: 3.5,
  Trinculo: 9.0,
  Umbriel: 584.7,
  Ymir: 9.0,
}

const TEXTURE_HINTS = {
  Moon: { textureFamily: 'lunar', colorHint: '#b7b0a4' },
  Phobos: { textureFamily: 'rocky-dark', colorHint: '#77685d' },
  Deimos: { textureFamily: 'rocky-dark', colorHint: '#7c7067' },
  Io: { textureFamily: 'sulfuric', colorHint: '#f3cd54' },
  Europa: { textureFamily: 'icy-cracked', colorHint: '#d8cfc0' },
  Ganymede: { textureFamily: 'icy-rocky', colorHint: '#948a7d' },
  Callisto: { textureFamily: 'rocky-dark', colorHint: '#7b6b58' },
  Titan: { textureFamily: 'clouded-amber', colorHint: '#d6a95c' },
  Enceladus: { textureFamily: 'icy-bright', colorHint: '#e6eef4' },
  Triton: { textureFamily: 'icy-pink', colorHint: '#c9a7a8' },
}

const REFERENCE_CASES = [
  { bodyId: 'earth', command: '399' },
  { bodyId: 'moon', command: '301' },
  { bodyId: 'mars', command: '499' },
  { bodyId: 'io', command: '501' },
  { bodyId: 'titan', command: '606' },
  { bodyId: 'triton', command: '801' },
  { bodyId: 'himalia', command: '506' },
  { bodyId: 'ymir', command: '619' },
  { bodyId: 'caliban', command: '716' },
  { bodyId: 'nereid', command: '802' },
]

const REFERENCE_DATES = [
  '1950-01-01 00:00',
  '2000-01-01 12:00',
  '2026-03-06 00:00',
  '2050-12-31 23:59',
]

function toId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseMaybeNumber(value) {
  const normalized = value.replace(/[,*]/g, '').trim()
  if (!normalized) {
    return null
  }

  const numeric = Number.parseFloat(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function parseJulianDate(dateText) {
  const [datePart, fractionPart = '0'] = dateText.split('.')
  const [year, month, day] = datePart.split('-').map((value) => Number.parseInt(value, 10))
  const utcMillis = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  return utcMillis / 86_400_000 + 2_440_587.5 + Number.parseFloat(`0.${fractionPart}`)
}

function buildPlanetOrbit(raw) {
  return {
    referenceFrame: 'ecliptic',
    epochJulianDate: 2451545.0,
    approximationClass: 'planet-secular',
    validFrom: '1950-01-01T00:00:00.000Z',
    validTo: '2050-12-31T23:59:59.999Z',
    elements: {
      semiMajorAxisKm: raw.a0 * AU_IN_KM,
      eccentricity: raw.e0,
      inclinationDeg: raw.i0,
      longitudeAscendingNodeDeg: raw.node0,
      longitudePerihelionDeg: raw.peri0,
      meanLongitudeDeg: raw.l0,
    },
    elementRates: {
      semiMajorAxisKmPerCentury: raw.aDot * AU_IN_KM,
      eccentricityPerCentury: raw.eDot,
      inclinationDegPerCentury: raw.iDot,
      longitudeAscendingNodeDegPerCentury: raw.nodeDot,
      longitudePerihelionDegPerCentury: raw.periDot,
      meanLongitudeDegPerCentury: raw.lDot,
    },
    meanLongitudeTerms: {
      b: 0,
      c: 0,
      s: 0,
      f: 0,
    },
  }
}

function estimateMoonRadiusKm(row) {
  if (row.radiusKm) {
    return row.radiusKm
  }

  if (Object.hasOwn(ADDITIONAL_MOON_RADII, row.name)) {
    return ADDITIONAL_MOON_RADII[row.name]
  }

  if (row.name.startsWith('S/')) {
    if (row.planet === 'Saturn') return 3
    if (row.planet === 'Jupiter') return 4
    if (row.planet === 'Uranus') return 5
    if (row.planet === 'Neptune') return 6
  }

  const a = row.semiMajorAxisKm

  switch (row.planet) {
    case 'Jupiter':
      if (a < 300_000) return 16
      if (a < 2_000_000) return 24
      if (a < 15_000_000) return 30
      return 12
    case 'Saturn':
      if (a < 300_000) return 8
      if (a < 1_000_000) return 12
      if (a < 5_000_000) return 16
      return 7
    case 'Uranus':
      if (a < 200_000) return 20
      if (a < 1_000_000) return 14
      return 12
    case 'Neptune':
      if (a < 100_000) return 16
      if (a < 1_000_000) return 30
      return 18
    default:
      return 12
  }
}

function determineMoonTextureFamily(name, radiusKm, planet) {
  if (Object.hasOwn(TEXTURE_HINTS, name)) {
    return TEXTURE_HINTS[name]
  }

  if (planet === 'Jupiter') {
    if (radiusKm > 1000) return { textureFamily: 'icy-rocky', colorHint: '#a69382' }
    return { textureFamily: 'rocky-dark', colorHint: '#8a7c6d' }
  }

  if (planet === 'Saturn') {
    if (radiusKm > 1000) return { textureFamily: 'clouded-amber', colorHint: '#ccb28e' }
    return { textureFamily: 'icy-bright', colorHint: '#dce7ef' }
  }

  if (planet === 'Uranus' || planet === 'Neptune') {
    return radiusKm > 200 ? { textureFamily: 'icy-cracked', colorHint: '#c9d7df' } : { textureFamily: 'icy-bright', colorHint: '#d9e5ee' }
  }

  return { textureFamily: 'rocky-dark', colorHint: '#897f76' }
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

function parsePlanetApproximation(preText) {
  const lines = preText
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^[-]+$/.test(line) &&
        !line.includes('au/Cy') &&
        !line.includes('rad/Cy') &&
        !line.startsWith('a ') &&
        !line.includes('EM Bary ='),
    )

  const planets = {}

  for (let index = 0; index < lines.length; index += 2) {
    const values = lines[index].split(/\s+/)
    const rates = lines[index + 1]?.split(/\s+/)

    if (!values?.length || !rates?.length) {
      continue
    }

    const isEarthMoonBarycenter = values[0] === 'EM' && values[1] === 'Bary'
    const name = isEarthMoonBarycenter ? 'Earth' : values[0]
    const fields = isEarthMoonBarycenter ? values.slice(2) : values.slice(1)
    const rateFields = rates

    if (!PLANET_CONFIG[name]) {
      continue
    }

    planets[name] = {
      name,
      codeName: isEarthMoonBarycenter ? 'EM Bary' : values[0],
      a0: Number.parseFloat(fields[0]),
      e0: Number.parseFloat(fields[1]),
      i0: Number.parseFloat(fields[2]),
      l0: Number.parseFloat(fields[3]),
      peri0: Number.parseFloat(fields[4]),
      node0: Number.parseFloat(fields[5]),
      aDot: Number.parseFloat(rateFields[0]),
      eDot: Number.parseFloat(rateFields[1]),
      iDot: Number.parseFloat(rateFields[2]),
      lDot: Number.parseFloat(rateFields[3]),
      periDot: Number.parseFloat(rateFields[4]),
      nodeDot: Number.parseFloat(rateFields[5]),
    }
  }

  return planets
}

function parseSatelliteElements(html) {
  const $ = cheerio.load(html)
  const seenCodes = new Set()
  const satellites = []

  $('#sat_elem tr').each((_, row) => {
    const cells = $(row)
      .find('td')
      .map((__, cell) => $(cell).text().trim())
      .get()

    if (cells.length === 0) {
      return
    }

    const planet = cells[1]
    if (!PLANETARY_SYSTEMS.has(planet)) {
      return
    }

    const code = cells[3]
    if (seenCodes.has(code)) {
      return
    }
    seenCodes.add(code)

    satellites.push({
      rowId: Number.parseInt(cells[0], 10),
      planet,
      name: cells[2].replace(/\s+/g, ' ').trim(),
      code,
      ephemeris: cells[4],
      frame: cells[5],
      epochJulianDate: parseJulianDate(cells[6]),
      semiMajorAxisKm: Number.parseFloat(cells[7]),
      eccentricity: Number.parseFloat(cells[8]),
      argumentPeriapsisDeg: Number.parseFloat(cells[9]),
      meanAnomalyDeg: Number.parseFloat(cells[10]),
      inclinationDeg: Number.parseFloat(cells[11]),
      longitudeAscendingNodeDeg: Number.parseFloat(cells[12]),
      periodDays: Number.parseFloat(cells[13]),
      periapsisPrecessionYears: parseMaybeNumber(cells[14]),
      nodePrecessionYears: parseMaybeNumber(cells[15]),
      framePoleRaDeg: parseMaybeNumber(cells[16]),
      framePoleDecDeg: parseMaybeNumber(cells[17]),
      frameTiltDeg: parseMaybeNumber(cells[18]),
      referenceCode: cells[19],
      hasPhysicalRadius: false,
    })
  })

  return satellites
}

function parseSatellitePhysical(html) {
  const $ = cheerio.load(html)
  const radii = new Map()

  $('#sat_phys_par tr').each((_, row) => {
    const tokens = $(row)
      .text()
      .trim()
      .split(/\s+/)

    if (tokens.length < 9) {
      return
    }

    const name = tokens[1]
    const meanRadius = Number.parseFloat(tokens[6])
    if (Number.isFinite(meanRadius)) {
      radii.set(name, meanRadius)
    }
  })

  return radii
}

async function buildReferenceStates() {
  const states = {}

  for (const referenceCase of REFERENCE_CASES) {
    states[referenceCase.bodyId] = {}

    for (const when of REFERENCE_DATES) {
      const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api')
      url.searchParams.set('format', 'json')
      url.searchParams.set('COMMAND', `'${referenceCase.command}'`)
      url.searchParams.set('EPHEM_TYPE', 'VECTORS')
      url.searchParams.set('CENTER', "'500@10'")
      url.searchParams.set('START_TIME', `'${when}'`)
      url.searchParams.set('STOP_TIME', `'${when}:01'`)
      url.searchParams.set('STEP_SIZE', "'1 m'")

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Horizons request failed for ${referenceCase.bodyId} at ${when}`)
      }

      const json = await response.json()
      const match = /X =\s*([^\s]+)\s+Y =\s*([^\s]+)\s+Z =\s*([^\s]+)/.exec(json.result)

      if (!match) {
        throw new Error(`Could not parse Horizons vector for ${referenceCase.bodyId} at ${when}`)
      }

      states[referenceCase.bodyId][when] = {
        xKm: Number.parseFloat(match[1]),
        yKm: Number.parseFloat(match[2]),
        zKm: Number.parseFloat(match[3]),
      }
    }
  }

  return states
}

async function main() {
  const snapshotDate = new Date().toISOString()

  const [planetApproxHtml, satelliteHtml, satellitePhysicalHtml] = await Promise.all([
    fetchText('https://ssd.jpl.nasa.gov/planets/approx_pos.html'),
    fetchText('https://ssd.jpl.nasa.gov/sats/elem/'),
    fetchText('https://ssd.jpl.nasa.gov/sats/phys_par/'),
  ])

  const planetApproxPre = [...planetApproxHtml.matchAll(/<pre>([\s\S]*?)<\/pre>/g)]
    .map((match) => match[1])
    .find((candidate) => candidate.includes('Mercury') && candidate.includes('Jupiter'))

  if (!planetApproxPre) {
    throw new Error('Could not locate the planet approximation table.')
  }

  const planetTable = parsePlanetApproximation(cheerio.load(`<div>${planetApproxPre}</div>`)('div').text())
  const satelliteRows = parseSatelliteElements(satelliteHtml)
  const satelliteRadii = parseSatellitePhysical(satellitePhysicalHtml)

  const bodies = []

  bodies.push({
    id: 'sun',
    name: 'Sun',
    code: '10',
    parentId: null,
    kind: 'sun',
    system: 'sun',
    radiiKm: { mean: 695700 },
    rotationModel: {
      rotationPeriodHours: 609.12,
      obliquityDeg: 7.25,
      axialTiltDeg: 7.25,
    },
    orbitModel: null,
    textureSet: {
      kind: 'procedural',
      textureFamily: 'sun',
      colorHint: '#f4c552',
      curatedPath: null,
    },
    ringSet: null,
    dataSnapshotDate: snapshotDate,
  })

  for (const planetName of Object.keys(PLANET_CONFIG)) {
    const config = PLANET_CONFIG[planetName]
    const orbit = buildPlanetOrbit(planetTable[planetName])
    bodies.push({
      id: config.id,
      name: planetName,
      code: config.id === 'earth' ? '399' : `${Object.keys(PLANET_CONFIG).indexOf(planetName) + 1}99`,
      parentId: 'sun',
      kind: config.kind,
      system: config.system,
      radiiKm: { mean: config.radiusKm },
      rotationModel: {
        rotationPeriodHours: config.rotationPeriodHours,
        obliquityDeg: config.obliquityDeg,
        axialTiltDeg: config.obliquityDeg,
      },
      orbitModel: orbit,
      textureSet: {
        kind: 'curated-or-procedural',
        textureFamily: config.textureFamily,
        colorHint: config.colorHint,
        curatedPath: null,
      },
      ringSet:
        planetName === 'Saturn'
          ? { innerRadiusKm: 66900, outerRadiusKm: 140180, textureFamily: 'rings-saturn' }
          : planetName === 'Uranus'
            ? { innerRadiusKm: 38000, outerRadiusKm: 51000, textureFamily: 'rings-uranus' }
            : planetName === 'Neptune'
              ? { innerRadiusKm: 42000, outerRadiusKm: 63000, textureFamily: 'rings-neptune' }
              : planetName === 'Jupiter'
                ? { innerRadiusKm: 92000, outerRadiusKm: 128000, textureFamily: 'rings-jupiter' }
                : null,
      dataSnapshotDate: snapshotDate,
    })
  }

  for (const row of satelliteRows) {
    row.radiusKm = satelliteRadii.get(row.name) ?? null
    row.hasPhysicalRadius = row.radiusKm !== null
    const radiusKm = row.radiusKm ?? estimateMoonRadiusKm(row)
    const textureHint = determineMoonTextureFamily(row.name, radiusKm, row.planet)

    bodies.push({
      id: toId(row.name),
      name: row.name,
      code: row.code,
      parentId: toId(row.planet),
      kind: 'moon',
      system: toId(row.planet),
      radiiKm: { mean: radiusKm },
      rotationModel: {
        rotationPeriodHours: row.periodDays * 24,
        obliquityDeg: 0,
        axialTiltDeg: 0,
      },
      orbitModel: {
        referenceFrame: row.frame.toLowerCase(),
        epochJulianDate: row.epochJulianDate,
        approximationClass: row.hasPhysicalRadius || radiusKm >= 300 ? 'major-moon' : 'minor-moon',
        validFrom: '1950-01-01T00:00:00.000Z',
        validTo: '2050-12-31T23:59:59.999Z',
        elements: {
          semiMajorAxisKm: row.semiMajorAxisKm,
          eccentricity: row.eccentricity,
          inclinationDeg: row.inclinationDeg,
          longitudeAscendingNodeDeg: row.longitudeAscendingNodeDeg,
          argumentPeriapsisDeg: row.argumentPeriapsisDeg,
          meanAnomalyDeg: row.meanAnomalyDeg,
        },
        elementRates: {
          meanLongitudeDegPerCentury: 36525 * 360 / row.periodDays,
        },
        periodDays: row.periodDays,
        precession: {
          periapsisYears: row.periapsisPrecessionYears,
          nodeYears: row.nodePrecessionYears,
        },
        framePole: row.framePoleRaDeg === null || row.framePoleDecDeg === null
          ? null
          : {
              raDeg: row.framePoleRaDeg,
              decDeg: row.framePoleDecDeg,
              tiltDeg: row.frameTiltDeg,
            },
      },
      textureSet: {
        kind: 'curated-or-procedural',
        textureFamily: textureHint.textureFamily,
        colorHint: textureHint.colorHint,
        curatedPath: null,
      },
      ringSet: null,
      dataSnapshotDate: snapshotDate,
    })
  }

  const referenceStates = await buildReferenceStates()

  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'bodies.json'),
    `${JSON.stringify({ snapshotDate, bodies }, null, 2)}\n`,
    'utf8',
  )
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'reference-states.json'),
    `${JSON.stringify({ snapshotDate, referenceStates }, null, 2)}\n`,
    'utf8',
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
