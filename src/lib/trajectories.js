import data from '../data/catalogue/trajectories.json' with { type: 'json' }
import orbits from '../data/catalogue/orbits.json' with { type: 'json' }
import { planetPosition } from './orbits.js'
import { educationalPeriod, radiusFromAu } from '../data/solarBodies.js'

/**
 * Spacecraft positions from JPL Horizons: heliocentric ecliptic (J2000)
 * vectors in AU, sampled every 1–30 days (`npm run orbits`). Between samples
 * the position is interpolated as a smooth curve in distance, longitude and
 * latitude, which keeps Parker Solar Probe on a curved path round the Sun
 * even where it sweeps through a large angle in a single day.
 *
 * These are ephemerides — reconstructed and planned trajectories — for the
 * simulated date. They are not live tracking.
 */
export const TRAJECTORY_RETRIEVED = data.retrieved
const AU_KM = 149597870.7
const C_KM_S = 299792.458

const tracks = new Map()

function track(id) {
  if (tracks.has(id)) return tracks.get(id)
  const samples = data.spacecraft[id]?.samples
  if (!samples) return null
  // Spherical form, longitude unwrapped so it never jumps by a full turn.
  const jd = samples.map((s) => s[0])
  const logR = []
  const lon = []
  const lat = []
  let previous = null
  for (const [, x, y, z] of samples) {
    const r = Math.hypot(x, y, z)
    let l = Math.atan2(y, x)
    if (previous != null) l += Math.round((previous - l) / (Math.PI * 2)) * Math.PI * 2
    previous = l
    logR.push(Math.log(r))
    lon.push(l)
    lat.push(Math.asin(z / r))
  }
  const result = { id, jd, logR, lon, lat, start: jd[0], end: jd[jd.length - 1] }
  tracks.set(id, result)
  return result
}

/** First and last Julian date with data, or null. */
export function trajectoryRange(id) {
  const t = track(id)
  return t ? [t.start, t.end] : null
}

// Cubic Hermite through unevenly spaced samples, tangents from the neighbours.
function spline(values, times, i, u) {
  const p0 = values[Math.max(i - 1, 0)]
  const p1 = values[i]
  const p2 = values[i + 1]
  const p3 = values[Math.min(i + 2, values.length - 1)]
  const t0 = times[Math.max(i - 1, 0)]
  const t1 = times[i]
  const t2 = times[i + 1]
  const t3 = times[Math.min(i + 2, times.length - 1)]
  const h = t2 - t1
  const m1 = t2 > t0 ? ((p2 - p0) / (t2 - t0)) * h : p2 - p1
  const m2 = t3 > t1 ? ((p3 - p1) / (t3 - t1)) * h : p2 - p1
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2
}

// Parker has flown one fixed orbit since its last Venus flyby (November
// 2024), so between daily samples it follows two-body motion closely. A
// spline alone would cut the corner at perihelion, where it turns through
// over 100° in a day, and miss the closest approach by a million km.
const KEPLER_TRACKS = new Set(['parker-solar-probe'])
const TWO_PI = Math.PI * 2

/**
 * Ellipse fitted to a track: plane from the samples' angular momentum,
 * semi-major axis from the period (Kepler's third law), eccentricity from
 * the aphelion distance (slow, so well sampled), and the perihelion
 * direction from samples well away from perihelion.
 */
function keplerFit(t, samples) {
  const period = trajectoryPeriod(t.id)
  if (!period) return null
  const h = [0, 0, 0]
  for (let k = 0; k < samples.length - 1; k += 1) {
    const [, x1, y1, z1] = samples[k]
    const [, x2, y2, z2] = samples[k + 1]
    h[0] += y1 * z2 - z1 * y2
    h[1] += z1 * x2 - x1 * z2
    h[2] += x1 * y2 - y1 * x2
  }
  const hn = Math.hypot(...h)
  const n = h.map((v) => v / hn)
  // In-plane basis: P along the ascending node, Q = n × P.
  const pn = Math.hypot(n[1], n[0])
  const P = [-n[1] / pn, n[0] / pn, 0]
  const Q = [n[1] * P[2] - n[2] * P[1], n[2] * P[0] - n[0] * P[2], n[0] * P[1] - n[1] * P[0]]
  const a = Math.pow(period / 365.25, 2 / 3)
  const rMax = Math.max(...t.logR.map(Math.exp))
  const e = rMax / a - 1
  const semi = a * (1 - e * e)
  const theta = samples.map(([, x, y, z]) => Math.atan2(x * Q[0] + y * Q[1] + z * Q[2], x * P[0] + y * P[1] + z * P[2]))
  let sx = 0
  let sy = 0
  for (let k = 1; k < samples.length - 1; k += 1) {
    const r = Math.exp(t.logR[k])
    if (r < a) continue
    const nu = Math.acos(Math.max(-1, Math.min(1, (semi / r - 1) / e)))
    const outbound = t.logR[k + 1] > t.logR[k - 1]
    const peri = theta[k] - (outbound ? nu : -nu)
    sx += Math.cos(peri)
    sy += Math.sin(peri)
  }
  return { a, e, semi, P, Q, theta, peri: Math.atan2(sy, sx) }
}

const wrap = (x) => ((x % TWO_PI) + TWO_PI) % TWO_PI
function meanFromTrue(nu, e) {
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2))
  return wrap(E - e * Math.sin(E))
}
function trueFromMean(M, e) {
  let E = e > 0.8 ? Math.PI : M
  for (let k = 0; k < 30; k += 1) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-12) break
  }
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
}

function keplerPosition(fit, i, u, out) {
  const { e, semi, P, Q, theta, peri } = fit
  const M1 = meanFromTrue(wrap(theta[i] - peri), e)
  let M2 = meanFromTrue(wrap(theta[i + 1] - peri), e)
  if (M2 < M1) M2 += TWO_PI
  const nu = trueFromMean(wrap(M1 + u * (M2 - M1)), e)
  const r = semi / (1 + e * Math.cos(nu))
  const c = Math.cos(peri + nu)
  const s = Math.sin(peri + nu)
  for (let k = 0; k < 3; k += 1) out[k] = r * (c * P[k] + s * Q[k])
  return out
}

/**
 * Heliocentric ecliptic position (AU) at `jd` into `out`, or null when the
 * date is outside the downloaded ephemeris.
 */
export function trajectoryPosition(id, jd, out = [0, 0, 0]) {
  const t = track(id)
  if (!t || jd < t.start || jd > t.end) return null
  let lo = 0
  let hi = t.jd.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t.jd[mid] <= jd) lo = mid
    else hi = mid
  }
  const i = Math.min(lo, t.jd.length - 2)
  const u = (jd - t.jd[i]) / (t.jd[i + 1] - t.jd[i])
  if (t.kepler === undefined) t.kepler = KEPLER_TRACKS.has(id) ? keplerFit(t, data.spacecraft[id].samples) : null
  if (t.kepler) return keplerPosition(t.kepler, i, u, out)
  const r = Math.exp(spline(t.logR, t.jd, i, u))
  const l = spline(t.lon, t.jd, i, u)
  const b = spline(t.lat, t.jd, i, u)
  out[0] = r * Math.cos(b) * Math.cos(l)
  out[1] = r * Math.cos(b) * Math.sin(l)
  out[2] = r * Math.sin(b)
  return out
}

/**
 * Mean time between perihelia in the samples (days), for a craft on a
 * repeating orbit such as Parker's; null if fewer than two are sampled.
 */
export function trajectoryPeriod(id) {
  const t = track(id)
  if (!t) return null
  const minima = []
  for (let k = 1; k < t.logR.length - 1; k += 1) {
    if (t.logR[k] < t.logR[k - 1] && t.logR[k] <= t.logR[k + 1]) minima.push(t.jd[k])
  }
  if (minima.length < 2) return null
  return (minima[minima.length - 1] - minima[0]) / (minima.length - 1)
}

// Educational pace for a repeating orbit (days per simulated second): the
// same compressed Kepler law that sets the comets' and asteroids' periods.
const paces = new Map()
function educationalPace(id) {
  if (paces.has(id)) return paces.get(id)
  const period = trajectoryPeriod(id)
  const range = trajectoryRange(id)
  let pace = 0
  if (period && range) {
    const p = [0, 0, 0]
    let rMin = Infinity
    let rMax = 0
    for (let jd = range[0]; jd < range[0] + period; jd += 0.25) {
      trajectoryPosition(id, jd, p)
      const r = Math.hypot(p[0], p[1], p[2])
      rMin = Math.min(rMin, r)
      rMax = Math.max(rMax, r)
    }
    pace = period / educationalPeriod(radiusFromAu((rMin + rMax) / 2))
  }
  paces.set(id, pace)
  return pace
}

/**
 * Julian date a probe is shown for. Real dates: the simulated date. In
 * educational mode a probe leaving the solar system stays at today's
 * position (it moves a few AU a year), while one on a repeating orbit
 * (`loops`, Parker's) runs whole orbits of its data at the compressed pace.
 */
export function probeJd(id, { mode, jd, t }, now, loops = false) {
  if (mode === 'real') return jd
  if (!loops) return now
  const range = trajectoryRange(id)
  const period = trajectoryPeriod(id)
  const pace = educationalPace(id)
  if (!range || !period || !pace) return now
  const loop = Math.floor((range[1] - range[0]) / period) * period
  if (loop <= 0) return now
  const offset = now - range[0] + t * pace
  return range[0] + (((offset % loop) + loop) % loop)
}

/** Distances for the panel at `jd`: from the Sun and from Earth (AU), and the one-way light time (hours). */
export function probeDistances(id, jd) {
  const p = trajectoryPosition(id, jd)
  if (!p) return null
  const e = planetPosition(orbits.planets.earth, jd)
  const sun = Math.hypot(p[0], p[1], p[2])
  const earth = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2])
  return { sun, earth, lightHours: (earth * AU_KM) / C_KM_S / 3600 }
}
