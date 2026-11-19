import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { getOpenSettings, ship } from '../../../lib/openWorldStore.js'
import { fabricMaps, flagTexture, missionPatchTexture, nameTagTexture, spaceEnvironment } from '../../../lib/suitTextures.js'

/**
 * An EVA astronaut in the style of the shuttle/ISS-era EMU, modelled from
 * lathe-turned shells and primitives (no downloaded assets):
 * - helmet: clear pressure bubble inside a hard visor assembly, gold sun visor,
 *   lamp and camera housings, neck ring;
 * - suit: hard upper torso, fabric limbs with convolute bellows at elbows and
 *   knees, bearings at shoulders, waist, wrists and thighs, seams, commander's
 *   red leg stripes, flag, mission patch and name tag;
 * - gloves with jointed fingers and rubber grips, boots with ridged soles;
 * - display and control module on the chest, life-support backpack with
 *   panels and a jet-pack unit, and the hoses between them.
 * Materials are physically based, lit by the scene's light and a small
 * generated space environment for reflections.
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
// Debug-only inspection (?debug): turn the figure and bring it closer.
const inspect = { yaw: 0, distance: 0, lift: 0 }

// --- Geometry helpers ---------------------------------------------------------------------

/** Scale UVs so the fabric weave keeps roughly one size across parts. */
function uvScale(geometry, su, sv) {
  const uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  return geometry
}

/** A shell of revolution from (radius, height) pairs, bottom to top. */
function lathe(profile, segments = 28, tile = 0.11) {
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y))
  const geometry = new THREE.LatheGeometry(points, segments)
  const rMax = Math.max(...profile.map((p) => p[0]))
  let length = 0
  for (let i = 1; i < profile.length; i += 1) length += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1])
  return uvScale(geometry, (Math.PI * 2 * rMax) / tile, length / tile)
}

/** A limb segment from y0 (bottom) to y1, tapering r0 to r1, with convolute ridges near one end. */
function limb(r0, r1, y0, y1, { ridges = 0, at = 'top', depth = 0.012, span = 0.35 } = {}) {
  const profile = []
  const steps = 26
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    let r = r0 + (r1 - r0) * t
    const u = at === 'top' ? (t - (1 - span)) / span : 1 - t / span
    if (ridges && u >= 0 && u <= 1) r += depth * (0.5 + 0.5 * Math.cos(u * ridges * Math.PI * 2))
    // Rounded ends so segments tuck into each other.
    const end = Math.min(t, 1 - t)
    if (end < 0.06) r *= 0.82 + 0.18 * Math.sin((end / 0.06) * (Math.PI / 2))
    profile.push([r, y0 + (y1 - y0) * t])
  }
  return lathe(profile, 24)
}

const ring = (r, tube, segments = 32) => new THREE.TorusGeometry(r, tube, 8, segments)

function buildGeometry() {
  // Hard upper torso: a turned shell, flattened front to back.
  const hut = lathe(
    [
      [0.16, -0.08],
      [0.2, 0.0],
      [0.245, 0.12],
      [0.265, 0.24],
      [0.262, 0.32],
      [0.235, 0.4],
      [0.17, 0.46],
      [0.13, 0.48],
    ],
    36,
  ).scale(1, 1, 0.74)
  // Lower torso and brief, with waist convolutes.
  const lowerTorso = limb(0.175, 0.165, -0.4, -0.06, { ridges: 3, at: 'top', depth: 0.01, span: 0.45 }).scale(1, 1, 0.8)
  const brief = new THREE.SphereGeometry(0.19, 28, 18, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55).scale(1.05, 0.9, 0.82)
  uvScale(brief, 14, 6)

  // Glove: palm, four fingers in two segments, thumb; rubber pads on the tips.
  const fingers = []
  const tips = []
  for (let f = 0; f < 4; f += 1) {
    const x = -0.027 + f * 0.018
    const len = [0.032, 0.036, 0.034, 0.028][f]
    fingers.push(new THREE.CapsuleGeometry(0.0085, len, 3, 8).translate(x, -0.075 - len / 2, 0.004))
    const tip = new THREE.CapsuleGeometry(0.0082, len * 0.8, 3, 8).rotateX(0.5).translate(x, -0.1 - len, 0.012)
    fingers.push(tip)
    tips.push(new THREE.SphereGeometry(0.0095, 8, 6).scale(1, 0.9, 0.6).translate(x, -0.112 - len * 1.2, 0.02))
  }
  fingers.push(new THREE.CapsuleGeometry(0.01, 0.034, 3, 8).rotateZ(-0.7).rotateX(0.4).translate(0.045, -0.06, 0.018))
  const palm = new THREE.SphereGeometry(0.045, 16, 12).scale(1, 1.15, 0.5).translate(0, -0.05, 0)
  const glove = mergeGeometries([palm, ...fingers].map((g) => g.toNonIndexed()))
  const gloveTips = mergeGeometries(tips.map((g) => g.toNonIndexed()))
  palm.dispose()
  ;[...fingers, ...tips].forEach((g) => g.dispose())
  const gauntlet = lathe([
    [0.046, -0.03],
    [0.056, 0.0],
    [0.066, 0.05],
    [0.068, 0.07],
  ])

  // Boot: an ankle cuff over a foot, on a rounded sole with tread ridges.
  const ankle = lathe([
    [0.075, -0.06],
    [0.085, 0.0],
    [0.088, 0.06],
  ])
  const foot = new THREE.SphereGeometry(0.1, 28, 18).scale(0.82, 0.5, 1.45).translate(0, -0.055, 0.045)
  uvScale(foot, 9, 5)
  const boot = mergeGeometries([ankle, foot].map((g) => g.toNonIndexed()))
  ankle.dispose()
  foot.dispose()
  const soleParts = [new RoundedBoxGeometry(0.16, 0.026, 0.3, 3, 0.012).translate(0, -0.1, 0.045)]
  for (let i = 0; i < 6; i += 1) soleParts.push(new THREE.BoxGeometry(0.15, 0.008, 0.016).translate(0, -0.115, -0.07 + i * 0.045))
  const sole = mergeGeometries(soleParts.map((g) => (g.index ? g.toNonIndexed() : g)))
  soleParts.forEach((g) => g.dispose())

  // Helmet. The figure faces +z; in a Three.js sphere that is phi = π/2.
  const opening = 0.62 // half-width of the face opening, radians
  const bubble = new THREE.SphereGeometry(0.19, 40, 28)
  const shell = new THREE.SphereGeometry(0.207, 48, 32, Math.PI / 2 + opening, Math.PI * 2 - opening * 2, 0, Math.PI * 0.74)
  const brow = new THREE.SphereGeometry(0.207, 24, 10, Math.PI / 2 - opening, opening * 2, 0, Math.PI * 0.2)
  const visor = new THREE.SphereGeometry(0.2, 40, 24, Math.PI / 2 - opening, opening * 2, Math.PI * 0.2, Math.PI * 0.5)

  // Hoses from the chest module round to the backpack.
  const hose = (side) =>
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.15, 0.03, 0.22),
        new THREE.Vector3(side * 0.24, -0.04, 0.2),
        new THREE.Vector3(side * 0.31, -0.02, 0.02),
        new THREE.Vector3(side * 0.24, 0.08, -0.2),
      ]),
      28,
      0.016,
      10,
      false,
    )
  return {
    hut,
    lowerTorso,
    brief,
    upperArm: limb(0.088, 0.096, -0.36, 0, { ridges: 0 }),
    forearm: limb(0.074, 0.086, -0.34, 0.02, { ridges: 4, at: 'top', depth: 0.011, span: 0.4 }),
    thigh: limb(0.098, 0.112, -0.4, 0, { ridges: 0 }),
    shin: limb(0.078, 0.096, -0.38, 0.02, { ridges: 4, at: 'top', depth: 0.012, span: 0.38 }),
    shoulder: new THREE.SphereGeometry(0.105, 24, 16),
    elbow: new THREE.SphereGeometry(0.084, 20, 14),
    knee: new THREE.SphereGeometry(0.096, 20, 14),
    bearing: ring(0.1, 0.016),
    bearingSmall: ring(0.078, 0.012),
    seam: ring(1, 0.035, 40),
    glove,
    gloveTips,
    gauntlet,
    boot,
    sole,
    bubble,
    shell,
    brow,
    visor,
    neck: ring(0.135, 0.022, 40),
    lampLens: new THREE.CircleGeometry(0.018, 16),
    lampBody: new THREE.CylinderGeometry(0.026, 0.03, 0.06, 16),
    knob: new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16),
    dot: new THREE.SphereGeometry(0.008, 8, 6),
    hoseL: hose(1),
    hoseR: hose(-1),
    connector: new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16),
    patch: new THREE.CircleGeometry(0.05, 32),
    flag: new THREE.PlaneGeometry(0.095, 0.05),
    tag: new THREE.PlaneGeometry(0.14, 0.035),
    stripe: new THREE.CylinderGeometry(1, 1, 0.045, 28, 1, true),
  }
}

function useSuit() {
  const gl = useThree((state) => state.gl)
  const suit = useMemo(() => {
    const geometry = buildGeometry()
    const maps = fabricMaps()
    const env = spaceEnvironment(gl)
    const envMap = env.texture
    const flag = flagTexture()
    const patch = missionPatchTexture()
    const tag = nameTagTexture()
    const fabric = (color, intensity = 0.32) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.92,
        roughnessMap: maps.roughness,
        normalMap: maps.normal,
        normalScale: new THREE.Vector2(1.15, 1.15),
        sheen: 0.55,
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color('#ffffff'),
        envMap,
        envMapIntensity: intensity,
      })
    const material = {
      fabric: fabric('#eeede7'),
      joint: fabric('#e2e1da', 0.25),
      hose: fabric('#c9ccd0', 0.4),
      stripe: fabric('#a3212c', 0.2),
      seam: new THREE.MeshStandardMaterial({ color: '#cfcdc5', roughness: 0.85, envMap, envMapIntensity: 0.2 }),
      shell: new THREE.MeshPhysicalMaterial({ color: '#f1f0ec', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, envMap, envMapIntensity: 0.55 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: 0.24, metalness: 1, envMap, envMapIntensity: 1.1 }),
      blue: new THREE.MeshStandardMaterial({ color: '#3d6fb4', roughness: 0.3, metalness: 0.9, envMap, envMapIntensity: 0.9 }),
      red: new THREE.MeshStandardMaterial({ color: '#b83a3a', roughness: 0.3, metalness: 0.9, envMap, envMapIntensity: 0.9 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 0.82, envMap, envMapIntensity: 0.15 }),
      panel: new THREE.MeshStandardMaterial({ color: '#8d939b', roughness: 0.55, metalness: 0.35, envMap, envMapIntensity: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: '#25292f', roughness: 0.5, metalness: 0.4, envMap, envMapIntensity: 0.5 }),
      // Gold film on polycarbonate: a mirror tinted gold, with a whisper of
      // emission so it never reads as a hole in dark space.
      visor: new THREE.MeshPhysicalMaterial({
        color: '#e0ad4c',
        metalness: 1,
        roughness: 0.07,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMap,
        envMapIntensity: 2.4,
        emissive: '#4a3008',
        emissiveIntensity: 0.9,
      }),
      bubble: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, envMap, envMapIntensity: 1.4, depthWrite: false }),
      lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#eaf4ff', emissiveIntensity: 1.1 }),
      led: new THREE.MeshStandardMaterial({ color: '#2ef0b0', emissive: '#2ef0b0', emissiveIntensity: 1.6 }),
      screen: new THREE.MeshStandardMaterial({ color: '#0d1a14', emissive: '#4ad6a0', emissiveIntensity: 0.35, roughness: 0.3 }),
      flag: new THREE.MeshStandardMaterial({ map: flag, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }),
      patch: new THREE.MeshStandardMaterial({ map: patch, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
      tag: new THREE.MeshStandardMaterial({ map: tag, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
    }
    return { geometry, material, textures: [maps.normal, maps.roughness, flag, patch, tag], env }
  }, [gl])
  useEffect(
    () => () => {
      Object.values(suit.geometry).forEach((g) => g.dispose())
      Object.values(suit.material).forEach((m) => m.dispose())
      suit.textures.forEach((t) => t.dispose())
      suit.env.dispose()
    },
    [suit],
  )
  return suit
}

// --- Parts ------------------------------------------------------------------------------------

/** A thin seam band round a limb at height y and radius r. */
const Seam = ({ g, m, y, r, z = 1 }) => <mesh geometry={g.seam} material={m.seam} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[r, r * z, r]} />

function Glove({ side, g, m }) {
  // Palms face the body and thumbs point forward; mirrored for the right
  // hand (three.js flips the winding for a negative scale).
  return (
    <group scale={[side * 1.35, 1.35, 1.35]} rotation={[-0.35, -side * (Math.PI / 2), 0]}>
      <mesh geometry={g.gauntlet} material={m.fabric} />
      <mesh geometry={g.glove} material={m.joint} />
      <mesh geometry={g.gloveTips} material={m.rubber} />
    </group>
  )
}

function Arm({ side, g, m, armRef, foreRef }) {
  // side +1 is the astronaut's left (the figure faces +z).
  return (
    <group position={[side * 0.31, 0.3, 0]} ref={armRef}>
      <mesh geometry={g.bearing} material={m.metal} rotation={[0, Math.PI / 2, 0]} position={[-side * 0.035, 0, 0]} scale={1.12} />
      <mesh geometry={g.shoulder} material={m.joint} />
      <group position={[side * 0.02, -0.06, 0]}>
        <mesh geometry={g.upperArm} material={m.fabric} />
        <Seam g={g} m={m} y={-0.17} r={0.093} />
        {side === 1 ? (
          <mesh geometry={g.flag} material={m.flag} position={[0.098, -0.12, 0]} rotation={[0, Math.PI / 2, 0]} />
        ) : (
          <mesh geometry={g.patch} material={m.patch} position={[-0.099, -0.12, 0]} rotation={[0, -Math.PI / 2, 0]} scale={0.8} />
        )}
        <group position={[0, -0.38, 0]} ref={foreRef}>
          <mesh geometry={g.elbow} material={m.joint} />
          <mesh geometry={g.forearm} material={m.fabric} />
          <Seam g={g} m={m} y={-0.22} r={0.08} />
          <mesh geometry={g.bearingSmall} material={m.metal} position={[0, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={g.bearingSmall} material={side === 1 ? m.red : m.blue} position={[0, -0.355, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.02, 1.02, 0.5]} />
          {side === 1 && (
            // Cuff checklist on the left wrist.
            <RoundedBox args={[0.07, 0.09, 0.025]} radius={0.008} smoothness={2} material={m.panel} position={[0, -0.27, 0.085]} />
          )}
          <group position={[0, -0.38, 0]}>
            <Glove side={side} g={g} m={m} />
          </group>
        </group>
      </group>
    </group>
  )
}

function Leg({ side, g, m, legRef, shinRef }) {
  return (
    <group position={[side * 0.115, -0.4, 0]} ref={legRef}>
      <mesh geometry={g.bearing} material={m.metal} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} scale={1.18} />
      <mesh geometry={g.thigh} material={m.fabric} position={[0, -0.04, 0]} />
      {/* Commander's red stripes. */}
      <mesh geometry={g.stripe} material={m.stripe} position={[0, -0.2, 0]} scale={[0.109, 1, 0.109]} />
      <mesh geometry={g.stripe} material={m.stripe} position={[0, -0.3, 0]} scale={[0.106, 1, 0.106]} />
      <Seam g={g} m={m} y={-0.11} r={0.111} />
      <group position={[0, -0.45, 0]} ref={shinRef}>
        <mesh geometry={g.knee} material={m.joint} />
        <mesh geometry={g.shin} material={m.fabric} />
        <Seam g={g} m={m} y={-0.24} r={0.087} />
        <mesh geometry={g.bearingSmall} material={m.metal} position={[0, -0.36, 0]} rotation={[Math.PI / 2, 0, 0]} scale={1.08} />
        <group position={[0, -0.4, 0]}>
          <mesh geometry={g.boot} material={m.fabric} />
          <mesh geometry={g.sole} material={m.rubber} />
        </group>
      </group>
    </group>
  )
}

function Helmet({ g, m }) {
  return (
    <group position={[0, 0.69, 0.02]}>
      <mesh geometry={g.shell} material={m.shell} />
      <mesh geometry={g.brow} material={m.shell} />
      <mesh geometry={g.visor} material={m.visor} />
      <mesh geometry={g.bubble} material={m.bubble} renderOrder={2} />
      {/* Lamp and camera housings on both sides. */}
      {[1, -1].map((side) => (
        <group key={side} position={[side * 0.205, 0.09, -0.01]} rotation={[0, side * 0.2, 0]}>
          <RoundedBox args={[0.05, 0.07, 0.12]} radius={0.012} smoothness={2} material={m.shell} />
          <mesh geometry={g.lampBody} material={m.dark} position={[0, 0.012, 0.06]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={g.lampLens} material={m.lamp} position={[0, 0.012, 0.091]} />
          <mesh geometry={g.dot} material={m.dark} position={[0, -0.022, 0.062]} scale={1.6} />
        </group>
      ))}
    </group>
  )
}

function Torso({ g, m }) {
  return (
    <>
      <mesh geometry={g.hut} material={m.shell} position={[0, 0.0, 0]} />
      <mesh geometry={g.lowerTorso} material={m.fabric} />
      <mesh geometry={g.brief} material={m.fabric} position={[0, -0.36, 0]} />
      <mesh geometry={g.bearing} material={m.metal} position={[0, -0.075, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.8, 1.48, 1.2]} />
      <mesh geometry={g.neck} material={m.metal} position={[0, 0.5, 0.02]} rotation={[Math.PI / 2, 0, 0]} />
      {/* Display and control module. */}
      <group position={[0, 0.07, 0.2]}>
        <RoundedBox args={[0.3, 0.14, 0.09]} radius={0.02} smoothness={3} material={m.shell} />
        <RoundedBox args={[0.12, 0.05, 0.01]} radius={0.004} smoothness={2} material={m.screen} position={[0, 0.02, 0.046]} />
        {[-0.11, -0.065, 0.065, 0.11].map((x) => (
          <mesh key={x} geometry={g.knob} material={m.metal} position={[x, -0.025, 0.05]} rotation={[Math.PI / 2, 0, 0]} />
        ))}
        <mesh geometry={g.dot} material={m.led} position={[-0.11, 0.035, 0.047]} />
        <mesh geometry={g.dot} material={m.lamp} position={[0.11, 0.035, 0.047]} />
        <mesh geometry={g.connector} material={m.metal} position={[0.135, -0.04, 0.02]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={g.connector} material={m.metal} position={[-0.135, -0.04, 0.02]} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <mesh geometry={g.tag} material={m.tag} position={[0, 0.25, 0.203]} rotation={[-0.18, 0, 0]} />
      <mesh geometry={g.patch} material={m.patch} position={[-0.135, 0.28, 0.181]} rotation={[-0.15, -0.52, 0]} scale={0.62} />
      <mesh geometry={g.hoseL} material={m.hose} />
      <mesh geometry={g.hoseR} material={m.hose} />
      {/* Primary life support system. */}
      <group position={[0, 0.16, -0.31]}>
        <RoundedBox args={[0.52, 0.66, 0.24]} radius={0.06} smoothness={4} material={m.shell} />
        <RoundedBox args={[0.44, 0.2, 0.03]} radius={0.012} smoothness={2} material={m.panel} position={[0, 0.17, -0.12]} />
        <RoundedBox args={[0.2, 0.12, 0.03]} radius={0.01} smoothness={2} material={m.panel} position={[-0.11, -0.06, -0.12]} />
        <RoundedBox args={[0.16, 0.12, 0.03]} radius={0.01} smoothness={2} material={m.dark} position={[0.13, -0.06, -0.12]} />
        <mesh geometry={g.connector} material={m.metal} position={[0.24, -0.08, 0.1]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={g.connector} material={m.metal} position={[-0.24, -0.08, 0.1]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={g.dot} material={m.led} position={[0.19, 0.3, -0.11]} />
        {/* Jet-pack unit under the backpack, with its stowed hand controller. */}
        <RoundedBox args={[0.5, 0.14, 0.26]} radius={0.03} smoothness={3} material={m.panel} position={[0, -0.4, 0.01]} />
        <RoundedBox args={[0.12, 0.06, 0.06]} radius={0.015} smoothness={2} material={m.dark} position={[0.18, -0.38, 0.16]} />
      </group>
    </>
  )
}

export default function Astronaut({ reducedMotion }) {
  const { geometry: g, material: m } = useSuit()
  const root = useRef(null)
  const body = useRef(null)
  const armL = useRef(null)
  const armR = useRef(null)
  const foreL = useRef(null)
  const foreR = useRef(null)
  const legL = useRef(null)
  const legR = useRef(null)
  const shinL = useRef(null)
  const shinR = useRef(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__cosmosAstronaut = root.current
      window.__cosmosAstronautInspect = inspect
    }
  }, [])
  const state = useRef({ mix: 0, lean: 0, bank: 0, twist: 0, time: 0, lastQ: new THREE.Quaternion(), turn: new THREE.Vector3() })

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1)
    const s = state.current
    const settings = getOpenSettings()
    const root_ = root.current
    if (!root_) return
    // Camera mode: glide the figure out of view rather than popping it.
    const wantFirst = settings.camera === 'first' ? 1 : 0
    s.mix += (wantFirst - s.mix) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 5))
    root_.visible = s.mix < 0.97

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
    if (inspect.distance) offset.set(0, -0.08 + inspect.lift, -inspect.distance)
    offset.y += bob
    offset.applyQuaternion(qShip)
    root_.position.copy(offset)
    root_.quaternion.copy(qShip)

    // Body: faces away from the camera; leans into thrust, banks into turns.
    const b = body.current
    b.rotation.set(-0.12 - s.lean + THREE.MathUtils.clamp(s.turn.x * 0.2, -0.3, 0.3), Math.PI + inspect.yaw, s.bank + (reducedMotion ? 0 : Math.sin(t * 0.37) * 0.04))
    const breath = reducedMotion ? 1 : 1 + Math.sin(t * 1.6) * 0.008
    b.scale.set(breath, 1, breath)

    // Limbs drift, with a relaxed neutral-buoyancy bend at elbows and knees;
    // legs trail when thrusting.
    const sway = reducedMotion ? 0 : Math.sin(t * 0.9)
    const drift = reducedMotion ? 0 : Math.sin(t * 0.55 + 1.3)
    armL.current.rotation.set(0.25 + sway * 0.06 - s.lean * 0.6, 0, 0.32 + sway * 0.04)
    armR.current.rotation.set(0.2 - sway * 0.05 - s.lean * 0.6, 0, -0.3 - sway * 0.04)
    legL.current.rotation.set(0.08 + s.lean * 0.8 + sway * 0.04, 0, 0.06)
    legR.current.rotation.set(-0.04 + s.lean * 0.7 - sway * 0.05, 0, -0.08)
    foreL.current.rotation.set(-0.5 - drift * 0.08 + s.lean * 0.3, 0, 0)
    foreR.current.rotation.set(-0.42 + drift * 0.07 + s.lean * 0.3, 0, 0)
    shinL.current.rotation.set(0.32 + drift * 0.05 - s.lean * 0.2, 0, 0)
    shinR.current.rotation.set(0.26 - drift * 0.06 - s.lean * 0.2, 0, 0)
  })

  return (
    <group ref={root} scale={0.4}>
      <group ref={body}>
        <Torso g={g} m={m} />
        <Helmet g={g} m={m} />
        <Arm side={1} g={g} m={m} armRef={armL} foreRef={foreL} />
        <Arm side={-1} g={g} m={m} armRef={armR} foreRef={foreR} />
        <Leg side={1} g={g} m={m} legRef={legL} shinRef={shinL} />
        <Leg side={-1} g={g} m={m} legRef={legR} shinRef={shinR} />
      </group>
    </group>
  )
}
