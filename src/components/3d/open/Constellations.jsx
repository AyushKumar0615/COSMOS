import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import sky from '../../../data/catalogue/constellations.json' with { type: 'json' }
import { KM_PER_LY, raDecToWorld } from '../../../lib/openWorld.js'
import { getOpenSettings, ship } from '../../../lib/openWorldStore.js'

// On the sky sphere: inside the Sky (30000) and the camera's far plane.
const RADIUS = 20000
// The figures are Earth's view; they distort as soon as the ship leaves the
// Sun's neighbourhood, so they fade out between these distances.
const FULL_LY = 15
const GONE_LY = 60

/** Constellation figures as line segments at infinity, built once. */
export function constellationSegments(figures = sky.figures) {
  const points = []
  const p = [0, 0, 0]
  for (const figure of figures) {
    for (const line of figure.lines) {
      for (let i = 1; i < line.length; i += 1) {
        for (const [ra, dec] of [line[i - 1], line[i]]) {
          raDecToWorld(ra, dec, RADIUS, p)
          points.push(p[0], p[1], p[2])
        }
      }
    }
  }
  return new Float32Array(points)
}

/**
 * The constellations as seen from the Sun's neighbourhood: d3-celestial's
 * figure lines between the stars' J2000 positions. Figures are a cultural
 * convention; the star directions are measured. Off by default.
 */
export default function Constellations() {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(constellationSegments(), 3))
    const m = new THREE.LineBasicMaterial({ color: '#7fa6d8', transparent: true, opacity: 0, depthWrite: false, depthTest: false })
    return { geometry: g, material: m }
  }, [])
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material])
  useFrame(() => {
    const ly = Math.hypot(...ship.pos) / KM_PER_LY
    const fade = 1 - THREE.MathUtils.smoothstep(ly, FULL_LY, GONE_LY)
    material.opacity = getOpenSettings().constellations ? 0.32 * fade : 0
  })
  return <lineSegments geometry={geometry} material={material} renderOrder={-90} frustumCulled={false} raycast={() => null} />
}
