import orbits from './catalogue/orbits.json' with { type: 'json' }
import { PLANETS, PLANETS_BY_ID, SUN } from './planets.js'
import { makeRadiusMap } from '../lib/orbits.js'

/**
 * Layout for everything in the solar system besides the Sun and planets:
 * moons, dwarf planets, asteroids and comets.
 *
 * Real values (orbits.json, from JPL) drive the facts, the angles and the
 * timing. The `sim` values only place things on screen: sizes and distances
 * are compressed, in the same spirit as the planets in planets.js, and are
 * never shown as data.
 */
export const ORBIT_DATA = orbits

// --- Distances -------------------------------------------------------------------

// IAU 2015 nominal solar radius (a defined constant, Resolution B3) in AU.
const SUN_RADIUS_AU = 695700 / 149597870.7

/**
 * Real distance from the Sun (AU) to the scene's compressed radius. The
 * Sun's surface is the last anchor inside Mercury, so a body grazing the
 * Sun, such as Parker Solar Probe, stays just outside the drawn Sun.
 */
export const radiusFromAu = makeRadiusMap([
  [SUN_RADIUS_AU, SUN.sim.radius],
  ...PLANETS.map((p) => [orbits.planets[p.id].a, p.sim.orbitRadius]),
])

const EARTH = PLANETS_BY_ID.earth

/**
 * Educational-mode period (simulated seconds) for an orbit of compressed
 * radius r: Kepler's third law on the compressed radii, scaled so Earth keeps
 * its period, exactly as planets.js derives the planets' periods.
 */
export const educationalPeriod = (simRadius) => EARTH.sim.orbitPeriod * Math.pow(simRadius / EARTH.sim.orbitRadius, 1.5)

/** Simulated seconds per real day in educational mode, for a body of real period P (days). */
export const daysPerSecond = (realPeriodDays, simPeriodSeconds) => realPeriodDays / simPeriodSeconds

// --- Moons ------------------------------------------------------------------------

/**
 * Each planet's moons are spread between an inner and an outer radius
 * (in planet radii) on a logarithmic scale, which keeps their order and
 * relative spacing while fitting them between the planets' compressed
 * orbits. Saturn's moons start beyond the F ring, Uranus's beyond its rings.
 */
const MOON_RANGE = {
  earth: [4, 4],
  mars: [1.9, 3.2],
  jupiter: [1.35, 2.15],
  saturn: [2.65, 3.7],
  uranus: [2.35, 4.3],
  neptune: [3.1, 3.1],
}

const hostRadiusKm = (host) => orbits.planets[host]?.radiusKm ?? (host === 'pluto' ? orbits.small.pluto.radiusKm : null)
const hostDayDays = (host) => Math.abs(orbits.planets[host]?.rotationDays ?? 6.387)

function hostSim(host) {
  if (PLANETS_BY_ID[host]) return PLANETS_BY_ID[host].sim
  return { radius: DWARF_SIZE.pluto, rotationSpeed: (Math.PI * 2) / 20 }
}

// Moon size relative to its planet, softened (exponent 0.6) so the
// smallest are visible, with a floor of a few pixels when framed.
const moonSize = (radiusKm, host) => Math.max(0.014, hostSim(host).radius * Math.pow(radiusKm / hostRadiusKm(host), 0.6))

const NAMES = { moon: 'Moon' }
const nameOf = (id) => NAMES[id] ?? id[0].toUpperCase() + id.slice(1)

function buildMoons() {
  const byHost = {}
  for (const [id, m] of Object.entries(orbits.moons)) (byHost[m.planet] ??= []).push([id, m])
  const out = []
  for (const [host, list] of Object.entries(byHost)) {
    if (host === 'pluto') continue
    const R = hostRadiusKm(host)
    const ln = list.map(([, m]) => Math.log(m.orbitKm / R))
    const lo = Math.min(...ln)
    const hi = Math.max(...ln)
    const [inner, outer] = MOON_RANGE[host]
    const sim = hostSim(host)
    const hostDaySim = (Math.PI * 2) / Math.abs(sim.rotationSpeed)
    list.forEach(([id, m], k) => {
      const f = hi > lo ? (ln[k] - lo) / (hi - lo) : 0
      out.push({
        id,
        name: nameOf(id),
        host,
        elements: m,
        retrograde: m.i > 90,
        sim: {
          size: moonSize(m.radiusKm, host),
          orbit: sim.radius * (inner + (outer - inner) * f),
          // Real ordering, compressed: the host's simulated day scaled by
          // (period / host day)^0.4, the same law the spacecraft use.
          period: hostDaySim * Math.pow(m.periodDays / hostDayDays(host), 0.4),
        },
      })
    })
  }
  return out
}

// --- Dwarf planets, asteroids, comets ------------------------------------------------

/** Compressed size for a small body: Earth's sim radius times (r / R_earth)^0.6. */
const sizeFromKm = (radiusKm, min) => Math.max(min, EARTH.sim.radius * Math.pow(radiusKm / 6371.0084, 0.6))

const DWARF_SIZE = {
  pluto: sizeFromKm(orbits.small.pluto.radiusKm, 0.05),
}

export const SMALL_KIND = {
  ceres: 'dwarf',
  pluto: 'dwarf',
  haumea: 'dwarf',
  makemake: 'dwarf',
  eris: 'dwarf',
  vesta: 'asteroid',
  pallas: 'asteroid',
  hygiea: 'asteroid',
  eros: 'near-earth',
  bennu: 'near-earth',
  apophis: 'near-earth',
  halley: 'comet',
  encke: 'comet',
  'churyumov-gerasimenko': 'comet',
  'swift-tuttle': 'comet',
  'hale-bopp': 'comet',
}

const SMALL_NAMES = {
  'churyumov-gerasimenko': '67P/Churyumov–Gerasimenko',
  'swift-tuttle': '109P/Swift–Tuttle',
  'hale-bopp': 'C/1995 O1 (Hale–Bopp)',
  halley: '1P/Halley',
  encke: '2P/Encke',
}

function buildSmall() {
  return Object.entries(orbits.small).map(([id, b]) => {
    const kind = SMALL_KIND[id]
    const radiusKm = b.radiusKm ?? (b.diameterKm ? b.diameterKm / 2 : null)
    const q = radiusFromAu(b.q)
    const Q = radiusFromAu(b.Q ?? b.q)
    const size =
      kind === 'dwarf' ? sizeFromKm(radiusKm ?? 500, 0.045) : kind === 'asteroid' ? 0.03 : kind === 'near-earth' ? 0.018 : 0.02
    return {
      id,
      name: SMALL_NAMES[id] ?? nameOf(id),
      kind,
      elements: b,
      radiusKm,
      sim: {
        size,
        // Educational period from the compressed orbit's mean radius.
        period: educationalPeriod((q + Q) / 2),
      },
    }
  })
}

export const MOONS = buildMoons()
export const MOONS_BY_ID = Object.fromEntries(MOONS.map((m) => [m.id, m]))
export const SMALL_BODIES = buildSmall()
export const SMALL_BY_ID = Object.fromEntries(SMALL_BODIES.map((b) => [b.id, b]))

/**
 * Pluto and Charon orbit a point between them that lies outside Pluto.
 * The separation is compressed; the barycentre's offset from Pluto keeps its
 * real value in Pluto radii (mass ratio from JPL's GM values), so it really
 * does sit in space between the two.
 */
export const PLUTO_SYSTEM = (() => {
  const pluto = orbits.small.pluto
  const charon = orbits.moons.charon
  const G = 6.6743e-20 // km^3 kg^-1 s^-2
  const plutoGm = pluto.massE24Kg * 1e24 * G
  const fraction = pluto.charonGm / (plutoGm + pluto.charonGm)
  const plutoSize = SMALL_BY_ID.pluto.sim.size
  const plutoOffset = (fraction * charon.orbitKm) / pluto.radiusKm * plutoSize
  return {
    charon: {
      id: 'charon',
      name: 'Charon',
      host: 'pluto',
      elements: charon,
      sim: {
        size: Math.max(0.02, plutoSize * Math.pow(charon.radiusKm / pluto.radiusKm, 0.75)),
        separation: plutoSize * 5,
        // Mutually tidally locked: Charon's orbit equals Pluto's day.
        period: 16,
      },
    },
    plutoOffset,
    massFraction: fraction,
  }
})()

/** Every selectable id in the solar system beyond the planets and spacecraft. */
export const SOLAR_EXTRA_IDS = [...MOONS.map((m) => m.id), 'charon', ...SMALL_BODIES.map((b) => b.id)]

/** Framing radius for the camera. */
export function extraFramingRadius(id) {
  if (id === 'charon') return PLUTO_SYSTEM.charon.sim.size
  return MOONS_BY_ID[id]?.sim.size ?? SMALL_BY_ID[id]?.sim.size ?? null
}
