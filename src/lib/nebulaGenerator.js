import * as THREE from 'three'
import { createPointBuffer, createRandom, mixRgb, rgb, scaleRgb } from './random.js'
import { thin } from './quality.js'

/**
 * Procedural nebulae, built as layers of camera-facing cloud sprites:
 *
 *   clouds  additive — glowing ionised gas
 *   dust    normal   — dark, light-absorbing dust, drawn over the glow
 *   rims    additive — bright edges where starlight strikes dust
 *   stars            — point stars, including the ones lighting the gas
 *   glows            — halos around the brightest stars
 *
 * "Lighting" is evaluated once at generation: every gas sprite is
 * brightened by its distance to each light source, so regions near the hot
 * stars glow hardest. Each builder follows the real object's structure.
 */

const TAU = Math.PI * 2

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function lightAt(point, lights, ambient) {
  let f = ambient
  for (const light of lights) {
    const d = distance(point, light.p) / light.falloff
    f += light.intensity / (1 + d * d)
  }
  return Math.min(f, 1.8)
}

// Noise channel per sprite (see lib/cloudTexture.js): `variant` in
//   [0, .25) soft billows   [.25, .5) ridged   [.5, .75) wisps   [.75, 1) clumps
// Ridged noise turns into hollow rings on small sprites, so it is only ever
// chosen explicitly, for large ones.
export const CHANNEL = {
  soft: (rng) => rng.next() * 0.24,
  ridged: (rng) => 0.25 + rng.next() * 0.24,
  wisp: (rng) => 0.5 + rng.next() * 0.24,
  clump: (rng) => 0.75 + rng.next() * 0.24,
}

function makeLayer(rng) {
  const list = []
  list.add = (p, s, c, a, { st = 1, v } = {}) => {
    const variant = v ?? (rng.next() < 0.5 ? CHANNEL.soft(rng) : CHANNEL.wisp(rng))
    list.push({ p, s, st, c, a, r: rng.next() * TAU, v: variant })
  }
  return list
}

function addFieldStars(stars, rng, count, extent, { minSize = 0.3, maxSize = 1.1 } = {}) {
  const palette = [rgb('#dfe8ff'), rgb('#fff2dc'), rgb('#ffd9b0'), rgb('#bcd2ff')]
  for (let i = 0; i < count; i += 1) {
    stars.add(
      [rng.range(-extent[0], extent[0]), rng.range(-extent[1], extent[1]), rng.range(-extent[2], extent[2])],
      scaleRgb(rng.pick(palette), rng.range(0.4, 1)),
      rng.range(minSize, maxSize),
    )
  }
}

function addCluster(stars, rng, center, count, spread, colors, sizes) {
  for (let i = 0; i < count; i += 1) {
    stars.add(
      [center[0] + rng.gauss() * spread, center[1] + rng.gauss() * spread, center[2] + rng.gauss() * spread * 0.7],
      scaleRgb(rng.pick(colors), rng.range(0.6, 1)),
      rng.range(sizes[0], sizes[1]),
    )
  }
}

/** A dust column with a lit rim on the side facing `light`. */
function addPillar(dust, rims, rng, light, { x, base, height, width, lean = 0, z = 0, count = 80, rimCount = 40 }) {
  const dustLow = rgb('#2c1910')
  const dustHigh = rgb('#43281a')
  const rimColor = rgb('#ffcf8a')
  const capColor = rgb('#ffe3b4')

  for (let i = 0; i < count; i += 1) {
    const t = Math.pow(rng.next(), 0.8)
    const w = width * (1 - 0.55 * t)
    const cx = x + lean * t * height
    dust.add(
      [cx + rng.gauss() * w * 0.26, base + t * height, z + rng.gauss() * w * 0.24],
      w * rng.range(1.05, 1.6),
      mixRgb(dustLow, dustHigh, rng.next()),
      rng.range(0.78, 0.94),
      { v: CHANNEL.soft(rng) },
    )
  }

  // Rim: the outer skin of the column on the side facing the light.
  const toLight = new THREE.Vector2(light.p[0] - x, light.p[1] - (base + height)).normalize()
  const facing = Math.atan2(toLight.y, toLight.x)
  for (let i = 0; i < rimCount; i += 1) {
    const t = Math.pow(rng.next(), 0.6)
    const w = width * (1 - 0.55 * t)
    const cx = x + lean * t * height
    const angle = facing + rng.gauss() * 0.7
    rims.add(
      [cx + Math.cos(angle) * w * 0.5, base + t * height + Math.max(0, Math.sin(angle)) * w * 0.2, z + rng.gauss() * w * 0.2],
      rng.range(2.4, 4.4),
      scaleRgb(rimColor, 0.45 + 0.45 * t),
      rng.range(0.1, 0.2),
      { v: CHANNEL.wisp(rng) },
    )
  }

  // Bright cap where the top is being evaporated.
  const top = [x + lean * height, base + height, z]
  for (let i = 0; i < 8; i += 1) {
    rims.add(
      [top[0] + rng.gauss() * width * 0.25, top[1] + width * 0.15 + rng.gauss() * width * 0.12, top[2] + rng.gauss() * 0.8],
      rng.range(3, 5.5),
      capColor,
      rng.range(0.14, 0.26),
      { v: CHANNEL.soft(rng) },
    )
  }
}

// ---------------------------------------------------------------------------

function buildOrion() {
  const rng = createRandom(42)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const trapezium = [0, 0, 2]
  const lights = [{ p: trapezium, intensity: 1.5, falloff: 14 }]

  const teal = rgb('#5fe3cf')
  const white = rgb('#e9fbff')
  const pink = rgb('#ff5a8e')
  const red = rgb('#c62e4a')
  const orange = rgb('#ff8a5c')

  // Hot core: oxygen glows teal-green closest to the Trapezium.
  for (let i = 0; i < 46; i += 1) {
    const r = Math.abs(rng.gauss()) * 5
    const [dx, dy, dz] = rng.direction()
    const p = [dx * r, dy * r + 1, dz * r * 0.5 - 3]
    clouds.add(p, rng.range(6, 13), scaleRgb(mixRgb(teal, white, rng.next() * 0.4), 0.55 * lightAt(p, lights, 0.2)), rng.range(0.07, 0.13))
  }

  // The bat-wing bowl: the nebula is a blister on the near face of a much
  // larger cloud, so the glowing surface curves away behind the stars.
  for (let i = 0; i < 200; i += 1) {
    const left = rng.next() < 0.5
    const t = rng.next()
    const angle = left ? 2.1 + t * 1.9 : -1.0 + t * 1.8
    const radius = 7 + Math.pow(rng.next(), 0.7) * 24
    const x = Math.cos(angle) * radius * 1.15 + rng.gauss() * 2.5
    const y = Math.sin(angle) * radius * 0.85 + rng.gauss() * 2.5
    const z = -0.018 * (x * x + y * y) - 2 + rng.gauss() * 3
    const p = [x, y, z]
    let color = mixRgb(pink, red, radius / 32)
    if (rng.next() < 0.15) color = orange
    clouds.add(p, rng.range(9, 19) * (0.65 + radius / 40), scaleRgb(color, lightAt(p, lights, 0.35)), rng.range(0.1, 0.2))
  }

  // Faint outer envelope.
  for (let i = 0; i < 60; i += 1) {
    const angle = rng.next() * TAU
    const radius = rng.range(22, 44)
    const p = [Math.cos(angle) * radius * 1.2, Math.sin(angle) * radius * 0.9, -0.02 * radius * radius - 4 + rng.gauss() * 4]
    clouds.add(p, rng.range(22, 36), rgb('#7e2a5a'), rng.range(0.06, 0.11))
  }

  // M43, the small detached region to the north, with its own star.
  const m43 = [5, 21, -5]
  for (let i = 0; i < 22; i += 1) {
    const [dx, dy, dz] = rng.direction()
    const r = Math.abs(rng.gauss()) * 3.5
    const p = [m43[0] + dx * r, m43[1] + dy * r, m43[2] + dz * r]
    clouds.add(p, rng.range(5, 10), mixRgb(pink, orange, rng.next() * 0.4), rng.range(0.12, 0.22))
  }

  // Dark bay between M42 and M43, and lanes across the western wing.
  for (let i = 0; i < 28; i += 1) {
    dust.add([rng.range(-14, 9), 13 + rng.gauss() * 1.6, 3 + rng.gauss()], rng.range(5, 9), rgb('#170a10'), rng.range(0.5, 0.7), { v: CHANNEL.soft(rng) })
  }
  for (let i = 0; i < 42; i += 1) {
    const angle = rng.range(2.5, 3.5)
    const radius = rng.range(18, 32)
    dust.add([Math.cos(angle) * radius * 1.15, Math.sin(angle) * radius * 0.85, 1 + rng.gauss()], rng.range(6, 12), rgb('#140910'), rng.range(0.4, 0.6), { v: CHANNEL.soft(rng) })
  }

  // Stars: the Trapezium, the Orion Nebula Cluster around it, and field stars.
  for (const offset of [[0, 0, 0], [0.9, 0.4, 0], [-0.6, 0.8, 0], [0.3, -0.7, 0]]) {
    stars.add([trapezium[0] + offset[0], trapezium[1] + offset[1], trapezium[2] + offset[2]], rgb('#e3edff'), 3.4)
  }
  addCluster(stars, rng, trapezium, 650, 6, [rgb('#dfe8ff'), rgb('#ffe9cf'), rgb('#bcd2ff')], [0.35, 1.3])
  stars.add([m43[0], m43[1], m43[2] + 1], rgb('#fff1d8'), 2.4)
  addFieldStars(stars, rng, 380, [70, 55, 40])

  return {
    clouds,
    dust,
    rims,
    stars: stars.build(),
    glows: [
      { position: trapezium, size: 14, color: '#d5ecff', intensity: 0.32 },
      { position: [m43[0], m43[1], m43[2] + 1], size: 6, color: '#ffe8c8', intensity: 0.35 },
    ],
  }
}

function buildCrab() {
  const rng = createRandom(1054)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const A = [34, 24, 24]

  // Interior: blue synchrotron light from electrons spiralling in the
  // pulsar's magnetic field.
  for (let i = 0; i < 42; i += 1) {
    const [dx, dy, dz] = rng.direction()
    const r = Math.pow(rng.next(), 0.6) * 0.68
    const p = [dx * A[0] * r, dy * A[1] * r, dz * A[2] * r]
    clouds.add(p, rng.range(14, 26), mixRgb(rgb('#4f6cf5'), rgb('#a9c0ff'), rng.next()), rng.range(0.07, 0.13), { v: CHANNEL.soft(rng) })
  }

  // Filaments: chains of small sprites traced over the expanding shell.
  const palette = [
    [rgb('#ff7a3d'), 0.5],
    [rgb('#ff4b3e'), 0.3],
    [rgb('#d9e27a'), 0.2],
  ]
  const pickColor = () => {
    let roll = rng.next()
    for (const [color, weight] of palette) {
      if (roll < weight) return color
      roll -= weight
    }
    return palette[0][0]
  }
  const dir = new THREE.Vector3()
  const axis = new THREE.Vector3()
  for (let f = 0; f < 34; f += 1) {
    dir.fromArray(rng.direction())
    axis.fromArray(rng.direction()).cross(dir).normalize()
    const arc = rng.range(0.6, 1.6)
    const steps = 18
    const color = pickColor()
    const shell = rng.range(0.8, 1.0)
    for (let k = 0; k < steps; k += 1) {
      const d = dir.clone().applyAxisAngle(axis, (k / steps) * arc)
      d.x += rng.gauss() * 0.04
      d.y += rng.gauss() * 0.04
      d.z += rng.gauss() * 0.04
      d.normalize()
      const s = shell + rng.gauss() * 0.03
      clouds.add([d.x * A[0] * s, d.y * A[1] * s, d.z * A[2] * s], rng.range(3, 5.4), color, rng.range(0.28, 0.48))
    }
  }

  // Inner torus and jet around the pulsar, both seen in X-ray images.
  const tilt = 0.5
  for (let i = 0; i < 40; i += 1) {
    const angle = rng.next() * TAU
    const r = 5 + rng.gauss() * 0.6
    const y = Math.sin(angle) * r * Math.sin(tilt)
    const z = Math.sin(angle) * r * Math.cos(tilt)
    clouds.add([Math.cos(angle) * r, y, z], 2.6, rgb('#cfe0ff'), 0.3)
  }
  for (const sign of [1, -1]) {
    for (let i = 0; i < 10; i += 1) {
      const d = rng.range(2, 9)
      clouds.add([rng.gauss() * 0.4, sign * d * Math.cos(tilt), -sign * d * Math.sin(tilt)], 2, rgb('#bcd2ff'), 0.22)
    }
  }

  addFieldStars(stars, rng, 460, [80, 60, 60])
  stars.add([0, 0, 0], rgb('#eef4ff'), 2.8)

  return {
    clouds,
    dust,
    rims,
    stars: stars.build(),
    glows: [
      // The pulsar spins about 30 times a second; its glow here pulses far
      // more slowly and gently, for comfortable viewing.
      { position: [0, 0, 0], size: 10, color: '#eaf1ff', intensity: 0.75, pulseRate: 2 * Math.PI * 0.9, pulseAmount: 0.35 },
      { position: [0, 0, 0], size: 70, color: '#3f56c8', intensity: 0.1, power: 1.6 },
    ],
  }
}

function buildEagle() {
  const rng = createRandom(16)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const cluster = [34, 58, 8]
  const light = { p: cluster, intensity: 1.6, falloff: 42 }
  const lights = [light]

  const teal = rgb('#3fb8b0')
  const gold = rgb('#f0a24c')
  const amber = rgb('#ffcb7a')

  // The glowing cavity behind the pillars, brightest towards NGC 6611.
  for (let i = 0; i < 150; i += 1) {
    const p = [rng.range(-75, 75), rng.range(-55, 62), rng.range(-46, -14)]
    const mix = THREE.MathUtils.smoothstep(p[1] + p[0] * 0.3, -40, 50)
    clouds.add(p, rng.range(20, 36), scaleRgb(mixRgb(teal, gold, mix), lightAt(p, lights, 0.35)), rng.range(0.09, 0.17))
  }
  for (let i = 0; i < 46; i += 1) {
    const p = [rng.range(-38, 36), rng.range(-46, 26), rng.range(-20, -8)]
    const color = mixRgb(teal, amber, THREE.MathUtils.smoothstep(p[1], -40, 20))
    clouds.add(p, rng.range(16, 28), scaleRgb(color, 0.85 * lightAt(p, lights, 0.5)), rng.range(0.14, 0.24))
  }
  for (let i = 0; i < 26; i += 1) {
    const [dx, dy, dz] = rng.direction()
    const r = Math.abs(rng.gauss()) * 16
    clouds.add([cluster[0] + dx * r, cluster[1] + dy * r, cluster[2] - 12 + dz * r * 0.4], rng.range(14, 24), amber, rng.range(0.12, 0.2))
  }

  // The Pillars of Creation: three columns, the left one tallest.
  addPillar(dust, rims, rng, light, { x: -17, base: -50, height: 46, width: 8.5, lean: -0.05, z: 0, count: 95, rimCount: 46 })
  addPillar(dust, rims, rng, light, { x: 3, base: -50, height: 30, width: 7, lean: 0.04, z: -3, count: 70, rimCount: 34 })
  addPillar(dust, rims, rng, light, { x: 20, base: -50, height: 22, width: 6.2, lean: 0.08, z: 2, count: 55, rimCount: 28 })

  addCluster(stars, rng, cluster, 34, 7, [rgb('#d9e6ff'), rgb('#eef3ff')], [1.4, 3])
  addFieldStars(stars, rng, 460, [80, 65, 40])

  return {
    clouds,
    dust,
    rims,
    stars: stars.build(),
    glows: [{ position: cluster, size: 46, color: '#ffe8c2', intensity: 0.32 }],
  }
}

function buildCarina() {
  const rng = createRandom(3372)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()

  const eta = [10, 6, 0]
  const tr14 = [-14, 13, -2]
  const tr16 = [6, 1, 3]
  const lights = [
    { p: eta, intensity: 1.6, falloff: 24 },
    { p: tr14, intensity: 1.0, falloff: 20 },
    { p: tr16, intensity: 0.9, falloff: 18 },
  ]

  const blue = rgb('#4aa8ff')
  const cyan = rgb('#8fdcff')
  const orange = rgb('#ff7a3a')
  const rust = rgb('#c4442a')

  // Wide region: oxygen-blue near the hot clusters, hydrogen-orange beyond.
  for (let i = 0; i < 240; i += 1) {
    const p = [rng.gauss() * 48, rng.gauss() * 32, rng.range(-32, -6)]
    const lit = lightAt(p, lights, 0)
    const color = mixRgb(mixRgb(rust, orange, rng.next()), mixRgb(blue, cyan, rng.next()), Math.min(1, lit * 0.9))
    clouds.add(p, rng.range(18, 38), scaleRgb(color, 0.45 + Math.min(lit, 1.2) * 0.6), rng.range(0.08, 0.16))
  }
  for (let i = 0; i < 44; i += 1) {
    const center = rng.next() < 0.6 ? eta : tr16
    const [dx, dy, dz] = rng.direction()
    const r = Math.abs(rng.gauss()) * 12
    clouds.add([center[0] + dx * r, center[1] + dy * r, center[2] - 6 + dz * r * 0.4], rng.range(9, 18), mixRgb(cyan, rgb('#fff1d6'), rng.next() * 0.5), rng.range(0.14, 0.24))
  }

  // Dark V of dust lanes splitting the nebula.
  const lane = (from, to, count) => {
    for (let i = 0; i < count; i += 1) {
      const t = rng.next()
      dust.add(
        [from[0] + (to[0] - from[0]) * t + rng.gauss() * 5, from[1] + (to[1] - from[1]) * t + rng.gauss() * 4, 2 + rng.gauss()],
        rng.range(9, 17),
        rgb('#1b0f0b'),
        rng.range(0.45, 0.65),
        { v: CHANNEL.soft(rng) },
      )
    }
  }
  lane([-72, 38], [-2, -12], 62)
  lane([72, 42], [6, -14], 58)

  // The Keyhole: a dark knot of dust right beside Eta Carinae.
  for (let i = 0; i < 14; i += 1) {
    dust.add([eta[0] - 6 + rng.gauss() * 2.4, eta[1] + 4 + rng.gauss() * 2.4, 3], rng.range(3, 6), rgb('#110705'), rng.range(0.7, 0.88), { v: CHANNEL.soft(rng) })
  }

  // Mystic Mountain: a smaller pillar pointing towards Trumpler 14.
  addPillar(dust, rims, rng, lights[1], { x: -42, base: -48, height: 28, width: 7.5, lean: 0.12, z: 3, count: 60, rimCount: 26 })

  // The Homunculus, the two-lobed cloud Eta Carinae threw off in its 1840s
  // eruption. Enlarged: at true scale it would be far smaller than a pixel.
  const axis = new THREE.Vector3(0.45, 0.8, 0.3).normalize()
  for (const sign of [1, -1]) {
    for (let i = 0; i < 30; i += 1) {
      const [dx, dy, dz] = rng.direction()
      const p = [
        eta[0] + axis.x * 2.6 * sign + dx * 1.6,
        eta[1] + axis.y * 2.6 * sign + dy * 1.6,
        eta[2] + axis.z * 2.6 * sign + dz * 2.2,
      ]
      rims.add(p, rng.range(1.4, 2.6), mixRgb(rgb('#e8a070'), rgb('#f6d2a8'), rng.next()), rng.range(0.35, 0.6), { v: CHANNEL.soft(rng) })
    }
  }

  addCluster(stars, rng, tr14, 60, 3, [rgb('#cfe0ff'), rgb('#e6eeff')], [0.9, 2.4])
  addCluster(stars, rng, tr16, 50, 4, [rgb('#cfe0ff'), rgb('#e6eeff')], [0.8, 2.1])
  stars.add(eta, rgb('#fff4e0'), 4.2)
  addFieldStars(stars, rng, 1100, [110, 75, 40])

  return {
    clouds,
    dust,
    rims,
    stars: stars.build(),
    glows: [
      { position: eta, size: 24, color: '#fff2dc', intensity: 0.42 },
      { position: tr14, size: 22, color: '#cfe2ff', intensity: 0.32 },
      { position: tr16, size: 18, color: '#cfe2ff', intensity: 0.28 },
    ],
  }
}

/** Close-up of the three columns, in Webb's near-infrared palette. */
function buildPillars() {
  const rng = createRandom(116)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const light = { p: [28, 70, 22], intensity: 1.5, falloff: 46 }

  const haze = rgb('#5d86b8')
  const warm = rgb('#d9a06a')

  // Blue-grey haze: a Webb view sees through most of the surrounding gas.
  for (let i = 0; i < 120; i += 1) {
    const p = [rng.range(-70, 70), rng.range(-50, 66), rng.range(-40, -14)]
    const t = THREE.MathUtils.smoothstep(p[1], -40, 60)
    clouds.add(p, rng.range(24, 42), scaleRgb(mixRgb(warm, haze, t), 0.9), rng.range(0.16, 0.28))
  }

  const columns = [
    { x: -19, base: -56, height: 78, width: 15, lean: -0.08, z: 0, count: 190, rimCount: 96 },
    { x: 7, base: -56, height: 56, width: 12, lean: 0.07, z: -6, count: 140, rimCount: 72 },
    { x: 30, base: -56, height: 38, width: 10.5, lean: 0.12, z: 3, count: 100, rimCount: 52 },
  ]
  const tips = []
  for (const column of columns) {
    addPillar(dust, rims, rng, light, column)
    const tip = [column.x + column.lean * column.height, column.base + column.height, column.z]
    tips.push(tip)

    // Gas boiling off the head of the column, streaming towards the light.
    for (let i = 0; i < 26; i += 1) {
      const t = rng.next()
      const p = [tip[0] + t * 11 + rng.gauss() * 2.6, tip[1] + t * 15 + rng.gauss() * 2.2, tip[2] + rng.gauss() * 2]
      clouds.add(p, rng.range(4, 9), scaleRgb(rgb('#ffcf9a'), 0.9 * (1 - t * 0.7)), rng.range(0.08, 0.18), { v: CHANNEL.wisp(rng) })
    }
    // Young stars breaking out of the dense tips.
    addCluster(stars, rng, [tip[0], tip[1] - 3, tip[2] + 3], 7, 3.4, [rgb('#ff6a4d'), rgb('#ff8d5a')], [1.3, 2.6])
  }

  addFieldStars(stars, rng, 620, [85, 72, 42], { maxSize: 0.95 })

  return {
    clouds,
    dust,
    rims,
    stars: stars.build(),
    glows: tips.map((tip) => ({ position: [tip[0], tip[1] - 3, tip[2] + 4], size: 16, color: '#ff8a5c', intensity: 0.24 })),
  }
}

// Outline of the head and neck, traced in the plane of the sky.
const HORSE_OUTLINE = [
  [-16, -44], [-20, -28], [-19, -14], [-15, -2], [-13, 8], [-17, 15], [-23, 19], [-28, 18],
  [-30, 12], [-34, 9], [-35, 14], [-31, 21], [-24, 28], [-15, 31], [-6, 31], [-2, 36],
  [1, 30], [5, 26], [9, 16], [11, 4], [13, -10], [16, -26], [19, -44],
]

function insideOutline(x, y) {
  let inside = false
  for (let i = 0, j = HORSE_OUTLINE.length - 1; i < HORSE_OUTLINE.length; j = i, i += 1) {
    const [xi, yi] = HORSE_OUTLINE[i]
    const [xj, yj] = HORSE_OUTLINE[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** A dust silhouette against glowing hydrogen, with a dark cloud bank below. */
function buildHorsehead() {
  const rng = createRandom(33)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()

  // IC 434: a curtain of red hydrogen, its streaks running up and away.
  const red = rgb('#d6303c')
  const deep = rgb('#7a1730')
  const pink = rgb('#ff6b78')
  for (let i = 0; i < 300; i += 1) {
    const p = [rng.range(-96, 96), rng.range(-62, 80), rng.range(-26, -8)]
    const bright = THREE.MathUtils.smoothstep(p[1], -44, 22) * (0.7 + 0.3 * rng.next())
    clouds.add(p, rng.range(20, 38), scaleRgb(mixRgb(deep, red, bright), 0.75 + 0.75 * bright), rng.range(0.24, 0.42), { st: rng.range(1, 1.5) })
  }
  for (let i = 0; i < 70; i += 1) {
    const p = [rng.range(-90, 90), rng.range(-10, 74), rng.range(-14, -6)]
    clouds.add(p, rng.range(9, 20), pink, rng.range(0.12, 0.22), { v: CHANNEL.wisp(rng), st: 1.6 })
  }

  // The head itself: dense dust packed inside the traced outline.
  const dark = rgb('#0b0406')
  const darkEdge = rgb('#1f0a0e')
  let placed = 0
  while (placed < 900) {
    const x = rng.range(-38, 22)
    const y = rng.range(-46, 38)
    if (!insideOutline(x, y)) continue
    placed += 1
    dust.add([x, y, rng.range(-2, 5)], rng.range(5, 8.5), mixRgb(dark, darkEdge, rng.next() * 0.6), 0.98, { v: CHANNEL.soft(rng) })
  }

  // Its lit edge: a thin glow where radiation is eroding the dust.
  for (let i = 0; i < HORSE_OUTLINE.length - 1; i += 1) {
    const [ax, ay] = HORSE_OUTLINE[i]
    const [bx, by] = HORSE_OUTLINE[i + 1]
    for (let k = 0; k < 12; k += 1) {
      const t = rng.next()
      rims.add([ax + (bx - ax) * t, ay + (by - ay) * t, 6], rng.range(2.4, 5), scaleRgb(rgb('#ffb0a0'), 1), rng.range(0.14, 0.26), { v: CHANNEL.wisp(rng) })
    }
  }

  // The dark cloud bank the head rises from.
  for (let i = 0; i < 520; i += 1) {
    const x = rng.range(-105, 105)
    const top = -34 + Math.sin(x * 0.07) * 7 + Math.sin(x * 0.19 + 1.3) * 3
    dust.add([x, top - Math.abs(rng.gauss()) * 18, rng.range(-3, 9)], rng.range(8, 17), mixRgb(dark, darkEdge, rng.next()), rng.range(0.82, 0.96), { v: CHANNEL.soft(rng) })
  }

  addFieldStars(stars, rng, 340, [100, 80, 22])
  const glowStar = [52, 56, 8]
  addCluster(stars, rng, glowStar, 3, 2, [rgb('#dfe9ff')], [2.2, 3.4])

  return {
    clouds,
    dust,
    rims,
    stars: stars.build(),
    glows: [{ position: glowStar, size: 30, color: '#d9e4ff', intensity: 0.3 }],
  }
}

function addShell(layer, rng, { radius, width, axisScale, count, color, alpha, size, viewHole = 0 }) {
  for (let i = 0; i < count; i += 1) {
    const [dx, dy, dz] = rng.direction()
    if (Math.abs(dz) > 1 - viewHole) continue
    const r = radius + rng.gauss() * width
    layer.add([dx * r, dy * r, dz * r * axisScale], rng.range(size[0], size[1]), scaleRgb(color, rng.range(0.7, 1.05)), rng.range(alpha[0], alpha[1]))
  }
}

/** A barrel-shaped shell, nearly end-on, in steps of ionisation. */
function buildRing() {
  const rng = createRandom(57)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()

  // Hottest near the star, so the colours step outward: blue, green, red.
  addShell(clouds, rng, { radius: 12, width: 3, axisScale: 1.5, count: 150, color: rgb('#6fa8ff'), alpha: [0.08, 0.15], size: [11, 18] })
  addShell(clouds, rng, { radius: 22, width: 2, axisScale: 1.7, count: 620, color: rgb('#58d6c0'), alpha: [0.13, 0.24], size: [7, 12], viewHole: 0.12 })
  addShell(clouds, rng, { radius: 29, width: 2.4, axisScale: 1.7, count: 720, color: rgb('#ffb36b'), alpha: [0.13, 0.24], size: [6, 11], viewHole: 0.16 })
  addShell(rims, rng, { radius: 33, width: 1.5, axisScale: 1.6, count: 640, color: rgb('#ff4f5e'), alpha: [0.13, 0.24], size: [3.5, 7], viewHole: 0.2 })

  // Dark knots of dust and molecules threaded through the rim.
  for (let i = 0; i < 150; i += 1) {
    const theta = rng.next() * TAU
    const r = 28 + rng.gauss() * 2.6
    dust.add([Math.cos(theta) * r, Math.sin(theta) * r, rng.gauss() * 6], rng.range(0.9, 2.1), rgb('#1a0c10'), rng.range(0.28, 0.5), { v: CHANNEL.clump(rng) })
  }
  // A faint outer halo from earlier mass loss.
  addShell(clouds, rng, { radius: 46, width: 3.4, axisScale: 1.2, count: 170, color: rgb('#a43a4a'), alpha: [0.03, 0.07], size: [10, 17] })

  stars.add([0, 0, 0], rgb('#eaf1ff'), 2.6)
  addFieldStars(stars, rng, 320, [95, 80, 70], { maxSize: 0.9 })

  return { clouds, dust, rims, stars: stars.build(), glows: [{ position: [0, 0, 0], size: 13, color: '#cfe0ff', intensity: 0.34 }] }
}

/** Two tilted rings, and comet-shaped knots pointing at the white dwarf. */
function buildHelix() {
  const rng = createRandom(7293)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const tilt = (p, angle) => [p[0], p[1] * Math.cos(angle) - p[2] * Math.sin(angle), p[1] * Math.sin(angle) + p[2] * Math.cos(angle)]

  const rings = [
    { radius: 30, width: 4.4, tilt: 0.3, color: rgb('#ff7d5c'), count: 420 },
    { radius: 41, width: 5.4, tilt: -0.5, color: rgb('#ff5266'), count: 380 },
  ]
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i += 1) {
      const theta = rng.next() * TAU
      const r = ring.radius + rng.gauss() * ring.width
      const p = tilt([Math.cos(theta) * r, Math.sin(theta) * r, rng.gauss() * 3.4], ring.tilt)
      clouds.add(p, rng.range(4.5, 10), scaleRgb(ring.color, rng.range(0.7, 1.1)), rng.range(0.1, 0.2))
    }
  }
  // The blue-green core, where oxygen is ionised.
  for (let i = 0; i < 150; i += 1) {
    const [dx, dy, dz] = rng.direction()
    const r = Math.abs(rng.gauss()) * 13
    clouds.add([dx * r, dy * r, dz * r * 0.6], rng.range(7, 13), rgb('#4fb4d0'), rng.range(0.03, 0.07))
  }

  // Cometary knots: a bright head, with a fading tail streaming away from
  // the star. Each tail is a short line of shrinking sprites.
  for (let i = 0; i < 520; i += 1) {
    const theta = rng.next() * TAU
    const r = 19 + Math.abs(rng.gauss()) * 8
    const head = tilt([Math.cos(theta) * r, Math.sin(theta) * r, rng.gauss() * 3], 0.3)
    const length = Math.hypot(...head)
    const out = head.map((value) => value / length)
    rims.add(head, rng.range(0.7, 1.3), rgb('#ffd9b8'), rng.range(0.24, 0.42), { v: CHANNEL.soft(rng) })
    for (let k = 1; k <= 3; k += 1) {
      const t = k * rng.range(0.9, 1.5)
      rims.add(head.map((value, axis) => value + out[axis] * t), 0.8 - k * 0.13, rgb('#ff8a6a'), 0.2 - k * 0.05, { v: CHANNEL.soft(rng) })
    }
  }

  stars.add([0, 0, 0], rgb('#eef4ff'), 3)
  addFieldStars(stars, rng, 340, [110, 90, 70], { maxSize: 0.9 })

  return { clouds, dust, rims, stars: stars.build(), glows: [{ position: [0, 0, 0], size: 18, color: '#bfd8ff', intensity: 0.36 }] }
}

/** Shared base: a glowing cloud with hot-star lighting and a field of stars. */
function glowingCloud(seed, { count, extent, colors, alpha = [0.14, 0.26], size = [14, 30] }) {
  const rng = createRandom(seed)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const palette = colors.map(rgb)
  for (let i = 0; i < count; i += 1) {
    const p = [rng.gauss() * extent[0], rng.gauss() * extent[1], rng.gauss() * extent[2]]
    clouds.add(p, rng.range(size[0], size[1]), scaleRgb(rng.pick(palette), rng.range(0.7, 1.15)), rng.range(alpha[0], alpha[1]))
  }
  return { rng, clouds, dust, rims, stars }
}

function buildLagoon() {
  const { rng, clouds, dust, rims, stars } = glowingCloud(8, { count: 330, extent: [40, 24, 16], colors: ['#ff4f78', '#ff7f9a', '#e0407a'] })
  // The lagoon: a dark lane curving through the middle.
  for (let i = 0; i < 280; i += 1) {
    const t = rng.range(-1, 1)
    dust.add([t * 56 + rng.gauss() * 3, Math.sin(t * 1.5) * 13 + rng.gauss() * 3.4, 8], rng.range(5, 10), rgb('#14060c'), rng.range(0.6, 0.86), { v: CHANNEL.soft(rng) })
  }
  const core = [-16, 7, 10]
  addCluster(stars, rng, [24, -8, 6], 34, 8, [rgb('#dfe9ff')], [1, 2.4])
  addFieldStars(stars, rng, 420, [90, 70, 40])
  return { clouds, dust, rims, stars: stars.build(), glows: [{ position: core, size: 42, color: '#ffc0c8', intensity: 0.4 }] }
}

function buildTrifid() {
  const { rng, clouds, dust, rims, stars } = glowingCloud(20, { count: 300, extent: [26, 26, 14], colors: ['#ff5a7a', '#ff7a8f', '#ff4a6a'] })
  // Its blue reflection nebula, scattering light instead of emitting it.
  for (let i = 0; i < 130; i += 1) {
    clouds.add([rng.gauss() * 22, 48 + rng.gauss() * 14, rng.gauss() * 10 - 6], rng.range(12, 24), rgb('#5a90e8'), rng.range(0.1, 0.2))
  }
  // Three dark lanes meeting near the centre.
  for (const angle of [0.5, 2.6, 4.7]) {
    for (let i = 0; i < 120; i += 1) {
      const r = rng.next() * 42
      dust.add([Math.cos(angle) * r + rng.gauss() * 1.8, Math.sin(angle) * r + rng.gauss() * 1.8, 9], rng.range(3.4, 7), rgb('#12060c'), rng.range(0.66, 0.9), { v: CHANNEL.soft(rng) })
    }
  }
  addFieldStars(stars, rng, 380, [85, 80, 36])
  return { clouds, dust, rims, stars: stars.build(), glows: [{ position: [0, 0, 11], size: 26, color: '#f4f0ff', intensity: 0.44 }] }
}

function buildRosette() {
  const rng = createRandom(2237)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const reds = [rgb('#e0304a'), rgb('#ff5a6e'), rgb('#a01c34')]
  // A thick ring: the cluster has cleared out the middle.
  for (let i = 0; i < 560; i += 1) {
    const theta = rng.next() * TAU
    const r = 44 + Math.abs(rng.gauss()) * 18
    clouds.add([Math.cos(theta) * r, Math.sin(theta) * r, rng.gauss() * 13], rng.range(12, 26), scaleRgb(rng.pick(reds), rng.range(0.7, 1.15)), rng.range(0.13, 0.26))
  }
  for (let i = 0; i < 150; i += 1) {
    const theta = rng.next() * TAU
    const r = 40 + rng.next() * 16
    dust.add([Math.cos(theta) * r, Math.sin(theta) * r, 12], rng.range(1.6, 4), rgb('#16060c'), rng.range(0.5, 0.8), { v: CHANNEL.clump(rng) })
  }
  addCluster(stars, rng, [0, 0, 0], 70, 11, [rgb('#dfe9ff'), rgb('#bcd2ff')], [1, 2.8])
  addFieldStars(stars, rng, 420, [105, 90, 40])
  return { clouds, dust, rims, stars: stars.build(), glows: [{ position: [0, 0, 0], size: 40, color: '#cfe0ff', intensity: 0.2 }] }
}

function buildCatsEye() {
  const rng = createRandom(6543)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  // Faint nested shells, one per pulse of mass loss.
  for (let shell = 0; shell < 7; shell += 1) {
    addShell(clouds, rng, { radius: 17 + shell * 5.2, width: 0.5, axisScale: 1, count: 180, color: rgb(shell % 2 ? '#4fb8c8' : '#7fd0c0'), alpha: [0.08, 0.16], size: [3, 6] })
  }
  // Two bright lobes, crossed at an angle like the pupil of an eye.
  for (const tilt of [0.5, -0.5]) {
    for (let i = 0; i < 300; i += 1) {
      const t = rng.gauss() * 13
      const w = rng.gauss() * 4.6
      clouds.add([t * Math.cos(tilt) - w * Math.sin(tilt), t * Math.sin(tilt) + w * Math.cos(tilt), rng.gauss() * 4], rng.range(3, 7), scaleRgb(rgb('#ff7a6a'), rng.range(0.8, 1.2)), rng.range(0.2, 0.36))
    }
  }
  addShell(rims, rng, { radius: 11, width: 0.7, axisScale: 1, count: 240, color: rgb('#8ff0d8'), alpha: [0.12, 0.24], size: [1.4, 3.2] })
  stars.add([0, 0, 0], rgb('#eef4ff'), 2.8)
  addFieldStars(stars, rng, 320, [90, 80, 60], { maxSize: 0.9 })
  return { clouds, dust, rims, stars: stars.build(), glows: [{ position: [0, 0, 0], size: 14, color: '#cfe8ff', intensity: 0.4 }] }
}

function buildTarantula() {
  const rng = createRandom(30)
  const clouds = makeLayer(rng)
  const dust = makeLayer(rng)
  const rims = makeLayer(rng)
  const stars = createPointBuffer()
  const tones = [rgb('#ff9a5a'), rgb('#ff5a7a'), rgb('#ffd08a')]
  // Filaments radiating from the cluster, like the spider it is named for.
  for (let leg = 0; leg < 11; leg += 1) {
    const angle = (leg / 11) * TAU + rng.range(-0.2, 0.2)
    const curl = rng.range(-0.5, 0.5)
    for (let i = 0; i < 62; i += 1) {
      const t = i / 62
      const a = angle + curl * t
      const r = 12 + t * 74
      clouds.add([Math.cos(a) * r + rng.gauss() * 4, Math.sin(a) * r + rng.gauss() * 4, rng.gauss() * 11], rng.range(7, 16) * (1.2 - t * 0.5), scaleRgb(rng.pick(tones), 1.1 - t * 0.5), rng.range(0.13, 0.25))
    }
  }
  addCluster(stars, rng, [0, 0, 0], 110, 6, [rgb('#cfe0ff'), rgb('#eef3ff')], [1.2, 3])
  addFieldStars(stars, rng, 460, [110, 95, 40])
  return { clouds, dust, rims, stars: stars.build(), glows: [{ position: [0, 0, 0], size: 58, color: '#dfe9ff', intensity: 0.42 }] }
}

const BUILDERS = {
  orion: buildOrion,
  crab: buildCrab,
  eagle: buildEagle,
  carina: buildCarina,
  pillars: buildPillars,
  horsehead: buildHorsehead,
  ring: buildRing,
  helix: buildHelix,
  lagoon: buildLagoon,
  trifid: buildTrifid,
  rosette: buildRosette,
  'cats-eye': buildCatsEye,
  tarantula: buildTarantula,
}

export function generateNebula(id) {
  const built = BUILDERS[id]()
  // The sprite layers are where the fill cost sits, so they are what gets
  // thinned on weaker hardware. Stars and glows are cheap and carry the
  // nebula's shape, so they are left alone.
  return { ...built, clouds: thin(built.clouds), dust: thin(built.dust), rims: thin(built.rims) }
}
