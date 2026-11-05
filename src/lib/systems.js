import { CATALOGUE_BY_ID, systemMembers } from '../data/catalogue/index.js'
import { bodyVisual, starLook } from './bodyVisuals.js'

/**
 * Turns a catalogue system into something drawable. Nothing here is to scale.
 * Orbit radii keep their order and rough ratios, compressed with a power law;
 * sizes are compressed too; and speeds keep their order but are slowed and
 * evened out. The interface says so, and profiles quote the true values.
 */

const HOST_NAMES = { 'proxima-cen': 'proxima', 'trappist-1': 'trappist-1', 'eps-eri': 'epsilon-eridani' }

const periodOf = (entry) => entry.periodDays ?? 365

function layout(bodies, firstRadius) {
  const shortest = Math.min(...bodies.map(periodOf))
  const biggest = Math.max(...bodies.map((body) => body.radiusKm ?? 1000))
  return [...bodies]
    .sort((a, b) => periodOf(a) - periodOf(b))
    .map((entry, index) => ({
      entry,
      visual: bodyVisual(entry),
      // a ∝ P^(2/3) by Kepler's third law, then compressed.
      orbit: firstRadius * Math.pow(periodOf(entry) / shortest, 0.24) + index * 1.4,
      size: 0.22 + 1.05 * Math.pow((entry.radiusKm ?? 1000) / biggest, 0.42),
      speed: 0.5 / Math.pow(periodOf(entry) / shortest, 0.36),
      phase: (index * 2.399963) % (Math.PI * 2),
    }))
}

function starFor(entry) {
  return { kind: 'star', entry, look: starLook(entry) }
}

/** The drawable description of one system, by id. */
export function buildSystem(systemId) {
  if (systemId === 'sol') {
    const members = systemMembers('sol')
    const sun = members.find((entry) => entry.type === 'star')
    return { id: systemId, title: 'Solar System', center: starFor(sun), centerSize: 2.6, bodies: layout(members.filter((entry) => entry.type !== 'star'), 6), parent: null }
  }
  if (systemId.startsWith('moons:')) {
    const planet = CATALOGUE_BY_ID[systemId.slice(6)]
    const moons = systemMembers(systemId)
    return {
      id: systemId,
      title: `${planet.name} and its moons`,
      center: { kind: 'body', entry: planet, visual: bodyVisual(planet) },
      centerSize: 2.4,
      bodies: layout(moons, 5.4),
      parent: 'sol',
    }
  }
  if (systemId.startsWith('host:')) {
    const key = systemId.slice(5)
    const planets = systemMembers(systemId).filter((entry) => entry.type === 'exoplanet')
    const star = CATALOGUE_BY_ID[HOST_NAMES[key]]
    const first = planets[0]
    const center = star ?? { id: `host-${key}`, name: first.host, type: 'star', class: first.hostType ? `Host star · ${first.hostType}` : 'Host star', temperatureK: first.hostTeffK, ra: first.ra, dec: first.dec, distanceLy: first.distanceLy }
    return { id: systemId, title: `${first.host} system`, center: starFor(center), centerSize: 1.9, bodies: layout(planets, 5.2), parent: null }
  }
  if (systemId.startsWith('star:')) {
    const entry = CATALOGUE_BY_ID[systemId.slice(5)]
    return { id: systemId, title: entry.name, center: starFor(entry), centerSize: 2.6, bodies: [], parent: null }
  }
  if (systemId.startsWith('cluster:')) {
    const entry = CATALOGUE_BY_ID[systemId.slice(8)]
    return { id: systemId, title: entry.name, cluster: entry, bodies: [], parent: null }
  }
  return null
}

/** The system a body is viewed in, and any system nested below it. */
export function homeSystem(entry) {
  return entry.system ?? null
}
