import { createRandom } from './random.js'

/**
 * The Milky Way as seen from the Sun, as point data.
 *
 * Stars are drawn from a simple galactic model in light-years: an exponential
 * disc with spiral arms, a bulge and a halo, with the Sun 26,000 light-years
 * from the centre. Each draws a class from the disc or bulge population, so
 * its colour, size and brightness belong together. Positions are then
 * compressed logarithmically about the Sun, like everything else on the map.
 *
 * These stars are procedural. Named stars in the catalogue are real; these are
 * a statistical backdrop, and no point here corresponds to a particular star.
 */

// fraction, temperature range (K), size, brightness
const CLASSES = {
  o: { name: 'Blue giant', t: [28000, 42000], size: [2.6, 4.2], light: [1, 1.5] },
  b: { name: 'Blue star', t: [11000, 28000], size: [1.7, 3], light: [0.8, 1.2] },
  a: { name: 'White star', t: [7500, 11000], size: [1.2, 2.1], light: [0.65, 1] },
  f: { name: 'Yellow-white star', t: [6000, 7500], size: [1, 1.7], light: [0.5, 0.85] },
  g: { name: 'Yellow star', t: [5200, 6000], size: [0.8, 1.4], light: [0.42, 0.75] },
  k: { name: 'Orange star', t: [3900, 5200], size: [0.7, 1.2], light: [0.34, 0.6] },
  m: { name: 'Red dwarf', t: [2600, 3900], size: [0.45, 0.85], light: [0.16, 0.36] },
  giant: { name: 'Red giant', t: [3200, 4800], size: [1.8, 3], light: [0.7, 1.1] },
  super: { name: 'Red supergiant', t: [3000, 4000], size: [3.2, 5], light: [1, 1.5] },
  dwarf: { name: 'White dwarf', t: [8000, 30000], size: [0.35, 0.6], light: [0.5, 0.8] },
  neutron: { name: 'Neutron star', t: [500000, 800000], size: [0.45, 0.7], light: [0.9, 1.3] },
}

const DISC = [['m', 0.42], ['k', 0.2], ['g', 0.12], ['f', 0.08], ['a', 0.05], ['b', 0.03], ['o', 0.006], ['giant', 0.06], ['super', 0.003], ['dwarf', 0.03], ['neutron', 0.001]]
const OLD = [['m', 0.42], ['k', 0.26], ['g', 0.1], ['giant', 0.18], ['dwarf', 0.04]]

const pick = (rng, table) => {
  let roll = rng.next()
  for (const [id, weight] of table) {
    roll -= weight
    if (roll <= 0) return id
  }
  return 'm'
}

/** Approximate sRGB colour of a blackbody, after Tanner Helland's fit. */
export function temperatureColor(kelvin) {
  const t = Math.min(Math.max(kelvin, 1000), 40000) / 100
  const clamp = (v) => Math.min(255, Math.max(0, v)) / 255
  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [clamp(red), clamp(green), clamp(blue)]
}

const SUN_TO_CENTRE = 26000

function discPoint(rng) {
  // Rejection against four logarithmic arms gives the disc its structure.
  for (let tries = 0; tries < 6; tries += 1) {
    const r = -9000 * Math.log(1 - rng.next() * 0.995)
    const theta = rng.next() * Math.PI * 2
    const arm = 4 * (theta - Math.log(Math.max(r, 1500) / 1500) / 0.22)
    if (0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.cos(arm), 3) > rng.next()) {
      return [r * Math.cos(theta), rng.gauss() * (260 + r * 0.035), r * Math.sin(theta)]
    }
  }
  return [0, 0, 0]
}

/**
 * @param count  points to generate
 * @param compress  the map's distance function, ly to scene units
 * @param clusters  [{ position, kind, stars, spread }] in scene units
 */
export function generateStarfield(count, compress, clusters = []) {
  const rng = createRandom(20260)
  const list = []

  const push = (position, classId, orbit = 0, phase = 0) => {
    const c = CLASSES[classId]
    const temperature = c.t[0] + rng.next() * (c.t[1] - c.t[0])
    list.push({
      position,
      color: classId === 'neutron' ? [0.75, 0.86, 1] : temperatureColor(temperature),
      size: c.size[0] + rng.next() * (c.size[1] - c.size[0]),
      light: c.light[0] + rng.next() * (c.light[1] - c.light[0]),
      twinkle: rng.next(),
      orbit,
      phase,
      pulse: classId === 'neutron' ? 1 : 0,
    })
  }

  const place = (x, y, z) => {
    const d = Math.hypot(x, y, z) || 1
    const r = compress(d)
    return [(x / d) * r, (y / d) * r, (z / d) * r]
  }

  const fromCentre = (p) => place(p[0] + SUN_TO_CENTRE, p[1], p[2])

  const local = Math.round(count * 0.3)
  const bulge = Math.round(count * 0.14)
  const halo = Math.round(count * 0.03)
  const disc = count - local - bulge - halo

  for (let i = 0; i < disc; i += 1) {
    const p = fromCentre(discPoint(rng))
    const id = pick(rng, DISC)
    // About one in eight is drawn as a pair circling a shared centre.
    if (rng.next() < 0.12) {
      const orbit = 0.012 + rng.next() * 0.03
      const phase = rng.next() * Math.PI * 2
      push(p, id, orbit, phase)
      push(p, pick(rng, DISC), orbit, phase + Math.PI)
    } else {
      push(p, id)
    }
  }
  for (let i = 0; i < bulge; i += 1) {
    const [dx, dy, dz] = rng.direction()
    const r = Math.abs(rng.gauss()) * 4200
    push(fromCentre([dx * r, dy * r * 0.62, dz * r]), pick(rng, OLD))
    // Compression piles the bulge up on one shell, so each star must be faint.
    list[list.length - 1].light *= 0.3
  }
  for (let i = 0; i < halo; i += 1) {
    const [dx, dy, dz] = rng.direction()
    const r = 8000 + rng.next() ** 2 * 60000
    push(fromCentre([dx * r, dy * r, dz * r]), pick(rng, OLD))
  }
  // The neighbourhood: enough local stars that the sky around you is not empty.
  for (let i = 0; i < local; i += 1) {
    const [dx, dy, dz] = rng.direction()
    const r = Math.pow(10, 0.6 + rng.next() * 3.2)
    push(place(dx * r, dy * r * 0.7, dz * r), pick(rng, DISC))
  }
  for (const cluster of clusters) {
    const table = cluster.kind === 'globular' ? OLD : [['b', 0.22], ['a', 0.28], ['f', 0.25], ['g', 0.15], ['o', 0.03], ['k', 0.07]]
    for (let i = 0; i < cluster.stars; i += 1) {
      const [dx, dy, dz] = rng.direction()
      const r = Math.abs(rng.gauss()) * cluster.spread
      push([cluster.position[0] + dx * r, cluster.position[1] + dy * r, cluster.position[2] + dz * r], pick(rng, table))
    }
  }

  // Shuffled, so showing only the first part of the buffer thins the sky
  // evenly: that is the level-of-detail control.
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }

  const n = list.length
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  const shape = new Float32Array(n * 4) // size, light, twinkle, pulse
  // Distant stars fade, as they do in the sky, which gives the map its depth.
  for (const star of list) {
    const r = Math.hypot(star.position[0], star.position[1], star.position[2])
    star.light *= 0.16 + 0.84 * Math.exp(-r / 21)
  }
  const orbits = new Float32Array(n * 2) // radius, phase
  list.forEach((star, i) => {
    positions.set(star.position, i * 3)
    colors.set(star.color, i * 3)
    shape.set([star.size, star.light, star.twinkle, star.pulse], i * 4)
    orbits.set([star.orbit, star.phase], i * 2)
  })
  return { positions, colors, shape, orbits, count: n }
}

/** Stars of one cluster, in its own space, for the close-up view. */
export function generateCluster(kind, seed, count) {
  const rng = createRandom(seed)
  const table = kind === 'globular' ? OLD : [['b', 0.25], ['a', 0.3], ['f', 0.25], ['g', 0.12], ['o', 0.04], ['k', 0.04]]
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const [dx, dy, dz] = rng.direction()
    // King-like falloff: dense core, thin outskirts.
    const r = kind === 'globular' ? 15 * Math.pow(rng.next(), 2.2) + Math.abs(rng.gauss()) * 1.6 : Math.abs(rng.gauss()) * 9
    positions.set([dx * r, dy * r, dz * r], i * 3)
    const c = CLASSES[pick(rng, table)]
    colors.set(temperatureColor(c.t[0] + rng.next() * (c.t[1] - c.t[0])), i * 3)
    sizes[i] = c.size[0] + rng.next() * (c.size[1] - c.size[0])
  }
  return { positions, colors, sizes }
}
