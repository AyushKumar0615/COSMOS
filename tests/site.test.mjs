import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { MISSIONS, AGENCIES, MISSION_TYPES, STATUS_LABELS } from '../src/data/missions.js'
import { BODY_ORDER, PLANETS, PLANETS_BY_ID, SUN } from '../src/data/planets.js'
import { SATELLITES, SATELLITE_FACT_FIELDS, isProbe } from '../src/data/satellites.js'
import { probeDistances, probeJd, trajectoryPeriod, trajectoryPosition, trajectoryRange, TRAJECTORY_RETRIEVED } from '../src/lib/trajectories.js'
import { MOONS, SMALL_BODIES, radiusFromAu } from '../src/data/solarBodies.js'
import { SOLAR_BODIES, SOLAR_BODIES_BY_ID } from '../src/data/solarNames.js'
import orbitsData from '../src/data/catalogue/orbits.json' with { type: 'json' }
import trajectoriesData from '../src/data/catalogue/trajectories.json' with { type: 'json' }
import skyData from '../src/data/catalogue/constellations.json' with { type: 'json' }
import extrasData from '../src/data/catalogue/extras.json' with { type: 'json' }
import { eclipseState, julianDate, moonPosition, planetPosition, solveKepler } from '../src/lib/orbits.js'
import { EFFECT_DEFAULTS } from '../src/lib/effects.js'
import { ROCK, comaMaterial, cometActivity } from '../src/lib/cometTail.js'
import { GALAXIES } from '../src/data/galaxies.js'
import { NEBULAE } from '../src/data/nebulae.js'
import { TOUR_STOPS } from '../src/data/tour.js'
import { BLACK_HOLE_IDS, GALAXY_IDS, NAV_ITEMS, NEBULA_IDS, PHENOMENON_IDS } from '../src/data/navigation.js'
import { CATALOGUE, CATALOGUE_BY_ID, mapRadius, nearbyObjects, toGalactic } from '../src/data/catalogue/index.js'
import { BADGE_RULES, CHALLENGES } from '../src/data/catalogue/achievements.js'
import { LIFE_PATHS } from '../src/data/phenomena.js'
import { BLACK_HOLES, BLACK_HOLE_MISSIONS, BLACK_HOLE_TOPICS, DIVE_STAGES, diveRadius } from '../src/data/blackholes.js'
import { PHENOMENA } from '../src/data/phenomena.js'
import {
  clockRate,
  fallSpeed,
  hawkingTemperature,
  orbitalSpeed,
  properTimeToSingularity,
  schwarzschildRadiusKm,
  tidalAcceleration,
  tidalRadiusX,
} from '../src/lib/relativity.js'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const read = (file) => fs.readFileSync(path.join(dist, file), 'utf8')
const html = () => read('index.html')
const meta = (attribute, name) =>
  html().match(new RegExp(`<meta[^>]*${attribute}="${name}"[^>]*content="([^"]*)"`, 's'))?.[1]

test('content: the catalogue is complete', () => {
  assert.equal(PLANETS.length, 8)
  assert.equal(BODY_ORDER.length, 9)
  assert.equal(TOUR_STOPS.length, 10)
  assert.equal(GALAXIES.length, 17)
  assert.equal(NEBULAE.length, 13)
  assert.equal(BLACK_HOLES.length, 4)
  assert.equal(BLACK_HOLE_MISSIONS.length, 5)
  assert.equal(PHENOMENA.length, 10)
  assert.equal(MISSIONS.length, 14)
  assert.ok(NAV_ITEMS.every((item) => item.status === 'live'))
})

test('content: the id lists in the first load match the full data', () => {
  assert.deepEqual(BLACK_HOLE_IDS, BLACK_HOLES.map((hole) => hole.id))
  assert.deepEqual(GALAXY_IDS, GALAXIES.map((entry) => entry.id))
  assert.deepEqual(NEBULA_IDS, NEBULAE.map((entry) => entry.id))
  assert.deepEqual(PHENOMENON_IDS, PHENOMENA.map((entry) => entry.id))
})

test('content: ids are unique', () => {
  for (const list of [PLANETS, GALAXIES, NEBULAE, MISSIONS, BLACK_HOLES, PHENOMENA, BLACK_HOLE_MISSIONS, BLACK_HOLE_TOPICS]) {
    const ids = list.map((entry) => entry.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('content: every mission is sourced, dated and correctly classified', () => {
  for (const mission of MISSIONS) {
    assert.ok(AGENCIES[mission.agency], `${mission.id}: agency`)
    assert.ok(mission.types.length && mission.types.every((type) => MISSION_TYPES[type]), `${mission.id}: types`)
    assert.ok(STATUS_LABELS[mission.status], `${mission.id}: status`)
    assert.ok(mission.statusAsOf, `${mission.id}: statusAsOf`)
    assert.ok(mission.sources?.length, `${mission.id}: sources`)
    for (const source of mission.sources) {
      assert.match(source.url, /^https:\/\//, `${mission.id}: source url`)
    }
  }
})

test('content: every new destination cites a source and labels its evidence', () => {
  for (const entry of [...BLACK_HOLES, ...PHENOMENA.filter((item) => item.kind !== 'spacetime')]) {
    assert.ok(entry.sources?.length, `${entry.id}: sources`)
    assert.ok(entry.evidence, `${entry.id}: evidence`)
  }
  for (const entry of [...GALAXIES.slice(3), ...NEBULAE.slice(4)]) assert.ok(entry.sources?.length, `${entry.id}: sources`)
})

test('catalogue: required objects exist, with sources and unique ids', () => {
  assert.equal(new Set(CATALOGUE.map((entry) => entry.id)).size, CATALOGUE.length)
  const required = ['pluto', 'ceres', 'eris', 'haumea', 'makemake', 'europa', 'titan', 'enceladus', 'ganymede', 'io', 'callisto', 'triton', 'pinwheel', 'lmc', 'smc', 'cartwheel', 'black-eye', 'centaurus-a', 'pleiades', 'omega-centauri', 'betelgeuse', 'sirius-b', 'crab-pulsar', 'trappist-1-e', 'proxima-cen-b']
  for (const id of required) assert.ok(CATALOGUE_BY_ID[id], id)
  assert.ok(CATALOGUE.filter((entry) => entry.type === 'exoplanet').length > 30)
  for (const entry of CATALOGUE) assert.ok(entry.sources?.length, `${entry.id}: sources`)
})

test('catalogue: archive values match independently known figures', () => {
  const close = (actual, expected, tolerance) => assert.ok(Math.abs(actual / expected - 1) < tolerance, `${actual} vs ${expected}`)
  close(CATALOGUE_BY_ID.jupiter.radiusKm, 69911, 0.01)
  close(CATALOGUE_BY_ID.earth.massKg, 5.97e24, 0.01)
  close(CATALOGUE_BY_ID.titan.radiusKm, 2575, 0.01)
  close(CATALOGUE_BY_ID.moon.periodDays, 27.3, 0.01)
  close(CATALOGUE_BY_ID.sirius.distanceLy, 8.6, 0.02)
  close(CATALOGUE_BY_ID.proxima.distanceLy, 4.25, 0.01)
  close(CATALOGUE_BY_ID['trappist-1-e'].periodDays, 6.1, 0.01)
  close(CATALOGUE_BY_ID.andromeda.distanceLy, 2.5e6, 0.1)
})

test('catalogue: no galaxy gets a parallax distance, and sky positions are right', () => {
  for (const entry of CATALOGUE.filter((item) => item.type === 'galaxy' && item.id !== 'milky-way')) {
    assert.ok(entry.distanceLy > 1e5, `${entry.id}: ${entry.distanceLy}`)
  }
  const centre = toGalactic(266.4168, -29.0078)
  assert.ok(Math.abs(centre.l) < 0.2 && Math.abs(centre.b) < 0.2, 'Sgr A* marks the galactic centre')
  assert.ok(mapRadius(4) < mapRadius(1e4) && mapRadius(1e4) < mapRadius(1e9))
})

test('catalogue: every explorer link and system resolves', () => {
  for (const entry of CATALOGUE) {
    if (entry.explorer?.scene === 'galaxies') assert.ok(GALAXY_IDS.includes(entry.explorer.id), entry.id)
    if (entry.explorer?.scene === 'nebulae') assert.ok(NEBULA_IDS.includes(entry.explorer.id), entry.id)
    if (entry.explorer?.scene === 'black-holes') assert.ok(BLACK_HOLE_IDS.includes(entry.explorer.id), entry.id)
  }
  const nearest = nearbyObjects(CATALOGUE_BY_ID.proxima, 1)[0]
  assert.equal(nearest.name, 'Alpha Centauri B')
})

test('discovery: every challenge names real objects, and badges are unique', () => {
  for (const challenge of CHALLENGES) for (const id of challenge.ids) assert.ok(CATALOGUE_BY_ID[id], `${challenge.id}: ${id}`)
  assert.equal(new Set(BADGE_RULES.map((rule) => rule.id)).size, BADGE_RULES.length)
})

test('life cycle: paths end in the right remnant', () => {
  const last = (path) => LIFE_PATHS[path].stages.at(-1).id
  assert.equal(last('sun'), 'dwarf')
  assert.equal(last('massive'), 'neutron')
  assert.equal(last('giant'), 'hole')
  for (const path of Object.values(LIFE_PATHS)) assert.equal(path.stages[0].id, 'cloud')
})

test('spacecraft: sourced facts, real ordering, and a truly geostationary orbit', () => {
  const ids = new Set(SATELLITES.map((craft) => craft.id))
  assert.equal(ids.size, SATELLITES.length)
  for (const craft of SATELLITES) {
    assert.ok(craft.facts.description.length > 60, `${craft.id} description`)
    assert.ok(craft.facts.orbit, `${craft.id} orbit`)
    for (const key of Object.keys(craft.facts)) {
      assert.ok(key === 'description' || SATELLITE_FACT_FIELDS.some((field) => field.key === key), `${craft.id}.${key} is shown`)
    }
    if (craft.trajectory) assert.ok(trajectoryRange(craft.trajectory), `${craft.id} has a Horizons track`)
    if (isProbe(craft)) continue
    assert.ok(PLANETS_BY_ID[craft.host], `${craft.id} host`)
    assert.ok(craft.sim.radius > 1.1, `${craft.id} clears the planet and its atmosphere`)
  }
  const period = (id) => SATELLITES.find((craft) => craft.id === id).sim.period
  // Lower orbits are faster, as Kepler's third law requires.
  assert.ok(period('tiangong') <= period('iss') && period('iss') < period('hubble'))
  assert.ok(period('hubble') < period('gps') && period('gps') < period('geo-comms'))
  const earthDay = (2 * Math.PI) / PLANETS_BY_ID.earth.sim.rotationSpeed
  assert.ok(Math.abs(period('geo-comms') - earthDay) < 1e-9, 'geostationary keeps pace with the planet')
  assert.equal(SATELLITES.find((craft) => craft.id === 'hubble').facts.inclination, '28.5°')
  assert.equal(SATELLITES.find((craft) => craft.id === 'iss').facts.inclination, '51.6°')
})

test('probes: Horizons tracks interpolate smoothly and stay outside the drawn Sun', () => {
  const retrieved = julianDate(Date.parse(`${TRAJECTORY_RETRIEVED}T00:00:00Z`))
  for (const craft of SATELLITES.filter(isProbe)) {
    const [start, end] = trajectoryRange(craft.trajectory)
    assert.ok(start <= retrieved && retrieved <= end, `${craft.id} covers the retrieval date`)
    assert.equal(trajectoryPosition(craft.trajectory, end + 1), null, `${craft.id} has no invented positions`)
  }
  // Voyager 1 is beyond 160 AU and over 22 light-hours away from 2025 on.
  const v1 = probeDistances('voyager-1', retrieved)
  assert.ok(v1.sun > 160 && v1.lightHours > 22, `Voyager 1 at ${v1.sun} AU`)
  // Parker: perihelion 9.86 solar radii (0.0459 AU) every ~88 days, found
  // between daily samples by the two-body fit rather than cut through, and
  // the fit stays on the samples elsewhere.
  for (const [jd, x, y, z] of trajectoriesData.spacecraft['parker-solar-probe'].samples.slice(0, -1)) {
    const p = trajectoryPosition('parker-solar-probe', jd + 1e-9)
    assert.ok(Math.hypot(p[0] - x, p[1] - y, p[2] - z) < 0.003, `Parker fit at ${jd}`)
  }
  const [start] = trajectoryRange('parker-solar-probe')
  const period = trajectoryPeriod('parker-solar-probe')
  assert.ok(Math.abs(period - 88) < 1.5, `period ${period}`)
  let closest = Infinity
  for (let jd = start; jd < start + period; jd += 0.02) {
    const p = trajectoryPosition('parker-solar-probe', jd)
    closest = Math.min(closest, Math.hypot(p[0], p[1], p[2]))
  }
  assert.ok(Math.abs(closest - 0.0459) < 0.001, `perihelion ${closest} AU`)
  assert.ok(radiusFromAu(closest) > SUN.sim.radius * 1.4, 'drawn clear of the Sun')
  // Educational mode loops Parker through whole orbits and keeps the far probes still.
  const loopJd = probeJd('parker-solar-probe', { mode: 'educational', jd: 0, t: 1e6 }, retrieved, true)
  assert.ok(loopJd >= start && loopJd <= trajectoryRange('parker-solar-probe')[1])
  assert.equal(probeJd('voyager-1', { mode: 'educational', jd: 0, t: 1e6 }, retrieved, false), retrieved)
  // The distance map keeps every distance in order.
  let previous = -1
  for (const au of [0.0047, 0.0459, 0.39, 1, 5.2, 30, 66, 172]) {
    assert.ok(radiusFromAu(au) > previous, `monotonic at ${au} AU`)
    previous = radiusFromAu(au)
  }
})

test('orbits: Kepler solver, Earth at its known places, and eclipses on the right dates', () => {
  // Kepler's equation holds even for Hale-Bopp's near-parabolic orbit.
  for (const e of [0, 0.0167, 0.2056, 0.967, 0.995]) {
    for (let M = -3; M <= 3; M += 0.25) {
      const E = solveKepler(M, e)
      assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-9, `e=${e} M=${M}`)
    }
  }
  // Earth: about 0.983 AU at January perihelion, 1.017 AU at July aphelion,
  // and the Sun at the March equinox, which in JPL's fixed J2000 frame sits
  // behind 0° by the precession since 2000 (50.29″ a year: 0.369° by 2026).
  const earth = orbitsData.planets.earth
  const r = (iso) => Math.hypot(...planetPosition(earth, julianDate(Date.parse(iso))))
  assert.ok(Math.abs(r('2026-01-03T17:00Z') - 0.9833) < 0.001)
  assert.ok(Math.abs(r('2026-07-06T18:00Z') - 1.0166) < 0.001)
  const eq = planetPosition(earth, julianDate(Date.parse('2026-03-20T14:46Z')))
  const sunLon = (Math.atan2(-eq[1], -eq[0]) * 180) / Math.PI
  const precession = (50.29 * (2026.21 - 2000)) / 3600
  assert.ok(Math.abs(sunLon + precession) < 0.05, `Sun longitude at equinox ${sunLon}`)

  // Eclipses: the geometry should find each within ±3 hours of its maximum,
  // and nothing at new and full moons outside eclipse season.
  const moon = orbitsData.moons.moon
  const AU_KM = 149597870.7
  const around = (iso) => {
    const found = new Set()
    for (let h = -3; h <= 3; h += 0.25) {
      const jd = julianDate(Date.parse(iso)) + h / 24
      const e = planetPosition(earth, jd)
      const d = Math.hypot(...e)
      const rel = moonPosition(moon, moon.orbitKm, moon.eccentricity, jd, [0, 0, 0], earth)
      const s = eclipseState(rel, e.map((v) => -v / d), d * AU_KM, earth.radiusKm, moon.radiusKm)
      if (s.solar) found.add('solar')
      if (s.lunar) found.add(s.lunar)
    }
    return found
  }
  for (const iso of ['2024-04-08T18:17Z', '2024-10-02T18:45Z', '2025-03-29T10:47Z', '2025-09-21T19:41Z', '2026-02-17T12:12Z', '2026-08-12T17:46Z']) {
    assert.ok(around(iso).has('solar'), `solar eclipse ${iso}`)
  }
  for (const iso of ['2025-03-14T06:58Z', '2025-09-07T18:11Z', '2026-03-03T11:33Z']) assert.ok(around(iso).has('total'), `total lunar eclipse ${iso}`)
  for (const iso of ['2024-03-25T07:13Z', '2024-09-18T02:44Z', '2026-08-28T04:12Z']) assert.ok(around(iso).size > 0, `lunar eclipse ${iso}`)
  for (const iso of ['2024-06-06T12:38Z', '2024-06-22T01:08Z', '2025-06-25T10:31Z', '2025-07-10T20:37Z']) {
    assert.equal(around(iso).size, 0, `no eclipse at ${iso}`)
  }
})

test('moons and small bodies: JPL data present, named, and drawn in their real order', () => {
  for (const moon of MOONS) {
    const el = moon.elements
    assert.ok(SOLAR_BODIES_BY_ID[moon.id]?.kind === 'moon', `${moon.id} is named`)
    assert.ok(el.orbitKm > 0 && el.radiusKm > 0 && el.periodDays > 0, `${moon.id} JPL values`)
    assert.equal(moon.retrograde, el.i > 90, `${moon.id} direction`)
  }
  // Around each planet, a farther moon is drawn farther out and goes round more slowly.
  const hosts = new Set(MOONS.map((m) => m.host))
  for (const host of hosts) {
    const moons = MOONS.filter((m) => m.host === host).sort((a, b) => a.elements.orbitKm - b.elements.orbitKm)
    for (let k = 1; k < moons.length; k += 1) {
      assert.ok(moons[k].sim.orbit > moons[k - 1].sim.orbit, `${moons[k].id} beyond ${moons[k - 1].id}`)
      assert.ok(moons[k].sim.period > moons[k - 1].sim.period, `${moons[k].id} slower than ${moons[k - 1].id}`)
    }
  }
  // Every named body has data, and every body with data has a name.
  const withData = new Set([...MOONS.map((m) => m.id), ...SMALL_BODIES.map((b) => b.id), 'charon'])
  for (const body of SOLAR_BODIES) assert.ok(withData.has(body.id), `${body.id} has data`)
  for (const id of withData) assert.ok(SOLAR_BODIES_BY_ID[id], `${id} has a name`)
  // Comets: perihelion inside aphelion, and Halley about 76 years.
  for (const body of SMALL_BODIES) assert.ok(body.elements.q < (body.elements.Q ?? Infinity), `${body.id} q < Q`)
  const halley = SMALL_BODIES.find((b) => b.id === 'halley').elements
  assert.ok(Math.abs(halley.periodDays / 365.25 - 76) < 2)
})

test("rings: Saturn's divisions sit at their real radii, and only Saturn frames by its rings", () => {
  const saturn = PLANETS_BY_ID.saturn.sim.ring
  // C ring inner edge 74,658 km and F ring 140,180 km over a 60,268 km radius.
  assert.ok(saturn.inner <= 74658 / 60268 && saturn.outer >= 140180 / 60268)
  assert.ok(!saturn.faint)
  assert.ok(PLANETS_BY_ID.uranus.sim.ring.faint && PLANETS_BY_ID.neptune.sim.ring.faint)
  // Uranus's epsilon ring (51,149 km) lies inside the texture's span.
  assert.ok(PLANETS_BY_ID.uranus.sim.ring.outer > 51149 / 25559)
})

test('effects: every switch has a default and intensity is in range', () => {
  assert.deepEqual(Object.keys(EFFECT_DEFAULTS).sort(), ['auroras', 'events', 'intensity', 'meteors', 'orbits', 'satellites'])
  assert.ok(EFFECT_DEFAULTS.intensity > 0 && EFFECT_DEFAULTS.intensity <= 1.5)
})

test('physics: Schwarzschild figures match known values', () => {
  const close = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual / expected - 1) < tolerance, `${actual} vs ${expected}`)
  close(schwarzschildRadiusKm(1), 2.953)
  close(schwarzschildRadiusKm(6.5e9), 1.92e10)
  assert.equal(clockRate(1), 0)
  close(clockRate(4 / 3), 0.5)
  close(fallSpeed(4), 0.5)
  close(orbitalSpeed(3), 0.5)
  assert.equal(orbitalSpeed(1.5), 1)
  close(hawkingTemperature(1), 6.17e-8)
  // Tides at the horizon fall as 1/M²: a thousand times the mass, a millionth of the tide.
  close(tidalAcceleration(1000, 1) / tidalAcceleration(1, 1), 1e-6)
  // Falling from the horizon takes 2/3 of r_s/c from rest at infinity.
  close(properTimeToSingularity(1e6, 1), (2 / 3) * 9.85)
  assert.ok(tidalRadiusX(21.2) > 1, 'a stellar black hole shreds you outside the horizon')
  assert.ok(tidalRadiusX(4.07e10) < 1, 'an ultramassive one does not')
})

test('physics: the descent starts at the camera, crosses the horizon and ends at zero', () => {
  const horizon = DIVE_STAGES.find((stage) => stage.id === 'horizon').at
  assert.equal(Number(diveRadius(0, 30).toFixed(6)), 30)
  assert.equal(Number(diveRadius(horizon, 30).toFixed(6)), 1)
  assert.equal(diveRadius(1, 30), 0)
  for (let p = 0.01; p < 1; p += 0.01) assert.ok(diveRadius(p, 30) < diveRadius(p - 0.01, 30), 'always falling')
})

test('missions: each condition can pass, and none pass from far away', () => {
  const far = { r: 80, inclination: 60, diskCrossed: false }
  for (const mission of BLACK_HOLE_MISSIONS) assert.equal(mission.check(far), false, mission.id)
  const states = {
    horizon: { r: 1.2 },
    photon: { r: 1.5 },
    lensing: { r: 20, inclination: 3 },
    disk: { diskCrossed: true },
    dilation: { r: 1.3 },
  }
  for (const mission of BLACK_HOLE_MISSIONS) assert.ok(mission.check({ ...far, ...states[mission.id] }), mission.id)
})

test('build: metadata is complete and resolved', () => {
  const page = html()
  assert.doesNotMatch(page, /__SITE_URL__|%VITE_/)
  assert.match(page, /<title>COSMOS — Explore the Universe<\/title>/)
  assert.ok(meta('name', 'description')?.length >= 50)
  for (const name of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt']) {
    assert.ok(meta('property', name), name)
  }
  for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.ok(meta('name', name), name)
  }
  const canonical = page.match(/rel="canonical" href="([^"]+)"/)?.[1]
  assert.ok(canonical?.endsWith('/'))
  assert.equal(meta('property', 'og:url'), canonical)
  assert.ok(meta('property', 'og:image').startsWith(canonical))
})

test('build: robots.txt and sitemap.xml share the canonical origin', () => {
  const canonical = html().match(/rel="canonical" href="([^"]+)"/)[1]
  assert.match(read('robots.txt'), new RegExp(`Sitemap: ${canonical}sitemap\\.xml`))
  assert.match(read('sitemap.xml'), new RegExp(`<loc>${canonical}</loc>`))
})

test('build: every file referenced by index.html exists', () => {
  const refs = [...html().matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((match) => match[1])
  assert.ok(refs.length >= 6)
  for (const ref of refs) assert.ok(fs.existsSync(path.join(dist, ref)), ref)
})

test('build: the first load never preloads Three.js', () => {
  assert.doesNotMatch(html(), /vendor-three|SceneCanvas|MissionExplorer|GalaxyExplorer|NebulaExplorer|BlackHoleExplorer|PhenomenaExplorer|BlackHoleLayer|PhenomenaHud|AtlasExplorer|AtlasLayer|DeepSpaceLayer/)
})

test('build: no credentials or source maps ship', () => {
  const pattern = /(sk-[a-z0-9]{20}|ghp_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJhbGciOi)/
  for (const file of fs.readdirSync(path.join(dist, 'assets'))) {
    assert.ok(!file.endsWith('.map'), file)
    assert.doesNotMatch(read(`assets/${file}`), pattern, file)
  }
})

test('config: vercel.json serves every public file and sends the security headers', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  assert.equal(config.outputDirectory, 'dist')
  const rewrite = new RegExp(`^${config.rewrites[0].source}$`)
  assert.ok(rewrite.test('/anything'))
  for (const file of fs.readdirSync(path.join(root, 'public'))) {
    assert.ok(!rewrite.test(`/${file}`), `${file} would be rewritten to index.html`)
  }
  const keys = config.headers.flatMap((entry) => entry.headers.map((header) => header.key))
  for (const key of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy']) {
    assert.ok(keys.includes(key), key)
  }
})

// --- Open universe ----------------------------------------------------------------------

const ow = await import('../src/lib/openWorld.js')
const wc = await import('../src/lib/worldCatalogue.js')
const { truePosition, mapPosition, galacticToScene } = await import('../src/data/catalogue/index.js')

test('open universe: units and readouts pick the right scale', () => {
  assert.equal(ow.formatKm(384400), '384,400 km')
  assert.match(ow.formatKm(2.5e6), /million km$/)
  assert.match(ow.formatKm(ow.KM_PER_AU * 5.2), /^5\.2 AU$/)
  assert.match(ow.formatKm(ow.KM_PER_LY * 8.6), /^8\.6 ly$/)
  assert.match(ow.formatKm(ow.KM_PER_LY * 2.5e6), /Mpc$/)
  assert.equal(ow.formatSpeed(ow.C_KM_S).c, '1 c')
  assert.equal(ow.formatSpeed(0).c, '0 c')
  assert.ok(ow.formatSpeed(ow.C_KM_S * 2).fasterThanLight)
  assert.ok(!ow.formatSpeed(17).fasterThanLight)
  assert.equal(ow.formatSpeed(ow.KM_PER_LY * 10).lys, '10 ly/s')
  assert.equal(ow.formatDuration(30), '30 s')
  assert.match(ow.formatDuration(3 * 86400 * 365.25 * 1e6), /million years/)
  // The light-year is defined from c and the Julian year; 1 pc ≈ 3.2616 ly.
  assert.ok(Math.abs(ow.KM_PER_PC / ow.KM_PER_LY - 3.26156) < 1e-4)
})

test('atlas: galactic frame is a rotation, not a mirror image', () => {
  // Images of the galactic unit vectors (towards l = 0, l = 90°, the north pole).
  const ex = galacticToScene(0, 0, 1)
  const ey = galacticToScene(90, 0, 1)
  const ez = galacticToScene(0, 90, 1)
  const cross = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]]
  cross.forEach((v, i) => assert.ok(Math.abs(v - ez[i]) < 1e-12, `x × y = z (axis ${i})`))
  // Known directions: the Galactic Centre on +X, l = 90° on -Z, the anticentre side on +Z for l > 180°.
  const sgr = truePosition(CATALOGUE_BY_ID['sgr-a'])
  assert.ok(sgr[0] > 0.99 * Math.hypot(...sgr))
  const l = (e) => (toGalactic(e.ra, e.dec).l + 360) % 360
  for (const e of CATALOGUE.filter((x) => x.ra != null && x.distanceLy > 0)) {
    const p = truePosition(e)
    const sinL = Math.sin((l(e) * Math.PI) / 180)
    if (Math.abs(sinL) > 0.05 && Math.abs(toGalactic(e.ra, e.dec).b) < 80) assert.equal(Math.sign(p[2]), -Math.sign(sinL), e.id)
  }
})

test('atlas: the fix keeps distances, map directions and nearby lists', () => {
  for (const e of CATALOGUE.filter((x) => x.ra != null && x.distanceLy > 0)) {
    const t = truePosition(e)
    const m = mapPosition(e)
    const d = Math.hypot(...t)
    assert.ok(Math.abs(d - e.distanceLy) < 1e-9 * Math.max(1, d), `${e.id} distance`)
    assert.ok(Math.abs(Math.hypot(...m) - mapRadius(e.distanceLy)) < 1e-9, `${e.id} map radius`)
    // Map and true positions point the same way.
    const dot = (t[0] * m[0] + t[1] * m[1] + t[2] * m[2]) / (d * Math.hypot(...m))
    assert.ok(dot > 1 - 1e-12, `${e.id} direction`)
  }
  // A reflection preserves separations, so "nearby" is unchanged: Proxima's nearest is Alpha Centauri.
  const near = nearbyObjects(CATALOGUE_BY_ID.proxima, 3)
  assert.ok(near.length === 3 && near.every((n, i) => i === 0 || n.awayLy >= near[i - 1].awayLy))
  assert.match(near[0].id, /alpha-cen|rigil|toliman/i)
})

test('open universe: a right-handed galactic frame that agrees with the catalogue', () => {
  // The same positions as the atlas's truePosition, on every axis.
  for (const id of ['sirius', 'andromeda', 'orion', 'sgr-a', 'proxima']) {
    const e = CATALOGUE_BY_ID[id]
    const mine = ow.raDecToWorld(e.ra, e.dec, e.distanceLy)
    const theirs = truePosition(e)
    for (let i = 0; i < 3; i += 1) assert.ok(Math.abs(mine[i] - theirs[i]) < 1e-6 * e.distanceLy, `${id} axis ${i}`)
    const { l, b } = ow.galacticAngles(...mine)
    const g = toGalactic(e.ra, e.dec)
    assert.ok(Math.abs(((l - (g.l + 360) % 360 + 540) % 360) - 180) < 1e-4 && Math.abs(b - g.b) < 1e-4, id)
  }
  // Right-handed: x × y = z for the images of the equatorial axes.
  const x = ow.equatorialToWorld(1, 0, 0)
  const y = ow.equatorialToWorld(0, 1, 0)
  const z = ow.equatorialToWorld(0, 0, 1)
  const cross = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]
  cross.forEach((v, i) => assert.ok(Math.abs(v - z[i]) < 1e-6))
  // Ecliptic north pole: RA 270°, Dec 90° − obliquity.
  const pole = ow.eclipticToWorld(0, 0, 1)
  const expected = ow.raDecToWorld(270, 90 - 23.4392911, 1)
  pole.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-9))
})

test('open universe: compressed rendering keeps order and true angular size', () => {
  let last = -Infinity
  for (let e = 0; e <= 23; e += 0.5) {
    const r = ow.renderDistance(10 ** e)
    assert.ok(r > last)
    last = r
  }
  assert.ok(ow.renderDistance(1e23) < ow.RENDER_FAR, 'the farthest quasar fits inside the far plane')
  // Scaling by R/d about the camera keeps the angle a radius subtends.
  for (const [radius, d] of [[6371, 30000], [695700, 1.5e8], [5e17, 2.4e19]]) {
    const k = ow.renderDistance(d) / d
    assert.ok(Math.abs(Math.atan(radius / d) - Math.atan((radius * k) / (d * k))) < 1e-12)
  }
})

test('open universe: autopilot eases in log distance and always arrives', () => {
  const start = 2.4e19
  const stop = 1e15
  assert.ok(ow.autopilotDuration(start, stop) <= 22 && ow.autopilotDuration(1e5, 1e4) >= 3)
  assert.ok(Math.abs(ow.autopilotDistance(start, stop, 0) - start) / start < 1e-12)
  assert.ok(Math.abs(ow.autopilotDistance(start, stop, 1) - stop) / stop < 1e-12)
  let last = Infinity
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const d = ow.autopilotDistance(start, stop, t)
    assert.ok(d <= last * (1 + 1e-12))
    last = d
  }
})

test('open universe: procedural stars are deterministic, inside the galaxy only', () => {
  const disc = { centreLy: 26000, sunRLy: 26000, radiusLy: 50000, scaleLengthLy: 13000, scaleHeightLy: 900 }
  const tier = { id: 0, cellLy: 25, perCell: 3, magMin: 0, magMax: 10 }
  assert.deepEqual(ow.cellStars(4, 0, -7, tier, disc), ow.cellStars(4, 0, -7, tier, disc))
  assert.notDeepEqual(ow.cellStars(4, 0, -7, tier, disc), ow.cellStars(5, 0, -7, tier, disc))
  assert.equal(ow.diskDensity(26000 + 70000, 0, 0, disc), 0, 'nothing beyond the disc edge')
  assert.ok(ow.diskDensity(0, 0, 0, disc) === 1 && ow.diskDensity(0, 3000, 0, disc) < 0.05)
  const kept = ow.cellStars(0, 0, 0, tier, disc, () => true)
  assert.equal(kept.length, 0, 'a keep-out rule removes stars')
  // Magnitudes: a star at 10 pc shows its absolute magnitude.
  const tenPc = (10 * ow.KM_PER_PC) / ow.KM_PER_LY
  assert.ok(Math.abs(ow.apparentMagnitude(4.83, tenPc) - 4.83) < 1e-9)
  assert.ok(Math.abs(ow.absoluteMagnitude(ow.apparentMagnitude(-1, 8.6), 8.6) + 1) < 1e-9)
})

test('open universe: every catalogued object is placed, from JPL and SIMBAD data', () => {
  const { objects, byId } = wc.getWorld()
  const ids = new Set()
  for (const obj of objects) {
    assert.ok(!ids.has(obj.id), `duplicate ${obj.id}`)
    ids.add(obj.id)
    assert.ok(obj.pos.every(Number.isFinite), `${obj.id} position`)
    assert.ok(obj.radiusKm > 0 && obj.stopKm > obj.radiusKm, `${obj.id} stops outside itself`)
    assert.ok(obj.influenceKm > 0)
    if (['galaxy', 'nebula', 'cluster'].includes(obj.render)) assert.ok(obj.influenceKm > obj.stopKm, `${obj.id}: arriving counts as entering`)
    // Anything not measured says so.
    if (obj.entry && obj.render !== 'probe' && obj.entry.radiusKm == null && obj.render !== 'galaxy' && obj.render !== 'blackhole') assert.ok(obj.sizeNote, `${obj.id} model size is labelled`)
  }
  for (const e of CATALOGUE) if ((e.ra != null && e.distanceLy != null) || e.distanceLy === 0) assert.ok(byId[e.id] || e.type === 'exoplanet', `${e.id} missing`)
  const d = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2])
  const sun = byId.sun
  assert.ok(Math.abs(d(byId.earth, sun) / ow.KM_PER_AU - 1) < 0.02)
  assert.ok(d(byId.moon, byId.earth) > 356000 && d(byId.moon, byId.earth) < 407000)
  assert.ok(d(byId.io, byId.jupiter) > 410000 && d(byId.io, byId.jupiter) < 435000)
  assert.ok(d(byId['voyager-1'], sun) / ow.KM_PER_AU > 160)
  assert.ok(Math.abs(d(byId['sirius'], sun) / ow.KM_PER_LY - CATALOGUE_BY_ID.sirius.distanceLy) < 1e-6)
  // The Milky Way is centred on Sagittarius A*, about l = 0, b = 0.
  const centre = ow.galacticAngles(...byId['milky-way'].pos)
  assert.ok((centre.l < 0.5 || centre.l > 359.5) && Math.abs(centre.b) < 0.5)
  // Exoplanets sit at their measured distance from their star.
  for (const planet of objects.filter((o) => o.type === 'exoplanet' && o.entry.semiMajorAu)) {
    const host = byId[planet.parent]
    assert.ok(Math.abs(Math.hypot(...planet.pos.map((v, i) => v - host.pos[i])) / ow.KM_PER_AU - planet.entry.semiMajorAu) < planet.entry.semiMajorAu * 0.01, planet.id)
  }
})

test('comet tails: activity model, and comets tagged with their JPL elements', () => {
  assert.equal(cometActivity(5.5), 0)
  assert.equal(cometActivity(0.5), 1)
  assert.ok(cometActivity(1.5) > cometActivity(3) && cometActivity(3) > 0)
  const comets = wc.getWorld().objects.filter((o) => o.comet)
  assert.deepEqual(comets.map((o) => o.id).sort(), SMALL_BODIES.filter((b) => b.kind === 'comet').map((b) => b.id).sort())
  for (const c of comets) assert.match(c.entry.note, /Tails are a model/)
  // Nucleus shape shares vertices (smooth shading); the coma is additive and never writes depth.
  assert.ok(ROCK.index && ROCK.attributes.normal)
  const coma = comaMaterial('#ffffff')
  assert.equal(coma.depthWrite, false)
  coma.dispose()
})

test('open universe: star sizes inferred from measured brightness are labelled and plausible', () => {
  const { byId } = wc.getWorld()
  // Inverse of magnitudeFromStar.
  assert.ok(Math.abs(ow.radiusFromMagnitude(ow.magnitudeFromStar(3, 4500, 5772), 4500, 5772) - 3) < 1e-9)
  assert.ok(Math.abs(ow.radiusFromMagnitude(ow.SUN_ABS_MAG, 5772, 5772) - 1) < 1e-9)
  for (const id of ['sirius', 'vega', 'polaris', 'betelgeuse']) {
    const star = byId[id]
    if (star.entry.radiusKm) continue
    assert.match(star.sizeNote, /inferred/i, id)
  }
  // Order of magnitude: a main-sequence star stays small, a supergiant large.
  assert.ok(byId.sirius.radiusKm / 695700 < 3)
  assert.ok(byId.betelgeuse.radiusKm / 695700 > 100)
})

test('extras: constellation figures sit on catalogued stars', () => {
  assert.ok(skyData.source.url && skyData.retrieved)
  assert.ok(skyData.figures.length >= 88)
  const ori = skyData.figures.find((f) => f.id === 'Ori')
  assert.ok(ori, 'Orion present')
  // A vertex of Orion lies on Betelgeuse's catalogued (SIMBAD) direction.
  const b = CATALOGUE_BY_ID.betelgeuse
  const sep = (ra1, d1, ra2, d2) => {
    const r = Math.PI / 180
    return Math.acos(Math.min(1, Math.sin(d1 * r) * Math.sin(d2 * r) + Math.cos(d1 * r) * Math.cos(d2 * r) * Math.cos((ra1 - ra2) * r))) / r
  }
  const nearest = Math.min(...ori.lines.flat().map(([ra, dec]) => sep(ra, dec, b.ra, b.dec)))
  assert.ok(nearest < 0.05, `Betelgeuse vertex ${nearest}°`)
  for (const f of skyData.figures) for (const line of f.lines) for (const [ra, dec] of line) assert.ok(ra >= 0 && ra < 360 && Math.abs(dec) <= 90, f.id)
})

test('extras: rover positions and Earth orbiters are sourced and plausible', () => {
  assert.deepEqual(extrasData.rovers.map((r) => r.id).sort(), ['curiosity', 'perseverance'])
  for (const r of extrasData.rovers) {
    assert.ok(Math.abs(r.lat) < 90 && r.lonEast >= -180 && r.lonEast <= 360 && r.sol > 0, r.id)
    assert.match(r.source.url, /^https:\/\/mars\.nasa\.gov\//)
  }
  assert.deepEqual(extrasData.orbiters.map((o) => o.id).sort(), ['hubble', 'iss', 'tiangong'])
  const earthKm = CATALOGUE_BY_ID.earth.radiusKm
  for (const el of extrasData.orbiters) {
    assert.match(el.line1, /^1 /)
    assert.match(el.line2, /^2 /)
    const epoch = wc.orbiterEpochJd(el)
    // Low Earth orbit at the epoch and a day later.
    for (const jd of [epoch, epoch + 1]) {
      const altitude = Math.hypot(...wc.orbiterPosition(el, jd)) - earthKm
      assert.ok(altitude > 250 && altitude < 700, `${el.id} altitude ${altitude}`)
    }
    // Its region is its own vicinity, never Earth's neighbourhood.
    const craft = wc.getWorld().byId[el.id]
    if (craft) assert.ok(craft.influenceKm <= craft.stopKm * 2 && craft.influenceKm < wc.getWorld().byId.earth.stopKm, `${el.id} region`)
    // Shown only while the TLE is fresh.
    assert.ok(wc.orbitersFor(epoch + 0.5).includes(el))
    assert.ok(!wc.orbitersFor(epoch + wc.ORBITER_DAYS + 0.01).includes(el))
  }
  // Precession to J2000: identity at J2000, a rotation, about 50 arcsec a year since.
  const x = [7000, 0, 0]
  assert.deepEqual(wc.precessToJ2000(x, 2451545).map((v) => Math.round(v * 1e6) / 1e6), [7000, 0, 0])
  const later = wc.precessToJ2000(x, 2451545 + 26 * 365.25)
  assert.ok(Math.abs(Math.hypot(...later) - 7000) < 1e-6)
  const degrees = (Math.acos(later[0] / 7000) * 180) / Math.PI
  assert.ok(degrees > 0.3 && degrees < 0.42, `precession ${degrees}°`)
})

test('open universe: real spacecraft speeds come from the Horizons tracks', () => {
  const speeds = Object.fromEntries(wc.referenceSpeeds(Date.UTC(2026, 10, 19)).map((r) => [r.id, r.kms]))
  assert.ok(speeds['voyager-1'] > 15 && speeds['voyager-1'] < 19, String(speeds['voyager-1']))
  assert.ok(speeds['parker-solar-probe'] > 150 && speeds['parker-solar-probe'] < 220, String(speeds['parker-solar-probe']))
})

test('open universe: listed in the navigation, loaded lazily', () => {
  assert.ok(NAV_ITEMS.some((item) => item.id === 'open' && item.status === 'live'))
  const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8')
  assert.match(app, /lazy\(loadOpenUniverseHud\)/)
  const scenes = fs.readFileSync(path.join(root, 'src/scenes/SpaceEnvironment.jsx'), 'utf8')
  assert.match(scenes, /lazy\(\(\) => import\('\.\/OpenUniverse\.jsx'\)\)/)
})
