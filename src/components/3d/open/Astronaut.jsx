import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { getOpenSettings, ship } from '../../../lib/openWorldStore.js'

/**
 * A modern EVA astronaut, built from primitives (no downloaded assets): white
 * multi-layer suit with a hard upper torso, life-support backpack, display
 * and control module, gold sun visor, helmet lights and mission stripes.
 *
 * Drawn in camera space for the third-person view: it faces where the ship
 * faces (we see the backpack), leans into thrust, banks into turns, and
 * floats with a slow breath-like drift. Reduced motion keeps it still.
 */

const THIRD = new THREE.Vector3(0, -0.62, -3.1)
const FIRST = new THREE.Vector3(0, -0.15, 0.4)
const offset = new THREE.Vector3()
const qShip = new THREE.Quaternion()
const qLean = new THREE.Quaternion()
const euler = new THREE.Euler()

function useMaterials() {
  const materials = useMemo(
    () => ({
      suit: new THREE.MeshStandardMaterial({ color: '#eceee9', roughness: 0.82, metalness: 0 }),
      soft: new THREE.MeshStandardMaterial({ color: '#d9dcd6', roughness: 0.9 }),
      grey: new THREE.MeshStandardMaterial({ color: '#8b9097', roughness: 0.6, metalness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.55, metalness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: '#b8bec7', roughness: 0.3, metalness: 0.85 }),
      // No environment map to reflect, so a little emission keeps the gold visor gold.
      visor: new THREE.MeshStandardMaterial({ color: '#d4a548', roughness: 0.22, metalness: 0.65, emissive: '#3b2808', emissiveIntensity: 0.6 }),
      stripe: new THREE.MeshStandardMaterial({ color: '#b3262e', roughness: 0.7 }),
      patch: new THREE.MeshStandardMaterial({ color: '#2a6fb0', roughness: 0.6 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f4ff', emissiveIntensity: 2.2 }),
      led: new THREE.MeshStandardMaterial({ color: '#2ef0b0', emissive: '#2ef0b0', emissiveIntensity: 1.6 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  return materials
}

// Shared geometries: created once for both arms and legs.
const G = {
  limb: new THREE.CapsuleGeometry(0.085, 0.26, 6, 14),
  joint: new THREE.SphereGeometry(0.1, 16, 12),
  bearing: new THREE.TorusGeometry(0.1, 0.022, 8, 24),
  thigh: new THREE.CapsuleGeometry(0.105, 0.3, 6, 14),
  shin: new THREE.CapsuleGeometry(0.095, 0.3, 6, 14),
  band: new THREE.CylinderGeometry(0.108, 0.108, 0.05, 20, 1, true),
  helmet: new THREE.SphereGeometry(0.2, 32, 24),
  visor: new THREE.SphereGeometry(0.205, 32, 24, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.24, Math.PI * 0.46),
  lamp: new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12),
  pelvis: new THREE.CapsuleGeometry(0.17, 0.12, 6, 16),
  neck: new THREE.TorusGeometry(0.14, 0.028, 10, 28),
  dot: new THREE.SphereGeometry(0.012, 8, 6),
}

function Arm({ side, m, armRef }) {
  return (
    <group position={[side * 0.3, 0.28, 0]} ref={armRef}>
      <mesh geometry={G.bearing} material={m.metal} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={G.joint} material={m.suit} scale={1.05} />
      <mesh geometry={G.limb} material={m.suit} position={[side * 0.03, -0.2, 0]} rotation={[0, 0, side * 0.12]} />
      <group position={[side * 0.06, -0.4, 0.02]} name="forearm">
        <mesh geometry={G.joint} material={m.soft} scale={0.85} />
        <mesh geometry={G.limb} material={m.suit} position={[0, -0.18, 0.04]} rotation={[-0.25, 0, 0]} />
        <mesh geometry={G.bearing} material={m.metal} position={[0, -0.36, 0.08]} rotation={[Math.PI / 2 - 0.25, 0, 0]} scale={0.85} />
        <RoundedBox args={[0.12, 0.14, 0.07]} radius={0.03} smoothness={3} material={m.grey} position={[0, -0.44, 0.1]} rotation={[-0.25, 0, 0]} />
      </group>
    </group>
  )
}

function Leg({ side, m, legRef }) {
  return (
    <group position={[side * 0.13, -0.42, 0]} ref={legRef}>
      <mesh geometry={G.thigh} material={m.suit} position={[0, -0.2, 0]} />
      <mesh geometry={G.band} material={m.stripe} position={[0, -0.12, 0]} />
      <mesh geometry={G.joint} material={m.soft} position={[0, -0.42, 0.01]} scale={1.05} />
      <group position={[0, -0.42, 0]} name="shin">
        <mesh geometry={G.shin} material={m.suit} position={[0, -0.22, -0.02]} />
        <RoundedBox args={[0.17, 0.12, 0.3]} radius={0.04} smoothness={3} material={m.dark} position={[0, -0.46, 0.04]} />
      </group>
    </group>
  )
}

export default function Astronaut({ reducedMotion }) {
  const m = useMaterials()
  const root = useRef(null)
  const body = useRef(null)
  const armL = useRef(null)
  const armR = useRef(null)
  const legL = useRef(null)
  const legR = useRef(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('debug')) window.__cosmosAstronaut = root.current
  }, [])
  const state = useRef({ mix: 0, lean: 0, bank: 0, twist: 0, time: 0, lastQ: new THREE.Quaternion(), turn: new THREE.Vector3() })

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1)
    const s = state.current
    const settings = getOpenSettings()
    const g = root.current
    if (!g) return
    // Camera mode: glide the figure out of view rather than popping it.
    const wantFirst = settings.camera === 'first' ? 1 : 0
    s.mix += (wantFirst - s.mix) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 5))
    g.visible = s.mix < 0.97

    qShip.set(...ship.quat)
    // Turn rate in the ship's frame, from the change of orientation.
    qLean.copy(s.lastQ).invert().multiply(qShip)
    euler.setFromQuaternion(qLean, 'YXZ')
    s.lastQ.copy(qShip)
    const k = 1 - Math.exp(-dt * 3)
    s.turn.x += ((dt > 0 ? euler.x / dt : 0) - s.turn.x) * k
    s.turn.y += ((dt > 0 ? euler.y / dt : 0) - s.turn.y) * k

    if (!reducedMotion && !settings.paused) s.time += dt
    const t = s.time
    s.lean += (ship.thrust * 0.32 - s.lean) * k
    s.bank += (THREE.MathUtils.clamp(-s.turn.y * 0.35, -0.5, 0.5) - s.bank) * k
    const bob = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.035

    offset.lerpVectors(THIRD, FIRST, s.mix)
    offset.y += bob
    offset.applyQuaternion(qShip)
    g.position.copy(offset)
    g.quaternion.copy(qShip)

    // Body: faces away from the camera; leans into thrust, banks into turns.
    const b = body.current
    b.rotation.set(-0.12 - s.lean + THREE.MathUtils.clamp(s.turn.x * 0.2, -0.3, 0.3), Math.PI, s.bank + (reducedMotion ? 0 : Math.sin(t * 0.37) * 0.04))
    const breath = reducedMotion ? 1 : 1 + Math.sin(t * 1.6) * 0.008
    b.scale.set(breath, 1, breath)

    // Limbs drift; legs trail when thrusting.
    const sway = reducedMotion ? 0 : Math.sin(t * 0.9)
    armL.current.rotation.set(0.25 + sway * 0.06 - s.lean * 0.6, 0, 0.32 + sway * 0.04)
    armR.current.rotation.set(0.2 - sway * 0.05 - s.lean * 0.6, 0, -0.3 - sway * 0.04)
    legL.current.rotation.set(0.08 + s.lean * 0.8 + sway * 0.04, 0, 0.06)
    legR.current.rotation.set(-0.04 + s.lean * 0.7 - sway * 0.05, 0, -0.08)
  })

  return (
    <group ref={root} scale={0.4}>
      <group ref={body}>
        {/* Hard upper torso and soft lower torso. */}
        <RoundedBox args={[0.5, 0.52, 0.34]} radius={0.12} smoothness={4} material={m.suit} position={[0, 0.18, 0]} />
        <mesh geometry={G.pelvis} material={m.soft} position={[0, -0.25, 0]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={G.neck} material={m.metal} position={[0, 0.46, 0.02]} rotation={[Math.PI / 2, 0, 0]} />
        {/* Display and control module on the chest. */}
        <RoundedBox args={[0.3, 0.13, 0.1]} radius={0.025} smoothness={3} material={m.dark} position={[0, 0.06, 0.2]} />
        <mesh geometry={G.dot} material={m.led} position={[-0.08, 0.08, 0.255]} />
        <mesh geometry={G.dot} material={m.lamp} position={[0.08, 0.08, 0.255]} />
        {/* Shoulder patch and commander's stripes. */}
        <mesh material={m.patch} position={[-0.27, 0.32, 0.03]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.055, 20]} />
        </mesh>
        {/* Primary life support system: the backpack. */}
        <RoundedBox args={[0.5, 0.62, 0.24]} radius={0.06} smoothness={3} material={m.suit} position={[0, 0.14, -0.3]} />
        <RoundedBox args={[0.42, 0.18, 0.06]} radius={0.02} smoothness={2} material={m.grey} position={[0, 0.3, -0.43]} />
        <RoundedBox args={[0.42, 0.1, 0.05]} radius={0.02} smoothness={2} material={m.dark} position={[0, -0.05, -0.43]} />
        {/* Helmet with a gold sun visor and two lamps. */}
        <group position={[0, 0.66, 0.02]}>
          <mesh geometry={G.helmet} material={m.suit} />
          <mesh geometry={G.visor} material={m.visor} />
          <mesh geometry={G.lamp} material={m.lamp} position={[0.19, 0.08, 0.04]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={G.lamp} material={m.lamp} position={[-0.19, 0.08, 0.04]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
        <Arm side={1} m={m} armRef={armL} />
        <Arm side={-1} m={m} armRef={armR} />
        <Leg side={1} m={m} legRef={legL} />
        <Leg side={-1} m={m} legRef={legR} />
      </group>
    </group>
  )
}
