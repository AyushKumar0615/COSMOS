import * as THREE from 'three'
import { prng } from './openWorld.js'

/**
 * Textures for the open-universe astronaut, drawn on canvases at runtime (no
 * downloads): the suit's ripstop outer fabric (normal, roughness and albedo
 * variation), seam stitching, and the flag, mission patch and name tag.
 * Reflections come from the live scene, not from a texture here. Everything
 * is created per mount and disposed by the caller.
 */

const canvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Woven technical fabric, the outer layer of a multilayer suit: a fine
 * plain weave with uneven threads, a raised ripstop grid, slubs (thicker
 * runs of yarn) and soft puckering from the layers beneath. Returns tiling
 * normal, roughness and albedo-variation maps; the albedo carries faint,
 * even wear so the white is not a flat paint.
 */
export function fabricMaps(size = 512) {
  const random = prng(7)
  const height = new Float32Array(size * size)
  const shade = new Float32Array(size * size)
  const cell = size / 10 // ripstop grid: 10 squares per tile
  // Per-thread thickness, so the weave is not machine-perfect.
  const warpT = Float32Array.from({ length: size }, () => 0.8 + random() * 0.4)
  const weftT = Float32Array.from({ length: size }, () => 0.8 + random() * 0.4)
  // Slubs: short thicker runs along random threads.
  const slubs = Array.from({ length: 40 }, () => ({ x: (random() * size) | 0, y: (random() * size) | 0, len: 10 + random() * 30, h: random() < 0.5 }))
  // Low-frequency puckering from the insulation layers underneath.
  const pucker = (x, y) => {
    const u = (x / size) * Math.PI * 2
    const v = (y / size) * Math.PI * 2
    return Math.sin(u * 3 + Math.sin(v * 2) * 1.3) * Math.cos(v * 4 + Math.sin(u * 3) * 0.8) * 0.5 + Math.sin(u * 7 + v * 5) * 0.2
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const warp = Math.sin((x / size) * Math.PI * 2 * 96) * ((y >> 1) & 1 ? 1 : -1) * warpT[x]
      const weft = Math.sin((y / size) * Math.PI * 2 * 96) * ((x >> 1) & 1 ? 1 : -1) * weftT[y]
      let h = 0.16 * (warp + weft)
      const gx = Math.abs((x % cell) - cell / 2) / (cell / 2)
      const gy = Math.abs((y % cell) - cell / 2) / (cell / 2)
      h += 0.8 * Math.max(Math.max(0, gx - 0.92) * 12, Math.max(0, gy - 0.92) * 12)
      h += pucker(x, y) * 0.9
      height[y * size + x] = h + (random() - 0.5) * 0.1
      shade[y * size + x] = 0
    }
  }
  for (const s of slubs) {
    for (let k = 0; k < s.len; k += 1) {
      const x = (s.h ? s.x + k : s.x) % size
      const y = (s.h ? s.y : s.y + k) % size
      height[y * size + x] += 0.35 * Math.sin((k / s.len) * Math.PI)
    }
  }
  // Wear: a few large, very faint smudges and a fine mottling.
  const smudges = Array.from({ length: 7 }, () => ({ x: random() * size, y: random() * size, r: 20 + random() * 60, a: 0.02 + random() * 0.03 }))
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let d = (random() - 0.5) * 0.025
      for (const m of smudges) {
        const dx = Math.min(Math.abs(x - m.x), size - Math.abs(x - m.x))
        const dy = Math.min(Math.abs(y - m.y), size - Math.abs(y - m.y))
        d -= m.a * Math.exp(-(dx * dx + dy * dy) / (m.r * m.r))
      }
      shade[y * size + x] = d
    }
  }
  const normal = canvas(size, size)
  const rough = canvas(size, size)
  const albedo = canvas(size, size)
  const n = normal.getContext('2d').createImageData(size, size)
  const r = rough.getContext('2d').createImageData(size, size)
  const a = albedo.getContext('2d').createImageData(size, size)
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 1.4
      const dy = (at(x, y + 1) - at(x, y - 1)) * 1.4
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      n.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      n.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      n.data[i + 2] = (1 / len) * 255
      n.data[i + 3] = 255
      // Raised threads are a touch glossier than the hollows between them.
      const v = 205 + Math.max(-45, Math.min(35, -at(x, y) * 28))
      r.data[i] = r.data[i + 1] = r.data[i + 2] = v
      r.data[i + 3] = 255
      // Albedo near white, a warm cast in the hollows, faint wear.
      const base = 1 + shade[y * size + x] + Math.min(0, at(x, y)) * 0.02
      a.data[i] = Math.min(255, 255 * base)
      a.data[i + 1] = Math.min(255, 252 * base)
      a.data[i + 2] = Math.min(255, 246 * base)
      a.data[i + 3] = 255
    }
  }
  normal.getContext('2d').putImageData(n, 0, 0)
  rough.getContext('2d').putImageData(r, 0, 0)
  albedo.getContext('2d').putImageData(a, 0, 0)
  const wrap = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { normal: wrap(normal, false), roughness: wrap(rough, false), albedo: wrap(albedo, true) }
}

/**
 * Seam piping with two rows of lock stitches, for a band whose u runs round
 * the limb: thread-coloured dashes on fabric, with the needle holes darker.
 */
export function stitchTexture() {
  const w = 64
  const h = 32
  const c = canvas(w, h)
  const g = c.getContext('2d')
  const fabric = g.createLinearGradient(0, 0, 0, h)
  fabric.addColorStop(0, '#d9d7cf')
  fabric.addColorStop(0.5, '#ecebe5')
  fabric.addColorStop(1, '#d9d7cf')
  g.fillStyle = fabric
  g.fillRect(0, 0, w, h)
  for (const y of [7, 25]) {
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = '#b9b6ac'
      g.fillRect(x + 1, y - 1, 2, 2)
      g.fillStyle = '#f7f6f1'
      g.fillRect(x + 3, y - 1, 10, 2)
      g.fillStyle = 'rgba(80,78,70,0.35)'
      g.fillRect(x + 3, y + 1, 10, 1)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
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
