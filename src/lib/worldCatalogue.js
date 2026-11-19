import { CATALOGUE, CATALOGUE_BY_ID, OBJECT_TYPES } from '../data/catalogue/index.js'
import { ORBIT_DATA, MOONS, SMALL_BODIES } from '../data/solarBodies.js'
import { PLANETS_BY_ID } from '../data/planets.js'
import { GALAXIES_BY_ID } from '../data/galaxies.js'
import { NEBULAE_BY_ID } from '../data/nebulae.js'
import { BLACK_HOLES } from '../data/blackholes.js'
import { SATELLITES, isProbe } from '../data/satellites.js'
import { propagate, twoline2satrec } from 'satellite.js'
import { julianDate, moonPosition, planetPosition, smallBodyPosition } from './orbits.js'
import EXTRAS from '../data/catalogue/extras.json' with { type: 'json' }
import { trajectoryPosition, trajectoryRange } from './trajectories.js'
import { starLook } from './bodyVisuals.js'
import {
  C_KM_S,
  KM_PER_AU,
  KM_PER_LY,
  SUN_ABS_MAG,
  absoluteMagnitude,
  eclipticToWorld,
  equatorialToWorld,
  magnitudeFromStar,
  radiusFromMagnitude,
  prng,
  raDecToWorld,
} from './openWorld.js'

/**
 * Everything in the open universe, in one list, positioned in the world
 * frame (galactic, km). Built from the catalogue and JPL data; nothing here is
 * typed in by hand. Where a size or position is not measured, the object is
 * still drawn, but `sizeNote` / `positionNote` says so and the HUD labels it.
 */

const SUN_RADIUS_KM = 695700
const SUN_TEFF = CATALOGUE_BY_ID.sun.temperatureK
// IAU 2015 Resolution B3 nominal solar mass parameter (m^3/s^2), for horizon sizes.
const GM_SUN = 1.3271244e20
const schwarzschildKm = (massSuns) => (2 * GM_SUN * massSuns) / (C_KM_S * 1000) ** 2 / 1000

export const TYPE_LOOK = {
  ...OBJECT_TYPES,
  small: { label: 'Asteroids and comets', one: 'Small body', color: '#b9b0a2' },
  spacecraft: { label: 'Spacecraft', one: 'Spacecraft', color: '#7ef0c8' },
}

const MODEL_SIZE = 'Size drawn is a model: no measured size in the catalogue.'
const INFERRED_SIZE = 'Size inferred from the measured magnitude, distance and temperature (Stefan–Boltzmann, no bolometric correction): approximate.'
const lookOf = (type) => TYPE_LOOK[type] ?? TYPE_LOOK.star

// --- Sizes ----------------------------------------------------------------------

/** Nebula size from its published "Size" fact, e.g. "About 24 light-years across". */
function nebulaSize(id) {
  const fact = NEBULAE_BY_ID[id]?.facts?.find((f) => /size|diameter/i.test(f.label))
  const match = fact?.value.match(/([\d,.]+)\s*light-years/)
  return match ? { radiusLy: Number(match[1].replace(/,/g, '')) / 2, text: fact.value } : null
}

// --- Builders ------------------------------------------------------------------------

function base(entry, extra) {
  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    klass: entry.class,
    entry,
    pos: [0, 0, 0],
    color: lookOf(entry.type).color,
    sizeNote: null,
    positionNote: null,
    parent: null,
    ...extra,
  }
}

function starObject(entry, posKm) {
  const look = starLook(entry)
  const measuredRadius = entry.radiusKm
  // Brightness: measured magnitude and distance first, else Stefan–Boltzmann.
  let absMag = entry.magnitude != null && entry.distanceLy ? absoluteMagnitude(entry.magnitude, entry.distanceLy) : null
  if (absMag == null && measuredRadius && entry.temperatureK) absMag = magnitudeFromStar(measuredRadius / SUN_RADIUS_KM, entry.temperatureK, SUN_TEFF)
  // No measured radius: infer one from the measured brightness, distance and
  // temperature (Stefan–Boltzmann). Visual magnitudes with no bolometric
  // correction, so cool giants come out smaller than they are.
  const inferred = !measuredRadius && entry.magnitude != null && entry.distanceLy && entry.temperatureK ? radiusFromMagnitude(absMag, entry.temperatureK, SUN_TEFF) : null
  return base(entry, {
    pos: posKm,
    radiusKm: measuredRadius ?? (inferred ? inferred * SUN_RADIUS_KM : SUN_RADIUS_KM * look.relative),
    sizeNote: measuredRadius ? null : inferred ? INFERRED_SIZE : MODEL_SIZE,
    temperature: look.temperature,
    absMag: absMag ?? 2,
    render: 'star',
    pulsar: look.pulsar,
  })
}

function deepObject(entry, posKm) {
  const type = entry.type
  if (type === 'galaxy') {
    const model = GALAXIES_BY_ID[entry.explorer?.id]?.model
    return base(entry, {
      pos: posKm,
      radiusKm: model ? model.radius * 1000 * KM_PER_LY : 20000 * KM_PER_LY,
      sizeNote: 'Size from the galaxy explorer’s model (1 unit = 1,000 light-years).',
      render: 'galaxy',
      modelId: model ? entry.explorer.id : null,
    })
  }
  if (type === 'nebula') {
    const size = nebulaSize(entry.explorer?.id ?? entry.id)
    return base(entry, {
      pos: posKm,
      radiusKm: (size?.radiusLy ?? 10) * KM_PER_LY,
      sizeNote: size ? `Drawn at its published size: ${size.text.charAt(0).toLowerCase()}${size.text.slice(1)}. Shape is a model.` : MODEL_SIZE,
      render: 'nebula',
      modelId: entry.explorer?.id ?? null,
    })
  }
  if (type === 'cluster') {
    const globular = /Globular/.test(entry.class)
    return base(entry, { pos: posKm, radiusKm: (globular ? 60 : 12) * KM_PER_LY, sizeNote: MODEL_SIZE, render: 'cluster' })
  }
  // Black holes: the event horizon from the mass, a defined constant and c.
  const hole = BLACK_HOLES.find((h) => h.id === (entry.explorer?.id ?? entry.id))
  const rs = hole?.massSuns ? schwarzschildKm(hole.massSuns) : null
  return base(entry, {
    pos: posKm,
    radiusKm: rs ?? 30,
    horizon: rs != null,
    sizeNote: rs ? 'Event horizon radius from the mass (2GM/c²).' : MODEL_SIZE,
    render: 'blackhole',
  })
}

/** A host star known only from its planets' archive rows. */
function hostObject(systemId, planet, posKm) {
  const radiusSun = planet.hostRadiusSun
  return {
    id: systemId,
    name: planet.host,
    type: 'star',
    klass: `Star${planet.hostType ? ` · ${planet.hostType}` : ''} · exoplanet host`,
    entry: {
      id: systemId,
      name: planet.host,
      type: 'star',
      class: 'Exoplanet host star',
      note: `Host star of ${planet.name} and any siblings listed in the NASA Exoplanet Archive.`,
      distanceLy: planet.distanceLy,
      radiusKm: radiusSun ? radiusSun * SUN_RADIUS_KM : null,
      temperatureK: planet.hostTeffK,
      spectralType: planet.hostType,
      sources: planet.sources,
    },
    pos: posKm,
    color: lookOf('star').color,
    radiusKm: (radiusSun ?? 1) * SUN_RADIUS_KM,
    sizeNote: radiusSun ? null : MODEL_SIZE,
    positionNote: null,
    temperature: planet.hostTeffK ?? 5000,
    absMag: magnitudeFromStar(radiusSun ?? 1, planet.hostTeffK ?? 5000, SUN_TEFF),
    render: 'star',
    parent: null,
  }
}

// --- Solar system, moved with the date ---------------------------------------------

const scratch = [0, 0, 0]

function atAu(au, out) {
  eclipticToWorld(au[0] * KM_PER_AU, au[1] * KM_PER_AU, au[2] * KM_PER_AU, out)
  return out
}

// SGP4 from a fresh TLE stays within a few km for days; the error grows with
// the TLE's age (drag), so nothing is shown beyond this window.
export const ORBITER_DAYS = 14

const satrecs = new Map()
function satrecFor(el) {
  if (!satrecs.has(el.id)) satrecs.set(el.id, twoline2satrec(el.line1, el.line2))
  return satrecs.get(el.id)
}
export const orbiterEpochJd = (el) => {
  const rec = satrecFor(el)
  return rec.jdsatepoch + (rec.jdsatepochF ?? 0)
}

/** Earth-orbit spacecraft whose TLE is within ORBITER_DAYS of `jd`. */
export const orbitersFor = (jd) => EXTRAS.orbiters.filter((el) => Math.abs(jd - orbiterEpochJd(el)) <= ORBITER_DAYS)

/**
 * Precession from the mean equator and equinox of date to J2000 (IAU 1976,
 * Lieske et al.): the transpose of P(T). SGP4's TEME frame differs from mean
 * of date only by nutation, under 1 km in low Earth orbit.
 */
export function precessToJ2000(v, jd, out = [0, 0, 0]) {
  const T = (jd - 2451545) / 36525
  const as = Math.PI / (180 * 3600)
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as
  const [cz, sz, cZ, sZ, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(th), Math.sin(th)]
  const P = [
    [cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ],
    [cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ],
    [cz * st, -sz * st, ct],
  ]
  const [x, y, w] = v
  out[0] = P[0][0] * x + P[1][0] * y + P[2][0] * w
  out[1] = P[0][1] * x + P[1][1] * y + P[2][1] * w
  out[2] = P[0][2] * x + P[1][2] * y + P[2][2] * w
  return out
}

/** Geocentric J2000 equatorial position (km) by SGP4 at `jd` (UTC); null if SGP4 fails. */
export function orbiterPosition(el, jd, out = [0, 0, 0]) {
  const result = propagate(satrecFor(el), new Date((jd - 2440587.5) * 86400000))
  const p = result?.position
  if (!p || typeof p === 'boolean') return null
  // shortcut: precession takes UTC for TT (about a minute apart); negligible here.
  return precessToJ2000([p.x, p.y, p.z], jd, out)
}

/** Tilt a moon's equatorial orbit by its planet's obliquity, about the ecliptic X axis. */
function tiltOrbit(v, tiltDeg) {
  // shortcut: JPL gives Laplace/equatorial frames, but the planets' pole
  // directions are not in our data, so the plane is tilted by the obliquity
  // only. Good to a few degrees for most moons; add IAU pole RA/Dec to fix.
  const t = (tiltDeg * Math.PI) / 180
  const y = v[1] * Math.cos(t) - v[2] * Math.sin(t)
  const z = v[1] * Math.sin(t) + v[2] * Math.cos(t)
  v[1] = y
  v[2] = z
  return v
}

function solarObjects() {
  const out = []
  const sun = CATALOGUE_BY_ID.sun
  out.push({ ...starObject(sun, [0, 0, 0]), absMag: SUN_ABS_MAG, temperature: SUN_TEFF, system: 'sol' })
  const planets = {}
  for (const entry of CATALOGUE.filter((e) => e.type === 'planet')) {
    const el = ORBIT_DATA.planets[entry.id]
    const obj = base(entry, {
      radiusKm: entry.radiusKm,
      render: 'body',
      update(jd, pos) {
        atAu(planetPosition(el, jd, scratch), pos)
      },
    })
    planets[entry.id] = obj
    out.push(obj)
  }
  for (const entry of CATALOGUE.filter((e) => e.type === 'dwarf')) {
    const el = ORBIT_DATA.small[entry.id]
    const obj = base(entry, {
      radiusKm: entry.radiusKm ?? 300,
      sizeNote: entry.radiusKm ? null : MODEL_SIZE,
      render: 'body',
      update(jd, pos) {
        atAu(smallBodyPosition(el, jd, scratch), pos)
      },
    })
    planets[entry.id] = obj
    out.push(obj)
  }
  const earth = ORBIT_DATA.planets.earth
  for (const moon of [...MOONS, { id: 'charon', host: 'pluto', elements: ORBIT_DATA.moons.charon }]) {
    const entry = CATALOGUE_BY_ID[moon.id]
    const host = planets[moon.host]
    if (!entry || !host) continue
    const el = moon.elements
    const tilt = el.frame === 'ecliptic' ? 0 : PLANETS_BY_ID[moon.host]?.sim.tilt ?? 0
    out.push(
      base(entry, {
        radiusKm: entry.radiusKm,
        parent: host.id,
        positionNote: tilt ? 'Orbit plane approximate: tilted by the planet’s obliquity only.' : null,
        render: 'body',
        update(jd, pos) {
          const rel = moonPosition(el, el.orbitKm, el.eccentricity, jd, [0, 0, 0], moon.id === 'moon' ? earth : null)
          tiltOrbit(rel, tilt)
          eclipticToWorld(rel[0], rel[1], rel[2], rel)
          pos[0] = host.pos[0] + rel[0]
          pos[1] = host.pos[1] + rel[1]
          pos[2] = host.pos[2] + rel[2]
        },
      }),
    )
  }
  for (const body of SMALL_BODIES) {
    if (CATALOGUE_BY_ID[body.id]) continue
    const el = body.elements
    const kind = { asteroid: 'Asteroid', 'near-earth': 'Near-Earth asteroid', comet: 'Comet' }[body.kind] ?? 'Small body'
    const entry = {
      id: body.id,
      name: body.name,
      type: 'small',
      class: kind,
      note: `${kind} on its JPL Small-Body Database orbit.${body.kind === 'comet' ? ' Tails are a model: pointed from the Sun and back along the orbit, with illustrative length and brightness.' : ''}`,
      distanceLy: 0,
      radiusKm: body.radiusKm,
      periodDays: el.periodDays,
      semiMajorAu: el.a,
      eccentricity: el.e,
      sources: [{ label: 'JPL Small-Body Database', url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html' }],
    }
    out.push(
      base(entry, {
        radiusKm: body.radiusKm ?? 2,
        sizeNote: body.radiusKm ? null : MODEL_SIZE,
        render: 'body',
        // Comets carry their elements so the scene can grow tails (a model).
        comet: body.kind === 'comet' ? el : null,
        update(jd, pos) {
          atAu(smallBodyPosition(el, jd, scratch), pos)
        },
      }),
    )
  }
  // Earth-orbit spacecraft, while their Horizons elements are fresh.
  const earthObj = out.find((o) => o.id === 'earth')
  for (const el of orbitersFor(julianDate(Date.now()))) {
    const craft = SATELLITES.find((c) => c.id === el.id)
    const entry = {
      id: el.id,
      name: craft?.name ?? el.id,
      type: 'spacecraft',
      class: craft?.category ?? 'Earth orbit',
      note: craft?.facts?.description ?? null,
      distanceLy: 0,
      sources: [el.source],
    }
    out.push(
      base(entry, {
        radiusKm: 0.05,
        render: 'probe',
        parent: 'earth',
        positionNote: `Position by SGP4 from the CelesTrak two-line elements fetched ${EXTRAS.retrieved}. Accurate to a few km near that date, approximate later; shown for ${ORBITER_DAYS} days. Not live tracking.`,
        update(jd, pos) {
          if (!orbiterPosition(el, jd, scratch)) return
          equatorialToWorld(scratch[0], scratch[1], scratch[2], pos)
          for (let i = 0; i < 3; i += 1) pos[i] += earthObj.pos[i]
        },
      }),
    )
  }
  // Deep-space probes, where JPL Horizons has data for the date.
  for (const craft of SATELLITES.filter(isProbe)) {
    const range = trajectoryRange(craft.trajectory)
    if (!range) continue
    const entry = {
      id: craft.id,
      name: craft.name,
      type: 'spacecraft',
      class: craft.category ?? 'Spacecraft',
      note: craft.facts?.description ?? null,
      distanceLy: 0,
      sources: [{ label: 'JPL Horizons', url: 'https://ssd.jpl.nasa.gov/horizons/' }],
    }
    out.push(
      base(entry, {
        radiusKm: 0.005,
        render: 'probe',
        positionNote: 'Position from a JPL Horizons ephemeris for the date. Not live tracking.',
        update(jd, pos) {
          const p = trajectoryPosition(craft.trajectory, Math.min(Math.max(jd, range[0]), range[1]), scratch)
          if (p) atAu(p, pos)
        },
      }),
    )
  }
  return out
}

// --- Everything ------------------------------------------------------------------

export function buildWorld(now = Date.now()) {
  const objects = solarObjects()
  const byId = Object.fromEntries(objects.map((o) => [o.id, o]))
  const at = (entry) => raDecToWorld(entry.ra, entry.dec, entry.distanceLy * KM_PER_LY)

  for (const entry of CATALOGUE) {
    if (byId[entry.id] || entry.ra == null || entry.distanceLy == null) continue
    let obj = null
    if (entry.type === 'star') obj = starObject(entry, at(entry))
    else if (['galaxy', 'nebula', 'cluster', 'blackhole'].includes(entry.type)) obj = deepObject(entry, at(entry))
    if (obj) {
      objects.push(obj)
      byId[obj.id] = obj
    }
  }

  // The Milky Way: its model centred on Sagittarius A*.
  const sgr = byId['sgr-a']
  if (sgr) {
    const mw = deepObject(CATALOGUE_BY_ID['milky-way'], [...sgr.pos])
    objects.push(mw)
    byId[mw.id] = mw
  }

  // Exoplanets round their host stars. The distance from the star is
  // measured; where on the orbit the planet is, and the orbit's tilt, are not.
  for (const planet of CATALOGUE.filter((e) => e.type === 'exoplanet')) {
    if (planet.ra == null || planet.distanceLy == null) continue
    const hostId = Object.values(byId).find((o) => o.entry?.system === planet.system && o.type === 'star')?.id ?? planet.system
    if (!byId[hostId]) {
      const host = hostObject(planet.system, planet, at(planet))
      objects.push(host)
      byId[hostId] = host
    }
    const host = byId[hostId]
    const random = prng([...planet.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7))
    const angle = random() * Math.PI * 2
    const orbitKm = (planet.semiMajorAu ?? 0.05) * KM_PER_AU
    const obj = base(planet, {
      pos: [host.pos[0] + Math.cos(angle) * orbitKm, host.pos[1] + (random() - 0.5) * 0.1 * orbitKm, host.pos[2] + Math.sin(angle) * orbitKm],
      radiusKm: planet.radiusKm ?? 6371,
      sizeNote: planet.radiusKm ? null : MODEL_SIZE,
      positionNote: planet.semiMajorAu
        ? 'Distance from its star is measured; where it is on its orbit is illustrative.'
        : 'Orbit size not in the archive: placed for illustration.',
      parent: hostId,
      render: 'body',
    })
    objects.push(obj)
    byId[obj.id] = obj
  }

  for (const obj of objects) {
    obj.stopKm = stopDistance(obj)
    obj.influenceKm = influence(obj)
  }
  updateWorld(objects, julianDate(now))
  return { objects, byId }
}

/** Move the solar-system bodies to their positions on Julian date `jd`. */
export function updateWorld(objects, jd) {
  // Planets before moons: the list keeps hosts first.
  for (const obj of objects) obj.update?.(jd, obj.pos)
}

/** How close autopilot stops: near enough to fill a good part of the view. */
function stopDistance(obj) {
  const r = obj.radiusKm
  switch (obj.render) {
    case 'galaxy':
      return r * 2.4
    case 'nebula':
      return r * 2.6
    case 'cluster':
      return r * 3
    case 'blackhole':
      return r * 40
    case 'star':
      return obj.id === 'sun' ? r * 14 : r * 22
    case 'probe':
      return 2000
    default:
      return r * 4.5
  }
}

/** The region an object "owns", for discovery notices. A threshold, not a measurement. */
function influence(obj) {
  const r = obj.radiusKm
  switch (obj.render) {
    case 'galaxy':
      // Out to where autopilot parks, so arriving counts as being there.
      return r * 3
    case 'nebula':
    case 'cluster':
      return r * 3.5
    case 'blackhole':
      return r * 2000
    case 'star':
      return obj.id === 'sun' ? 150 * KM_PER_AU : Math.max(r * 2e4, 400 * KM_PER_AU)
    case 'probe':
      // Deep-space probes are alone out there; a craft in Earth orbit must not
      // claim Earth's neighbourhood as its own region.
      return obj.parent ? obj.stopKm * 2 : 1e6
    default:
      return obj.type === 'moon' ? r * 40 : r * 300
  }
}

/**
 * Real spacecraft speeds for comparison with the simulated cruise speed,
 * measured from the JPL Horizons tracks (km/s): Voyager 1 today, and the
 * fastest point of Parker Solar Probe's orbit.
 */
export function referenceSpeeds(now = Date.now()) {
  const jd = julianDate(now)
  const speed = (id, at, step) => {
    const a = trajectoryPosition(id, at - step, [0, 0, 0])
    const b = trajectoryPosition(id, at + step, [0, 0, 0])
    if (!a || !b) return null
    return (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * KM_PER_AU) / (2 * step * 86400)
  }
  const out = []
  const voyager = trajectoryRange('voyager-1')
  if (voyager) {
    const v = speed('voyager-1', Math.min(Math.max(jd, voyager[0] + 1), voyager[1] - 1), 1)
    if (v) out.push({ id: 'voyager-1', label: 'Voyager 1, today', kms: v })
  }
  const parker = trajectoryRange('parker-solar-probe')
  if (parker) {
    let best = 0
    for (let t = parker[0] + 0.5; t < Math.min(parker[1] - 0.5, parker[0] + 120); t += 0.02) best = Math.max(best, speed('parker-solar-probe', t, 0.01) ?? 0)
    if (best) out.push({ id: 'parker-solar-probe', label: 'Parker Solar Probe, at perihelion', kms: best })
  }
  return out
}

let cached = null
/** The world, built once per visit and shared by the scene and the HUD. */
export function getWorld() {
  if (!cached) {
    cached = buildWorld()
    cached.objects.forEach((obj, index) => {
      obj.index = index
    })
  }
  return cached
}

/** A catalogue object, or a saved place, to fly to. */
export function findTarget(id, places = []) {
  if (!id) return null
  const world = getWorld()
  if (world.byId[id]) return world.byId[id]
  const place = places.find((p) => p.id === id)
  return place ? { id: place.id, name: place.name, type: 'place', klass: 'Saved place', pos: place.pos, radiusKm: 0, stopKm: 1, influenceKm: 0 } : null
}
