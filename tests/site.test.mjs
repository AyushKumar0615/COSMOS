import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { MISSIONS, AGENCIES, MISSION_TYPES, STATUS_LABELS } from '../src/data/missions.js'
import { BODY_ORDER, PLANETS } from '../src/data/planets.js'
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
