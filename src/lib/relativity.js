/**
 * Schwarzschild relativity for the black hole explorer, in plain numbers.
 *
 * Positions are expressed as x = r / r_s, so the same scene serves every
 * black hole and only the conversions below depend on its mass. Everything
 * here assumes a non-rotating black hole; the real ones spin, which moves the
 * inner disc edge and photon orbit by an amount the model leaves out.
 */

const G = 6.6743e-11
const C = 299792458
const SOLAR_MASS = 1.98847e30
const LIGHT_YEAR_KM = 9.4607e12
const AU_KM = 1.495979e8
const SECONDS_PER_YEAR = 3.15576e7

export const PHOTON_SPHERE = 1.5
export const ISCO = 3
/** Critical impact parameter: the edge of the black hole's shadow. */
export const SHADOW_RADIUS = (3 * Math.sqrt(3)) / 2

/** Schwarzschild radius in kilometres, for a mass in Suns. */
export function schwarzschildRadiusKm(solarMasses) {
  return (2 * G * solarMasses * SOLAR_MASS) / (C * C) / 1000
}

/** Light-crossing time of r_s in seconds. */
export function lightCrossingSeconds(solarMasses) {
  return (schwarzschildRadiusKm(solarMasses) * 1000) / C
}

/** Rate of a static observer's clock relative to a distant one (0 to 1). */
export function clockRate(x) {
  return x <= 1 ? 0 : Math.sqrt(1 - 1 / x)
}

/** Speed of an object falling from rest at infinity, as a fraction of c. */
export function fallSpeed(x) {
  return Math.min(1, 1 / Math.sqrt(Math.max(x, 1)))
}

/** Local speed of a circular orbit, as a fraction of c; 1 at the photon sphere. */
export function orbitalSpeed(x) {
  if (x <= PHOTON_SPHERE) return 1
  return Math.min(1, 1 / Math.sqrt(2 * (x - 1)))
}

/**
 * Head-to-foot tidal acceleration across a body `length` metres long, in
 * m/s². This is the Newtonian 2GML/r³, which is also the exact radial tidal
 * term for a free-falling observer in Schwarzschild spacetime.
 */
export function tidalAcceleration(solarMasses, x, length = 2) {
  const r = x * schwarzschildRadiusKm(solarMasses) * 1000
  return (2 * G * solarMasses * SOLAR_MASS * length) / (r * r * r)
}

/**
 * Proper time left before reaching r = 0 when falling from rest at infinity:
 * (2/3) x^(3/2) r_s / c. Falling any other way changes it only by a factor of
 * order one, and nothing can extend it beyond π r_s / 2c once inside.
 */
export function properTimeToSingularity(solarMasses, x) {
  return (2 / 3) * Math.pow(Math.max(x, 0), 1.5) * lightCrossingSeconds(solarMasses)
}

/** Hawking temperature in kelvin. */
export function hawkingTemperature(solarMasses) {
  return 6.17e-8 / solarMasses
}

/** Evaporation time by Hawking radiation alone, in years. */
export function evaporationYears(solarMasses) {
  return 2.1e67 * Math.pow(solarMasses, 3)
}

/** Distance from the centre at which a 2 m body feels `limit` m/s² of tide. */
export function tidalRadiusX(solarMasses, limit = 100) {
  const r = Math.cbrt((2 * G * solarMasses * SOLAR_MASS * 2) / limit)
  return r / (schwarzschildRadiusKm(solarMasses) * 1000)
}

const compact = (value, digits = 3) =>
  Number(value.toPrecision(digits)).toLocaleString('en-GB', { maximumFractionDigits: 3 })

function scientific(value, digits = 2) {
  const [mantissa, exponent] = value.toExponential(digits - 1).split('e')
  return `${mantissa} × 10^${Number(exponent)}`
}

export function formatDistanceKm(km) {
  if (km >= LIGHT_YEAR_KM * 0.1) return `${compact(km / LIGHT_YEAR_KM)} light-years`
  if (km >= AU_KM * 0.5) return `${compact(km / AU_KM)} AU`
  if (km >= 1e6) return `${compact(km / 1e6)} million km`
  if (km >= 1) return `${compact(km)} km`
  return `${compact(km * 1000)} m`
}

export function formatSeconds(seconds) {
  if (seconds < 1e-3) return `${compact(seconds * 1e6)} µs`
  if (seconds < 1) return `${compact(seconds * 1000)} ms`
  if (seconds < 120) return `${compact(seconds)} s`
  if (seconds < 7200) return `${compact(seconds / 60)} minutes`
  if (seconds < 172800) return `${compact(seconds / 3600)} hours`
  if (seconds < SECONDS_PER_YEAR) return `${compact(seconds / 86400)} days`
  return `${compact(seconds / SECONDS_PER_YEAR)} years`
}

export function formatAcceleration(value) {
  const g = value / 9.81
  if (g >= 1e4) return `${scientific(g)} g`
  if (g >= 0.01) return `${compact(g)} g`
  return 'Imperceptible'
}

export function formatKelvin(value) {
  return `${scientific(value)} K`
}

export function formatYears(value) {
  return `${scientific(value)} years`
}
