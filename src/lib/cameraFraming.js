import * as THREE from 'three'
import { BODIES_BY_ID, SYSTEM_EXTENT } from '../data/planets.js'

const OVERVIEW_ELEVATION = THREE.MathUtils.degToRad(28)
const FOCUS_FILL = 0.38

function halfFovTangents(camera) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  return { tanV, tanH: tanV * camera.aspect }
}

/**
 * Radius the camera must keep in frame for a body. Saturn is framed by its
 * rings rather than its globe, and the Sun by part of its corona.
 */
export function framingRadius(id) {
  const body = BODIES_BY_ID[id]
  if (!body) return 1
  const { radius, ring } = body.sim
  if (ring) return radius * ring.outer * 0.9
  if (id === 'sun') return radius * 1.3
  return radius
}

/**
 * Distance at which a sphere of `radius` fills FOCUS_FILL of the narrower
 * viewport axis. Using the narrower axis is what keeps a focused planet
 * entirely visible on a portrait phone as well as a wide desktop.
 */
export function focusDistance(camera, radius) {
  const { tanV, tanH } = halfFovTangents(camera)
  return radius / (Math.min(tanV, tanH) * FOCUS_FILL)
}

/**
 * Camera position that frames the orbits for the current aspect ratio.
 *
 * The extra term accounts for perspective: the near edge of the outermost
 * orbit is SYSTEM_EXTENT closer to the camera than the centre, so framing
 * on the centre alone pushes the near edge off screen. The upper clamp
 * lets a portrait viewport crop the outer orbit a little rather than
 * retreating until the whole system is too small to read.
 */
export function overviewPosition(camera, out = new THREE.Vector3(), view = null) {
  const { tanH } = halfFovTangents(camera)
  const distance =
    THREE.MathUtils.clamp(SYSTEM_EXTENT * (0.9 + 1.15 / tanH), 42, 80) *
    (view?.distanceScale ?? 1)
  // A tour stop may ask for a steeper or shallower look at the whole system.
  const elevation =
    view?.elevation != null ? THREE.MathUtils.degToRad(view.elevation) : OVERVIEW_ELEVATION
  return out.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance)
}
