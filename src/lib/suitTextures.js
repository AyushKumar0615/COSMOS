import * as THREE from 'three'
import { prng } from './openWorld.js'

/**
 * Textures for the open-universe astronaut, drawn on canvases at runtime (no
 * downloads): the suit's ripstop "ortho-fabric" as normal and roughness maps,
 * a dark space environment for reflections, and the flag, mission patch and
 * name tag. Everything is created per mount and disposed by the caller.
 */

const canvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Woven technical fabric: a fine plain weave, a raised ripstop grid every few
 * millimetres, and faint irregularity. Returns tiling normal and roughness maps.
 */
export function fabricMaps(size = 256) {
  const random = prng(7)
  const height = new Float32Array(size * size)
  const cell = size / 8 // ripstop grid: 8 squares per tile
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Plain weave: alternating warp and weft bumps.
      const warp = Math.sin((x / size) * Math.PI * 2 * 64) * (((y >> 1) & 1) ? 1 : -1)
      const weft = Math.sin((y / size) * Math.PI * 2 * 64) * (((x >> 1) & 1) ? 1 : -1)
      let h = 0.18 * (warp + weft)
      // Ripstop: thicker threads along the grid.
      const gx = Math.abs(((x % cell) + cell) % cell - cell / 2) / (cell / 2)
      const gy = Math.abs(((y % cell) + cell) % cell - cell / 2) / (cell / 2)
      h += 0.9 * Math.max(Math.max(0, gx - 0.9) * 10, Math.max(0, gy - 0.9) * 10)
      height[y * size + x] = h + (random() - 0.5) * 0.12
    }
  }
  const normal = canvas(size, size)
  const rough = canvas(size, size)
  const n = normal.getContext('2d').createImageData(size, size)
  const r = rough.getContext('2d').createImageData(size, size)
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = at(x + 1, y) - at(x - 1, y)
      const dy = at(x, y + 1) - at(x, y - 1)
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      n.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      n.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      n.data[i + 2] = (1 / len) * 255
      n.data[i + 3] = 255
      // Raised threads catch a little more light than the hollows.
      const v = 200 + Math.max(-40, Math.min(40, -at(x, y) * 30))
      r.data[i] = r.data[i + 1] = r.data[i + 2] = v
      r.data[i + 3] = 255
    }
  }
  normal.getContext('2d').putImageData(n, 0, 0)
  rough.getContext('2d').putImageData(r, 0, 0)
  const wrap = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { normal: wrap(normal, false), roughness: wrap(rough, false) }
}

/** A dark sky with a Milky Way band and one bright source, for visor and metal reflections. */
export function spaceEnvironment(gl) {
  const w = 512
  const h = 256
  const c = canvas(w, h)
  const g = c.getContext('2d')
  g.fillStyle = '#030408'
  g.fillRect(0, 0, w, h)
  // A soft, wide band of light (the galaxy) across the equator.
  const band = g.createLinearGradient(0, h * 0.3, 0, h * 0.7)
  band.addColorStop(0, 'rgba(120,130,160,0)')
  band.addColorStop(0.5, 'rgba(150,155,175,0.35)')
  band.addColorStop(1, 'rgba(120,130,160,0)')
  g.fillStyle = band
  g.fillRect(0, h * 0.3, w, h * 0.4)
  const random = prng(19)
  for (let i = 0; i < 900; i += 1) {
    const a = 0.3 + random() * 0.7
    g.fillStyle = `rgba(255,255,255,${a})`
    g.fillRect(random() * w, random() * h, random() < 0.1 ? 2 : 1, 1)
  }
  // A bright source high on one side, giving the visor its highlight.
  const sun = g.createRadialGradient(w * 0.2, h * 0.28, 0, w * 0.2, h * 0.28, h * 0.32)
  sun.addColorStop(0, 'rgba(255,250,235,1)')
  sun.addColorStop(0.08, 'rgba(255,240,210,0.9)')
  sun.addColorStop(1, 'rgba(255,240,210,0)')
  g.fillStyle = sun
  g.fillRect(0, 0, w, h)
  const texture = new THREE.CanvasTexture(c)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  const pmrem = new THREE.PMREMGenerator(gl)
  const target = pmrem.fromEquirectangular(texture)
  texture.dispose()
  pmrem.dispose()
  return target
}

const textureFrom = (c) => {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** A flag patch: thirteen stripes and a starred canton, as worn on the left shoulder. */
export function flagTexture() {
  const w = 190
  const h = 100
  const c = canvas(w, h)
  const g = c.getContext('2d')
  for (let i = 0; i < 13; i += 1) {
    g.fillStyle = i % 2 ? '#f4f1ea' : '#a8232d'
    g.fillRect(0, (i * h) / 13, w, h / 13 + 1)
  }
  g.fillStyle = '#2b3a67'
  g.fillRect(0, 0, w * 0.4, (h * 7) / 13)
  g.fillStyle = '#f4f1ea'
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < (row % 2 ? 5 : 6); col += 1) {
      g.beginPath()
      g.arc(6 + col * 12.4 + (row % 2) * 6.2, 5 + row * 5.6, 1.5, 0, Math.PI * 2)
      g.fill()
    }
  }
  return textureFrom(c)
}

/** A round mission patch: an orbit about a world and a star, ringed with a border. */
export function missionPatchTexture() {
  const s = 128
  const c = canvas(s, s)
  const g = c.getContext('2d')
  g.fillStyle = '#e9e5da'
  g.beginPath()
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#16213f'
  g.beginPath()
  g.arc(s / 2, s / 2, s / 2 - 7, 0, Math.PI * 2)
  g.fill()
  const planet = g.createRadialGradient(s * 0.42, s * 0.6, 2, s / 2, s * 0.64, 28)
  planet.addColorStop(0, '#6fa8dc')
  planet.addColorStop(1, '#1f4e85')
  g.fillStyle = planet
  g.beginPath()
  g.arc(s / 2, s * 0.64, 26, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#d9b45a'
  g.lineWidth = 3
  g.beginPath()
  g.ellipse(s / 2, s * 0.5, 46, 16, -0.35, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = '#f4f1ea'
  g.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 4 : 10
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    g.lineTo(s * 0.68 + Math.cos(a) * r, s * 0.27 + Math.sin(a) * r)
  }
  g.fill()
  return textureFrom(c)
}

/** A name tag in the suit's lettering. */
export function nameTagTexture(text = 'COSMOS') {
  const c = canvas(256, 64)
  const g = c.getContext('2d')
  g.fillStyle = '#e6e3da'
  g.fillRect(0, 0, 256, 64)
  g.strokeStyle = '#8a8f97'
  g.lineWidth = 3
  g.strokeRect(2, 2, 252, 60)
  g.fillStyle = '#1d2433'
  g.font = '600 34px ui-sans-serif, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 34)
  return textureFrom(c)
}
