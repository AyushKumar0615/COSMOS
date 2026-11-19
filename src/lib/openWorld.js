/**
 * Maths for the open universe: units, the compressed render distance,
 * galactic coordinates, autopilot timing and procedural field stars.
 *
 * World frame: galactic, in kilometres, float64. The Sun is at the origin,
 * +X points to the Galactic Centre (l = 0), +Y to the north galactic pole and
 * -Z to l = 90°. That keeps the frame right-handed, as Three.js is, so the
 * sky is not mirrored. (The atlas's `truePosition` puts l = 90° on +Z, a
 * mirror image; its distances are unaffected.)
 *
 * Pure functions over plain arrays, so they run in tests without a GPU.
 */

// Defined constants, not measurements: the IAU 2012 astronomical unit, the
// SI speed of light and the Julian year that defines the light-year.
export const KM_PER_AU = 149597870.7
export const C_KM_S = 299792.458
export const KM_PER_LY = C_KM_S * 365.25 * 86400
export const KM_PER_PC = (KM_PER_AU * 648000) / Math.PI
export const KM_PER_MPC = KM_PER_PC * 1e6

const DEG = Math.PI / 180

// --- Formatting -------------------------------------------------------------------

const fmt = (value, digits = 3) => {
  if (value >= 1000) return Math.round(value).toLocaleString('en-GB')
  return Number(value.toPrecision(digits)).toLocaleString('en-GB', { maximumFractionDigits: 6 })
}

/** A distance in the unit that suits its scale: km, AU, light-years or Mpc. */
export function formatKm(km) {
  if (km == null || !Number.isFinite(km)) return '—'
  if (km < 1e6) return `${fmt(km)} km`
  if (km < 1e7) return `${fmt(km / 1e6)} million km`
  if (km < 0.05 * KM_PER_LY) return `${fmt(km / KM_PER_AU)} AU`
  if (km < 1e6 * KM_PER_LY) return `${fmt(km / KM_PER_LY)} ly`
  return `${fmt(km / KM_PER_MPC)} Mpc`
}

/** Speed in km/s, AU/s and multiples of light speed. */
export function formatSpeed(kmPerS) {
  const v = Math.abs(kmPerS)
  const c = v / C_KM_S
  return {
    kms: v < 1e9 ? `${fmt(v)} km/s` : `${(v).toExponential(2).replace('e+', ' × 10^')} km/s`,
    aus: `${fmt(v / KM_PER_AU, 2)} AU/s`,
    c: c === 0 ? '0 c' : c < 1e-4 ? `${c.toExponential(1)} c` : c < 1e6 ? `${fmt(c, 3)} c` : `${c.toExponential(2).replace('e+', ' × 10^')} c`,
    lys: v >= C_KM_S * 1e5 ? `${fmt(v / KM_PER_LY)} ly/s` : null,
    fasterThanLight: c > 1,
  }
}

/** A duration in seconds, in words. */
export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const s = Math.abs(seconds)
  if (s < 1) return 'under a second'
  if (s < 60) return `${Math.round(s)} s`
  if (s < 3600) return `${fmt(s / 60, 2)} min`
  if (s < 86400) return `${fmt(s / 3600, 2)} h`
  const days = s / 86400
  if (days < 365.25 * 2) return `${fmt(days, 3)} days`
  const years = days / 365.25
  if (years < 1e4) return `${fmt(years, 3)} years`
  if (years < 1e6) return `${fmt(years / 1e3, 3)} thousand years`
  if (years < 1e9) return `${fmt(years / 1e6, 3)} million years`
  return `${fmt(years / 1e9, 3)} billion years`
}

// --- Rendering -------------------------------------------------------------------

/**
 * Compressed render distance. Every object is drawn at R(d) along its true
 * direction and scaled by R/d: a uniform scale about the camera, so angular
 * sizes and directions are exact. Monotonic, so nearer stays in front.
 */
const R0 = 12
const RA = 110
const D0 = 1000
export const RENDER_FAR = 8000
export const renderDistance = (km) => R0 + RA * Math.log1p(Math.max(km, 0) / D0)

// --- Speed ---------------------------------------------------------------------

/** Cruise speed is set on a log scale: 10^0 km/s up to 10^21 km/s. */
export const SPEED_LOG = { min: 0, max: 21, initial: 4 }
export const speedFromLog = (log) => 10 ** log
export const BOOST = 10

// --- Coordinates ------------------------------------------------------------------

// J2000 obliquity of the ecliptic (IAU 1976 value, the one J2000 is defined with).
const OBLIQUITY = 23.4392911 * DEG
// Equatorial J2000 to galactic (Hipparcos, ESA 1997, vol. 1 §1.5.3).
const EQ_TO_GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
]

/** Equatorial J2000 vector to the world frame (galactic, Y up). */
export function equatorialToWorld(x, y, z, out = [0, 0, 0]) {
  const gx = EQ_TO_GAL[0][0] * x + EQ_TO_GAL[0][1] * y + EQ_TO_GAL[0][2] * z
  const gy = EQ_TO_GAL[1][0] * x + EQ_TO_GAL[1][1] * y + EQ_TO_GAL[1][2] * z
  const gz = EQ_TO_GAL[2][0] * x + EQ_TO_GAL[2][1] * y + EQ_TO_GAL[2][2] * z
  out[0] = gx
  out[1] = gz
  out[2] = -gy
  return out
}

/** Ecliptic J2000 vector (any unit) to the world frame, same unit. */
export function eclipticToWorld(x, y, z, out = [0, 0, 0]) {
  const c = Math.cos(OBLIQUITY)
  const s = Math.sin(OBLIQUITY)
  return equatorialToWorld(x, y * c - z * s, y * s + z * c, out)
}

/** Right ascension and declination (deg) at a distance (km) to the world frame. */
export function raDecToWorld(raDeg, decDeg, km, out = [0, 0, 0]) {
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  equatorialToWorld(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec), out)
  out[0] *= km
  out[1] *= km
  out[2] *= km
  return out
}

/** Galactic longitude and latitude (deg) of a world-frame direction. */
export function galacticAngles(dx, dy, dz) {
  const r = Math.hypot(dx, dy, dz) || 1
  const l = (Math.atan2(-dz, dx) / DEG + 360) % 360
  return { l, b: Math.asin(Math.max(-1, Math.min(1, dy / r))) / DEG }
}

// --- Autopilot -------------------------------------------------------------------

/**
 * Autopilot moves in log-distance, so a trip of ten orders of magnitude is
 * not ten times as long as one: about 3 s plus 0.7 s per decade, capped.
 */
export function autopilotDuration(startKm, stopKm) {
  const decades = Math.abs(Math.log10(Math.max(startKm, 1) / Math.max(stopKm, 1)))
  return Math.min(22, 3 + decades * 0.7)
}

const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10)

/** Distance to the target at progress t ∈ [0, 1]: eased in log space. */
export function autopilotDistance(startKm, stopKm, t) {
  const k = smooth(Math.min(1, Math.max(0, t)))
  return Math.exp(Math.log(startKm) + (Math.log(stopKm) - Math.log(startKm)) * k)
}

// --- Procedural field stars -------------------------------------------------------------

/** Small, fast, deterministic PRNG (mulberry32). */
export function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const cellSeed = (ix, iy, iz, tier) =>
  (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791) ^ Math.imul(tier + 1, 2654435761)) >>> 0

/**
 * Relative star density of the Milky Way model at a point (ly from the Sun):
 * an exponential disc with the scale length, thickness and radius of the
 * model in galaxies.js, normalised to 1 at the Sun. A model, not a survey.
 */
export function diskDensity(xLy, yLy, zLy, disc) {
  const R = Math.hypot(xLy - disc.centreLy, zLy)
  if (R > disc.radiusLy * 1.15) return 0
  const radial = Math.exp(-(R - disc.sunRLy) / disc.scaleLengthLy)
  const vertical = Math.exp(-Math.abs(yLy) / disc.scaleHeightLy)
  const edge = R > disc.radiusLy ? 1 - (R - disc.radiusLy) / (disc.radiusLy * 0.15) : 1
  return radial * vertical * edge
}

/**
 * Stars in one cell of a procedural tier, deterministic for (cell, tier).
 * Each star: position (ly), absolute magnitude and temperature (K).
 */
export function cellStars(ix, iy, iz, tier, disc, keepOut = null) {
  const cx = (ix + 0.5) * tier.cellLy
  const cy = (iy + 0.5) * tier.cellLy
  const cz = (iz + 0.5) * tier.cellLy
  const expected = tier.perCell * diskDensity(cx, cy, cz, disc)
  if (expected <= 0) return []
  const random = prng(cellSeed(ix, iy, iz, tier.id))
  let count = Math.floor(expected)
  if (random() < expected - count) count += 1
  const stars = []
  for (let k = 0; k < count; k += 1) {
    const x = (ix + random()) * tier.cellLy
    const y = (iy + random()) * tier.cellLy
    const z = (iz + random()) * tier.cellLy
    const roll = random()
    if (keepOut && keepOut(x, y, z)) continue
    // A rough luminosity mix: many dim red stars, fewer bright hot ones.
    const temperature = roll < 0.6 ? 3200 + random() * 1800 : roll < 0.9 ? 5000 + random() * 2500 : 7500 + random() * 16000
    const absMag = tier.magMin + random() ** 0.6 * (tier.magMax - tier.magMin)
    stars.push({ x, y, z, absMag, temperature })
  }
  return stars
}

const TEN_PC_LY = (10 * KM_PER_PC) / KM_PER_LY

/** Apparent magnitude of a star of absolute magnitude M at d light-years. */
export const apparentMagnitude = (absMag, ly) => absMag + 5 * Math.log10(Math.max(ly, 1e-12) / TEN_PC_LY)
/** Absolute magnitude from apparent magnitude seen at d light-years. */
export const absoluteMagnitude = (mag, ly) => mag - 5 * Math.log10(Math.max(ly, 1e-12) / TEN_PC_LY)

// IAU 2015 Resolution B2: nominal solar luminosity and the zero point of the
// bolometric magnitude scale (both defined values).
const L_SUN_W = 3.828e26
const L_ZERO_W = 3.0128e28
/** Bolometric absolute magnitude from radius (Suns) and temperature (K), by Stefan–Boltzmann. */
export function magnitudeFromStar(radiusSun, temperatureK, sunTemperatureK) {
  const luminosity = L_SUN_W * radiusSun ** 2 * (temperatureK / sunTemperatureK) ** 4
  return -2.5 * Math.log10(luminosity / L_ZERO_W)
}
export const SUN_ABS_MAG = -2.5 * Math.log10(L_SUN_W / L_ZERO_W)
/** Inverse of magnitudeFromStar: the radius (in Suns) a star of this absolute magnitude and temperature has. */
export const radiusFromMagnitude = (absMag, temperatureK, sunTemperatureK) =>
  10 ** (-0.2 * (absMag - SUN_ABS_MAG)) * (sunTemperatureK / temperatureK) ** 2
