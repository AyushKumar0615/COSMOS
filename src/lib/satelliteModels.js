import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Low-poly spacecraft built from primitives, recognisable by silhouette:
 * the ISS's long truss and paired solar wings, Hubble's tube and two panels,
 * Webb's gold hexagonal mirror over its layered sunshield, and so on.
 *
 * Each model is merged into one geometry per material, so a spacecraft costs
 * three or four draw calls however many parts it has. Models are built once
 * at about one unit across and shared; the scene scales them.
 *
 * Navigation lights are returned as positions with a colour and a blink
 * phase each, drawn by a single points object per spacecraft.
 */

function panelTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1b2a52'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#5a6f9e'
  ctx.lineWidth = 1
  for (let i = 0; i <= size; i += 8) {
    ctx.beginPath()
    ctx.moveTo(i + 0.5, 0)
    ctx.lineTo(i + 0.5, size)
    ctx.moveTo(0, i + 0.5)
    ctx.lineTo(size, i + 0.5)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 6)
  texture.anisotropy = 4
  return texture
}

let materials = null

/** Shared materials: built on first use, kept for the session. */
export function satelliteMaterials() {
  if (materials) return materials
  materials = {
    metal: new THREE.MeshStandardMaterial({ color: '#c9ced8', metalness: 0.7, roughness: 0.32, emissive: '#2a3040', emissiveIntensity: 0.5 }),
    foil: new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 0.9, roughness: 0.3, emissive: '#5a3a0c', emissiveIntensity: 0.55 }),
    panel: new THREE.MeshStandardMaterial({ map: panelTexture(), metalness: 0.35, roughness: 0.2, emissive: '#13204a', emissiveIntensity: 0.6, side: THREE.DoubleSide }),
    white: new THREE.MeshStandardMaterial({ color: '#ece9e2', metalness: 0.1, roughness: 0.55, emissive: '#303034', emissiveIntensity: 0.5, side: THREE.DoubleSide }),
    shield: new THREE.MeshStandardMaterial({ color: '#d7c6e6', metalness: 0.8, roughness: 0.25, emissive: '#2a2033', emissiveIntensity: 0.35, side: THREE.DoubleSide }),
  }
  return materials
}

// --- Part helpers: each returns a positioned geometry ------------------------

const tmp = new THREE.Object3D()

function place(geometry, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0]) {
  tmp.position.set(x, y, z)
  tmp.rotation.set(rx, ry, rz)
  tmp.scale.set(1, 1, 1)
  tmp.updateMatrix()
  return geometry.applyMatrix4(tmp.matrix)
}

const box = (w, h, d, at, rot) => place(new THREE.BoxGeometry(w, h, d), at, rot)
// Cylinders along the x axis unless rotated.
const tube = (r, length, at, rot = [0, 0, Math.PI / 2], segments = 16) =>
  place(new THREE.CylinderGeometry(r, r, length, segments), at, rot)
const panel = (w, l, at, rot) => place(new THREE.BoxGeometry(w, 0.004, l), at, rot)

function dish(r, depth, at, rot) {
  const geometry = new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.atan2(r, r - depth) * 0.9)
  geometry.translate(0, -r, 0)
  return place(geometry, at, rot)
}

function hexagon(r, at, rot) {
  return place(new THREE.CylinderGeometry(r, r, 0.006, 6), at, rot)
}

// --- Models --------------------------------------------------------------------

function iss() {
  const parts = { metal: [], panel: [], white: [] }
  parts.metal.push(box(1.0, 0.035, 0.035, [0, 0, 0]))
  for (const x of [-0.46, -0.36, 0.36, 0.46]) {
    for (const side of [-1, 1]) parts.panel.push(panel(0.075, 0.32, [x, 0, side * 0.19]))
    parts.metal.push(box(0.02, 0.02, 0.06, [x, 0, 0]))
  }
  // Pressurised modules run along the direction of flight, below the truss.
  parts.white.push(tube(0.028, 0.5, [0, -0.05, -0.02], [Math.PI / 2, 0, 0]))
  parts.white.push(tube(0.024, 0.18, [0.07, -0.05, 0.12], [0, 0, Math.PI / 2]))
  parts.white.push(tube(0.024, 0.18, [-0.07, -0.05, -0.12], [0, 0, Math.PI / 2]))
  parts.white.push(tube(0.022, 0.12, [0, -0.05, -0.32], [Math.PI / 2, 0, 0]))
  parts.panel.push(panel(0.05, 0.22, [0, -0.05, -0.32], [0, 0, 0]))
  // Radiators: white panels standing off the truss.
  for (const x of [-0.18, 0.18]) parts.white.push(box(0.12, 0.004, 0.09, [x, 0.0, -0.08], [0, 0, 0.3]))
  const lights = [
    [-0.5, 0, 0, 'red'],
    [0.5, 0, 0, 'green'],
    [0, -0.05, -0.38, 'white'],
  ]
  return { parts, lights }
}

function tiangong() {
  const parts = { metal: [], panel: [], white: [] }
  parts.white.push(tube(0.05, 0.42, [0, 0, 0], [Math.PI / 2, 0, 0]))
  parts.white.push(tube(0.042, 0.36, [0.2, 0, 0.2], [0, 0, Math.PI / 2]))
  parts.white.push(tube(0.042, 0.36, [-0.2, 0, 0.2], [0, 0, Math.PI / 2]))
  for (const x of [-0.42, 0.42]) {
    for (const side of [-1, 1]) parts.panel.push(panel(0.07, 0.36, [x, 0, 0.2 + side * 0.2]))
  }
  for (const side of [-1, 1]) parts.panel.push(panel(0.3, 0.06, [side * 0.18, 0, -0.16]))
  parts.metal.push(box(0.04, 0.04, 0.05, [0, 0, 0.24]))
  return { parts, lights: [[0.6, 0, 0.2, 'green'], [-0.6, 0, 0.2, 'red'], [0, 0.05, -0.22, 'white']] }
}

function hubble() {
  const parts = { metal: [], panel: [], white: [] }
  parts.metal.push(tube(0.12, 0.55, [0, 0, 0]))
  parts.metal.push(tube(0.135, 0.22, [-0.36, 0, 0]))
  // Aperture door, hinged open.
  parts.white.push(box(0.004, 0.22, 0.22, [0.33, 0.1, 0], [0, 0, 0.9]))
  for (const side of [-1, 1]) {
    parts.panel.push(panel(0.11, 0.62, [-0.05, 0, side * 0.23], [0, Math.PI / 2, 0]))
    parts.metal.push(box(0.02, 0.02, 0.1, [-0.05, 0, side * 0.14]))
  }
  parts.white.push(box(0.01, 0.12, 0.04, [0, 0.14, 0]))
  return { parts, lights: [[0.28, 0.13, 0, 'white']] }
}

function gps() {
  const parts = { foil: [], panel: [], white: [], metal: [] }
  parts.foil.push(box(0.2, 0.2, 0.2, [0, 0, 0]))
  for (const side of [-1, 1]) {
    parts.panel.push(panel(0.18, 0.46, [side * 0.38, 0, 0], [0, Math.PI / 2, 0]))
    parts.metal.push(box(0.12, 0.012, 0.012, [side * 0.14, 0, 0]))
  }
  // Earth-facing antenna array.
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2
    parts.white.push(place(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), [Math.cos(a) * 0.05, -0.13, Math.sin(a) * 0.05]))
  }
  return { parts, lights: [[0.62, 0, 0, 'green'], [-0.62, 0, 0, 'red']] }
}

function geo() {
  const parts = { foil: [], panel: [], white: [], metal: [] }
  parts.foil.push(box(0.22, 0.28, 0.22, [0, 0, 0]))
  for (const side of [-1, 1]) {
    parts.panel.push(panel(0.15, 0.58, [side * 0.44, 0, 0], [0, Math.PI / 2, 0]))
    parts.metal.push(box(0.1, 0.012, 0.012, [side * 0.15, 0, 0]))
    // Large reflectors either side, facing Earth (−y).
    parts.white.push(dish(0.13, 0.04, [0, -0.08, side * 0.2], [Math.PI + side * 0.5, 0, 0]))
  }
  parts.white.push(dish(0.06, 0.02, [0, -0.16, 0], [Math.PI, 0, 0]))
  return { parts, lights: [[0.74, 0, 0, 'green'], [-0.74, 0, 0, 'red']] }
}

function jwst() {
  const parts = { foil: [], shield: [], metal: [] }
  // Five sunshield layers: elongated hexagons, slightly spread apart.
  const outline = new THREE.Shape()
  const points = [[0.5, 0], [0.22, 0.3], [-0.22, 0.3], [-0.5, 0], [-0.22, -0.3], [0.22, -0.3]]
  outline.moveTo(...points[0])
  for (const p of points.slice(1)) outline.lineTo(...p)
  outline.closePath()
  for (let i = 0; i < 5; i += 1) {
    const layer = new THREE.ShapeGeometry(outline)
    layer.rotateX(-Math.PI / 2)
    layer.scale(1 - i * 0.03, 1, 1 - i * 0.03)
    parts.shield.push(place(layer, [0, i * 0.014, 0]))
  }
  // Primary mirror: 18 gold hexagons in a honeycomb, tilted upright.
  const mirror = []
  const r = 0.045
  const axial = []
  for (let q = -2; q <= 2; q += 1)
    for (let s = -2; s <= 2; s += 1) {
      const t = -q - s
      if (Math.abs(t) > 2 || (q === 0 && s === 0)) continue
      axial.push([q, s])
    }
  for (const [q, s] of axial) {
    const x = r * 1.75 * (q + s / 2)
    const y = r * 1.52 * s
    mirror.push(hexagon(r * 0.98, [x, y, 0], [Math.PI / 2, 0, 0]))
  }
  const mirrorGeometry = mergeGeometries(mirror)
  mirrorGeometry.rotateX(-0.25)
  mirrorGeometry.translate(0, 0.27, 0.05)
  parts.foil.push(mirrorGeometry)
  // Secondary mirror on three struts.
  parts.metal.push(place(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12), [0, 0.3, 0.32], [Math.PI / 2, 0, 0]))
  for (const [x, y] of [[-0.12, 0.1], [0.12, 0.1], [0, 0.45]]) {
    const from = new THREE.Vector3(x, y, 0.06)
    const to = new THREE.Vector3(0, 0.3, 0.32)
    const strut = new THREE.CylinderGeometry(0.004, 0.004, from.distanceTo(to), 5)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
    strut.applyQuaternion(quaternion)
    parts.metal.push(place(strut, mid.toArray()))
  }
  parts.metal.push(box(0.14, 0.08, 0.14, [0, -0.06, 0]))
  return { parts, lights: [] }
}

function mro() {
  const parts = { metal: [], panel: [], white: [], foil: [] }
  parts.foil.push(box(0.16, 0.22, 0.16, [0, 0, 0]))
  parts.white.push(dish(0.2, 0.06, [0, 0.3, 0], [0, 0, 0]))
  parts.metal.push(box(0.012, 0.18, 0.012, [0, 0.18, 0]))
  for (const side of [-1, 1]) parts.panel.push(panel(0.2, 0.36, [side * 0.3, -0.04, 0], [0, Math.PI / 2, 0]))
  parts.metal.push(tube(0.04, 0.12, [0, -0.15, 0.04], [Math.PI / 2, 0, 0]))
  return { parts, lights: [[0.48, -0.04, 0, 'green'], [-0.48, -0.04, 0, 'red']] }
}

// Deep-space probes carry no navigation lights. Their high-gain dishes face
// +y, which the scene turns towards Earth.

function voyager() {
  const parts = { metal: [], white: [], foil: [] }
  parts.white.push(dish(0.46, 0.1, [0, 0.16, 0]))
  parts.foil.push(place(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 10), [0, 0.02, 0]))
  // RTG boom, science boom with the scan platform, and the long magnetometer.
  parts.metal.push(tube(0.008, 0.5, [-0.4, -0.02, 0.0]))
  parts.metal.push(tube(0.05, 0.22, [-0.6, -0.02, 0.0]))
  parts.metal.push(tube(0.008, 0.42, [0.36, -0.02, 0.0]))
  parts.metal.push(box(0.1, 0.08, 0.08, [0.6, -0.02, 0.0]))
  parts.metal.push(tube(0.004, 1.3, [0, -0.02, 0.6], [Math.PI / 2, 0, 0], 6))
  return { parts, lights: [] }
}

function newHorizons() {
  const parts = { metal: [], white: [], foil: [] }
  parts.foil.push(place(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 3), [0, 0, 0]))
  parts.white.push(dish(0.26, 0.06, [0, 0.12, 0]))
  parts.metal.push(tube(0.04, 0.34, [0.34, -0.02, 0], [0, 0, Math.PI / 2 + 0.3], 10))
  parts.metal.push(box(0.06, 0.06, 0.06, [-0.12, -0.08, 0.1]))
  return { parts, lights: [] }
}

function parker() {
  const parts = { metal: [], white: [], panel: [], foil: [] }
  // Carbon-composite heat shield: white face towards the Sun (+z in the model).
  parts.white.push(place(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 6), [0, 0, 0.3], [Math.PI / 2, 0, 0]))
  parts.foil.push(place(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 6), [0, 0, 0.04], [Math.PI / 2, 0, 0]))
  for (const side of [-1, 1]) {
    parts.panel.push(panel(0.14, 0.18, [side * 0.26, 0, 0.12], [0, 0, 0]))
    parts.metal.push(tube(0.006, 0.12, [side * 0.16, 0, 0.12]))
  }
  parts.metal.push(tube(0.004, 0.7, [0, 0, -0.45], [Math.PI / 2, 0, 0], 6))
  return { parts, lights: [] }
}

function juno() {
  const parts = { metal: [], white: [], panel: [], foil: [] }
  parts.foil.push(place(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 6), [0, 0, 0]))
  parts.white.push(dish(0.18, 0.04, [0, 0.1, 0]))
  // Three long solar wings, 120° apart.
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * Math.PI * 2
    parts.panel.push(place(new THREE.BoxGeometry(0.11, 0.004, 0.7), [Math.sin(a) * 0.52, 0, Math.cos(a) * 0.52], [0, a, 0]))
  }
  return { parts, lights: [] }
}

const BUILDERS = { iss, tiangong, hubble, gps, geo, jwst, mro, voyager, newHorizons, parker, juno }
const LIGHT_COLORS = { red: [1, 0.25, 0.2], green: [0.3, 1, 0.45], white: [1, 1, 1] }

const models = new Map()

/** Merged geometries per material, plus navigation lights, for a model type. */
export function satelliteModel(type) {
  if (models.has(type)) return models.get(type)
  const { parts, lights } = BUILDERS[type]()
  const meshes = []
  for (const [materialName, geometries] of Object.entries(parts)) {
    if (!geometries.length) continue
    const merged = mergeGeometries(geometries.map((g) => (g.index ? g.toNonIndexed() : g)))
    geometries.forEach((g) => g.dispose())
    merged.computeBoundingSphere()
    meshes.push({ material: materialName, geometry: merged })
  }

  const lightGeometry = new THREE.BufferGeometry()
  lightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lights.flatMap(([x, y, z]) => [x, y, z]), 3))
  lightGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lights.flatMap(([, , , c]) => LIGHT_COLORS[c]), 3))
  lightGeometry.setAttribute('phase', new THREE.Float32BufferAttribute(lights.map((_, i) => i * 0.37), 1))

  const model = { meshes, lights: lights.length ? lightGeometry : null }
  models.set(type, model)
  return model
}
