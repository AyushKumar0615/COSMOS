/**
 * Seeded pseudo-random numbers (mulberry32). Galaxies and nebulae are
 * generated from fixed seeds, so every visit shows the same structure and
 * generation stays a pure function of its inputs.
 */
export function createRandom(seed) {
  let state = seed >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Box-Muller standard normal.
  const gauss = () => {
    let u = 0
    let v = 0
    while (u === 0) u = next()
    while (v === 0) v = next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  return {
    next,
    gauss,
    range: (min, max) => min + (max - min) * next(),
    pick: (list) => list[Math.floor(next() * list.length)],
    // Uniform direction on the unit sphere.
    direction: () => {
      const z = next() * 2 - 1
      const theta = next() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      return [r * Math.cos(theta), r * Math.sin(theta), z]
    },
  }
}

/** "#rrggbb" to [r, g, b] in 0-1, used verbatim by the custom shaders. */
export function rgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

export function mixRgb(a, b, t) {
  const k = Math.min(1, Math.max(0, t))
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

export function scaleRgb(c, k) {
  return [c[0] * k, c[1] * k, c[2] * k]
}

/** Growable typed-array builder for point clouds. */
export function createPointBuffer() {
  const positions = []
  const colors = []
  const sizes = []
  return {
    add(position, color, size) {
      positions.push(position[0], position[1], position[2])
      colors.push(color[0], color[1], color[2])
      sizes.push(size)
    },
    get count() {
      return sizes.length
    },
    build() {
      return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        sizes: new Float32Array(sizes),
      }
    },
  }
}
