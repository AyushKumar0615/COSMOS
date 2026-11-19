import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { getOpenSettings, ship } from '../../../lib/openWorldStore.js'
import { fabricMaps, flagTexture, missionPatchTexture, nameTagTexture, stitchTexture } from '../../../lib/suitTextures.js'
import { quality } from '../../../lib/quality.js'

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

// Live reflection and shadow budget per device tier.
const TIER = {
  high: { cube: 256, every: 4, shadow: 1024 },
  medium: { cube: 128, every: 8, shadow: 512 },
  low: { cube: 64, every: 20, shadow: 0 },
}

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
  return wrinkle(lathe(profile, 32))
}

/**
 * Soft folds in pressurised fabric: shallow horizontal creases that wander
 * round the limb, plus slow bagging. Displaced along the radius; integer
 * angular frequencies keep the lathe seam closed.
 */
function wrinkle(geometry, amp = 0.0032) {
  const p = geometry.attributes.position
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-6) continue
    const a = Math.atan2(z, x)
    const crease = Math.sin(y * 62 + Math.sin(a * 3) * 1.8) * (0.5 + 0.5 * Math.sin(a * 2 + y * 11))
    const bag = Math.sin(a * 5 + y * 21) * 0.45 + Math.sin(a * 3 - y * 37) * 0.3
    const d = amp * (crease * 0.75 + bag * 0.5)
    p.setXYZ(i, x + (x / r) * d, y, z + (z / r) * d)
  }
  geometry.computeVertexNormals()
  return geometry
}

const ring = (r, tube, segments = 32) => new THREE.TorusGeometry(r, tube, 8, segments)

/** A bearing: two machined races with a gap between them and four locking tabs. */
function bearing(r, tube) {
  const parts = [ring(r, tube, 40).translate(0, 0, -tube * 0.9), ring(r * 1.01, tube * 0.72, 40).translate(0, 0, tube * 1.25)]
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4
    parts.push(new THREE.BoxGeometry(tube * 1.6, tube * 1.6, tube * 2.6).translate(Math.cos(a) * (r + tube * 0.75), Math.sin(a) * (r + tube * 0.75), 0))
  }
  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}

/** Place a part at a point on a curve, its axis (y) along the curve. */
const along = (geometry, curve, t) => {
  const at = curve.getPointAt(t)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t))
  return geometry.applyQuaternion(q).translate(at.x, at.y, at.z)
}

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
    const len = [0.03, 0.034, 0.032, 0.026][f]
    // Proximal, middle and distal segments, each bent a little more.
    let y = -0.078
    let z = 0.002
    let bend = 0.15
    for (const [k, w] of [
      [0.45, 0.0088],
      [0.33, 0.0083],
      [0.27, 0.0078],
    ]) {
      const l = len * k * 2
      fingers.push(new THREE.CapsuleGeometry(w, l, 3, 10).rotateX(bend).translate(x, y - (l / 2) * Math.cos(bend), z + (l / 2) * Math.sin(bend)))
      y -= l * Math.cos(bend)
      z += l * Math.sin(bend)
      bend += 0.32
    }
    tips.push(new THREE.SphereGeometry(0.0092, 10, 8).scale(1, 0.9, 0.62).translate(x, y - 0.002, z + 0.006))
  }
  fingers.push(new THREE.CapsuleGeometry(0.0105, 0.022, 3, 10).rotateZ(-0.7).rotateX(0.4).translate(0.042, -0.055, 0.016))
  fingers.push(new THREE.CapsuleGeometry(0.0095, 0.018, 3, 10).rotateZ(-0.35).rotateX(0.75).translate(0.054, -0.074, 0.028))
  // Rubber grip pad across the palm.
  tips.push(new THREE.SphereGeometry(0.04, 16, 10).scale(1, 0.85, 0.22).translate(0, -0.05, 0.019))
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
  soleParts.push(new RoundedBoxGeometry(0.15, 0.03, 0.08, 2, 0.01).translate(0, -0.118, -0.07))
  soleParts.push(new RoundedBoxGeometry(0.13, 0.04, 0.03, 2, 0.012).translate(0, -0.085, 0.19))
  const sole = mergeGeometries(soleParts.map((g) => (g.index ? g.toNonIndexed() : g)))
  soleParts.forEach((g) => g.dispose())

  // Helmet. The figure faces +z; in a Three.js sphere that is phi = π/2.
  const opening = 0.62 // half-width of the face opening, radians
  const bubble = new THREE.SphereGeometry(0.19, 40, 28)
  const shell = new THREE.SphereGeometry(0.207, 48, 32, Math.PI / 2 + opening, Math.PI * 2 - opening * 2, 0, Math.PI * 0.74)
  const brow = new THREE.SphereGeometry(0.207, 24, 10, Math.PI / 2 - opening, opening * 2, 0, Math.PI * 0.2)
  const visor = new THREE.SphereGeometry(0.2, 40, 24, Math.PI / 2 - opening, opening * 2, Math.PI * 0.2, Math.PI * 0.5)
  const outer = opening + 0.05
  const clearVisor = new THREE.SphereGeometry(0.212, 40, 24, Math.PI / 2 - outer, outer * 2, Math.PI * 0.17, Math.PI * 0.56)
  // The rim follows the edge of the opening on the shell.
  const rimPoints = []
  const onSphere = (phi, theta, r = 0.211) => new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta))
  const [p0, p1, t0, t1] = [Math.PI / 2 - outer, Math.PI / 2 + outer, Math.PI * 0.17, Math.PI * 0.73]
  for (let i = 0; i < 12; i += 1) rimPoints.push(onSphere(p0 + ((p1 - p0) * i) / 12, t0))
  for (let i = 0; i < 12; i += 1) rimPoints.push(onSphere(p1, t0 + ((t1 - t0) * i) / 12))
  for (let i = 0; i < 12; i += 1) rimPoints.push(onSphere(p1 - ((p1 - p0) * i) / 12, t1))
  for (let i = 0; i < 12; i += 1) rimPoints.push(onSphere(p0, t1 - ((t1 - t0) * i) / 12))
  const visorRim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints, true, 'catmullrom', 0.2), 96, 0.0055, 8, true)

  // Hoses from the chest module round to the backpack.
  const hoseCurve = (side) =>
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.15, 0.03, 0.22),
      new THREE.Vector3(side * 0.24, -0.04, 0.2),
      new THREE.Vector3(side * 0.31, -0.02, 0.02),
      new THREE.Vector3(side * 0.24, 0.08, -0.2),
    ])
  const hose = (side) => new THREE.TubeGeometry(hoseCurve(side), 36, 0.016, 12, false)
  const fittingParts = []
  for (const side of [1, -1]) {
    const curve = hoseCurve(side)
    for (const t of [0.015, 0.985]) {
      fittingParts.push(along(new THREE.CylinderGeometry(0.024, 0.024, 0.022, 6), curve, t))
      fittingParts.push(along(new THREE.CylinderGeometry(0.019, 0.021, 0.03, 16), curve, t < 0.5 ? 0.05 : 0.95))
    }
  }
  const fittings = mergeGeometries(fittingParts)
  fittingParts.forEach((g) => g.dispose())

  // Backpack: corner bolts and a vent grille on the upper panel.
  const boltParts = []
  for (const [x, y] of [
    [-0.205, 0.255],
    [0.205, 0.255],
    [-0.205, 0.085],
    [0.205, 0.085],
    [-0.2, -0.01],
    [-0.02, -0.01],
    [0.2, -0.01],
    [0.06, -0.01],
  ])
    boltParts.push(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 6).rotateX(Math.PI / 2).translate(x, y, -0.137))
  const bolts = mergeGeometries(boltParts)
  boltParts.forEach((g) => g.dispose())
  const slats = []
  for (let i = 0; i < 7; i += 1) slats.push(new THREE.BoxGeometry(0.28, 0.007, 0.006).translate(0.02, 0.125 + i * 0.016, -0.138))
  const grille = mergeGeometries(slats)
  slats.forEach((g) => g.dispose())
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
    bearing: bearing(0.1, 0.014),
    bearingSmall: bearing(0.078, 0.011),
    // Seam piping: a narrow band just proud of the fabric, stitched both sides.
    seam: new THREE.CylinderGeometry(1, 1, 0.17, 48, 1, true),
    glove,
    gloveTips,
    gauntlet,
    boot,
    sole,
    bubble,
    shell,
    brow,
    visor,
    clearVisor,
    visorRim,
    fittings,
    bolts,
    grille,
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
    const tier = TIER[quality().tier] ?? TIER.medium
    // Live reflections: a small cube camera renders the real scene round the
    // astronaut (Sun, Earth, stars, sky); three.js turns it into blurred
    // mip levels for each roughness when it is marked for update.
    const reflection = new THREE.WebGLCubeRenderTarget(tier.cube, { type: THREE.HalfFloatType })
    const cubeCamera = new THREE.CubeCamera(0.05, 64000, reflection)
    const envMap = reflection.texture
    const stitch = stitchTexture()
    stitch.repeat.set(26, 1)
    const flag = flagTexture()
    const patch = missionPatchTexture()
    const tag = nameTagTexture()
    const fabric = (color, intensity = 0.45) =>
      new THREE.MeshPhysicalMaterial({
        color,
        map: maps.albedo,
        roughness: 0.92,
        roughnessMap: maps.roughness,
        normalMap: maps.normal,
        normalScale: new THREE.Vector2(1.25, 1.25),
        sheen: 0.55,
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color('#ffffff'),
        envMap,
        envMapIntensity: intensity,
      })
    const material = {
      fabric: fabric('#f1f0ea'),
      joint: fabric('#e4e3dc', 0.35),
      // Gloves and boots see the most handling: a touch greyer.
      worn: fabric('#dcd9d1', 0.35),
      stitch: new THREE.MeshStandardMaterial({ map: stitch, roughness: 0.9, normalMap: maps.normal, envMap, envMapIntensity: 0.3 }),
      hose: fabric('#c9ccd0', 0.4),
      stripe: fabric('#a3212c', 0.2),
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
        envMapIntensity: 1.8,
        // The gold film's thin-film sheen, kept faint.
        iridescence: 0.25,
        iridescenceThicknessRange: [180, 420],
        emissive: '#2a1a05',
        emissiveIntensity: 0.35,
      }),
      // The clear protective visor in front of the gold one: a reflection
      // over depth, nearly invisible face on.
      clearVisor: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08, clearcoat: 1, envMap, envMapIntensity: 2.2, depthWrite: false }),
      bubble: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, envMap, envMapIntensity: 1.4, depthWrite: false }),
      lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#eaf4ff', emissiveIntensity: 1.1 }),
      led: new THREE.MeshStandardMaterial({ color: '#2ef0b0', emissive: '#2ef0b0', emissiveIntensity: 1.6 }),
      screen: new THREE.MeshStandardMaterial({ color: '#0d1a14', emissive: '#4ad6a0', emissiveIntensity: 0.35, roughness: 0.3 }),
      flag: new THREE.MeshStandardMaterial({ map: flag, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }),
      patch: new THREE.MeshStandardMaterial({ map: patch, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
      tag: new THREE.MeshStandardMaterial({ map: tag, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
    }
    return { geometry, material, textures: [maps.normal, maps.roughness, maps.albedo, stitch, flag, patch, tag], reflection, cubeCamera, tier }
  }, [gl])
  useEffect(
    () => () => {
      Object.values(suit.geometry).forEach((g) => g.dispose())
      Object.values(suit.material).forEach((m) => m.dispose())
      suit.textures.forEach((t) => t.dispose())
      suit.reflection.dispose()
    },
    [suit],
  )
  return suit
}

// --- Parts ------------------------------------------------------------------------------------

/** A thin seam band round a limb at height y and radius r. */
const Seam = ({ g, m, y, r }) => <mesh geometry={g.seam} material={m.stitch} position={[0, y, 0]} scale={[r * 1.014, r, r * 1.014]} />

function Glove({ side, g, m }) {
  // Palms face the body and thumbs point forward; mirrored for the right
  // hand (three.js flips the winding for a negative scale).
  return (
    <group scale={[side * 1.35, 1.35, 1.35]} rotation={[-0.35, -side * (Math.PI / 2), 0]}>
      <mesh geometry={g.gauntlet} material={m.worn} />
      <mesh geometry={g.glove} material={m.worn} />
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
          <mesh geometry={g.boot} material={m.worn} />
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
      <mesh geometry={g.visorRim} material={m.panel} />
      <mesh geometry={g.clearVisor} material={m.clearVisor} renderOrder={3} />
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
      <mesh geometry={g.fittings} material={m.metal} />
      {/* Primary life support system. */}
      <group position={[0, 0.16, -0.31]}>
        <RoundedBox args={[0.52, 0.66, 0.24]} radius={0.06} smoothness={4} material={m.shell} />
        <RoundedBox args={[0.44, 0.2, 0.03]} radius={0.012} smoothness={2} material={m.panel} position={[0, 0.17, -0.12]} />
        <RoundedBox args={[0.2, 0.12, 0.03]} radius={0.01} smoothness={2} material={m.panel} position={[-0.11, -0.06, -0.12]} />
        <RoundedBox args={[0.16, 0.12, 0.03]} radius={0.01} smoothness={2} material={m.dark} position={[0.13, -0.06, -0.12]} />
        <mesh geometry={g.connector} material={m.metal} position={[0.24, -0.08, 0.1]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={g.connector} material={m.metal} position={[-0.24, -0.08, 0.1]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={g.dot} material={m.led} position={[0.19, 0.3, -0.11]} />
        <mesh geometry={g.bolts} material={m.metal} />
        <mesh geometry={g.grille} material={m.dark} />
        {/* Jet-pack unit under the backpack, with its stowed hand controller. */}
        <RoundedBox args={[0.5, 0.14, 0.26]} radius={0.03} smoothness={3} material={m.panel} position={[0, -0.4, 0.01]} />
        <RoundedBox args={[0.12, 0.06, 0.06]} radius={0.015} smoothness={2} material={m.dark} position={[0.18, -0.38, 0.16]} />
      </group>
    </>
  )
}

export default function Astronaut({ reducedMotion }) {
  const { geometry: g, material: m, reflection, cubeCamera, tier } = useSuit()
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const keyLight = useRef(null)
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
  const state = useRef({ mix: 0, lean: 0, bank: 0, time: 0, frame: 0, programs: -1, compiling: null, lastQ: new THREE.Quaternion(), turn: new THREE.Vector3() })

  // Self-shadowing from the scene's key light (the brightest star). Only the
  // astronaut casts and receives, in a frustum just big enough for it, so the
  // extra pass draws one small model. Off on the low tier.
  useEffect(() => {
    const figure = root.current
    const light = figure?.parent?.children.find((o) => o.isDirectionalLight)
    if (!figure || !light || !tier.shadow) return undefined
    const previous = { enabled: gl.shadowMap.enabled, type: gl.shadowMap.type }
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFShadowMap
    light.castShadow = true
    light.shadow.mapSize.set(tier.shadow, tier.shadow)
    const cam = light.shadow.camera
    // The figure is 0.4 × ~2 units tall: a ±0.5 frustum holds it whole.
    cam.left = cam.bottom = -0.5
    cam.right = cam.top = 0.5
    cam.near = 48
    cam.far = 52
    cam.updateProjectionMatrix()
    light.shadow.bias = -0.0002
    light.shadow.normalBias = 0.002
    figure.traverse((o) => {
      if (!o.isMesh) return
      // Glass casts no shadow; everything else shades itself.
      o.castShadow = !o.material.transparent
      o.receiveShadow = true
      o.material.needsUpdate = true
    })
    keyLight.current = light
    return () => {
      keyLight.current = null
      light.castShadow = false
      light.shadow.map?.dispose()
      light.shadow.map = null
      gl.shadowMap.enabled = previous.enabled
      gl.shadowMap.type = previous.type
    }
  }, [gl, tier])

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

    // The scene points its key light from the origin each frame; moving the
    // light and its target together by the figure's position keeps the
    // direction exactly the same while centring the shadow frustum on it.
    const light = keyLight.current
    if (light) {
      light.position.add(root_.position)
      light.target.position.copy(root_.position)
      light.target.updateMatrixWorld()
    }

    // Refresh the reflection a few times a second, without the figure in it.
    // Drawing into the cube target needs its own shader variants (linear
    // output, no tone mapping), so when the scene gains new programs they
    // are first compiled in the background and the refresh waits for them,
    // instead of compiling in one blocking burst mid-flight.
    s.frame += 1
    const programs = gl.info.programs?.length ?? 0
    if (programs !== s.programs && !s.compiling) {
      s.programs = programs
      const previous = gl.getRenderTarget()
      gl.setRenderTarget(reflection)
      s.compiling = gl.compileAsync(scene, cubeCamera.children[0]).finally(() => {
        s.compiling = null
      })
      gl.setRenderTarget(previous)
    }
    if (root_.visible && !s.compiling && (s.frame % tier.every === 0 || s.frame < 3)) {
      root_.visible = false
      cubeCamera.position.copy(root_.position)
      cubeCamera.updateMatrixWorld()
      cubeCamera.update(gl, scene)
      reflection.texture.needsPMREMUpdate = true
      root_.visible = true
    }

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
