import { ORBIT_DATA } from '../data/solarBodies.js'

const DEG = Math.PI / 180

/** Resonances with Jupiter clear gaps in the asteroid belt (Kirkwood gaps). */
export function kirkwoodGaps(aJupiter) {
  return [[3, 1], [5, 2], [7, 3], [2, 1]].map(([p, q]) => aJupiter * Math.pow(q / p, 2 / 3))
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(Math.PI * 2 * random())
}

/**
 * Sample belt orbits: [a (AU), inclination (rad), node (rad), phase (rad)]
 * per particle. Real structure — Kirkwood gaps at Jupiter's 3:1, 5:2, 7:3
 * and 2:1, plutinos at Neptune's 3:2, from JPL semi-major axes — but the
 * particles themselves are a model, not real objects. Shared by the solar
 * scene and the open universe.
 */
export function sampleBelt(kind, count, random = Math.random) {
  const out = new Float32Array(count * 4)
  const aJ = ORBIT_DATA.planets.jupiter.a
  const aN = ORBIT_DATA.planets.neptune.a
  const gaps = kirkwoodGaps(aJ)
  let n = 0
  while (n < count) {
    let a
    let incl
    if (kind === 'asteroid') {
      a = 2.1 + random() * 1.2
      // Thin out the resonances: a narrow band around each gap stays nearly empty.
      if (gaps.some((g) => Math.abs(a - g) < 0.03) && random() < 0.92) continue
      incl = Math.abs(gaussian(random)) * 8 * DEG
    } else {
      const roll = random()
      if (roll < 0.2) a = aN * Math.pow(3 / 2, 2 / 3) + gaussian(random) * 0.3 // plutinos, 3:2 with Neptune
      else if (roll < 0.75) a = 42 + random() * 5.5 // the classical belt
      else a = 30 + random() * 25 // scattered and outer
      incl = Math.abs(gaussian(random)) * (roll < 0.75 ? 6 : 18) * DEG
    }
    out.set([a, incl, random() * Math.PI * 2, random() * Math.PI * 2], n * 4)
    n += 1
  }
  return out
}
