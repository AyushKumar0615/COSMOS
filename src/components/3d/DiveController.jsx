import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { diveRadius } from '../../data/blackholes.js'

const DURATION = 58
const direction = new THREE.Vector3()
const outward = new THREE.Vector3()
const lookAt = new THREE.Vector3()
const offset = new THREE.Vector3()
const backward = new THREE.Quaternion()
const forward = new THREE.Quaternion()
const matrix = new THREE.Matrix4()
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Owns the camera during the guided descent. The path is a radial fall with a
 * slow swirl, and playback is deliberately not real time: the radius follows
 * an even, watchable curve, while the interface reports the true proper time
 * for each radius. `dive.progress` can also be scrubbed from the interface.
 *
 * On leaving, the camera returns to where the journey began: an affordance of
 * the simulation, which the interface says a real observer would not have.
 */
export default function DiveController({ dive, reducedMotion }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const start = useRef(null)

  useEffect(() => {
    const position = camera.position.clone()
    const r = THREE.MathUtils.clamp(position.length(), 8, 60)
    const azimuth = Math.atan2(position.z, position.x)
    // A shallow, fixed tilt keeps the disc in view all the way down.
    start.current = { position, quaternion: camera.quaternion.clone(), r, azimuth }
    return () => {
      const s = start.current
      camera.position.copy(s.position)
      camera.quaternion.copy(s.quaternion)
      if (controls) {
        controls.target.set(0, 0, 0)
        controls.update()
      }
    }
  }, [camera, controls])

  useFrame((_, delta) => {
    const d = dive.current
    const s = start.current
    if (!s) return
    if (d.playing) {
      d.progress = Math.min(1, d.progress + Math.min(delta, 0.1) / DURATION)
      if (d.progress >= 1) d.playing = false
    }

    const r = Math.max(diveRadius(d.progress, s.r), 0.004)
    const azimuth = s.azimuth + d.progress * 2.1
    const tilt = 0.16 + 0.1 * d.progress
    direction.set(Math.cos(azimuth) * Math.cos(tilt), Math.sin(tilt), Math.sin(azimuth) * Math.cos(tilt))
    camera.position.copy(direction).multiplyScalar(r)

    // Facing the hole on the way in, then turning to look back at the
    // shrinking outside universe once below the horizon.
    outward.copy(direction)
    lookAt.set(0, 0, 0)
    matrix.lookAt(camera.position, lookAt, UP)
    forward.setFromRotationMatrix(matrix)
    lookAt.copy(camera.position).addScaledVector(outward, 1)
    offset.set(-outward.z, 0.15, outward.x).normalize()
    lookAt.addScaledVector(offset, 0.55)
    matrix.lookAt(camera.position, lookAt, UP)
    backward.setFromRotationMatrix(matrix)
    const turn = THREE.MathUtils.smoothstep(1.25 - r, 0, 0.5)
    camera.quaternion.copy(forward).slerp(backward, turn)

    if (!reducedMotion && r < 6 && d.playing) {
      const shake = 0.0016 * THREE.MathUtils.clamp(6 / r - 1, 0, 8) * Math.min(r, 1)
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
    }
    d.r = r
  })

  return null
}
