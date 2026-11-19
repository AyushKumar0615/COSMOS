import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Surface } from '../atlas/SystemView.jsx'
import PlanetAtmosphere from '../PlanetAtmosphere.jsx'
import SaturnRings from '../SaturnRings.jsx'
import { PLANET_LOOK } from '../Planet.jsx'
import { createPlanetMaterial } from '../../../lib/planetMaterial.js'
import { getPlanetTextures } from '../../../lib/planetTextures.js'
import { PLANETS_BY_ID } from '../../../data/planets.js'
import StarBody from '../atlas/StarBody.jsx'
import GalaxyModel from '../GalaxyModel.jsx'
import NebulaModel from '../NebulaModel.jsx'
import PointCloud from '../PointCloud.jsx'
import GlowSprite from '../GlowSprite.jsx'
import { bodyVisual } from '../../../lib/bodyVisuals.js'
import { generateCluster, temperatureColor } from '../../../lib/starPopulations.js'
import { generateNebula } from '../../../lib/nebulaGenerator.js'
import { sunMarkerAngle } from '../../../lib/galaxyGenerator.js'
import { GALAXIES_BY_ID } from '../../../data/galaxies.js'
import { KM_PER_LY, eclipticToWorld } from '../../../lib/openWorld.js'
import { scaleCount } from '../../../lib/quality.js'
import { ROCK } from '../../../lib/cometTail.js'

/**
 * Real meshes for whatever is near enough to show a disc or a shape. Each
 * sits at its compressed render position, scaled by R/d, so it appears at its
 * true angular size. Mounted and unmounted by the scene's level-of-detail
 * pass; everything else is a point of light in the beacon layer.
 */

// Solar-system bodies spin about axes tilted from the ecliptic's pole, not
// the galaxy's: this turns local +Y onto ecliptic north in the world frame.
const ECLIPTIC = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...eclipticToWorld(0, 0, 1)).normalize())
const SOLAR_TYPES = new Set(['planet', 'dwarf', 'moon', 'small'])

/** Keep a group at an object's render position and scale (unit = km per model unit). */
function usePlacement(view, obj, unitKm) {
  const ref = useRef(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const i = obj.index * 3
    g.position.set(view.rp[i], view.rp[i + 1], view.rp[i + 2])
    g.scale.setScalar(view.k[obj.index] * unitKm)
  })
  return ref
}

/** Fade with apparent size, so a model grows in rather than popping. */
function useFade(view, obj, from, to, extra = null) {
  const ref = useRef({ value: 0 })
  useFrame(() => {
    const px = view.px[obj.index]
    const t = THREE.MathUtils.clamp((px - from) / (to - from), 0, 1)
    ref.current.value = (extra ? extra() : 1) * t * t * (3 - 2 * t)
  })
  return ref
}

function Body({ obj, view, reducedMotion }) {
  const ref = usePlacement(view, obj, obj.radiusKm)
  const visual = useMemo(() => {
    const v = bodyVisual(obj.entry ?? { id: obj.id })
    return { ...v, solarId: obj.id }
  }, [obj])
  return (
    <group ref={ref}>
      <group quaternion={SOLAR_TYPES.has(obj.type) ? ECLIPTIC : undefined}>
        <Surface visual={visual} size={1} reducedMotion={reducedMotion} />
      </group>
    </group>
  )
}

// Comet nuclei are among the darkest surfaces known (albedo about 0.04);
// asteroids are grey rock. Both are irregular, unlike the round worlds.
const NUCLEUS = new THREE.MeshStandardMaterial({ color: '#2e2a27', roughness: 1, metalness: 0 })
const ASTEROID = new THREE.MeshStandardMaterial({ color: '#8a8178', roughness: 0.95, metalness: 0 })

function SmallBody({ obj, view, reducedMotion }) {
  const ref = usePlacement(view, obj, obj.radiusKm)
  const spin = useRef(null)
  useFrame((_, delta) => {
    if (!reducedMotion && spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * 0.05
  })
  return (
    <group ref={ref}>
      <group quaternion={ECLIPTIC}>
        <mesh ref={spin} geometry={ROCK} material={obj.comet ? NUCLEUS : ASTEROID} raycast={() => null} />
      </group>
      {/* The inner coma round an active nucleus (a model). */}
      {obj.comet && <GlowSprite size={14} color="#cfeee0" intensity={0.22} power={2.2} />}
    </group>
  )
}

const PLANET_SPHERE = new THREE.SphereGeometry(1, 96, 64)
const sunDir = new THREE.Vector3()

/**
 * A solar-system planet with the solar scene's full material: relief and
 * roughness maps, night-side city lights, haze, Earth's and Neptune's cloud
 * layers, atmosphere and rings. The Sun is given as a direction, since in the
 * open universe the render origin is the camera, not the Sun.
 */
function SolarPlanet({ obj, view, reducedMotion, sun }) {
  const ref = usePlacement(view, obj, obj.radiusKm)
  const gl = useThree((state) => state.gl)
  const textures = useMemo(() => getPlanetTextures(gl), [gl])
  const visual = useMemo(() => bodyVisual(obj.entry), [obj])
  const material = useMemo(() => {
    const look = PLANET_LOOK[obj.id] ?? {}
    return createPlanetMaterial({
      map: textures.surfaces[obj.id],
      data: textures.data[obj.id] ?? null,
      bumpScale: look.bumpScale ?? 1,
      roughness: look.roughness ?? 0.92,
      night: look.night ?? 0,
      atmosphere: look.haze ?? null,
    })
  }, [obj, textures])
  useEffect(() => () => material.dispose(), [material])
  const cloudMap = obj.id === 'earth' ? textures.clouds : obj.id === 'neptune' ? textures.neptuneClouds : null
  const ringTexture = visual.rings ? (textures.ringProfiles[obj.id] ?? textures.ringProfiles.faint) : null
  const spin = useRef(null)
  const clouds = useRef(null)
  useFrame((_, delta) => {
    sunDir.set(sun.pos[0] - obj.pos[0], sun.pos[1] - obj.pos[1], sun.pos[2] - obj.pos[2]).normalize()
    material.userData.uniforms.uSun.value.set(sunDir.x, sunDir.y, sunDir.z, 1)
    if (reducedMotion) return
    const dt = Math.min(delta, 0.1)
    if (spin.current) spin.current.rotation.y += dt * 0.08
    if (clouds.current) clouds.current.rotation.y += dt * 0.095
  })
  return (
    <group ref={ref}>
      <group quaternion={ECLIPTIC}>
      <group rotation={[0, 0, THREE.MathUtils.degToRad(PLANETS_BY_ID[obj.id].sim.tilt)]}>
        <mesh ref={spin} geometry={PLANET_SPHERE} material={material} raycast={() => null} />
        {cloudMap && (
          <mesh ref={clouds} geometry={PLANET_SPHERE} scale={obj.id === 'earth' ? 1.012 : 1.006} raycast={() => null}>
            <meshStandardMaterial map={cloudMap} transparent opacity={obj.id === 'earth' ? 1 : 0.8} depthWrite={false} roughness={1} metalness={0} />
          </mesh>
        )}
        {visual.atmosphere && <PlanetAtmosphere geometry={PLANET_SPHERE} color={visual.atmosphere.color} intensity={visual.atmosphere.glow} />}
        {visual.rings && <SaturnRings inner={visual.rings.inner} outer={visual.rings.outer} texture={ringTexture} opacity={visual.rings.opacity} />}
      </group>
      </group>
    </group>
  )
}

function Star({ obj, view, reducedMotion }) {
  const ref = usePlacement(view, obj, obj.radiusKm)
  return (
    <group ref={ref}>
      <StarBody temperature={obj.temperature} radius={1} reducedMotion={reducedMotion} cells={obj.radiusKm > 3e6 ? 1.8 : 3.4} />
    </group>
  )
}

const DISC = new THREE.RingGeometry(1.6, 9, 96, 1)
const SHADOW = new THREE.SphereGeometry(1, 40, 28)

/**
 * A black hole: the shadow (about 2.6 horizon radii, the photon-capture
 * radius of a non-spinning hole) and a thin accretion disc. The sky behind
 * is bent by weak-field lensing in the sky shader; the disc itself is not
 * lensed here. The Black Hole Explorer ray-traces the full picture.
 */
function BlackHole({ obj, view }) {
  const ref = usePlacement(view, obj, obj.radiusKm)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vP; void main(){ float r = length(vP); float a = smoothstep(1.6, 2.6, r) * (1.0 - smoothstep(4.0, 9.0, r)); vec3 c = mix(vec3(1.0,0.86,0.6), vec3(0.9,0.35,0.08), smoothstep(2.0, 7.0, r)); gl_FragColor = vec4(c * 1.4, a); }`,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <group ref={ref}>
      <mesh geometry={DISC} material={material} rotation={[-Math.PI / 2 + 0.25, 0, 0.3]} raycast={() => null} />
      <mesh geometry={SHADOW} scale={2.6} raycast={() => null} renderOrder={2}>
        <meshBasicMaterial color="#000000" />
      </mesh>
      <GlowSprite size={7} color="#ffb070" intensity={0.25} power={3} />
    </group>
  )
}

function Galaxy({ obj, view, reducedMotion, outside }) {
  const galaxy = GALAXIES_BY_ID[obj.modelId]
  const milkyWay = obj.id === 'milky-way'
  const ref = usePlacement(view, obj, 1000 * KM_PER_LY)
  const opacity = useFade(view, obj, milkyWay ? -1 : 22, milkyWay ? 0 : 70, milkyWay ? () => outside.current : null)
  // Lay the Milky Way in the galactic plane with the model's Sun marker on
  // the Sun's side of the centre. Other galaxies keep their explorer pose:
  // their tilt on our sky is not in the catalogue.
  const shown = useMemo(() => {
    if (!milkyWay) return galaxy
    const marker = sunMarkerAngle(galaxy.model)
    const angle = marker == null ? 0 : marker - Math.PI
    return { ...galaxy, model: { ...galaxy.model, rotation: [0, angle, 0] } }
  }, [galaxy, milkyWay])
  return (
    <group ref={ref}>
      <GalaxyModel galaxy={shown} opacityRef={opacity} reducedMotion={reducedMotion || milkyWay} followScale />
    </group>
  )
}

function Nebula({ obj, view, reducedMotion }) {
  const data = useMemo(() => generateNebula(obj.modelId), [obj.modelId])
  // The model's own extent, so its size on the sky matches the catalogue's.
  const extent = useMemo(() => {
    let max = 1
    for (const c of data.clouds) max = Math.max(max, Math.hypot(...c.p) + c.s * 0.5)
    return max
  }, [data])
  const ref = usePlacement(view, obj, obj.radiusKm / extent)
  const opacity = useFade(view, obj, 22, 70)
  return (
    <group ref={ref}>
      <NebulaModel nebulaId={obj.modelId} data={data} opacityRef={opacity} reducedMotion={reducedMotion} followScale />
    </group>
  )
}

function Cluster({ obj, view }) {
  const globular = /Globular/.test(obj.klass)
  const data = useMemo(() => {
    let seed = 7
    for (const character of obj.id) seed = (seed * 31 + character.charCodeAt(0)) % 100000
    return generateCluster(globular ? 'globular' : 'open', seed, scaleCount(globular ? 22000 : 2600, 900))
  }, [obj, globular])
  const ref = usePlacement(view, obj, obj.radiusKm / (globular ? 17 : 20))
  const opacity = useFade(view, obj, 22, 70)
  return (
    <group ref={ref}>
      <PointCloud {...data} alpha={0.95} scale={0.6} maxSize={12} opacityRef={opacity} followScale />
    </group>
  )
}

export default function DetailBodies({ list, world, view, reducedMotion, outside }) {
  return list.map((index) => {
    const obj = world.objects[index]
    const props = { obj, view, reducedMotion }
    switch (obj.render) {
      case 'body':
        if (PLANETS_BY_ID[obj.id]) return <SolarPlanet key={obj.id} {...props} sun={world.byId.sun} />
        return obj.type === 'small' ? <SmallBody key={obj.id} {...props} /> : <Body key={obj.id} {...props} />
      case 'star':
        return <Star key={obj.id} {...props} />
      case 'blackhole':
        return <BlackHole key={obj.id} {...props} />
      case 'galaxy':
        return obj.modelId ? <Galaxy key={obj.id} {...props} outside={outside} /> : null
      case 'nebula':
        return obj.modelId ? <Nebula key={obj.id} {...props} /> : null
      case 'cluster':
        return <Cluster key={obj.id} {...props} />
      default:
        return null
    }
  })
}

/** Beacon colour for an object, as linear RGB. */
export function beaconColor(obj, typeColor) {
  if (obj.render === 'star') return temperatureColor(obj.temperature)
  const c = new THREE.Color(typeColor)
  return [c.r, c.g, c.b]
}
