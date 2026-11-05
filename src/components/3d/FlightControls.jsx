import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from '../../lib/gsapConfig.js'
import { FLIGHT_SPEED } from '../../data/flight.js'

const PITCH_LIMIT = THREE.MathUtils.degToRad(84)
// A single pointer event can report a huge jump (a stalled frame, focus
// returning to the window); cap it so the view never whips around.
const MAX_LOOK_STEP = 90
const MODIFIER_CODES = new Set(['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'])

/**
 * Flight space for each scene. A boundary keeps visitors from drifting off
 * into nothing, an optional keep-out sphere stops them flying into the Sun,
 * and `speedScale` matches the speed dial to the size of the place.
 */
export const SOLAR_FLIGHT_SPACE = {
  home: { position: [0, 7, 30], target: [0, 0, 0] },
  boundary: 150,
  keepOut: 2.6,
  speedScale: 1,
}

/** Flight space around a galaxy or nebula, derived from its viewing pose. */
/**
 * Flight space around a black hole, in Schwarzschild radii. The keep-out
 * sphere stops just outside the horizon: crossing it is the guided descent's
 * job, where it can be labelled for what it is. Speed falls with distance, so
 * the last stretch is as controllable as the first.
 */
export function blackHoleFlightSpace(hole) {
  return {
    home: hole.pose,
    boundary: 110,
    keepOut: 1.12,
    speedScale: 0.7,
    slowNearCentre: 18,
  }
}

export function explorerFlightSpace(entry) {
  return {
    home: entry.pose,
    boundary: entry.maxDistance * 1.15,
    keepOut: null,
    speedScale: entry.maxDistance / 110,
  }
}

function homeFor(space) {
  const position = new THREE.Vector3().fromArray(space.home.position)
  const d = new THREE.Vector3().fromArray(space.home.target).sub(position)
  return {
    position,
    yaw: Math.atan2(-d.x, -d.z),
    pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)),
  }
}

const KEY_BINDINGS = {
  KeyW: ['forward', 1],
  ArrowUp: ['forward', 1],
  KeyS: ['forward', -1],
  ArrowDown: ['forward', -1],
  KeyD: ['right', 1],
  ArrowRight: ['right', 1],
  KeyA: ['right', -1],
  ArrowLeft: ['right', -1],
  Space: ['up', 1],
  ShiftLeft: ['up', -1],
  ShiftRight: ['up', -1],
}

const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const desired = new THREE.Vector3()
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
}

/**
 * First-person flight through the solar system.
 *
 * Desktop: WASD / arrows move, drag looks, Space up, Shift down, the wheel
 * sets speed. Touch: the on-screen joystick and up/down buttons write into
 * the shared `input` ref; dragging anywhere on the scene looks around.
 *
 * Deliberately drag-to-look rather than pointer lock: the cursor never
 * disappears, Escape goes straight to the app (pointer lock would swallow
 * the first press), and letting go always stops the camera turning.
 *
 * Everything is smoothed: velocity and view angles ease towards their
 * targets, so no input produces a jump.
 */
export default function FlightControls({
  input,
  reducedMotion,
  resetSignal,
  onSpeedChange,
  space = SOLAR_FLIGHT_SPACE,
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const get = useThree((state) => state.get)

  const keys = useRef({ forward: 0, right: 0, up: 0, pressed: new Set() })
  const look = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 })
  const velocity = useRef(new THREE.Vector3())
  const reset = useRef({ active: false, progress: { value: 0 }, tween: null, fromPos: new THREE.Vector3(), fromYaw: 0, fromPitch: 0 })
  const HOME = useMemo(() => homeFor(space), [space])
  const speedChanged = useRef(onSpeedChange)
  useEffect(() => {
    speedChanged.current = onSpeedChange
  })

  // Start from exactly where the camera is looking: no jump on entry.
  useEffect(() => {
    euler.setFromQuaternion(camera.quaternion, 'YXZ')
    const l = look.current
    l.yaw = l.targetYaw = euler.y
    l.pitch = l.targetPitch = THREE.MathUtils.clamp(euler.x, -PITCH_LIMIT, PITCH_LIMIT)
    velocity.current.set(0, 0, 0)

    // Nothing in the HUD should keep keyboard focus, or Space would press it.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [camera])

  // Keyboard
  useEffect(() => {
    const k = keys.current
    const recompute = () => {
      k.forward = 0
      k.right = 0
      k.up = 0
      for (const code of k.pressed) {
        const binding = KEY_BINDINGS[code]
        if (binding) k[binding[0]] += binding[1]
      }
    }
    const onDown = (event) => {
      if (isTypingTarget(event.target)) return
      // With a modifier held the browser may never send the matching keyup
      // (Cmd+Tab, Ctrl+W, system shortcuts), so modified keys never fly and
      // pressing a modifier releases everything.
      if (MODIFIER_CODES.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) {
        clear()
        return
      }
      if (!KEY_BINDINGS[event.code]) return
      if (event.repeat && k.pressed.has(event.code)) {
        event.preventDefault()
        return
      }
      // Stops page scroll and stops Space from activating a focused button.
      event.preventDefault()
      k.pressed.add(event.code)
      recompute()
    }
    const onUp = (event) => {
      if (MODIFIER_CODES.has(event.code)) {
        clear()
        return
      }
      if (!KEY_BINDINGS[event.code]) return
      event.preventDefault()
      k.pressed.delete(event.code)
      recompute()
    }
    // Releasing keys while the window is in the background never reaches
    // us; clearing on blur, tab switches, page hide and the context menu
    // prevents a "stuck" key flying the camera away.
    function clear() {
      if (k.pressed.size === 0) return
      k.pressed.clear()
      recompute()
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') clear()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    window.addEventListener('pagehide', clear)
    window.addEventListener('contextmenu', clear)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
      window.removeEventListener('pagehide', clear)
      window.removeEventListener('contextmenu', clear)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Pointer: drag to look, wheel to change speed.
  useEffect(() => {
    const element = gl.domElement
    let activePointer = null
    let lastX = 0
    let lastY = 0

    const onPointerDown = (event) => {
      if (activePointer !== null) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      activePointer = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      element.setPointerCapture?.(event.pointerId)
      element.style.cursor = 'grabbing'
    }
    const onPointerMove = (event) => {
      if (event.pointerId !== activePointer || reset.current.active) return
      const dx = THREE.MathUtils.clamp(event.clientX - lastX, -MAX_LOOK_STEP, MAX_LOOK_STEP)
      const dy = THREE.MathUtils.clamp(event.clientY - lastY, -MAX_LOOK_STEP, MAX_LOOK_STEP)
      lastX = event.clientX
      lastY = event.clientY
      const sensitivity = event.pointerType === 'touch' ? 0.0055 : 0.0034
      // Grab-the-scene, matching how dragging works everywhere else in the
      // app: the view follows the pointer rather than running from it.
      const l = look.current
      l.targetYaw += dx * sensitivity
      l.targetPitch = THREE.MathUtils.clamp(l.targetPitch + dy * sensitivity, -PITCH_LIMIT, PITCH_LIMIT)
    }
    const onPointerUp = (event) => {
      if (event.pointerId !== activePointer) return
      activePointer = null
      element.releasePointerCapture?.(event.pointerId)
      element.style.cursor = 'grab'
    }
    const onWheel = (event) => {
      event.preventDefault()
      const next = THREE.MathUtils.clamp(
        input.current.speed * Math.exp(-event.deltaY * 0.0015),
        FLIGHT_SPEED.min,
        FLIGHT_SPEED.max,
      )
      input.current.speed = next
      speedChanged.current?.(next)
    }

    element.style.cursor = 'grab'
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('lostpointercapture', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.style.cursor = ''
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('lostpointercapture', onPointerUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl, input])

  // Reset position: an eased glide back to a safe vantage point. Only a
  // change of the signal after mounting counts — re-entering flight must not
  // replay an old reset.
  const mountedSignal = useRef(resetSignal)
  useEffect(() => {
    if (resetSignal === mountedSignal.current) return
    mountedSignal.current = resetSignal
    const r = reset.current
    const l = look.current
    r.tween?.kill()
    r.fromPos.copy(camera.position)
    r.fromYaw = l.yaw
    r.fromPitch = l.pitch
    velocity.current.set(0, 0, 0)
    r.active = true
    r.progress.value = 0
    r.tween = gsap.to(r.progress, {
      value: 1,
      duration: reducedMotion ? 0.01 : 1.4,
      ease: 'power3.inOut',
      onComplete: () => {
        r.active = false
        l.targetYaw = l.yaw = HOME.yaw
        l.targetPitch = l.pitch = HOME.pitch
      },
    })
  }, [resetSignal, camera, reducedMotion, HOME])

  // Hand the view back to OrbitControls without a jump: point its target
  // straight ahead of the camera, so its first update keeps the same view.
  useEffect(
    () => () => {
      reset.current.tween?.kill()
      const controls = get().controls
      if (!controls) return
      camera.getWorldDirection(forward)
      // Far enough ahead to sit inside OrbitControls' distance limits, so
      // its first update does not pull the camera to a new distance.
      const ahead = THREE.MathUtils.clamp(12, controls.minDistance * 1.05, controls.maxDistance * 0.95)
      controls.target.copy(camera.position).addScaledVector(forward, ahead)
      controls.update()
    },
    [camera, get],
  )

  useFrame((_, rawDelta) => {
    // Capped so a long hitch cannot fling the camera, but loose enough that
    // movement keeps real-time speed down to about 10 fps.
    const dt = Math.min(rawDelta, 0.1)
    const l = look.current
    const r = reset.current

    if (r.active) {
      const t = r.progress.value
      camera.position.lerpVectors(r.fromPos, HOME.position, t)
      l.yaw = r.fromYaw + wrapAngle(HOME.yaw - r.fromYaw) * t
      l.pitch = THREE.MathUtils.lerp(r.fromPitch, HOME.pitch, t)
      l.targetYaw = l.yaw
      l.targetPitch = l.pitch
      euler.set(l.pitch, l.yaw, 0, 'YXZ')
      camera.quaternion.setFromEuler(euler)
      return
    }

    // Ease the view towards where the pointer has asked it to be.
    const lookEase = 1 - Math.exp(-14 * dt)
    l.yaw += (l.targetYaw - l.yaw) * lookEase
    l.pitch += (l.targetPitch - l.pitch) * lookEase
    euler.set(l.pitch, l.yaw, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)

    // Movement in camera space: W/S along the view, A/D level with the
    // horizon, Space/Shift straight up and down.
    const k = keys.current
    const stick = input.current.joystick
    const moveForward = THREE.MathUtils.clamp(k.forward + stick.y, -1, 1)
    const moveRight = THREE.MathUtils.clamp(k.right + stick.x, -1, 1)
    const moveUp = THREE.MathUtils.clamp(k.up + input.current.vertical, -1, 1)

    camera.getWorldDirection(forward)
    right.crossVectors(forward, WORLD_UP).normalize()
    desired
      .set(0, 0, 0)
      .addScaledVector(forward, moveForward)
      .addScaledVector(right, moveRight)
      .addScaledVector(WORLD_UP, moveUp)
    if (desired.lengthSq() > 1) desired.normalize()
    desired.multiplyScalar(input.current.speed * space.speedScale)
    if (space.slowNearCentre) {
      desired.multiplyScalar(THREE.MathUtils.clamp(camera.position.length() / space.slowNearCentre, 0.035, 1))
    }

    // Acceleration and braking are both eased: releasing every key glides
    // to a stop rather than halting dead.
    // Faster to respond than to coast, so input feels direct while
    // letting go still glides.
    const accelerating = desired.lengthSq() > velocity.current.lengthSq() * 0.25
    velocity.current.lerp(desired, 1 - Math.exp(-(accelerating ? 6.5 : 4.5) * dt))
    if (desired.lengthSq() === 0 && velocity.current.lengthSq() < 1e-6) velocity.current.set(0, 0, 0)
    camera.position.addScaledVector(velocity.current, dt)

    // Defensive: never let a bad frame leave the camera somewhere undefined.
    if (!Number.isFinite(camera.position.x + camera.position.y + camera.position.z)) {
      camera.position.copy(HOME.position)
      velocity.current.set(0, 0, 0)
    }

    // Boundaries: project back inside and cancel the offending velocity.
    const distance = camera.position.length()
    if (distance > space.boundary) {
      camera.position.multiplyScalar(space.boundary / distance)
      forward.copy(camera.position).normalize()
      const outward = velocity.current.dot(forward)
      if (outward > 0) velocity.current.addScaledVector(forward, -outward)
    } else if (space.keepOut && distance < space.keepOut) {
      camera.position.setLength(space.keepOut)
      forward.copy(camera.position).normalize()
      const inward = velocity.current.dot(forward)
      if (inward < 0) velocity.current.addScaledVector(forward, -inward)
    }
  })

  return null
}
