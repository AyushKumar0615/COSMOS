/**
 * Orbital mechanics for the solar system scene: Kepler's equation, JPL's
 * approximate planetary elements, small-body and moon elements, and the
 * mapping from real distances to the scene's compressed radii.
 *
 * Pure functions over plain numbers, so they run in tests without a GPU.
 * Positions are heliocentric (or planetocentric) ecliptic J2000, in AU or km.
 */

export const J2000 = 2451545.0
const DEG = Math.PI / 180

export const julianDate = (ms) => ms / 86400000 + 2440587.5
export const dateFromJulian = (jd) => new Date((jd - 2440587.5) * 86400000)

const wrap = (deg) => ((deg % 360) + 540) % 360 - 180

/** Eccentric anomaly E (rad) for mean anomaly M (rad), by Newton's method. */
export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI * Math.sign(Math.sin(M) || 1)
  for (let k = 0; k < 40; k += 1) {
    const step = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= step
    if (Math.abs(step) < 1e-12) break
  }
  return E
}

/**
 * Position from classical elements: a (any unit), e, inclination, node and
 * argument of periapsis (deg), mean anomaly (deg). Returns [x, y, z] in the
 * reference plane of the elements, x towards the reference direction.
 */
export function positionFromElements(a, e, i, node, peri, M, out = [0, 0, 0]) {
  const E = solveKepler(wrap(M) * DEG, e)
  const xv = a * (Math.cos(E) - e)
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const v = Math.atan2(yv, xv)
  const r = Math.hypot(xv, yv)
  const O = node * DEG
  const w = peri * DEG
  const I = i * DEG
  const u = v + w
  out[0] = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(I))
  out[1] = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(I))
  out[2] = r * Math.sin(u) * Math.sin(I)
  return out
}

/**
 * Heliocentric ecliptic position (AU) of a planet at Julian date `jd`, from
 * JPL's Table 1 elements and rates (valid 1800–2050; for Earth, the
 * Earth–Moon barycentre).
 */
export function planetPosition(el, jd, out = [0, 0, 0]) {
  const T = (jd - J2000) / 36525
  const a = el.a + el.rates.a * T
  const e = el.e + el.rates.e * T
  const I = el.I + el.rates.I * T
  const L = el.L + el.rates.L * T
  const peri = el.peri + el.rates.peri * T
  const node = el.node + el.rates.node * T
  return positionFromElements(a, e, I, node, peri - node, L - peri, out)
}

/** Heliocentric ecliptic longitude of a planet (rad), for placing it on its circle. */
export function planetLongitude(el, jd) {
  const p = planetPosition(el, jd, scratch)
  return Math.atan2(p[1], p[0])
}
const scratch = [0, 0, 0]

/** Mean anomaly (deg) of a small body at `jd`, from its epoch elements. */
export function smallBodyMeanAnomaly(body, jd) {
  return body.M + (360 / body.periodDays) * (jd - body.epochJd)
}

/** Heliocentric ecliptic position (AU) of a small body at `jd`. */
export function smallBodyPosition(body, jd, out = [0, 0, 0]) {
  return positionFromElements(body.a, body.e, body.i, body.node, body.peri, smallBodyMeanAnomaly(body, jd), out)
}

/**
 * A moon's position relative to its planet, in the moon's own reference
 * plane (km): the ecliptic for Earth's Moon, the planet's equator or
 * Laplace plane for the rest. The node and periapsis precess at the rates
 * JPL lists, which is what makes eclipse seasons come and go.
 */
export function moonPosition(moon, orbitKm, eccentricity, jd, out = [0, 0, 0], sun = null) {
  const days = jd - J2000
  const years = days / 365.25
  const nodeTurns = moon.nodalYears ? -years / moon.nodalYears : 0
  const periTurns = moon.apsidalYears ? years / moon.apsidalYears : 0
  const node = moon.node + 360 * nodeTurns
  const peri = moon.w + 360 * periTurns
  // JPL's period is sidereal: it is the mean longitude (node + periapsis +
  // mean anomaly) that completes a turn in that time, so the mean anomaly
  // advances by what is left after the two precessions.
  const M = moon.M + (360 / moon.periodDays) * days - 360 * (nodeTurns + periTurns)
  positionFromElements(orbitKm, eccentricity ?? 0, moon.i, node, peri, M, out)
  return sun ? perturbMoon(out, moon, node, peri, M, sun, jd) : out
}

const sinD = (deg) => Math.sin(deg * DEG)

/**
 * The largest periodic terms in the Moon's motion (evection, variation,
 * annual equation and the rest of the low-precision series in Meeus,
 * Astronomical Algorithms, ch. 47, rounded to 0.01°). Mean elements alone
 * drift by over a degree, enough to miss eclipses. The Sun's mean longitude
 * and anomaly come from JPL's Earth elements, so no solar theory is typed in.
 */
function perturbMoon(out, moon, node, peri, M, earth, jd) {
  const T = (jd - J2000) / 36525
  const earthL = earth.L + earth.rates.L * T
  const earthPeri = earth.peri + earth.rates.peri * T
  const sunL = earthL + 180
  const Ms = earthL - earthPeri
  const Lm = node + peri + M
  const D = Lm - sunL
  const F = Lm - node
  const Mm = M
  const dLon =
    1.274 * sinD(2 * D - Mm) + 0.658 * sinD(2 * D) - 0.186 * sinD(Ms) - 0.059 * sinD(2 * Mm - 2 * D) -
    0.057 * sinD(Mm - 2 * D + Ms) + 0.053 * sinD(Mm + 2 * D) + 0.046 * sinD(2 * D - Ms) + 0.041 * sinD(Mm - Ms) -
    0.035 * sinD(D) - 0.031 * sinD(Mm + Ms) - 0.015 * sinD(2 * F - 2 * D) + 0.011 * sinD(Mm - 4 * D)
  const dLat =
    -0.173 * sinD(F - 2 * D) - 0.055 * sinD(Mm - F - 2 * D) - 0.046 * sinD(Mm + F - 2 * D) +
    0.033 * sinD(F + 2 * D) + 0.017 * sinD(2 * Mm + F)
  const r = Math.hypot(out[0], out[1], out[2])
  const lon = Math.atan2(out[1], out[0]) + dLon * DEG
  const lat = Math.asin(out[2] / r) + dLat * DEG
  out[0] = r * Math.cos(lat) * Math.cos(lon)
  out[1] = r * Math.cos(lat) * Math.sin(lon)
  out[2] = r * Math.sin(lat)
  return out
}

/**
 * Real distance from the Sun (AU) to the scene's compressed radius: piecewise
 * linear in log(distance) through the eight planets' (AU, scene radius)
 * pairs, extended at the same slope inside Mercury and beyond Neptune.
 * Monotonic, so the order of everything is kept.
 */
export function makeRadiusMap(pairs) {
  const sorted = [...pairs].sort((p, q) => p[0] - q[0]).map(([au, r]) => [Math.log(au), r])
  const segment = (i) => {
    const [x0, y0] = sorted[i]
    const [x1, y1] = sorted[i + 1]
    return [x0, y0, (y1 - y0) / (x1 - x0)]
  }
  return (au) => {
    const x = Math.log(Math.max(au, 1e-4))
    let i = 0
    while (i < sorted.length - 2 && x > sorted[i + 1][0]) i += 1
    const [x0, y0, slope] = segment(i)
    return Math.max(0, y0 + (x - x0) * slope)
  }
}

/**
 * Ecliptic (x, y, z) to the scene: the ecliptic is the scene's horizontal
 * plane, ecliptic north is up (+y), and longitude increases counter-clockwise
 * seen from above, as the planets move.
 */
export function eclipticToScene(x, y, z, out) {
  out[0] = x
  out[1] = z
  out[2] = -y
  return out
}

/** Angle between two directions given as arrays (rad). */
export function separation(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.min(1, Math.max(-1, dot / (Math.hypot(...a) * Math.hypot(...b)))))
}

/**
 * Real eclipse geometry, in km. `moon` is the moon's position relative to
 * its planet, `sunDir` the unit vector from the planet to the Sun, and
 * `sunKm` the planet's distance from the Sun. Returns whether the moon's
 * shadow touches the planet ("solar" eclipse seen from the planet), and
 * whether the moon is in the planet's penumbra or umbra ("lunar" eclipse).
 */
export function eclipseState(moon, sunDir, sunKm, planetRadiusKm, moonRadiusKm) {
  const SUN_RADIUS_KM = 695700
  const along = moon[0] * sunDir[0] + moon[1] * sunDir[1] + moon[2] * sunDir[2]
  const d = Math.hypot(moon[0], moon[1], moon[2])
  const miss = Math.sqrt(Math.max(0, d * d - along * along))
  if (along > 0) {
    // Moon sunward of the planet: its penumbra reaching the planet's disc.
    const penumbra = moonRadiusKm + along * (SUN_RADIUS_KM + moonRadiusKm) / sunKm
    return { solar: miss < planetRadiusKm + penumbra, lunar: null }
  }
  const behind = -along
  const umbra = planetRadiusKm - behind * (SUN_RADIUS_KM - planetRadiusKm) / sunKm
  const penumbra = planetRadiusKm + behind * (SUN_RADIUS_KM + planetRadiusKm) / sunKm
  const lunar = miss + moonRadiusKm < umbra ? 'total' : miss - moonRadiusKm < umbra ? 'partial' : miss - moonRadiusKm < penumbra ? 'penumbral' : null
  return { solar: false, lunar }
}
