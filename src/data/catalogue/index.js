import measured from './measured.json' with { type: 'json' }
import { BLACK_HOLES } from '../blackholes.js'
import { GALAXIES } from '../galaxies.js'
import { NEBULAE } from '../nebulae.js'
import {
  BINARIES,
  DEEP_NOTES,
  DWARF_DIAMETERS_KM,
  DWARF_NOTES,
  EXOPLANET_NOTES,
  MOON_NOTES,
  OVERRIDES,
  PLANET_CLASS,
  STAR_NOTES,
} from './notes.js'
import { PLANETS } from '../planets.js'

/**
 * The universe catalogue: one list of every object, assembled from archive
 * data (measured.json). This module is only ever imported by lazy chunks, so
 * none of it reaches the first load.
 *
 * Every entry keeps `null` for anything the sources do not give. A gap is
 * shown as a gap, never filled with a guess.
 */

export const OBJECT_TYPES = {
  star: { label: 'Stars', one: 'Star', color: '#ffd28a' },
  planet: { label: 'Planets', one: 'Planet', color: '#6fb6ff' },
  dwarf: { label: 'Dwarf planets', one: 'Dwarf planet', color: '#c9a27a' },
  moon: { label: 'Moons', one: 'Moon', color: '#cfd8e8' },
  exoplanet: { label: 'Exoplanets', one: 'Exoplanet', color: '#7fd3a0' },
  cluster: { label: 'Star clusters', one: 'Star cluster', color: '#bcd6ff' },
  nebula: { label: 'Nebulae', one: 'Nebula', color: '#ff7fb0' },
  galaxy: { label: 'Galaxies', one: 'Galaxy', color: '#b9a3ff' },
  blackhole: { label: 'Black holes', one: 'Black hole', color: '#ff8a3d' },
}

const SOURCES = {
  exoplanet: { label: 'NASA Exoplanet Archive', url: 'https://exoplanetarchive.ipac.caltech.edu/' },
  jplPlanets: { label: 'JPL Solar System Dynamics: planets', url: 'https://ssd.jpl.nasa.gov/planets/phys_par.html' },
  jplMoons: { label: 'JPL Solar System Dynamics: satellites', url: 'https://ssd.jpl.nasa.gov/sats/phys_par/' },
  jplSbdb: { label: 'JPL Small-Body Database', url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html' },
  nasaDwarfs: { label: 'NASA: dwarf planets', url: 'https://science.nasa.gov/dwarf-planets/' },
  simbad: { label: 'SIMBAD (CDS)', url: 'https://simbad.cds.unistra.fr/simbad/' },
}

export const DATA_RETRIEVED = measured.retrieved

const SUN_RADIUS_KM = 695700
const EARTH_RADIUS_KM = 6371
const AU_LY = 1.5813e-5

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/** Equatorial coordinates (degrees) to galactic longitude and latitude. */
export function toGalactic(raDeg, decDeg) {
  const rad = Math.PI / 180
  const ra = raDeg * rad
  const dec = decDeg * rad
  const poleRa = 192.85948 * rad
  const poleDec = 27.12825 * rad
  const sinB = Math.sin(dec) * Math.sin(poleDec) + Math.cos(dec) * Math.cos(poleDec) * Math.cos(ra - poleRa)
  const b = Math.asin(sinB)
  const y = Math.cos(dec) * Math.sin(ra - poleRa)
  const x = Math.sin(dec) * Math.cos(poleDec) - Math.cos(dec) * Math.sin(poleDec) * Math.cos(ra - poleRa)
  return { l: (122.93192 * rad - Math.atan2(y, x)) / rad, b: b / rad }
}

/**
 * Distance on the map. Compressed logarithmically so one view holds both the
 * nearest star and the furthest quasar; directions are real, radii are not.
 */
export const mapRadius = (distanceLy) => 5.2 * Math.log10(1 + Math.max(distanceLy, 0) / 1.6)

/** Position on the map: galactic plane in XZ, galactic centre along +X. */
export function mapPosition(entry) {
  if (entry.ra == null || entry.distanceLy == null) return [0, 0, 0]
  const { l, b } = toGalactic(entry.ra, entry.dec)
  const r = mapRadius(entry.distanceLy)
  const rad = Math.PI / 180
  return [r * Math.cos(b * rad) * Math.cos(l * rad), r * Math.sin(b * rad), r * Math.cos(b * rad) * Math.sin(l * rad)]
}

/** True position in light-years, for real distances between objects. */
export function truePosition(entry) {
  if (entry.ra == null || entry.distanceLy == null) return [0, 0, 0]
  const { l, b } = toGalactic(entry.ra, entry.dec)
  const rad = Math.PI / 180
  const d = entry.distanceLy
  return [d * Math.cos(b * rad) * Math.cos(l * rad), d * Math.sin(b * rad), d * Math.cos(b * rad) * Math.sin(l * rad)]
}

// Stars whose planets are in the catalogue share a system with them.
const HOST_SYSTEMS = { 'trappist-1': 'host:trappist-1', proxima: 'host:proxima-cen', 'epsilon-eridani': 'host:eps-eri' }

function starEntries() {
  const sun = {
    id: 'sun',
    name: 'Sun',
    type: 'star',
    class: STAR_NOTES.sun[0],
    note: STAR_NOTES.sun[1],
    distanceLy: 0,
    radiusKm: SUN_RADIUS_KM,
    temperatureK: 5772,
    spectralType: 'G2V',
    system: 'sol',
    sources: [{ label: 'NASA Sun Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html' }],
  }
  const names = {
    'sirius-b': 'Sirius B', 'alpha-cen-a': 'Alpha Centauri A', 'alpha-cen-b': 'Alpha Centauri B', proxima: 'Proxima Centauri',
    barnard: 'Barnard’s Star', 'wolf-359': 'Wolf 359', 'tau-ceti': 'Tau Ceti', 'epsilon-eridani': 'Epsilon Eridani',
    '61-cygni-a': '61 Cygni A', 'eta-carinae': 'Eta Carinae', 'vy-cma': 'VY Canis Majoris', 'uy-scuti': 'UY Scuti',
    'wr-104': 'WR 104', 'van-maanen': 'Van Maanen’s Star', 'psr-b1919': 'PSR B1919+21', 'crab-pulsar': 'Crab Pulsar',
    'vela-pulsar': 'Vela Pulsar', 'trappist-1': 'TRAPPIST-1',
  }
  const stars = Object.entries(measured.stars).map(([id, m]) => {
    const [klass, note] = STAR_NOTES[id] ?? ['Star', '']
    const override = OVERRIDES[id] ?? {}
    return {
      id,
      name: names[id] ?? id[0].toUpperCase() + id.slice(1),
      type: 'star',
      class: klass,
      note,
      ra: m.ra,
      dec: m.dec,
      distanceLy: 'distanceLy' in override ? override.distanceLy : m.distanceLy,
      distanceNote: override.note,
      estimated: override.estimated ?? false,
      radiusKm: m.radiusSun ? m.radiusSun * SUN_RADIUS_KM : null,
      temperatureK: m.teffK,
      spectralType: m.spectralType,
      magnitude: m.magnitude,
      binary: BINARIES[id] ?? null,
      system: HOST_SYSTEMS[id] ?? `star:${id}`,
      sources: [SOURCES.simbad],
    }
  })
  return [sun, ...stars]
}

function planetEntries() {
  return PLANETS.map((planet) => {
    const m = measured.planets[planet.id]
    return {
      id: planet.id,
      name: planet.name,
      type: 'planet',
      class: PLANET_CLASS[planet.id],
      note: planet.facts.description,
      distanceLy: 0,
      radiusKm: m.radiusKm,
      massKg: m.massE24Kg * 1e24,
      density: m.density,
      gravity: m.gravity,
      periodDays: m.orbitYears * 365.25,
      rotationDays: Math.abs(m.rotationDays),
      temperatureText: planet.facts.temperature,
      moonsText: planet.facts.moons,
      system: 'sol',
      moonSystem: `moons:${planet.id}`,
      sources: [SOURCES.jplPlanets],
    }
  })
}

function dwarfEntries() {
  const order = ['ceres', 'pluto', 'haumea', 'makemake', 'eris']
  return order.map((id) => {
    const m = measured.smallBodies[id]
    const pluto = id === 'pluto' ? measured.planets.pluto : null
    const stated = DWARF_DIAMETERS_KM[id]
    const diameter = pluto ? pluto.radiusKm * 2 : (m.diameterKm ?? stated?.value ?? null)
    return {
      id,
      name: id[0].toUpperCase() + id.slice(1),
      type: 'dwarf',
      class: 'Dwarf planet',
      note: DWARF_NOTES[id][0],
      distanceLy: 0,
      radiusKm: diameter ? diameter / 2 : null,
      radiusNote: stated?.note,
      massKg: pluto ? pluto.massE24Kg * 1e24 : null,
      density: pluto?.density ?? m.density,
      periodDays: m.periodDays,
      rotationDays: m.rotationHours ? m.rotationHours / 24 : null,
      semiMajorAu: m.semiMajorAu,
      eccentricity: m.eccentricity,
      system: 'sol',
      moonSystem: id === 'pluto' ? 'moons:pluto' : null,
      sources: stated ? [SOURCES.jplSbdb, SOURCES.nasaDwarfs] : [SOURCES.jplSbdb],
    }
  })
}

function moonEntries() {
  return Object.entries(measured.moons).map(([id, m]) => {
    const [parent, klass, note] = MOON_NOTES[id]
    return {
      id,
      name: id[0].toUpperCase() + id.slice(1),
      type: 'moon',
      class: `Moon of ${parent} · ${klass}`,
      note,
      distanceLy: 0,
      radiusKm: m.radiusKm,
      massKg: m.gm / 6.6743e-20,
      density: m.density,
      periodDays: Math.abs(m.periodDays),
      orbitKm: m.orbitKm,
      eccentricity: m.eccentricity,
      parent: parent.toLowerCase(),
      system: `moons:${parent.toLowerCase()}`,
      sources: [SOURCES.jplMoons],
    }
  })
}

/** Broad class from radius and temperature, using common working thresholds. */
function exoplanetClass(p) {
  const r = p.radiusEarth
  // Close-in as well as warm: young imaged giants are hot but far from their star.
  const hot = (p.equilibriumK ?? 0) > 1000 && (p.periodDays ?? Infinity) < 30
  if (r >= 6) return hot ? 'Hot Jupiter' : 'Gas giant'
  if (r >= 3) return hot ? 'Hot Neptune' : 'Ice giant'
  if (r >= 1.75) return 'Sub-Neptune'
  if (r >= 1.25) return 'Super-Earth'
  return 'Earth-sized'
}

function habitableCandidate(p) {
  return p.equilibriumK != null && p.equilibriumK >= 175 && p.equilibriumK <= 320 && p.radiusEarth != null && p.radiusEarth < 2.7
}

function exoplanetEntries() {
  return measured.exoplanets.map((p) => {
    const klass = exoplanetClass(p)
    return {
      id: slug(p.name),
      name: p.name,
      type: 'exoplanet',
      class: klass,
      note: EXOPLANET_NOTES[p.name] ?? `A ${klass.toLowerCase()} found by ${p.method.toLowerCase()} in ${p.discovered}.`,
      ra: p.ra,
      dec: p.dec,
      distanceLy: p.distanceLy,
      radiusKm: p.radiusEarth != null ? p.radiusEarth * EARTH_RADIUS_KM : null,
      massKg: p.massEarth != null ? p.massEarth * 5.972e24 : null,
      temperatureK: p.equilibriumK,
      temperatureLabel: 'Equilibrium temperature',
      periodDays: p.periodDays,
      semiMajorAu: p.semiMajorAu,
      eccentricity: p.eccentricity,
      discovered: p.discovered,
      method: p.method,
      host: p.host,
      hostTeffK: p.starTeffK,
      hostRadiusSun: p.starRadiusSun,
      hostType: p.starType,
      temperate: habitableCandidate(p),
      system: `host:${slug(p.host)}`,
      sources: [SOURCES.exoplanet],
    }
  })
}

const EXPLORER = {
  galaxy: 'galaxies',
  nebula: 'nebulae',
  blackhole: 'black-holes',
}

const CURATED_ALIASES = { m87: null }

function deepEntries() {
  const curated = {
    ...Object.fromEntries(GALAXIES.map((entry) => [entry.id, entry])),
    ...Object.fromEntries(NEBULAE.map((entry) => [entry.id, entry])),
    ...Object.fromEntries(BLACK_HOLES.map((entry) => [entry.id, entry])),
  }
  return Object.entries(DEEP_NOTES).map(([id, [type, klass, note]]) => {
    const m = measured.deep[id] ?? {}
    const override = OVERRIDES[id] ?? {}
    // The curated 'm87' is the black hole, so the galaxy entry must not claim it.
    const entry = id in CURATED_ALIASES ? (type === 'galaxy' ? GALAXIES.find((g) => g.id === 'virgo-a') : null) : curated[id]
    const scene = entry ? EXPLORER[type] : null
    return {
      id,
      name: NAMES[id] ?? entry?.name ?? id,
      type,
      class: klass,
      note: entry?.description ?? note,
      ra: m.ra,
      dec: m.dec,
      distanceLy: override.distanceLy ?? m.distanceLy ?? null,
      distanceNote: override.note ?? (m.distanceMethod === 'published median' ? 'Median of published values in SIMBAD.' : undefined),
      estimated: override.estimated ?? false,
      morphology: m.morphology,
      redshift: m.redshift,
      magnitude: m.magnitude,
      facts: entry?.facts,
      massSuns: entry?.massSuns,
      system: type === 'cluster' ? `cluster:${id}` : null,
      explorer: scene ? { scene, id: entry.id } : null,
      sources: [...(entry?.sources ?? []), SOURCES.simbad],
    }
  })
}

const NAMES = {
  lagoon: 'Lagoon Nebula', rosette: 'Rosette Nebula', 'cats-eye': 'Cat’s Eye Nebula', trifid: 'Trifid Nebula', tarantula: 'Tarantula Nebula',
  pleiades: 'Pleiades', hyades: 'Hyades', beehive: 'Beehive Cluster', 'double-cluster': 'Double Cluster', 'ngc-3603': 'NGC 3603',
  'omega-centauri': 'Omega Centauri', '47-tucanae': '47 Tucanae', hercules: 'Hercules Cluster', bode: 'Bode’s Galaxy', cigar: 'Cigar Galaxy',
  m87: 'Messier 87', 'ngc-1300': 'NGC 1300', 'southern-pinwheel': 'Southern Pinwheel', sunflower: 'Sunflower Galaxy', pinwheel: 'Pinwheel Galaxy',
  lmc: 'Large Magellanic Cloud', smc: 'Small Magellanic Cloud', cartwheel: 'Cartwheel Galaxy', 'black-eye': 'Black Eye Galaxy', 'centaurus-a': 'Centaurus A',
  'sgr-a': 'Sagittarius A*', 'cygnus-x1': 'Cygnus X-1', 'ton-618': 'TON 618',
}

// M87 the galaxy and M87* its black hole are one position, two objects.
function m87BlackHole() {
  const hole = BLACK_HOLES.find((entry) => entry.id === 'm87')
  const m = measured.deep.m87
  return {
    id: 'm87-star',
    name: 'M87*',
    type: 'blackhole',
    class: 'Supermassive',
    note: hole.description,
    ra: m.ra,
    dec: m.dec,
    distanceLy: m.distanceLy,
    facts: hole.facts,
    massSuns: hole.massSuns,
    system: null,
    explorer: { scene: 'black-holes', id: 'm87' },
    sources: hole.sources,
  }
}

// No distance from Earth to our own galaxy, so it sits outside the map.
function milkyWay() {
  const galaxy = GALAXIES.find((entry) => entry.id === 'milky-way')
  return {
    id: 'milky-way',
    name: galaxy.name,
    type: 'galaxy',
    class: 'Barred spiral',
    note: galaxy.description,
    distanceLy: 0,
    facts: galaxy.facts,
    system: null,
    explorer: { scene: 'galaxies', id: 'milky-way' },
    sources: [{ label: 'NASA: the Milky Way', url: 'https://science.nasa.gov/resource/the-milky-way-galaxy/' }],
  }
}

export const CATALOGUE = [
  milkyWay(),
  ...starEntries(),
  ...planetEntries(),
  ...dwarfEntries(),
  ...moonEntries(),
  ...exoplanetEntries(),
  ...deepEntries(),
  m87BlackHole(),
]

export const CATALOGUE_BY_ID = Object.fromEntries(CATALOGUE.map((entry) => [entry.id, entry]))

/** Bodies sharing a system, with the central body first. */
export function systemMembers(systemId) {
  if (!systemId) return []
  if (systemId === 'sol') return CATALOGUE.filter((entry) => entry.system === 'sol')
  return CATALOGUE.filter((entry) => entry.system === systemId)
}

/** Objects closest to this one in true distance, for "nearby". */
export function nearbyObjects(entry, count = 5) {
  if (entry.distanceLy == null || entry.ra == null) {
    return systemMembers(entry.system).filter((other) => other.id !== entry.id).slice(0, count)
  }
  const here = truePosition(entry)
  return CATALOGUE.filter((other) => other.id !== entry.id && other.ra != null && other.distanceLy != null && other.system !== entry.system)
    .map((other) => {
      const there = truePosition(other)
      return { other, away: Math.hypot(here[0] - there[0], here[1] - there[1], here[2] - there[2]) }
    })
    .sort((a, b) => a.away - b.away)
    .slice(0, count)
    .map(({ other, away }) => ({ ...other, awayLy: away }))
}

export { AU_LY }
