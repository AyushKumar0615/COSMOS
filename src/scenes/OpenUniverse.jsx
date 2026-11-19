import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Astronaut from '../components/3d/open/Astronaut.jsx'
import Belts from '../components/3d/open/Belts.jsx'
import CometTails from '../components/3d/open/CometTails.jsx'
import DetailBodies, { beaconColor } from '../components/3d/open/DetailBodies.jsx'
import PointLayer from '../components/3d/open/PointLayer.jsx'
import Sky from '../components/3d/open/Sky.jsx'
import SpaceDust from '../components/3d/open/SpaceDust.jsx'
import { useFlightInput } from '../components/3d/open/useFlightInput.js'
import { findTarget, getWorld, updateWorld, TYPE_LOOK } from '../lib/worldCatalogue.js'
import {
  commands,
  emitOpenEvent,
  getOpenSettings,
  getPlaces,
  input,
  markers,
  publishTelemetry,
  setOpenSettings,
  ship,
} from '../lib/openWorldStore.js'
import {
  BOOST,
  KM_PER_AU,
  KM_PER_LY,
  RENDER_FAR,
  apparentMagnitude,
  autopilotDistance,
  autopilotDuration,
  cellStars,
  formatDuration,
  formatKm,
  galacticAngles,
  renderDistance,
} from '../lib/openWorld.js'
import { julianDate } from '../lib/orbits.js'
import { temperatureColor } from '../lib/starPopulations.js'
import { getDiscovery, recordVisit } from '../lib/discovery.js'
import { GALAXIES_BY_ID } from '../data/galaxies.js'
import { CATALOGUE_BY_ID } from '../data/catalogue/index.js'
import { quality } from '../lib/quality.js'

// Scratch, reused every frame.
const q = new THREE.Quaternion()
const qStep = new THREE.Quaternion()
const qGoal = new THREE.Quaternion()
const euler = new THREE.Euler()
const vLocal = new THREE.Vector3()
const vel = new THREE.Vector3()
const fwd = new THREE.Vector3()
const tmp = new THREE.Vector3()
const prev = new THREE.Vector3()
const qInverse = new THREE.Quaternion()
const look = new THREE.Matrix4()
const ORIGIN = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

const CATALOGUE_IDS = new Set(Object.keys(CATALOGUE_BY_ID))
const LIST_INTERVAL = 0.16
const DETAIL_INTERVAL = 0.2
const AHEAD_CONE = (14 * Math.PI) / 180
const MARKER_POOL = 12

// Procedural field stars: a near tier for parallax between real stars and a
// far tier of bright giants. Cells are hashed, so a place always looks the same.
const TIERS = [
  { id: 0, cellLy: 25, perCell: 2.2, magMin: 0.5, magMax: 11, reach: 3 },
  { id: 1, cellLy: 1400, perCell: 5, magMin: -7, magMax: -1, reach: 3 },
]

// The Milky Way model's disc, so procedural stars thin out where it does.
function discFor(milkyWay) {
  const model = GALAXIES_BY_ID['milky-way'].model
  const centreLy = Math.hypot(...milkyWay.pos) / KM_PER_LY
  return {
    centreLy,
    sunRLy: centreLy,
    radiusLy: model.radius * 1000,
    scaleLengthLy: model.scaleLength * 1000,
    scaleHeightLy: model.thickness * 1000,
  }
}

/** Solar-system bodies and spacecraft clutter lists once you are far from them. */
function listable(obj, d) {
  if (['moon', 'small', 'spacecraft', 'dwarf', 'planet'].includes(obj.type)) return d < 200 * KM_PER_AU
  if (obj.type === 'exoplanet') return d < 2000 * KM_PER_AU
  return true
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * The open universe: one continuous space from a planet's surface to the
 * quasars, flown in six directions. A floating origin keeps the camera at
 * the render origin; everything is drawn in its true direction at a
 * compressed distance and scaled to keep its true angular size.
 */
export default function OpenUniverse({ reducedMotion }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const world = useMemo(() => getWorld(), [])
  const n = world.objects.length
  const view = useMemo(
    () => ({
      rp: new Float32Array(n * 3),
      k: new Float64Array(n),
      d: new Float64Array(n),
      px: new Float32Array(n),
      centreDir: [1, 0, 0],
      inside: 1,
    }),
    [n],
  )
  const viewRef = useRef(view)
  const outside = useRef(0)
  const axes = useFlightInput()
  const beacons = useRef(null)
  const field = useRef(null)
  const light = useRef(null)
  const ambient = useRef(null)
  const [detail, setDetail] = useState([])
  // The navigation route: a line from the ship to the target, fading in.
  const route = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.13, 0.83, 0.93]), 3))
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    const line = new THREE.Line(geometry, material)
    line.frustumCulled = false
    line.renderOrder = 5
    line.visible = false
    return line
  }, [])
  useEffect(
    () => () => {
      route.geometry.dispose()
      route.material.dispose()
    },
    [route],
  )
  const loop = useRef({
    listTimer: 0,
    detailTimer: 0,
    worldTimer: 0,
    detailKey: '',
    pending: { yaw: 0, pitch: 0, roll: 0 },
    ap: null,
    face: null,
    seenReset: commands.reset,
    seenFace: commands.face,
    region: undefined,
    markerIds: [],
    labels: new Map(),
    cells: TIERS.map(() => ''),
    stars: TIERS.map(() => []),
    warnedLight: false,
  })

  const colors = useMemo(() => world.objects.map((obj) => beaconColor(obj, TYPE_LOOK[obj.type]?.color ?? '#ffffff')), [world])
  const milkyWay = world.byId['milky-way']
  const disc = useMemo(() => discFor(milkyWay), [milkyWay])
  const realStars = useMemo(
    () => world.objects.filter((o) => o.render === 'star' && o.id !== 'sun').map((o) => o.pos.map((v) => v / KM_PER_LY)),
    [world],
  )
  const fieldCapacity = Math.round(9000 * Math.min(1, quality().dprMax / 1.5 + 0.25))

  // Camera: wide depth range for the compressed scene; restored on exit.
  useLayoutEffect(() => {
    const previous = { near: camera.near, far: camera.far, position: camera.position.clone(), quaternion: camera.quaternion.clone() }
    camera.near = 0.02
    camera.far = RENDER_FAR * 8
    camera.updateProjectionMatrix()
    camera.position.set(0, 0, 0)
    return () => {
      camera.near = previous.near
      camera.far = previous.far
      camera.updateProjectionMatrix()
      camera.position.copy(previous.position)
      camera.quaternion.copy(previous.quaternion)
    }
  }, [camera])

  // First visit: start beside Earth, on its day side, looking at it.
  useEffect(() => {
    if (!ship.initialized) placeAtStart(world)
    ship.initialized = true
    if (new URLSearchParams(window.location.search).has('debug')) window.__cosmosOpen = { ship, world, settings: getOpenSettings, set: setOpenSettings, commands, view }
    return () => {
      ship.speed = 0
      ship.thrust = 0
      setOpenSettings({ autopilot: false })
    }
  }, [world, view])

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.1)
    const L = loop.current
    const s = getOpenSettings()
    const a = axes.current

    // The solar system keeps real time: refresh positions every couple of seconds.
    L.worldTimer += raw
    if (L.worldTimer > 2) {
      L.worldTimer = 0
      updateWorld(world.objects, julianDate(Date.now()))
    }

    if (commands.reset !== L.seenReset) {
      L.seenReset = commands.reset
      L.ap = null
      placeAtStart(world)
      vel.set(0, 0, 0)
      setOpenSettings({ autopilot: false, paused: false })
    }

    q.set(...ship.quat)

    // --- Turning: pointer deltas and arrow keys, eased so nothing jumps.
    const P = L.pending
    P.yaw += input.look.x + a.yaw * 1.1 * dt
    P.pitch += input.look.y + a.pitch * 1.1 * dt
    P.roll += a.roll * 1.3 * dt
    input.look.x = input.look.y = 0
    const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 14)
    euler.set(P.pitch * ease, P.yaw * ease, P.roll * ease, 'YXZ')
    P.yaw -= P.yaw * ease
    P.pitch -= P.pitch * ease
    P.roll -= P.roll * ease
    q.multiply(qStep.setFromEuler(euler)).normalize()

    // --- Moving.
    const stick = input.joystick
    const manual = a.forward || a.right || a.up || stick.x || stick.y || input.vertical
    if (manual && L.ap) cancelAutopilot(L, 'manual')
    const target = s.targetId ? findTarget(s.targetId, getPlaces()) : null
    if (s.autopilot && target && (!L.ap || L.ap.id !== target.id)) L.ap = startAutopilot(target, reducedMotion)
    if (!s.autopilot && L.ap) L.ap = null
    if (s.autopilot && !target) setOpenSettings({ autopilot: false })

    const before = prev.set(...ship.pos)
    if (s.paused) {
      vel.set(0, 0, 0)
      ship.thrust = 0
    } else if (L.ap) {
      const ap = L.ap
      ap.t += dt / ap.duration
      const d = autopilotDistance(ap.start, ap.stop, ap.t)
      for (let i = 0; i < 3; i += 1) ship.pos[i] = target.pos[i] + ap.dir[i] * d
      vel.set(ship.pos[0] - before.x, ship.pos[1] - before.y, ship.pos[2] - before.z).divideScalar(Math.max(dt, 1e-4))
      faceTowards(q, target.pos, reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6))
      ship.thrust = ap.t < 0.5 ? 0.8 : 0.1
      if (ap.t >= 1) {
        L.ap = null
        vel.set(0, 0, 0)
        setOpenSettings({ autopilot: false })
        emitOpenEvent({ type: 'arrived', id: target.id, name: target.name })
      }
    } else {
      vLocal.set(a.right + stick.x, a.up + input.vertical, -(a.forward + stick.y))
      if (vLocal.lengthSq() > 1) vLocal.normalize()
      ship.thrust = Math.max(0, -vLocal.z) + Math.abs(vLocal.x) * 0.3
      const cruise = 10 ** s.speedLog * (input.boost ? BOOST : 1)
      const desired = vLocal.applyQuaternion(q).multiplyScalar(cruise)
      if (manual || s.dampers) {
        const k = reducedMotion ? 1 : 1 - Math.exp(-dt / Math.max(s.response, 0.05))
        vel.lerp(desired, k)
        if (!manual && vel.length() < 1e-6) vel.set(0, 0, 0)
      }
      ship.pos[0] += vel.x * dt
      ship.pos[1] += vel.y * dt
      ship.pos[2] += vel.z * dt
    }

    // A face request (from the HUD) turns the view without moving.
    if (commands.face !== L.seenFace) {
      L.seenFace = commands.face
      L.face = commands.face?.id ?? null
    }
    if (L.face) {
      const faced = findTarget(L.face, getPlaces())
      if (!faced || faceTowards(q, faced.pos, reducedMotion ? 1 : 1 - Math.exp(-dt * 4)) < 0.004) L.face = null
    }

    // Never inside a planet or star: stop at its surface.
    for (const obj of world.objects) {
      if (obj.render !== 'body' && obj.render !== 'star' && obj.render !== 'blackhole') continue
      const minimum = obj.radiusKm * (obj.render === 'blackhole' ? 3 : 1.06)
      const dx = ship.pos[0] - obj.pos[0]
      const dy = ship.pos[1] - obj.pos[1]
      const dz = ship.pos[2] - obj.pos[2]
      const d = Math.hypot(dx, dy, dz)
      if (d < minimum && d > 0) {
        const push = minimum / d
        ship.pos[0] = obj.pos[0] + dx * push
        ship.pos[1] = obj.pos[1] + dy * push
        ship.pos[2] = obj.pos[2] + dz * push
        const inward = (vel.x * dx + vel.y * dy + vel.z * dz) / d
        if (inward < 0) vel.addScaledVector(tmp.set(dx, dy, dz).divideScalar(d), -inward)
      }
    }

    ship.vel[0] = vel.x
    ship.vel[1] = vel.y
    ship.vel[2] = vel.z
    ship.speed = vel.length()
    ship.quat[0] = q.x
    ship.quat[1] = q.y
    ship.quat[2] = q.z
    ship.quat[3] = q.w

    // --- Floating origin: the camera never leaves (0, 0, 0).
    camera.position.copy(ORIGIN)
    camera.quaternion.copy(q)
    camera.updateMatrixWorld()
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const halfHeight = size.height / 2
    const objects = world.objects
    for (let i = 0; i < n; i += 1) {
      const obj = objects[i]
      const dx = obj.pos[0] - ship.pos[0]
      const dy = obj.pos[1] - ship.pos[1]
      const dz = obj.pos[2] - ship.pos[2]
      const d = Math.max(Math.hypot(dx, dy, dz), 1e-6)
      const k = renderDistance(d) / d
      view.rp[i * 3] = dx * k
      view.rp[i * 3 + 1] = dy * k
      view.rp[i * 3 + 2] = dz * k
      view.k[i] = k
      view.d[i] = d
      view.px[i] = (Math.atan(obj.radiusKm / d) / tanHalf) * halfHeight
    }

    // Inside or outside the Milky Way, and where its centre lies.
    const gc = milkyWay.index
    const toCentre = [view.rp[gc * 3], view.rp[gc * 3 + 1], view.rp[gc * 3 + 2]]
    const lenCentre = Math.hypot(...toCentre) || 1
    view.centreDir = toCentre.map((v) => v / lenCentre)
    const fromCentreLy = view.d[gc] / KM_PER_LY
    const heightLy = Math.abs(ship.pos[1] - milkyWay.pos[1]) / KM_PER_LY
    outside.current = Math.max(smoothstep(42000, 85000, fromCentreLy), smoothstep(5000, 22000, heightLy))
    view.inside = 1 - outside.current

    // Light: the brightest star in the sky lights the astronaut and nearby worlds.
    let brightest = null
    let brightestMag = Infinity
    for (const obj of objects) {
      if (obj.render !== 'star') continue
      const m = apparentMagnitude(obj.absMag, view.d[obj.index] / KM_PER_LY)
      if (m < brightestMag) {
        brightestMag = m
        brightest = obj
      }
    }
    if (light.current && brightest) {
      const i = brightest.index * 3
      light.current.position.set(view.rp[i], view.rp[i + 1], view.rp[i + 2]).normalize().multiplyScalar(50)
      light.current.intensity = 2.6 * Math.min(1, Math.max(0.03, (-brightestMag - 1) / 24))
      light.current.color.setRGB(...temperatureColor(brightest.temperature))
    }
    if (ambient.current) ambient.current.intensity = 0.05 + 0.08 * view.inside

    writeBeacons(beacons.current, world, view, colors, outside.current)
    if (s.field) writeField(field.current, L, disc, realStars, fieldCapacity)
    else field.current?.commit(0)

    // --- Level of detail, a few times a second.
    L.detailTimer += raw
    if (L.detailTimer > DETAIL_INTERVAL) {
      L.detailTimer = 0
      const next = chooseDetail(world, view, detail, outside.current)
      const key = next.join(',')
      if (key !== L.detailKey) {
        L.detailKey = key
        setDetail(next)
      }
    }

    // --- Discovery lists and telemetry, a few times a second.
    L.listTimer += raw
    if (L.listTimer > LIST_INTERVAL) {
      L.listTimer = 0
      publish(L, world, view, s, target, brightest, brightestMag, outside.current)
    }
    if (markers.root) markers.root.style.visibility = s.labels ? 'visible' : 'hidden'
    writeMarkers(L, world, view, camera, size)

    // Route to the target: from just below the ship to the target's render position.
    route.visible = Boolean(target && s.route)
    if (route.visible) {
      const p = route.geometry.attributes.position
      tmp.set(0, -0.35, -0.6).applyQuaternion(q)
      p.setXYZ(0, tmp.x, tmp.y, tmp.z)
      const d = Math.max(Math.hypot(target.pos[0] - ship.pos[0], target.pos[1] - ship.pos[1], target.pos[2] - ship.pos[2]), 1e-6)
      const k = renderDistance(d) / d
      p.setXYZ(1, (target.pos[0] - ship.pos[0]) * k, (target.pos[1] - ship.pos[1]) * k, (target.pos[2] - ship.pos[2]) * k)
      p.needsUpdate = true
    }
  }, -1)

  return (
    <>
      <Sky state={viewRef} />
      <ambientLight ref={ambient} intensity={0.1} />
      <directionalLight ref={light} position={[0, 0, 50]} intensity={2} />
      <hemisphereLight args={['#9fb4ff', '#0a0c18', 0.12]} />
      {/* The suit's own helmet-lamp fill: reaches the astronaut, not the worlds. */}
      <pointLight position={[0, 0.4, 0]} intensity={2.2} distance={7} decay={2} color="#dfe8ff" />
      <PointLayer capacity={fieldCapacity} layer={field} renderOrder={-20} />
      <PointLayer capacity={n} layer={beacons} renderOrder={-10} />
      <Belts />
      <CometTails world={world} />
      <SpaceDust reducedMotion={reducedMotion} />
      <primitive object={route} />
      <DetailBodies list={detail} world={world} view={view} reducedMotion={reducedMotion} outside={outside} />
      <Astronaut reducedMotion={reducedMotion} />
    </>
  )
}

// --- Flight helpers ---------------------------------------------------------------------

function placeAtStart(world) {
  const earth = world.byId.earth
  const toSun = tmp.set(-earth.pos[0], -earth.pos[1], -earth.pos[2]).normalize()
  const side = new THREE.Vector3().crossVectors(toSun, UP).normalize()
  const away = new THREE.Vector3().copy(toSun).multiplyScalar(0.75).addScaledVector(side, 0.62).addScaledVector(UP, 0.18).normalize()
  const distance = earth.radiusKm * 4.6
  for (let i = 0; i < 3; i += 1) ship.pos[i] = earth.pos[i] + away.getComponent(i) * distance
  look.lookAt(ORIGIN, away.negate(), UP)
  q.setFromRotationMatrix(look)
  ship.quat[0] = q.x
  ship.quat[1] = q.y
  ship.quat[2] = q.z
  ship.quat[3] = q.w
  ship.vel[0] = ship.vel[1] = ship.vel[2] = 0
}

/** Turn `quat` toward a world position by fraction k; returns the remaining angle. */
function faceTowards(quat, pos, k) {
  fwd.set(pos[0] - ship.pos[0], pos[1] - ship.pos[1], pos[2] - ship.pos[2])
  if (fwd.lengthSq() === 0) return 0
  fwd.normalize()
  const up = tmp.set(0, 1, 0).applyQuaternion(quat)
  look.lookAt(ORIGIN, fwd, up)
  qGoal.setFromRotationMatrix(look)
  const angle = quat.angleTo(qGoal)
  quat.slerp(qGoal, k)
  return angle
}

function startAutopilot(target, reducedMotion) {
  const dir = [ship.pos[0] - target.pos[0], ship.pos[1] - target.pos[1], ship.pos[2] - target.pos[2]]
  const start = Math.hypot(...dir) || 1
  const stop = Math.min(target.stopKm, start)
  emitOpenEvent({ type: 'autopilot', id: target.id, name: target.name })
  return {
    id: target.id,
    dir: dir.map((v) => v / start),
    start,
    stop,
    t: 0,
    duration: reducedMotion ? 0.05 : start <= stop * 1.02 ? 1 : autopilotDuration(start, stop),
  }
}

function cancelAutopilot(L, reason) {
  L.ap = null
  setOpenSettings({ autopilot: false })
  emitOpenEvent({ type: 'cancelled', reason })
}

// --- Beacons: every catalogued object as a point of light -------------------------------

const JUPITER = { r: 69911, sun: 5.2 * KM_PER_AU, obs: 4.2 * KM_PER_AU }

function writeBeacons(layer, world, view, colors, outsideMw) {
  if (!layer) return
  const { position, color, size, alpha } = layer
  const objects = world.objects
  for (let i = 0; i < objects.length; i += 1) {
    const obj = objects[i]
    const d = view.d[i]
    const px = view.px[i]
    let s = 0
    let a = 0
    if (obj.render === 'star') {
      const m = apparentMagnitude(obj.absMag, d / KM_PER_LY)
      s = Math.min(10, Math.max(1.2, 1.5 + 0.5 * (6.8 - m)))
      a = Math.min(1, Math.max(0, (6.8 - m) / 3)) * (1 - smoothstep(1.5, 6, px))
    } else if (obj.render === 'body') {
      // Reflected light, scaled from Jupiter seen from Earth: a visual cue only.
      const sunD = Math.max(Math.hypot(...obj.pos), 1)
      const flux = (obj.radiusKm / JUPITER.r) ** 2 * (JUPITER.sun / sunD) ** 2 * (JUPITER.obs / d) ** 2
      const m = -2.2 - 2.5 * Math.log10(flux)
      s = Math.min(6, Math.max(1.2, 1.4 + 0.4 * (7 - m)))
      a = Math.min(1, Math.max(0, (7 - m) / 3)) * (1 - smoothstep(1, 4, px))
      if (obj.type === 'exoplanet') a = 0
    } else if (obj.render === 'probe') {
      s = 2.2
      a = d < 400 * KM_PER_AU ? 0.85 : 0
    } else if (obj.render === 'blackhole') {
      s = 2.4
      a = 0.32 * (1 - smoothstep(1, 3, px))
    } else if (obj.id === 'milky-way') {
      s = Math.min(140, Math.max(3, px * 1.6))
      a = 0.5 * outsideMw * (1 - smoothstep(20, 80, px))
    } else {
      // Galaxies, nebulae, clusters: brightness from their magnitude seen from here.
      const entry = obj.entry
      const fromEarth = entry?.distanceLy ? entry.distanceLy * KM_PER_LY : d
      const m = entry?.magnitude != null ? entry.magnitude + 5 * Math.log10(d / fromEarth) : 7
      s = Math.min(80, Math.max(2.4, px * 2.2))
      a = Math.min(0.75, Math.max(0.12, (11 - m) / 6)) * (1 - smoothstep(22, 70, px))
    }
    position.array[i * 3] = view.rp[i * 3]
    position.array[i * 3 + 1] = view.rp[i * 3 + 1]
    position.array[i * 3 + 2] = view.rp[i * 3 + 2]
    color.array[i * 3] = colors[i][0]
    color.array[i * 3 + 1] = colors[i][1]
    color.array[i * 3 + 2] = colors[i][2]
    size.array[i] = s
    alpha.array[i] = a
  }
  layer.commit(objects.length)
}

// --- Procedural field stars --------------------------------------------------------------

function writeField(layer, L, disc, realStars, capacity) {
  if (!layer) return
  const lx = ship.pos[0] / KM_PER_LY
  const ly = ship.pos[1] / KM_PER_LY
  const lz = ship.pos[2] / KM_PER_LY
  TIERS.forEach((tier, t) => {
    const ix = Math.floor(lx / tier.cellLy)
    const iy = Math.floor(ly / tier.cellLy)
    const iz = Math.floor(lz / tier.cellLy)
    const key = `${ix},${iy},${iz}`
    if (key === L.cells[t]) return
    L.cells[t] = key
    const list = []
    // Leave the real neighbourhood to the catalogue: no invented stars
    // within 20 ly of the Sun, or on top of a real star.
    const keepOut =
      tier.id === 0
        ? (x, y, z) => Math.hypot(x, y, z) < 20 || realStars.some((p) => Math.hypot(x - p[0], y - p[1], z - p[2]) < 2)
        : (x, y, z) => Math.hypot(x, y, z) < 400
    for (let dx = -tier.reach; dx <= tier.reach; dx += 1)
      for (let dy = -tier.reach; dy <= tier.reach; dy += 1)
        for (let dz = -tier.reach; dz <= tier.reach; dz += 1) {
          for (const star of cellStars(ix + dx, iy + dy, iz + dz, tier, disc, keepOut)) {
            star.color = temperatureColor(star.temperature)
            list.push(star)
          }
        }
    L.stars[t] = list
  })
  const { position, color, size, alpha } = layer
  let count = 0
  for (const list of L.stars) {
    for (const star of list) {
      if (count >= capacity) break
      const dx = star.x * KM_PER_LY - ship.pos[0]
      const dy = star.y * KM_PER_LY - ship.pos[1]
      const dz = star.z * KM_PER_LY - ship.pos[2]
      const d = Math.max(Math.hypot(dx, dy, dz), 1)
      const m = apparentMagnitude(star.absMag, d / KM_PER_LY)
      if (m > 7.2) continue
      const k = renderDistance(d) / d
      position.array[count * 3] = dx * k
      position.array[count * 3 + 1] = dy * k
      position.array[count * 3 + 2] = dz * k
      color.array.set(star.color, count * 3)
      size.array[count] = Math.min(7, Math.max(1, 1.2 + 0.42 * (7.2 - m)))
      alpha.array[count] = Math.min(0.9, (7.2 - m) / 3.4)
      count += 1
    }
  }
  layer.commit(count)
}

// --- Level of detail -----------------------------------------------------------------------

function chooseDetail(world, view, current, outsideMw) {
  const shown = new Set(current)
  const pick = { body: [], star: [], deep: [] }
  for (const obj of world.objects) {
    const px = view.px[obj.index]
    const keep = shown.has(obj.index)
    if (obj.render === 'body' && px > (keep ? 0.7 : 1.2)) pick.body.push([px, obj.index])
    else if (obj.render === 'star' && px > (keep ? 0.5 : 0.8)) pick.star.push([px, obj.index])
    else if (obj.render === 'blackhole' && px > 1.5) pick.star.push([px, obj.index])
    else if (obj.id === 'milky-way') {
      if (outsideMw > 0.01) pick.deep.push([1e9, obj.index])
    } else if (['galaxy', 'nebula', 'cluster'].includes(obj.render) && px > (keep ? 16 : 24)) pick.deep.push([px, obj.index])
  }
  const top = (list, count) => list.sort((p, r) => r[0] - p[0]).slice(0, count).map((entry) => entry[1])
  return [...top(pick.body, 14), ...top(pick.star, 6), ...top(pick.deep, 3)].sort((p, r) => p - r)
}

// --- Telemetry, discovery and markers ----------------------------------------------------------

function localDirection(rx, ry, rz) {
  tmp.set(rx, ry, rz).normalize().applyQuaternion(qInverse.copy(q).invert())
  return [tmp.x, tmp.y, -tmp.z] // right, up, forward
}

function publish(L, world, view, s, target, brightest, brightestMag, outsideMw) {
  fwd.set(0, 0, -1).applyQuaternion(q)
  const cruise = 10 ** s.speedLog * (input.boost ? BOOST : 1)
  const items = []
  for (const obj of world.objects) {
    const d = view.d[obj.index]
    if (!listable(obj, d) || obj.id === 'milky-way') continue
    const i = obj.index * 3
    const dot = (view.rp[i] * fwd.x + view.rp[i + 1] * fwd.y + view.rp[i + 2] * fwd.z) / (renderDistance(d) || 1)
    items.push({ obj, d, angle: Math.acos(Math.min(1, Math.max(-1, dot))) })
  }
  const describe = ({ obj, d, angle }) => ({
    id: obj.id,
    name: obj.name,
    type: obj.type,
    klass: obj.klass,
    distance: formatKm(d),
    km: d,
    eta: formatDuration(d / cruise),
    angle: (angle * 180) / Math.PI,
    behind: angle < AHEAD_CONE ? (occluded(world, view, obj)?.name ?? null) : null,
  })
  const ahead = items.filter((it) => it.angle < AHEAD_CONE).sort((p, r) => p.d - r.d).slice(0, 8)
  const nearby = [...items].sort((p, r) => p.d - r.d).slice(0, 8)

  // Region: the smallest catalogued region containing the ship.
  let region = null
  for (const obj of world.objects) {
    const d = view.d[obj.index]
    if (d < obj.influenceKm && (!region || obj.influenceKm < region.influenceKm)) region = obj
  }
  const regionId = region?.id ?? (outsideMw > 0.5 ? 'intergalactic' : 'interstellar')
  if (regionId !== L.region) {
    const first = L.region !== undefined
    L.region = regionId
    // Only catalogue objects count towards the shared discoveries.
    const catalogued = Boolean(region?.entry && CATALOGUE_IDS.has(region.id))
    const discovered = catalogued && !getDiscovery().visited[region.id]
    if (first) {
      const name = region?.name ?? (regionId === 'intergalactic' ? 'Intergalactic space' : 'Interstellar space')
      emitOpenEvent({ type: 'region', id: regionId, name, discovered })
    }
    if (catalogued) recordVisit({ id: region.id, name: region.name, type: region.type, position: region.pos.map((v) => v / KM_PER_LY) })
  }

  // Radar: the nearest dozen, in the ship's frame, log-scaled.
  const near = nearby.slice(0, 8)
  const rMin = Math.max(near[0]?.d ?? 1, 1)
  const rMax = Math.max(near[near.length - 1]?.d ?? 2, rMin * 2)
  const radar = near.map(({ obj, d }) => {
    const i = obj.index * 3
    const [x, y, z] = localDirection(view.rp[i], view.rp[i + 1], view.rp[i + 2])
    const r = 0.18 + 0.82 * (Math.log(d / rMin + 1) / Math.log(rMax / rMin + 1))
    const flat = Math.hypot(x, z) || 1
    return { id: obj.id, type: obj.type, x: (x / flat) * r, y: (-z / flat) * r, up: y }
  })

  let targetInfo = null
  if (target) {
    const d = Math.hypot(target.pos[0] - ship.pos[0], target.pos[1] - ship.pos[1], target.pos[2] - ship.pos[2])
    const [x, y, z] = localDirection(target.pos[0] - ship.pos[0], target.pos[1] - ship.pos[1], target.pos[2] - ship.pos[2])
    targetInfo = {
      id: target.id,
      name: target.name,
      type: target.type,
      klass: target.klass,
      distance: formatKm(d),
      km: d,
      eta: formatDuration(d / cruise),
      local: [x, y, z],
      angle: (Math.acos(Math.min(1, Math.max(-1, z))) * 180) / Math.PI,
      autopilot: L.ap ? { remaining: formatDuration((1 - L.ap.t) * L.ap.duration), progress: L.ap.t } : null,
    }
  }

  const heading = galacticAngles(fwd.x, fwd.y, fwd.z)
  const mw = world.byId['milky-way']
  // Acceleration over the publish interval (speed change per second).
  const now = performance.now()
  const acceleration = L.lastPublish ? (ship.speed - L.lastSpeed) / Math.max((now - L.lastPublish) / 1000, 1e-3) : 0
  L.lastPublish = now
  L.lastSpeed = ship.speed
  publishTelemetry({
    speed: ship.speed,
    acceleration,
    cruise,
    position: [...ship.pos],
    fromSun: Math.hypot(...ship.pos),
    fromCentre: view.d[mw.index],
    heading,
    region: { id: regionId, name: region?.name ?? (regionId === 'intergalactic' ? 'Intergalactic space' : 'Interstellar space'), type: region?.type ?? null },
    ahead: ahead.map(describe),
    nearby: nearby.map(describe),
    radar,
    target: targetInfo,
    star: brightest ? { name: brightest.name, magnitude: brightestMag } : null,
    autopilot: Boolean(L.ap),
    outside: outsideMw,
  })

  // Markers: the target, what lies ahead, and the closest few.
  const ids = []
  if (target && world.byId[target.id]) ids.push(target.id)
  for (const it of [...ahead.slice(0, 6), ...nearby.slice(0, 4)]) if (!ids.includes(it.obj.id)) ids.push(it.obj.id)
  // A marker never shows through a planet or star that hides it.
  L.markerIds = ids.filter((id) => id === target?.id || !occluded(world, view, world.byId[id])).slice(0, MARKER_POOL)
  L.labels.clear()
  for (const it of items) if (L.markerIds.includes(it.obj.id)) L.labels.set(it.obj.id, formatKm(it.d))
  if (target && L.markerIds[0] === target.id && !L.labels.has(target.id)) L.labels.set(target.id, targetInfo.distance)
  L.markerTarget = target?.id ?? null
}

/** The nearer body or star covering this object's centre, if any. */
function occluded(world, view, obj) {
  const i = obj.index
  const d = view.d[i]
  for (const other of world.objects) {
    if (other === obj || (other.render !== 'body' && other.render !== 'star')) continue
    const j = other.index
    if (view.d[j] >= d || view.px[j] < 2) continue
    const dot = (view.rp[i * 3] * view.rp[j * 3] + view.rp[i * 3 + 1] * view.rp[j * 3 + 1] + view.rp[i * 3 + 2] * view.rp[j * 3 + 2]) / (renderDistance(d) * renderDistance(view.d[j]))
    const separation = Math.acos(Math.min(1, Math.max(-1, dot)))
    if (separation < Math.atan(other.radiusKm / view.d[j])) return other
  }
  return null
}

const projected = new THREE.Vector3()
const placed = []

function writeMarkers(L, world, view, camera, size) {
  const root = markers.root
  if (!root) return
  const pool = root.children
  let used = 0
  let targetOff = null
  placed.length = 0
  for (const id of L.markerIds) {
    if (used >= pool.length) break
    const obj = world.byId[id]
    if (!obj) continue
    const i = obj.index * 3
    projected.set(view.rp[i], view.rp[i + 1], view.rp[i + 2]).project(camera)
    const behind = projected.z > 1
    const offscreen = behind || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1
    if (offscreen) {
      if (id === L.markerTarget) targetOff = { x: behind ? -projected.x : projected.x, y: behind ? -projected.y : projected.y }
      continue
    }
    const x = ((projected.x + 1) / 2) * size.width
    const y = ((1 - projected.y) / 2) * size.height
    // Labels do not stack: the target first, then the rest in priority order.
    if (id !== L.markerTarget && placed.some((p) => Math.abs(p[0] - x) < 110 && Math.abs(p[1] - y) < 30)) continue
    placed.push([x, y])
    const el = pool[used]
    used += 1
    const label = `${obj.name}|${L.labels.get(id) ?? ''}`
    if (el.dataset.label !== label) {
      el.dataset.label = label
      el.dataset.id = id
      el.querySelector('[data-name]').textContent = obj.name
      el.querySelector('[data-distance]').textContent = L.labels.get(id) ?? ''
    }
    el.dataset.target = String(id === L.markerTarget)
    el.dataset.type = obj.type
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
    el.style.opacity = '1'
    el.style.pointerEvents = 'auto'
  }
  for (let j = used; j < pool.length; j += 1) {
    pool[j].style.opacity = '0'
    pool[j].style.pointerEvents = 'none'
  }
  // Off-screen target: an arrow on the screen's edge, pointing the way.
  const arrow = markers.arrow
  if (arrow) {
    if (targetOff) {
      const angle = Math.atan2(-targetOff.y, targetOff.x)
      const rx = size.width / 2 - 44
      const ry = size.height / 2 - 70
      const scale = Math.min(rx / Math.abs(Math.cos(angle) || 1e-6), ry / Math.abs(Math.sin(angle) || 1e-6))
      const x = size.width / 2 + Math.cos(angle) * scale
      const y = size.height / 2 + Math.sin(angle) * scale
      arrow.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) rotate(${angle}rad)`
      arrow.style.opacity = '1'
    } else {
      arrow.style.opacity = '0'
    }
  }
}
