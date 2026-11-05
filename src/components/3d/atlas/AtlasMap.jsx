import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import UniverseStars from './UniverseStars.jsx'
import CloudSprites from '../CloudSprites.jsx'
import { CATALOGUE, OBJECT_TYPES, mapPosition, mapRadius } from '../../../data/catalogue/index.js'
import { getCloudTexture } from '../../../lib/cloudTexture.js'
import { createRandom, rgb, scaleRgb } from '../../../lib/random.js'
import { quality } from '../../../lib/quality.js'

const point = new THREE.Vector3()

// Everything with a place of its own on the map. Solar system bodies share
// the Sun's position and are reached through it.
const MAPPED = CATALOGUE.filter((entry) => entry.ra != null && entry.distanceLy != null && entry.type !== 'exoplanet' || entry.id === 'sun').map((entry) => ({
  entry,
  position: entry.id === 'sun' ? [0, 0, 0] : mapPosition(entry),
  rank: { sun: 0 }[entry.id] ?? { blackhole: 1, galaxy: 2, cluster: 3, nebula: 3, star: 4 }[entry.type] ?? 5,
}))

// One marker per planetary system, rather than one for each planet.
const SYSTEMS = (() => {
  const seen = new Set()
  return CATALOGUE.filter((entry) => {
    if (entry.type !== 'exoplanet' || seen.has(entry.system)) return false
    seen.add(entry.system)
    return true
  }).map((entry) => ({ entry, position: mapPosition(entry), rank: 4, label: entry.host }))
})()

export const MAP_OBJECTS = [...MAPPED, ...SYSTEMS]

const markerVertex = /* glsl */ `
  uniform float uPixelRatio;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 7.0 * uPixelRatio;
  }
`

const markerFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float ring = smoothstep(0.62, 0.74, d) * (1.0 - smoothstep(0.86, 1.0, d));
    float dot_ = 1.0 - smoothstep(0.14, 0.26, d);
    float a = max(ring * 0.7, dot_);
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a * uOpacity);
  }
`

function nebulaClouds() {
  const rng = createRandom(404)
  const sprites = []
  const tint = { 'Planetary nebula': '#58c8c0', 'Supernova remnant': '#ff8a3d', 'Dark nebula': '#7a2030' }
  for (const { entry, position } of MAPPED) {
    if (entry.type !== 'nebula') continue
    const color = rgb(tint[entry.class] ?? '#ff5a8e')
    for (let i = 0; i < 16; i += 1) {
      const [dx, dy, dz] = rng.direction()
      const r = Math.abs(rng.gauss()) * 0.7
      sprites.push({ p: [position[0] + dx * r, position[1] + dy * r, position[2] + dz * r], s: rng.range(0.8, 2), st: 1, c: scaleRgb(color, rng.range(0.6, 1)), a: rng.range(0.1, 0.22), r: rng.next() * 6.28, v: rng.next() * 0.24 })
    }
  }
  // Dust and glow along the plane, so the Milky Way reads as a band.
  const gc = mapRadius(26000)
  for (let i = 0; i < 170; i += 1) {
    const angle = rng.next() * Math.PI * 2
    const towardCentre = 0.5 + 0.5 * Math.cos(angle)
    const r = gc * (0.82 + rng.next() * 0.3)
    const dust = rng.next() < 0.3
    sprites.push({
      p: [Math.cos(angle) * r, rng.gauss() * 0.55, Math.sin(angle) * r],
      s: rng.range(4, 10),
      st: 1.7,
      c: dust ? [0.02, 0.015, 0.02] : scaleRgb(rgb('#9fb4e8'), 0.28 + 0.5 * towardCentre),
      a: dust ? 0.2 : rng.range(0.04, 0.09),
      r: 0,
      v: 0.5 + rng.next() * 0.24,
    })
  }
  return sprites
}

/**
 * The map of the universe: Points for every star, one layer for clouds, one
 * marker per object. Picking and labels work from projected positions in
 * JavaScript, so nothing here needs a mesh or a raycast per object.
 */
export default function AtlasMap({ view, onPick, opacityRef, reducedMotion, selectedId }) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const pixelRatio = useThree((state) => state.viewport.dpr)
  const texture = useMemo(() => getCloudTexture(gl), [gl])
  const clouds = useMemo(() => nebulaClouds(), [])

  const clusters = useMemo(() => {
    const list = MAPPED.filter(({ entry }) => entry.type === 'cluster').map(({ entry, position }) => ({
      position,
      kind: entry.class === 'Globular cluster' ? 'globular' : 'open',
      stars: Math.round((entry.class === 'Globular cluster' ? 900 : 240) * quality().particles),
      spread: entry.class === 'Globular cluster' ? 0.09 : 0.22,
    }))
    // Unnamed clusters, so the sky has more of them than the catalogue lists.
    const rng = createRandom(61)
    for (let i = 0; i < 46; i += 1) {
      const angle = rng.next() * Math.PI * 2
      const globular = i % 3 === 0
      const r = mapRadius(rng.range(1500, 40000))
      const lift = globular ? rng.gauss() * 5 : rng.gauss() * 0.5
      list.push({ position: [Math.cos(angle) * r, lift, Math.sin(angle) * r], kind: globular ? 'globular' : 'open', stars: Math.round((globular ? 260 : 90) * quality().particles), spread: globular ? 0.07 : 0.16 })
    }
    return list
  }, [])

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(MAP_OBJECTS.length * 3)
    const colors = new Float32Array(MAP_OBJECTS.length * 3)
    MAP_OBJECTS.forEach(({ entry, position }, i) => {
      positions.set(position, i * 3)
      colors.set(rgb(OBJECT_TYPES[entry.type].color), i * 3)
    })
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    return {
      geometry: buffer,
      material: new THREE.ShaderMaterial({
        vertexShader: markerVertex,
        fragmentShader: markerFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0 } },
      }),
    }
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Tap or click: whichever marker is nearest on screen, within reach.
  useEffect(() => {
    const element = gl.domElement
    let down = null
    const onDown = (event) => {
      down = [event.clientX, event.clientY]
    }
    const onUp = (event) => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 6) return
      const rect = element.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const reach = event.pointerType === 'touch' ? 30 : 18
      let best = null
      let bestDistance = reach
      for (const object of MAP_OBJECTS) {
        point.fromArray(object.position).project(camera)
        if (point.z > 1) continue
        const d = Math.hypot(((point.x + 1) / 2) * rect.width - x, ((1 - point.y) / 2) * rect.height - y)
        if (d < bestDistance) {
          best = object
          bestDistance = d
        }
      }
      if (best) onPick(best.entry.id)
    }
    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointerup', onUp)
    return () => {
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointerup', onUp)
    }
  }, [gl, camera, onPick])

  const tick = useRef(0)

  useFrame(() => {
    material.uniforms.uPixelRatio.value = pixelRatio
    material.uniforms.uOpacity.value = opacityRef.current.value * 0.55

    // Labels: a fixed pool of DOM nodes, moved directly, a few times a second.
    tick.current += 1
    if (tick.current % 5 !== 0) return
    const root = view.current.labels
    if (!root) return
    const taken = new Set()
    const nodes = root.children
    let used = 0
    const candidates = []
    for (const object of MAP_OBJECTS) {
      point.fromArray(object.position).project(camera)
      if (point.z > 1 || Math.abs(point.x) > 0.96 || Math.abs(point.y) > 0.9) continue
      candidates.push({ object, x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height })
    }
    candidates.sort((a, b) => a.object.rank - b.object.rank)
    for (const { object, x, y } of candidates) {
      if (used >= nodes.length) break
      const cell = `${Math.round(x / 118)}:${Math.round(y / 26)}`
      if (taken.has(cell)) continue
      taken.add(cell)
      const node = nodes[used]
      used += 1
      const name = object.label ?? object.entry.name
      if (node.textContent !== name) node.textContent = name
      node.dataset.id = object.entry.id
      node.dataset.selected = object.entry.id === selectedId
      // Near the right edge a label flips to the other side of its marker.
      const width = name.length * 6.6 + 8
      const left = x + 9 + width > size.width - 8 ? x - 9 - width : x + 9
      node.style.transform = `translate(${Math.round(left)}px, ${Math.round(y - 8)}px)`
      node.style.opacity = '1'
      node.style.pointerEvents = 'auto'
    }
    for (let i = used; i < nodes.length; i += 1) {
      nodes[i].style.opacity = '0'
      nodes[i].style.pointerEvents = 'none'
    }
  })

  return (
    <>
      <UniverseStars compress={mapRadius} clusters={clusters} opacityRef={opacityRef} reducedMotion={reducedMotion} />
      <CloudSprites sprites={clouds} texture={texture} opacityRef={opacityRef} reducedMotion={reducedMotion} renderOrder={-6} />
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} raycast={() => null} />
    </>
  )
}
