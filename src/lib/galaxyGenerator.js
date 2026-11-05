import { createPointBuffer, createRandom, mixRgb, rgb, scaleRgb } from './random.js'
import { scaleCount } from './quality.js'

/**
 * Returns a copy of a galaxy model with every `count` scaled to this device,
 * at any depth — bulge, bar, ring, dust, knots, each arm and each companion.
 */
function scaleModelCounts(value) {
  if (Array.isArray(value)) return value.map(scaleModelCounts)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, entry] of Object.entries(value)) {
    const isCount = (key === 'count' || key.endsWith('Count')) && typeof entry === 'number'
    out[key] = isCount ? scaleCount(entry, 60) : scaleModelCounts(entry)
  }
  return out
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** Exponential disc: most stars near the centre, thinning outwards. */
function sampleDiskRadius(rng, scaleLength, maxRadius) {
  const u = rng.next()
  return -scaleLength * Math.log(1 - u * (1 - Math.exp(-maxRadius / scaleLength)))
}

/** Angle of a logarithmic spiral arm at radius r. */
function armAngle(arm, r, model) {
  const tanPitch = Math.tan(model.pitch * DEG)
  return arm.offset + Math.log(Math.max(r, model.armStart) / model.armStart) / tanPitch
}

function pickArm(rng, arms) {
  const total = arms.reduce((sum, arm) => sum + arm.weight, 0)
  let roll = rng.next() * total
  for (const arm of arms) {
    if (roll < arm.weight) return arm
    roll -= arm.weight
  }
  return arms[0]
}

/**
 * Procedural spiral galaxy, in galaxy-local coordinates: the disc lies in
 * the XZ plane, Y is the disc normal, 1 unit = 1,000 light-years.
 *
 * Returns four layers, rendered separately:
 *   stars  additive — bulge, bar, disc and arm stars, companions
 *   dust   normal   — dark lanes along the inner edge of each arm
 *   knots  additive — star-forming regions (pink) and young clusters (blue)
 *   glows           — soft halos for the core and companion galaxies
 *
 * The point count is a sample: tens of thousands of points stand in for
 * hundreds of billions of stars.
 */
export function generateGalaxy(fullModel) {
  // Sample fewer stars on weaker hardware. The arms, bar and ring keep their
  // shape — they are drawn from the same seeded distribution either way, just
  // with fewer points in it — so a lower tier looks fainter, never different.
  const model = scaleModelCounts(fullModel)
  const rng = createRandom(model.seed)
  const palette = Object.fromEntries(
    Object.entries(model.palette).map(([key, hex]) => [key, rgb(hex)]),
  )
  const R = model.radius

  const stars = createPointBuffer()
  const dust = createPointBuffer()
  const knots = createPointBuffer()
  const glows = [
    {
      position: [0, 0, 0],
      size: model.coreGlow.size,
      color: model.coreGlow.color,
      intensity: model.coreGlow.intensity,
    },
  ]

  // Bulge: a flattened, warm, dense ball of old stars.
  for (let i = 0; i < model.bulge.count; i += 1) {
    const g = Math.abs(rng.gauss())
    const [dx, dy, dz] = rng.direction()
    const r = g * model.bulge.radius
    const color = mixRgb(palette.core, palette.bulge, Math.min(1, g / 2.2))
    stars.add(
      [dx * r, dy * r * model.bulge.flatten, dz * r],
      scaleRgb(color, rng.range(0.55, 1)),
      rng.range(0.6, 1.5),
    )
  }

  // Bar: an elongated concentration the arms grow from (Milky Way).
  if (model.bar) {
    const { count, length, width, angle } = model.bar
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (let i = 0; i < count; i += 1) {
      const x = rng.gauss() * length * 0.36
      const z = rng.gauss() * length * width
      const y = rng.gauss() * model.thickness * 0.7
      stars.add(
        [x * cos - z * sin, y, x * sin + z * cos],
        scaleRgb(palette.bulge, rng.range(0.5, 0.95)),
        rng.range(0.5, 1.25),
      )
    }
  }

  // Disc and arms.
  for (let i = 0; i < model.diskCount; i += 1) {
    const r = sampleDiskRadius(rng, model.scaleLength, R)
    const inArm = rng.next() < model.armFraction && r > model.armStart * 0.7
    let theta
    if (inArm) {
      const arm = pickArm(rng, model.arms)
      const width = model.armWidth * (0.35 + 0.65 * (r / R))
      theta = armAngle(arm, r, model) + (rng.gauss() * width) / Math.max(r, 1)
    } else {
      theta = rng.next() * TAU
    }

    const flare = 0.35 + 0.65 * Math.exp(-r / (R * 0.6))
    const y = rng.gauss() * model.thickness * flare

    let color
    let size
    if (inArm) {
      // Arms are where young, hot, blue stars are still being made.
      const young = rng.next() < 0.45
      color = young ? palette.young : mixRgb(palette.arm, palette.disk, rng.next() ** 2)
      size = rng.next() < 0.035 ? rng.range(1.8, 2.6) : rng.range(0.45, 1.35)
    } else {
      color = mixRgb(palette.disk, palette.bulge, rng.next() * 0.35)
      size = rng.range(0.35, 1.05)
    }
    stars.add(
      [r * Math.cos(theta), y, r * Math.sin(theta)],
      scaleRgb(color, rng.range(0.45, 0.95)),
      size,
    )
  }

  // A ring of star formation (Andromeda).
  if (model.ring) {
    const { radius, width, count } = model.ring
    for (let i = 0; i < count; i += 1) {
      const theta = rng.next() * TAU
      const r = radius + rng.gauss() * width
      stars.add(
        [r * Math.cos(theta), rng.gauss() * model.thickness * 0.5, r * Math.sin(theta)],
        scaleRgb(palette.young, rng.range(0.5, 0.95)),
        rng.range(0.5, 1.4),
      )
      if (rng.next() < 0.08) {
        knots.add(
          [r * Math.cos(theta), 0, r * Math.sin(theta)],
          rng.next() < 0.6 ? palette.hii : palette.blueKnot,
          rng.range(1.8, 3.6),
        )
      }
    }
  }

  // Dust lanes along the inner, concave edge of each arm.
  for (let i = 0; i < model.dust.count; i += 1) {
    const r = model.armStart + rng.next() ** 0.8 * (R * 0.85 - model.armStart)
    const arm = pickArm(rng, model.arms)
    const theta =
      armAngle(arm, r, model) +
      model.dust.offset +
      (rng.gauss() * model.dust.width) / Math.max(r, 1)
    dust.add(
      [r * Math.cos(theta), rng.gauss() * model.thickness * 0.25, r * Math.sin(theta)],
      palette.dust,
      rng.range(2.4, 5.2),
    )
  }

  // A dust ring seen edge-on (Sombrero): one dense, dark band, with faint
  // light caught along its outer rim. `tilt` and `warp` bend it out of the
  // disc, as in a merger scar; `arc` limits it to one side (Black Eye).
  if (model.dustRing) {
    const { radius, width, height, count, tilt = 0, warp = 0, arc = TAU } = model.dustRing
    for (let i = 0; i < count; i += 1) {
      const theta = (rng.next() - 0.5) * arc
      const r = radius * rng.range(arc < TAU ? 0.35 : 1, 1) + rng.gauss() * width
      const y = rng.gauss() * height + Math.sin(theta * 2) * warp
      const planar = r * Math.cos(theta)
      const position = [planar * Math.cos(tilt) - y * Math.sin(tilt), planar * Math.sin(tilt) + y * Math.cos(tilt), r * Math.sin(theta)]
      dust.add(position, palette.dust, rng.range(2.2, 4.6))
      if (rng.next() < 0.1) {
        stars.add([position[0] * 1.03, position[1], position[2] * 1.03], scaleRgb(palette.disk, rng.range(0.4, 0.75)), rng.range(0.4, 1))
      }
    }
  }

  // A ring galaxy's spokes, reaching from the core to the expanding ring.
  if (model.spokes) {
    const { count, lanes, reach } = model.spokes
    for (let i = 0; i < count; i += 1) {
      const lane = Math.floor(rng.next() * lanes)
      const theta = (lane / lanes) * TAU + rng.gauss() * 0.05
      const r = rng.next() * reach
      stars.add([r * Math.cos(theta), rng.gauss() * 0.5, r * Math.sin(theta)], scaleRgb(palette.disk, rng.range(0.35, 0.75)), rng.range(0.4, 1))
    }
  }

  // Lumpy star-forming regions with no spiral order (Magellanic Clouds).
  if (model.clumps) {
    const { count, spread, starsEach } = model.clumps
    for (let c = 0; c < count; c += 1) {
      const center = [rng.gauss() * spread, rng.gauss() * spread * 0.25, rng.gauss() * spread * 0.8]
      for (let i = 0; i < starsEach; i += 1) {
        const r = Math.abs(rng.gauss()) * spread * 0.2
        const [dx, dy, dz] = rng.direction()
        stars.add([center[0] + dx * r, center[1] + dy * r * 0.5, center[2] + dz * r], scaleRgb(rng.next() < 0.6 ? palette.young : palette.arm, rng.range(0.5, 1)), rng.range(0.4, 1.3))
      }
      knots.add(center, palette.hii, rng.range(1.6, 3.4))
    }
  }

  // Plumes of gas blown out of a starburst, along the disc's axis.
  if (model.plumes) {
    const { count, length, width } = model.plumes
    for (let i = 0; i < count; i += 1) {
      const t = rng.next()
      const side = rng.next() < 0.5 ? 1 : -1
      const spread = width * (0.25 + t)
      knots.add([rng.gauss() * spread, side * t * length, rng.gauss() * spread], scaleRgb(palette.hii, 0.75 * (1 - t * 0.7)), rng.range(1.2, 3))
    }
  }

  // Globular clusters: tight balls of old stars far outside the disc.
  if (model.globulars) {
    const { clusters, radius, starsEach } = model.globulars
    for (let c = 0; c < clusters; c += 1) {
      const [dx, dy, dz] = rng.direction()
      const reach = radius * (0.25 + 0.75 * rng.next() ** 1.6)
      for (let i = 0; i < starsEach; i += 1) {
        const [sx, sy, sz] = rng.direction()
        const spread = Math.abs(rng.gauss()) * 0.28
        stars.add(
          [dx * reach + sx * spread, dy * reach * 0.8 + sy * spread, dz * reach + sz * spread],
          scaleRgb(palette.bulge, rng.range(0.5, 0.95)),
          rng.range(0.35, 0.8),
        )
      }
    }
  }

  // Star-forming knots: pink hydrogen regions and blue young clusters.
  for (let i = 0; i < model.knots.count; i += 1) {
    const r = model.armStart * 1.1 + rng.next() * (R * 0.82 - model.armStart * 1.1)
    const arm = pickArm(rng, model.arms)
    // Scattered across the arm's width rather than on its spine, so they
    // read as clumps within the arm, not beads on a string.
    const theta = armAngle(arm, r, model) + (rng.gauss() * model.armWidth * 0.85) / Math.max(r, 1)
    knots.add(
      [r * Math.cos(theta), rng.gauss() * model.thickness * 0.3, r * Math.sin(theta)],
      scaleRgb(rng.next() < 0.6 ? palette.hii : palette.blueKnot, rng.range(0.55, 1)),
      rng.range(1.2, 3),
    )
  }

  // Companion galaxies: small, warm, ellipsoidal clouds of old stars.
  for (const companion of model.companions ?? []) {
    let center = companion.position
    if (companion.armTip) {
      const arm = model.arms[companion.armTip.arm]
      const r = R * companion.armTip.radiusFactor
      const theta = armAngle(arm, r, model)
      center = [r * Math.cos(theta), companion.lift ?? 0, r * Math.sin(theta)]

      // Tidal bridge: stars dragged out along the arm towards the companion.
      for (let i = 0; i < (companion.bridge ?? 0); i += 1) {
        const t = rng.next()
        const rr = R * (0.72 + t * (companion.armTip.radiusFactor - 0.72))
        const th = armAngle(arm, rr, model) + (rng.gauss() * model.armWidth * 0.6) / rr
        stars.add(
          [rr * Math.cos(th), (companion.lift ?? 0) * t + rng.gauss() * 0.6, rr * Math.sin(th)],
          scaleRgb(mixRgb(palette.arm, palette.disk, t), rng.range(0.4, 0.8)),
          rng.range(0.4, 1.1),
        )
      }
    }

    const color = rgb(companion.color)
    for (let i = 0; i < companion.count; i += 1) {
      const g = Math.abs(rng.gauss())
      const [dx, dy, dz] = rng.direction()
      const r = g * companion.radius
      stars.add(
        [center[0] + dx * r, center[1] + dy * r * companion.flatten, center[2] + dz * r],
        scaleRgb(color, rng.range(0.5, 1)),
        rng.range(0.45, 1.25),
      )
    }
    glows.push({
      position: center,
      size: companion.glow,
      color: companion.color,
      intensity: 0.4,
    })
  }

  // Approximate position of the Sun, for the Milky Way's "you are here".
  let marker = null
  if (model.sunMarker) {
    const { radius, armIndex, offset } = model.sunMarker
    const theta = armAngle(model.arms[armIndex], radius, model) + offset
    marker = [radius * Math.cos(theta), 0, radius * Math.sin(theta)]
  }

  return {
    stars: stars.build(),
    dust: dust.build(),
    knots: knots.build(),
    glows,
    marker,
    pointCount: stars.count + dust.count + knots.count,
  }
}
