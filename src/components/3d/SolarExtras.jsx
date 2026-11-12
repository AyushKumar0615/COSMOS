import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLANETS_BY_ID } from '../../data/planets.js'
import {
  MOONS,
  MOONS_BY_ID,
  ORBIT_DATA,
  PLUTO_SYSTEM,
  SMALL_BODIES,
  educationalPeriod,
  radiusFromAu,
} from '../../data/solarBodies.js'
import { clock } from '../../lib/simClock.js'
import { J2000, eclipseState, eclipticToScene, julianDate, moonPosition, positionFromElements, smallBodyPosition } from '../../lib/orbits.js'
import { createPlanetMaterial, planetMaterials } from '../../lib/planetMaterial.js'
import { getWorldTexture } from '../../lib/planetTextures.js'
import { bodyVisual } from '../../lib/bodyVisuals.js'
import { reportEvents } from '../../lib/solarEvents.js'
import { scaleCount } from '../../lib/quality.js'

const DEG = Math.PI / 180
const AU_KM = 149597870.7
const SPHERE = new THREE.SphereGeometry(1, 48, 32)
const HIT = new THREE.SphereGeometry(1, 10, 8)
const NOW = julianDate(Date.now())
const EARTH_ELEMENTS = ORBIT_DATA.planets.earth

// Scratch, reused every frame.
const tmp = [0, 0, 0]
const tmpScene = [0, 0, 0]
const hostWorld = new THREE.Vector3()
const bodyWorld = new THREE.Vector3()
const sunDir = [0, 0, 0]
const rel = [0, 0, 0]

/** Effective Julian date for a body: real in real-dates mode, compressed otherwise. */
const effectiveJd = (realPeriodDays, simPeriodSeconds) =>
  clock.mode === 'real' ? clock.jd : NOW + clock.t * (realPeriodDays / simPeriodSeconds)

function useBodyMaterial(id, { tint = '#000000', size = [512, 256] } = {}) {
  const gl = useThree((state) => state.gl)
  const visual = useMemo(() => bodyVisual({ id }), [id])
  const material = useMemo(
    () =>
      createPlanetMaterial({
        map: getWorldTexture(gl, visual, size),
        roughness: 0.95,
        occluders: true,
        occluderTint: tint,
        atmosphere: visual.atmosphere ? { color: visual.atmosphere.color, twilight: visual.atmosphere.color, strength: 0.25 } : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gl, visual],
  )
  useEffect(() => {
    planetMaterials.set(id, material)
    return () => {
      if (planetMaterials.get(id) === material) planetMaterials.delete(id)
      material.dispose()
    }
  }, [id, material])
  return { material, visual }
}

function HitTarget({ id, scale, onSelect }) {
  return (
    <mesh
      geometry={HIT}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(id)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  )
}

function ellipseLine(points, color, opacity) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  return { geometry, material }
}

// --- Moons -------------------------------------------------------------------------------

/**
 * One moon. Its orbit is computed from JPL's mean elements (with the main
 * lunar perturbations for Earth's Moon), scaled to the compressed orbit
 * radius, in the plane JPL gives: the ecliptic for the Moon, the planet's
 * equator for the rest. Every moon here is tidally locked, so it keeps one
 * face turned to its planet.
 */
function Moon({ moon, hosts, selected, onSelect, onRegister, showOrbit, state }) {
  const camera = useThree((s) => s.camera)
  const host = PLANETS_BY_ID[moon.host]
  const equatorial = moon.elements.frame !== 'ecliptic'
  const body = useBodyMaterial(moon.id, {
    // Earth's atmosphere bends red sunlight into its shadow: the Moon turns
    // copper in a total eclipse. Other planets' shadows are simply dark.
    tint: moon.host === 'earth' ? '#5a1e0c' : '#050505',
    size: moon.elements.radiusKm > 500 ? [512, 256] : [256, 128],
  })

  const followRef = useRef(null)
  const bodyRef = useRef(null)
  const meshRef = useRef(null)
  const orbitRef = useRef(null)

  const orbit = useMemo(() => {
    const points = []
    for (let k = 0; k <= 128; k += 1) {
      const E = (k / 128) * Math.PI * 2
      const M = (E - moon.elements.eccentricity * Math.sin(E)) / DEG
      positionFromElements(moon.sim.orbit, moon.elements.eccentricity, moon.elements.i, moon.elements.node, moon.elements.w, M, tmp)
      eclipticToScene(tmp[0], tmp[1], tmp[2], tmpScene)
      points.push(new THREE.Vector3(...tmpScene))
    }
    return ellipseLine(points, '#9fb3d8', 0.16)
  }, [moon])
  useEffect(() => () => (orbit.geometry.dispose(), orbit.material.dispose()), [orbit])

  useLayoutEffect(() => {
    onRegister(moon.id, bodyRef.current)
    return () => onRegister(moon.id, null)
  }, [moon.id, onRegister])

  // This moon's slot in the shared eclipse state, updated in place.
  const entry = useMemo(() => ({ host: moon.host, moonWorld: new THREE.Vector3(), hostWorld: new THREE.Vector3(), relKm: [0, 0, 0] }), [moon.host])
  useEffect(() => {
    state.set(moon.id, entry)
    return () => state.delete(moon.id)
  }, [state, moon.id, entry])

  useFrame(() => {
    const hostNode = hosts.current.get(moon.host)
    if (!hostNode || !followRef.current || !bodyRef.current) return
    followRef.current.position.copy(hostNode.position)

    const jd = effectiveJd(moon.elements.periodDays, moon.sim.period)
    moonPosition(moon.elements, 1, moon.elements.eccentricity, jd, tmp, moon.id === 'moon' ? EARTH_ELEMENTS : null)
    eclipticToScene(tmp[0], tmp[1], tmp[2], tmpScene)
    bodyRef.current.position.set(tmpScene[0] * moon.sim.orbit, tmpScene[1] * moon.sim.orbit, tmpScene[2] * moon.sim.orbit)

    // Tidal locking: the same face always points at the planet.
    hostNode.getWorldPosition(hostWorld)
    if (meshRef.current) meshRef.current.lookAt(hostWorld)

    bodyRef.current.getWorldPosition(bodyWorld)
    const near = camera.position.distanceTo(hostWorld) < host.sim.radius * 18 || selected
    bodyRef.current.visible = near
    if (orbitRef.current) orbitRef.current.visible = near && (showOrbit || selected)

    // Real eclipse geometry, in km, for the frame loop that applies shadows.
    // World units include the solar system's reveal scale, so the ratio is
    // taken against the moon's own world-space orbit radius.
    const worldOrbit = bodyWorld.distanceTo(hostWorld) || 1
    const scale = (Math.hypot(tmp[0], tmp[1], tmp[2]) * moon.elements.orbitKm) / worldOrbit
    entry.moonWorld.copy(bodyWorld)
    entry.hostWorld.copy(hostWorld)
    entry.relKm[0] = (bodyWorld.x - hostWorld.x) * scale
    entry.relKm[1] = (bodyWorld.y - hostWorld.y) * scale
    entry.relKm[2] = (bodyWorld.z - hostWorld.z) * scale
  })

  const tilt = (host.sim.tilt ?? 0) * DEG

  return (
    <group ref={followRef}>
      <group rotation={equatorial ? [0, 0, tilt] : [0, 0, 0]}>
        <lineLoop ref={orbitRef} geometry={orbit.geometry} material={orbit.material} visible={false} raycast={() => null} />
        <group ref={bodyRef} visible={false}>
          <mesh ref={meshRef} geometry={SPHERE} material={body.material} scale={moon.sim.size} raycast={() => null} />
          <HitTarget id={moon.id} scale={Math.max(moon.sim.size * 2, 0.04)} onSelect={onSelect} />
        </group>
      </group>
    </group>
  )
}

const EVENT_NAMES = { total: 'total', partial: 'partial', penumbral: 'penumbral' }

/**
 * Applies eclipse shadows, using the real geometry: the moon's actual
 * distance and size and the Sun's actual size and distance decide whether an
 * eclipse is happening; the compressed scene only decides where the shadow
 * falls. Without this gate the compressed distances would put Earth in the
 * Moon's shadow every month.
 */
const hostSlots = new Map()

function EclipseLayer({ state }) {
  useFrame(() => {
    hostSlots.clear()
    const events = []
    for (const [id, s] of state) {
      const moon = MOONS_BY_ID[id]
      if (!moon) continue
      const planet = ORBIT_DATA.planets[s.host]
      const hostDist = s.hostWorld.length()
      sunDir[0] = -s.hostWorld.x / hostDist
      sunDir[1] = -s.hostWorld.y / hostDist
      sunDir[2] = -s.hostWorld.z / hostDist
      rel[0] = s.relKm[0]
      rel[1] = s.relKm[1]
      rel[2] = s.relKm[2]
      const result = eclipseState(rel, sunDir, planet.a * AU_KM, planet.radiusKm, moon.elements.radiusKm)

      const hostMaterial = planetMaterials.get(s.host)
      if (result.solar && hostMaterial) {
        const slot = hostSlots.get(s.host) ?? 0
        if (slot < 4) {
          const u = hostMaterial.userData.uniforms
          u.uOcc.value[slot].set(s.moonWorld.x, s.moonWorld.y, s.moonWorld.z, moon.sim.size * 0.45)
          u.uOccStrength.value[slot] = 1
          hostSlots.set(s.host, slot + 1)
        }
        if (s.host === 'earth') events.push({ kind: 'solar', body: 'moon', type: 'eclipse' })
        else events.push({ kind: 'transit', body: id, type: s.host })
      }

      const moonMaterial = planetMaterials.get(id)
      if (moonMaterial) {
        const u = moonMaterial.userData.uniforms
        const strength = result.lunar === 'total' ? 1 : result.lunar === 'partial' ? 0.75 : result.lunar === 'penumbral' ? 0.3 : 0
        u.uOcc.value[0].set(s.hostWorld.x, s.hostWorld.y, s.hostWorld.z, PLANETS_BY_ID[s.host].sim.radius * 1.05)
        u.uOccStrength.value[0] = strength
        if (strength > 0 && s.host === 'earth') events.push({ kind: 'lunar', body: 'moon', type: EVENT_NAMES[result.lunar] })
      }
    }
    // Clear the slots no moon used this frame.
    for (const [id, material] of planetMaterials) {
      if (!PLANETS_BY_ID[id]) continue
      const used = hostSlots.get(id) ?? 0
      for (let k = used; k < 4; k += 1) material.userData.uniforms.uOccStrength.value[k] = 0
    }
    reportEvents(events)
  })
  useEffect(() => () => reportEvents([]), [])
  return null
}

// --- Pluto and Charon ------------------------------------------------------------------------

function PlutoSystem({ selectedId, onSelect, onRegister, showOrbit }) {
  const pluto = SMALL_BODIES.find((b) => b.id === 'pluto')
  const { charon } = PLUTO_SYSTEM
  const pBody = useBodyMaterial('pluto')
  const cBody = useBodyMaterial('charon', { size: [256, 128] })
  const baryRef = useRef(null)
  const plutoRef = useRef(null)
  const charonRef = useRef(null)
  const camera = useThree((s) => s.camera)

  useLayoutEffect(() => {
    onRegister('pluto', plutoRef.current)
    onRegister('charon', charonRef.current)
    return () => {
      onRegister('pluto', null)
      onRegister('charon', null)
    }
  }, [onRegister])

  useFrame(() => {
    if (!baryRef.current) return
    const jd = effectiveJd(pluto.elements.periodDays, pluto.sim.period)
    placeSmallBody(pluto.elements, jd, baryRef.current.position)
    // Mutually tidally locked: Charon's orbit and both bodies' days are equal.
    const jdc = effectiveJd(charon.elements.periodDays, charon.sim.period)
    const angle = ((jdc - J2000) / charon.elements.periodDays) * Math.PI * 2
    const c = Math.cos(angle)
    const s = -Math.sin(angle)
    plutoRef.current.position.set(-c * PLUTO_SYSTEM.plutoOffset, 0, -s * PLUTO_SYSTEM.plutoOffset)
    const far = charon.sim.separation - PLUTO_SYSTEM.plutoOffset
    charonRef.current.position.set(c * far, 0, s * far)
    plutoRef.current.rotation.y = -angle
    charonRef.current.rotation.y = -angle + Math.PI
    const near = camera.position.distanceTo(baryRef.current.getWorldPosition(bodyWorld)) < 4 || selectedId === 'pluto' || selectedId === 'charon'
    charonRef.current.visible = near
  })

  return (
    <>
      <SmallOrbit body={pluto} visible={showOrbit || selectedId === 'pluto' || selectedId === 'charon'} />
      <group ref={baryRef}>
        <group ref={plutoRef}>
          <mesh geometry={SPHERE} material={pBody.material} scale={pluto.sim.size} raycast={() => null} />
          <HitTarget id="pluto" scale={Math.max(pluto.sim.size * 2.2, 0.12)} onSelect={onSelect} />
        </group>
        <group ref={charonRef}>
          <mesh geometry={SPHERE} material={cBody.material} scale={charon.sim.size} raycast={() => null} />
          <HitTarget id="charon" scale={Math.max(charon.sim.size * 2.2, 0.06)} onSelect={onSelect} />
        </group>
      </group>
    </>
  )
}

// --- Dwarf planets, asteroids and comets -------------------------------------------------------

/** Heliocentric position at `jd`, with its distance compressed onto the scene. */
function placeSmallBody(elements, jd, out) {
  smallBodyPosition(elements, jd, tmp)
  const r = Math.hypot(tmp[0], tmp[1], tmp[2])
  const k = radiusFromAu(r) / r
  eclipticToScene(tmp[0] * k, tmp[1] * k, tmp[2] * k, tmpScene)
  return out.set(tmpScene[0], tmpScene[1], tmpScene[2])
}

const KIND_COLOR = { dwarf: '#b9c4dc', asteroid: '#a99a86', 'near-earth': '#e0a070', comet: '#8fd7ff' }

function SmallOrbit({ body, visible }) {
  const line = useMemo(() => {
    const el = body.elements
    const points = []
    // Sampled evenly in eccentric anomaly, which keeps a long comet orbit
    // smooth round its perihelion.
    for (let k = 0; k <= 256; k += 1) {
      const E = (k / 256) * Math.PI * 2
      const M = (E - el.e * Math.sin(E)) / DEG
      positionFromElements(el.a, el.e, el.i, el.node, el.peri, M, tmp)
      const r = Math.hypot(tmp[0], tmp[1], tmp[2])
      const s = radiusFromAu(r) / r
      eclipticToScene(tmp[0] * s, tmp[1] * s, tmp[2] * s, tmpScene)
      points.push(new THREE.Vector3(...tmpScene))
    }
    return ellipseLine(points, KIND_COLOR[body.kind], body.kind === 'dwarf' ? 0.2 : 0.16)
  }, [body])
  useEffect(() => () => (line.geometry.dispose(), line.material.dispose()), [line])
  return <lineLoop geometry={line.geometry} material={line.material} visible={visible} raycast={() => null} />
}

// An irregular rock shared by every asteroid and comet nucleus.
const ROCK = (() => {
  const g = new THREE.IcosahedronGeometry(1, 4)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let k = 0; k < p.count; k += 1) {
    v.fromBufferAttribute(p, k)
    const bump = 1 + 0.2 * Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3 - v.x) + 0.06 * Math.sin(v.y * 7 + v.z * 5) + 0.025 * Math.sin(v.x * 17 + v.z * 13)
    v.multiplyScalar(bump)
    p.setXYZ(k, v.x, v.y * 0.8, v.z)
  }
  g.computeVertexNormals()
  return g
})()
const ROCK_MATERIAL = new THREE.MeshStandardMaterial({ color: '#8a8178', roughness: 0.95, metalness: 0 })
const NUCLEUS_MATERIAL = new THREE.MeshStandardMaterial({ color: '#3a3532', roughness: 1, metalness: 0 })

const tailVertex = /* glsl */ `
  uniform vec3 uHead;
  uniform vec3 uAway;      // unit: from the Sun
  uniform vec3 uLag;       // unit: opposite the comet's motion
  uniform float uLength;
  uniform float uWidth;
  uniform float uCurve;    // 0 for the straight ion tail
  varying float vAlong;
  varying float vAcross;
  void main() {
    float t = position.x;
    vec3 p = uHead + uAway * uLength * t + uLag * uLength * uCurve * t * t;
    vec3 tangent = normalize(uAway + uLag * uCurve * 2.0 * t + 1e-4);
    vec3 view = normalize(cameraPosition - p);
    vec3 side = normalize(cross(tangent, view));
    p += side * position.y * uWidth * (0.25 + 1.6 * t);
    vAlong = t;
    vAcross = position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`
const tailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vAlong;
  varying float vAcross;
  void main() {
    float a = exp(-vAcross * vAcross * 3.0) * pow(1.0 - vAlong, 1.6) * smoothstep(0.0, 0.04, vAlong) * uStrength;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`
const comaFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = (exp(-r * r * 8.0) + exp(-r * 3.0) * 0.3) * (1.0 - smoothstep(0.85, 1.0, r)) * uStrength;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`
const TAIL_GEOMETRY = (() => {
  const g = new THREE.PlaneGeometry(1, 2, 24, 1)
  g.translate(0.5, 0, 0)
  return g
})()

function tailMaterial(color, curve) {
  return new THREE.ShaderMaterial({
    vertexShader: tailVertex,
    fragmentShader: tailFragment,
    uniforms: {
      uHead: { value: new THREE.Vector3() },
      uAway: { value: new THREE.Vector3(1, 0, 0) },
      uLag: { value: new THREE.Vector3(0, 0, 1) },
      uLength: { value: 1 },
      uWidth: { value: 0.05 },
      uCurve: { value: curve },
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

const before = new THREE.Vector3()
const away = new THREE.Vector3()
const lag = new THREE.Vector3()

/**
 * A small body moving on its JPL orbit. Comets grow a coma and two tails
 * as they near the Sun: a straight blue ion tail pointing directly away from
 * the Sun, and a broader, curved dust tail that lags behind along the orbit.
 * Activity switches on inside about 5 AU and strengthens towards the Sun;
 * lengths and brightness are illustrative.
 */
function SmallBody({ body, selected, onSelect, onRegister, showOrbit, dwarfMaterial }) {
  const groupRef = useRef(null)
  const comet = body.kind === 'comet'
  const tails = useMemo(() => (comet ? { ion: tailMaterial('#7fc4ff', 0), dust: tailMaterial('#ffe2b0', 0.45) } : null), [comet])
  const coma = useMemo(
    () =>
      comet
        ? new THREE.ShaderMaterial({
            vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: comaFragment,
            uniforms: { uColor: { value: new THREE.Color('#bfe8ff') }, uStrength: { value: 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        : null,
    [comet],
  )
  useEffect(
    () => () => {
      tails?.ion.dispose()
      tails?.dust.dispose()
      coma?.dispose()
    },
    [tails, coma],
  )
  const comaRef = useRef(null)

  useLayoutEffect(() => {
    onRegister(body.id, groupRef.current)
    return () => onRegister(body.id, null)
  }, [body.id, onRegister])

  useFrame(() => {
    if (!groupRef.current) return
    const jd = effectiveJd(body.elements.periodDays, body.sim.period)
    placeSmallBody(body.elements, jd, groupRef.current.position)
    if (!comet) return

    smallBodyPosition(body.elements, jd, tmp)
    const rAu = Math.hypot(tmp[0], tmp[1], tmp[2])
    // Activity: none beyond 5 AU, rising roughly as 1/r^2 towards the Sun.
    const activity = Math.min(1, Math.max(0, (5 - rAu) / 4.5) * Math.min(1.6, 1.2 / (rAu * rAu)))
    // Direction of motion from a position a day earlier.
    placeSmallBody(body.elements, jd - Math.max(1, body.elements.periodDays / 2000), before)
    const head = groupRef.current.position
    // Parent group is the solar system's (scaled) group: work in its space.
    away.copy(head).normalize()
    lag.copy(before).sub(head).normalize()
    const length = 0.15 + 3.2 * activity
    for (const [material, width, strength] of [[tails.ion, 0.035, 0.9], [tails.dust, 0.07, 0.75]]) {
      const u = material.uniforms
      u.uHead.value.copy(head)
      u.uAway.value.copy(away)
      u.uLag.value.copy(lag)
      u.uLength.value = length * (material === tails.dust ? 0.75 : 1)
      u.uWidth.value = width * (0.6 + activity)
      u.uStrength.value = strength * activity
    }
    coma.uniforms.uStrength.value = 0.15 + 0.85 * activity
    if (comaRef.current) comaRef.current.scale.setScalar(0.12 + 0.5 * activity)
  })

  const material = body.kind === 'dwarf' ? dwarfMaterial : comet ? NUCLEUS_MATERIAL : ROCK_MATERIAL
  const stretch = body.id === 'haumea' ? 0.62 : 1

  return (
    <>
      <SmallOrbit body={body} visible={showOrbit || selected} />
      <group ref={groupRef}>
        <mesh
          geometry={body.kind === 'dwarf' ? SPHERE : ROCK}
          material={material}
          scale={[body.sim.size, body.sim.size * stretch, body.sim.size]}
          raycast={() => null}
        />
        {comet && (
          <FaceCamera>
            <mesh ref={comaRef} material={coma} raycast={() => null}>
              <planeGeometry args={[1, 1]} />
            </mesh>
          </FaceCamera>
        )}
        <HitTarget id={body.id} scale={Math.max(body.sim.size * 2.5, 0.12)} onSelect={onSelect} />
      </group>
      {comet && (
        <>
          <mesh geometry={TAIL_GEOMETRY} material={tails.dust} frustumCulled={false} raycast={() => null} />
          <mesh geometry={TAIL_GEOMETRY} material={tails.ion} frustumCulled={false} raycast={() => null} />
        </>
      )}
    </>
  )
}

function DwarfBody(props) {
  const { material } = useBodyMaterial(props.body.id)
  return <SmallBody {...props} dwarfMaterial={material} />
}

// Coma sprite faces the camera.
function FaceCamera({ children }) {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => ref.current?.quaternion.copy(camera.quaternion))
  return <group ref={ref}>{children}</group>
}

// --- Belts ---------------------------------------------------------------------------------------------

const beltVertex = /* glsl */ `
  attribute vec4 aOrbit;   // compressed radius, inclination, node, phase (rad)
  attribute vec2 aRate;    // rad per real day, rad per educational second
  uniform float uDays;
  uniform float uT;
  uniform float uReal;
  uniform float uPixel;
  uniform float uSize;
  varying float vFade;
  void main() {
    float angle = aOrbit.w + mix(aRate.y * uT, aRate.x * uDays, uReal);
    float c = cos(angle), s = sin(angle);
    vec3 p = vec3(c, 0.0, -s) * aOrbit.x;
    float ci = cos(aOrbit.y), si = sin(aOrbit.y);
    p = vec3(p.x, -p.z * si, p.z * ci);
    float cn = cos(aOrbit.z), sn = sin(aOrbit.z);
    p = vec3(p.x * cn + p.z * sn, p.y, -p.x * sn + p.z * cn);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(uSize * uPixel * 10.0 / -mv.z, 0.8 * uPixel, 2.4 * uPixel);
    vFade = smoothstep(0.0, 0.6, gl_PointSize / uPixel - 0.5);
    gl_Position = projectionMatrix * mv;
  }
`
const beltFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float a = (1.0 - smoothstep(0.4, 1.0, r)) * uOpacity * vFade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

/** Resonances with Jupiter clear gaps in the asteroid belt (Kirkwood gaps). */
function kirkwoodGaps(aJupiter) {
  return [[3, 1], [5, 2], [7, 3], [2, 1]].map(([p, q]) => aJupiter * Math.pow(q / p, 2 / 3))
}

function buildBelt(kind, count) {
  const orbitAttr = new Float32Array(count * 4)
  const rateAttr = new Float32Array(count * 2)
  const position = new Float32Array(count * 3)
  const aJ = ORBIT_DATA.planets.jupiter.a
  const aN = ORBIT_DATA.planets.neptune.a
  const gaps = kirkwoodGaps(aJ)
  let n = 0
  while (n < count) {
    let a
    let incl
    if (kind === 'asteroid') {
      a = 2.1 + Math.random() * 1.2
      // Thin out the resonances: a narrow band around each gap stays nearly empty.
      if (gaps.some((g) => Math.abs(a - g) < 0.03) && Math.random() < 0.92) continue
      incl = Math.abs(gaussian()) * 8 * DEG
    } else {
      const roll = Math.random()
      if (roll < 0.2) a = aN * Math.pow(3 / 2, 2 / 3) + gaussian() * 0.3 // plutinos, 3:2 with Neptune
      else if (roll < 0.75) a = 42 + Math.random() * 5.5 // the classical belt
      else a = 30 + Math.random() * 25 // scattered and outer
      incl = Math.abs(gaussian()) * (roll < 0.75 ? 6 : 18) * DEG
    }
    const r = radiusFromAu(a)
    orbitAttr.set([r, incl, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2], n * 4)
    rateAttr.set([(Math.PI * 2) / (365.25 * Math.pow(a, 1.5)), (Math.PI * 2) / educationalPeriod(r)], n * 2)
    n += 1
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aOrbit', new THREE.BufferAttribute(orbitAttr, 4))
  g.setAttribute('aRate', new THREE.BufferAttribute(rateAttr, 2))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40)
  return g
}

function gaussian() {
  return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(Math.PI * 2 * Math.random())
}

/**
 * The main asteroid belt and the Kuiper belt as single point clouds, each
 * point on its own circular orbit, animated in the vertex shader. Real
 * structure: the belt's Kirkwood gaps sit at Jupiter's 3:1, 5:2, 7:3 and 2:1
 * resonances, and a cluster of "plutinos" at Neptune's 3:2, computed from
 * the planets' JPL semi-major axes. Individual points are not real objects,
 * and orbits are drawn circular.
 */
function Belt({ kind, count, color, opacity }) {
  const gl = useThree((s) => s.gl)
  const geometry = useMemo(() => buildBelt(kind, count), [kind, count])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beltVertex,
        fragmentShader: beltFragment,
        uniforms: {
          uDays: { value: 0 },
          uT: { value: 0 },
          uReal: { value: 0 },
          uPixel: { value: 1 },
          uSize: { value: kind === 'asteroid' ? 0.35 : 0.9 },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        },
        transparent: true,
        depthWrite: false,
      }),
    [kind, color, opacity],
  )
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material])
  useFrame(() => {
    const u = material.uniforms
    u.uDays.value = clock.jd - J2000
    u.uT.value = clock.t
    u.uReal.value = clock.mode === 'real' ? 1 : 0
    u.uPixel.value = gl.getPixelRatio()
  })
  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
}

// --- Assembly ----------------------------------------------------------------------------------------

/**
 * Everything in the solar system besides the Sun, planets and spacecraft,
 * mounted inside the solar system's scaled group.
 */
export default function SolarExtras({ hosts, selectedId, onSelect, onRegister, showOrbits }) {
  const state = useMemo(() => new Map(), [])
  useEffect(
    () => () => {
      document.body.style.cursor = 'auto'
    },
    [],
  )
  return (
    <>
      {MOONS.map((moon) => (
        <Moon
          key={moon.id}
          moon={moon}
          hosts={hosts}
          selected={selectedId === moon.id}
          onSelect={onSelect}
          onRegister={onRegister}
          showOrbit={showOrbits}
          state={state}
        />
      ))}
      <EclipseLayer state={state} />
      <PlutoSystem selectedId={selectedId} onSelect={onSelect} onRegister={onRegister} showOrbit={showOrbits} />
      {SMALL_BODIES.filter((b) => b.id !== 'pluto').map((body) =>
        body.kind === 'dwarf' ? (
          <DwarfBody key={body.id} body={body} selected={selectedId === body.id} onSelect={onSelect} onRegister={onRegister} showOrbit={showOrbits} />
        ) : (
          <SmallBody key={body.id} body={body} selected={selectedId === body.id} onSelect={onSelect} onRegister={onRegister} showOrbit={showOrbits} />
        ),
      )}
      <Belt kind="asteroid" count={scaleCount(5000, 1500)} color="#b8ab98" opacity={0.55} />
      <Belt kind="kuiper" count={scaleCount(4000, 1200)} color="#9fb2d6" opacity={0.45} />
    </>
  )
}
