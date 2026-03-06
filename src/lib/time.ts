const MS_PER_DAY = 86_400_000
const JULIAN_UNIX_EPOCH = 2_440_587.5

export const MIN_UTC_MS = Date.UTC(1950, 0, 1, 0, 0, 0, 0)
export const MAX_UTC_MS = Date.UTC(2050, 11, 31, 23, 59, 59, 999)
export const J2000_JULIAN_DATE = 2_451_545.0

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

export function clampSimulationTime(utcMillis: number): number {
  return Math.min(Math.max(utcMillis, MIN_UTC_MS), MAX_UTC_MS)
}

export function parseLocalDateTimeInput(value: string): number | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return clampSimulationTime(parsed.getTime())
}

export function formatLocalDateTimeInput(utcMillis: number): string {
  const date = new Date(utcMillis)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatLocalDateTimeLabel(utcMillis: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(utcMillis))
}

export function formatTimezoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function julianDateFromUtcMillis(utcMillis: number): number {
  return utcMillis / MS_PER_DAY + JULIAN_UNIX_EPOCH
}

export function centuriesSinceJ2000(julianDate: number): number {
  return (julianDate - J2000_JULIAN_DATE) / 36_525
}

export function daysSinceJulianDate(julianDate: number, epochJulianDate: number): number {
  return julianDate - epochJulianDate
}

export function speedToSliderValue(speedDaysPerSecond: number): number {
  return Math.log10(Math.max(speedDaysPerSecond, 0.01))
}

export function sliderValueToSpeed(sliderValue: number): number {
  return 10 ** sliderValue
}
