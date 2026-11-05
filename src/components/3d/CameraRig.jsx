import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from '../../lib/gsapConfig.js'
import * as THREE from 'three'
import {
  focusDistance,
  framingRadius,
  overviewPosition,
} from '../../lib/cameraFraming.js'
import { useViewShift } from '../../hooks/useViewShift.js'

export const LANDING_POSITION = new THREE.Vector3(0, 0.8, 17)

const ORIGIN = new THREE.Vector3(0, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const DEG = Math.PI / 180

/**
 * Default framing for a focused planet: a three-quarter-lit view, mostly
 * sideways, partly sunward, slightly above the orbital plane. Fully sunward
 * shows a flat full disc; fully sideways, a half-lit one. Tour stops can
 * override any of these per destination.
 */
const DEFAULT_VIEW = { azimuth: 58, elevation: 17.6, distanceScale: 1 }

// Scratch vectors, reused every frame to avoid garbage.
const bodyPosition = new THREE.Vector3()
const destinationTarget = new THREE.Vector3()
const destinationCamera = new THREE.Vector3()
const scratch = new THREE.Vector3()
const sunward = new THREE.Vector3()
const side = new THREE.Vector3()

/**
 * Unit vector from a body to the camera.
 *   azimuth   — degrees around the body, 0 = between body and Sun (fully lit),
 *               90 = side-on (half lit), 180 = behind it (backlit crescent).
 *   elevation — degrees above the orbital plane.
 */
function viewDirection(position, sideSign, view, out) {
  const v = view ?? DEFAULT_VIEW
  const az = (v.azimuth ?? DEFAULT_VIEW.azimuth) * DEG
  const el = (v.elevation ?? DEFAULT_VIEW.elevation) * DEG

  if (position.lengthSq() < 1e-6) {
    // The Sun: there is no sunward direction, so azimuth is measured
    // around the vertical axis from the default overview side.
    if (!view) return out.set(0, 0.42, 1).normalize()
    return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  }

  sunward.copy(position).negate().normalize()
  side.crossVectors(UP, sunward).normalize().multiplyScalar(sideSign)
  return out
    .copy(sunward)
    .multiplyScalar(Math.cos(az))
    .addScaledVector(side, Math.sin(az))
    .multiplyScalar(Math.cos(el))
    .addScaledVector(UP, Math.sin(el))
    .normalize()
}

/**
 * Single owner of camera motion in the solar system scene.
 *
 *  landing / entering / exiting — the rig drives the camera directly.
 *
 *  universe — OrbitControls owns the camera for user input. The rig only
 *    steps in to run a focus transition (controls disabled while it runs),
 *    to follow a focused body along its orbit, and to apply zoom-button and
 *    reset requests. Every transition is one GSAP tween on a scalar that
 *    useFrame reads, so GSAP never writes to the camera directly.
 *
 *  suspended — free flight owns the camera; the rig does nothing at all.
 */
export default function CameraRig({
  phase,
  reducedMotion,
  focusId,
  focusView = null,
  command,
  bodies,
  onPhaseSettled,
  suspended = false,
  viewShift = null,
  flightKey = null,
  onFlightSettled,
}) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)

  // Kept in a ref so a new callback identity cannot restart a running move.
  const settled = useRef(onPhaseSettled)
  const flightSettled = useRef(onFlightSettled)
  useEffect(() => {
    settled.current = onPhaseSettled
    flightSettled.current = onFlightSettled
  })

  // Phase transitions (landing <-> universe)
  const phaseProgress = useRef({ value: 1 })
  const phaseTween = useRef(null)
  const lastPhase = useRef(null)
  const phaseFrom = useRef(new THREE.Vector3().copy(LANDING_POSITION))
  const phaseTo = useRef(new THREE.Vector3().copy(LANDING_POSITION))

  // Pointer parallax on the landing page
  const pointer = useRef({ x: 0, y: 0 })
  const smoothed = useRef({ x: 0, y: 0 })

  // Universe: 'idle' | 'transition' | 'follow'
  const mode = useRef('idle')
  const flight = useRef({
    progress: { value: 0 },
    tween: null,
    focusId: null,
    view: null,
    key: null,
    sideSign: 1,
    fromCamera: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    arc: 0,
  })
  const lastBodyPosition = useRef(new THREE.Vector3())
  const zoom = useRef({ active: false, progress: { value: 0 }, from: 0, to: 0, tween: null })
  const handledCommand = useRef(null)

  const getBodyPosition = (id, out) => {
    if (!id || id === 'sun') return out.copy(ORIGIN)
    const node = bodies.current.get(id)
    return node ? node.getWorldPosition(out) : out.copy(ORIGIN)
  }

  const destinationFor = (id, view, sideSign, outCamera, outTarget) => {
    getBodyPosition(id, bodyPosition)
    if (id) {
      outTarget.copy(bodyPosition)
      viewDirection(bodyPosition, sideSign, view, scratch)
      const distance =
        focusDistance(camera, framingRadius(id)) * (view?.distanceScale ?? 1)
      outCamera.copy(bodyPosition).addScaledVector(scratch, distance)
    } else {
      outTarget.copy(ORIGIN)
      overviewPosition(camera, outCamera, view)
    }
  }

  // Keep the subject clear of the open panel (a side panel on desktop, a
  // bottom sheet on phones). The app decides the shift; see useViewShift.
  useViewShift(suspended ? null : viewShift, reducedMotion)

  // --- Landing pointer parallax ------------------------------------------
  useEffect(() => {
    if (reducedMotion) return
    const onPointerMove = (event) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    const onPointerLeave = () => {
      pointer.current.x = 0
      pointer.current.y = 0
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reducedMotion])

  // --- Phase transitions ---------------------------------------------------
  // Only an actual phase change restarts the move. Guarding on the value
  // rather than relying on the dependency array means an incidental change
  // of `camera` or `reducedMotion` identity cannot kill a move in flight.
  useEffect(() => {
    if (phase === lastPhase.current) return
    const firstRun = lastPhase.current === null
    lastPhase.current = phase

    // Mounted fresh: at app start, or returning from the galaxy or nebula
    // scene under the travel overlay. Place the camera directly instead of
    // animating from wherever the previous scene left it.
    if (firstRun && phase !== 'entering' && phase !== 'exiting') {
      if (phase === 'universe') {
        overviewPosition(camera, camera.position)
      } else {
        camera.position.copy(LANDING_POSITION)
        phaseFrom.current.copy(LANDING_POSITION)
        phaseTo.current.copy(LANDING_POSITION)
        phaseProgress.current.value = 1
      }
      camera.lookAt(ORIGIN)
      return
    }

    if (phase === 'universe') return

    // Leaving the universe cancels any flight or zoom in progress.
    flight.current.tween?.kill()
    zoom.current.tween?.kill()
    zoom.current.active = false
    mode.current = 'idle'

    phaseFrom.current.copy(camera.position)
    if (phase === 'entering') overviewPosition(camera, phaseTo.current)
    else phaseTo.current.copy(LANDING_POSITION)

    phaseTween.current?.kill()
    phaseProgress.current.value = 0

    if (reducedMotion) {
      phaseProgress.current.value = 1
      settled.current?.(phase)
      return
    }

    phaseTween.current = gsap.to(phaseProgress.current, {
      value: 1,
      duration: phase === 'entering' ? 2.1 : 1.4,
      ease: phase === 'entering' ? 'power2.inOut' : 'power3.out',
      overwrite: true,
      // The application waits for this rather than a parallel timer, so the
      // camera has always arrived before OrbitControls takes over.
      onComplete: () => settled.current?.(phase),
    })
  }, [phase, camera, reducedMotion])

  useEffect(
    () => () => {
      phaseTween.current?.kill()
      flight.current.tween?.kill()
      zoom.current.tween?.kill()
    },
    [],
  )

  // Free flight takes over: drop anything in progress.
  useEffect(() => {
    if (!suspended) return
    flight.current.tween?.kill()
    zoom.current.tween?.kill()
    zoom.current.active = false
    mode.current = 'idle'
  }, [suspended])

  // --- Starting a flight ---------------------------------------------------
  const startFlight = (targetId, view = null) => {
    if (!controls) return
    const f = flight.current

    f.tween?.kill()
    zoom.current.tween?.kill()
    zoom.current.active = false

    f.focusId = targetId
    f.view = view
    f.key = flightKey
    f.fromCamera.copy(camera.position)
    f.fromTarget.copy(controls.target)

    // Pick the side of the planet the camera is already on, once, so the
    // approach never flips sides mid-flight.
    getBodyPosition(targetId, bodyPosition)
    if (targetId && targetId !== 'sun') {
      sunward.copy(bodyPosition).negate().normalize()
      side.crossVectors(UP, sunward)
      scratch.copy(camera.position).sub(bodyPosition)
      f.sideSign = side.dot(scratch) >= 0 ? 1 : -1
    }

    // Travel distance sets the duration and the arc height. The arc lifts
    // the camera over the Sun instead of flying straight through it.
    destinationFor(targetId, view, f.sideSign, destinationCamera, destinationTarget)
    const travel = destinationCamera.distanceTo(camera.position)
    f.arc = Math.min(travel * 0.22, 9)

    controls.enabled = false
    mode.current = 'transition'
    f.progress.value = 0

    if (reducedMotion) {
      f.progress.value = 1
      return
    }

    f.tween = gsap.to(f.progress, {
      value: 1,
      duration: THREE.MathUtils.clamp(1.0 + travel * 0.035, 1.2, 2.4),
      ease: 'power3.inOut',
    })
  }

  // Selection or tour stop changes: fly to the new body (or framing), or
  // simply stop following.
  useEffect(() => {
    if (phase !== 'universe' || suspended) return
    if (focusId) {
      startFlight(focusId, focusView)
    } else if (focusView) {
      startFlight(null, focusView)
    } else if (mode.current === 'follow') {
      mode.current = 'idle'
    }
    // startFlight reads refs only; it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // flightKey: revisiting the same tour stop re-flies to it, so the tour
    // always gets an arrival to start its dwell timer from.
  }, [focusId, focusView, flightKey, phase, controls, suspended])

  // Commands from the interface: reset view, zoom in, zoom out. A command
  // that arrives before OrbitControls has mounted is kept and applied once
  // it has, rather than being dropped.
  useEffect(() => {
    if (!command || command.nonce === handledCommand.current) return
    if (phase !== 'universe' || !controls || suspended) return
    handledCommand.current = command.nonce

    if (command.type === 'reset') {
      startFlight(null, command.view ?? null)
      return
    }

    if (command.type === 'zoom') {
      if (mode.current === 'transition') return
      const z = zoom.current
      const current = camera.position.distanceTo(controls.target)
      z.from = current
      z.to = THREE.MathUtils.clamp(
        current * command.factor,
        controls.minDistance,
        controls.maxDistance,
      )
      z.progress.value = 0
      z.active = true
      z.tween?.kill()
      z.tween = gsap.to(z.progress, {
        value: 1,
        duration: reducedMotion ? 0.01 : 0.55,
        ease: 'power2.out',
        onComplete: () => {
          z.active = false
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, controls, phase, suspended])

  // --- Frame loop ----------------------------------------------------------
  useFrame((_, delta) => {
    if (phase === 'universe') {
      if (!controls || suspended) return
      const f = flight.current

      if (mode.current === 'transition') {
        const t = f.progress.value
        destinationFor(f.focusId, f.view, f.sideSign, destinationCamera, destinationTarget)

        camera.position.lerpVectors(f.fromCamera, destinationCamera, t)
        camera.position.addScaledVector(UP, Math.sin(Math.PI * t) * f.arc)
        controls.target.lerpVectors(f.fromTarget, destinationTarget, t)
        camera.lookAt(controls.target)

        if (t >= 1) {
          mode.current = f.focusId ? 'follow' : 'idle'
          lastBodyPosition.current.copy(destinationTarget)
          controls.enabled = true
          controls.update()
          // Tours wait for this before starting a stop's dwell time, so the
          // narration and the camera stay in step.
          if (f.key != null) flightSettled.current?.(f.key)
        }
      } else if (mode.current === 'follow') {
        // Carry camera and target along by the planet's motion, preserving
        // whatever orbit offset the user has dialled in.
        getBodyPosition(f.focusId, bodyPosition)
        scratch.copy(bodyPosition).sub(lastBodyPosition.current)
        camera.position.add(scratch)
        controls.target.copy(bodyPosition)
        lastBodyPosition.current.copy(bodyPosition)
      }

      const z = zoom.current
      if (z.active && mode.current !== 'transition') {
        const length = THREE.MathUtils.lerp(z.from, z.to, z.progress.value)
        scratch.copy(camera.position).sub(controls.target).normalize()
        camera.position.copy(controls.target).addScaledVector(scratch, length)
      }
      return
    }

    const t = phaseProgress.current.value
    camera.position.lerpVectors(phaseFrom.current, phaseTo.current, t)

    if (phase === 'landing' && !reducedMotion) {
      const ease = Math.min(1, delta * 2.4)
      smoothed.current.x += (pointer.current.x - smoothed.current.x) * ease
      smoothed.current.y += (pointer.current.y - smoothed.current.y) * ease
      camera.position.x += smoothed.current.x * 1.15
      camera.position.y += -smoothed.current.y * 0.7
    }

    camera.lookAt(ORIGIN)
  })

  return null
}
