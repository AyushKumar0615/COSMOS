import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import PlanetAtmosphere from './PlanetAtmosphere.jsx'
import SaturnRings from './SaturnRings.jsx'
import Aurora, { AURORA_BODIES } from './Aurora.jsx'
import { useEffects } from '../../lib/effects.js'
import { createPlanetMaterial, planetMaterials } from '../../lib/planetMaterial.js'
import { clock } from '../../lib/simClock.js'
import { J2000, julianDate, planetLongitude } from '../../lib/orbits.js'
import { ORBIT_DATA } from '../../data/solarBodies.js'

// Shared across all eight planets: geometry is scaled, never rebuilt.
// Dense enough that a planet filling the screen keeps a round limb.
const SPHERE = new THREE.SphereGeometry(1, 96, 64)
const HIT_SPHERE = new THREE.SphereGeometry(1, 16, 12)
const HIGHLIGHT_RING = new THREE.RingGeometry(1.0, 1.018, 96)

const DEG = Math.PI / 180
const TAU = Math.PI * 2

/**
 * Per-planet surface treatment. Bump strength is in Three's screen-space
 * bump units; haze is the day-side tint and terminator glow added on the
 * surface itself (the shell in PlanetAtmosphere draws the limb).
 */
const LOOK = {
  mercury: { bumpScale: 3.2 },
  venus: { roughness: 1, haze: { color: '#ffcf7a', twilight: '#ff9a4a', strength: 0.22 } },
  earth: {
    bumpScale: 1.6,
    night: 1.2,
    cloudShadow: 0.45,
    haze: { color: '#3d7fd6', twilight: '#ff8a4c', strength: 0.32 },
  },
  mars: { bumpScale: 2.6, haze: { color: '#d9824f', twilight: '#7aa0d8', strength: 0.1 } },
  jupiter: { roughness: 1, haze: { color: '#f4dcb0', twilight: '#c46a3a', strength: 0.08 } },
  saturn: { roughness: 1, haze: { color: '#f6e4bd', twilight: '#c9874a', strength: 0.08 } },
  uranus: { roughness: 1, haze: { color: '#9fe8ef', twilight: '#5fb2c0', strength: 0.16 } },
  neptune: { roughness: 1, haze: { color: '#5b8cff', twilight: '#3456b8', strength: 0.18 } },
}

const ATMOSPHERE = {
  venus: { color: '#ffd89a', intensity: 0.9 },
  earth: { color: '#6fb6ff', intensity: 1.3 },
  mars: { color: '#ff9b70', intensity: 0.35 },
  jupiter: { color: '#ffe2b8', intensity: 0.45 },
  saturn: { color: '#ffeccc', intensity: 0.4 },
  uranus: { color: '#a8f2f5', intensity: 1.0 },
  neptune: { color: '#7aa6ff', intensity: 1.1 },
}

/**
 * One planet: orbital motion, axial tilt, rotation, optional clouds,
 * atmosphere and rings, a generous invisible hit target, and a subtle
 * selection ring. The outer group is registered with the scene so the
 * camera rig can follow it.
 */
export default function Planet({
  planet,
  textures,
  selected,
  hovered,
  onSelect,
  onHover,
  onRegister,
  reducedMotion,
}) {
  const orbitRef = useRef(null)
  const spinRef = useRef(null)
  const cloudsRef = useRef(null)
  const highlightRef = useRef(null)

  const { radius, orbitRadius, orbitPeriod, rotationSpeed, tilt, ring } =
    planet.sim
  const angularSpeed = (Math.PI * 2) / orbitPeriod

  useLayoutEffect(() => {
    const node = orbitRef.current
    onRegister(planet.id, node)
    return () => onRegister(planet.id, null)
  }, [planet.id, onRegister])

  const atmosphere = ATMOSPHERE[planet.id]
  const effects = useEffects()
  const ringTexture = ring ? textures.ringProfiles[ring.profile] : null
  const cloudMap = planet.id === 'earth' ? textures.clouds : planet.id === 'neptune' ? textures.neptuneClouds : null

  const material = useMemo(() => {
    const look = LOOK[planet.id] ?? {}
    return createPlanetMaterial({
      map: textures.surfaces[planet.id],
      data: textures.data[planet.id] ?? null,
      bumpScale: look.bumpScale ?? 1,
      roughness: look.roughness ?? 0.92,
      night: look.night ?? 0,
      clouds: look.cloudShadow ? cloudMap : null,
      cloudShadow: look.cloudShadow ?? 0,
      // Only Saturn's rings are dense enough to cast a visible shadow.
      ring: ring && !ring.faint ? { texture: ringTexture, inner: ring.inner, outer: ring.outer } : null,
      atmosphere: look.haze ?? null,
      // Planets with moons can take their shadows.
      occluders: true,
    })
  }, [planet.id, textures, ring, ringTexture, cloudMap])
  useEffect(() => {
    planetMaterials.set(planet.id, material)
    return () => {
      if (planetMaterials.get(planet.id) === material) planetMaterials.delete(planet.id)
      material.dispose()
    }
  }, [planet.id, material])

  // JPL elements: where the planet really is today, and on any date.
  const elements = ORBIT_DATA.planets[planet.id]
  const rotationDays = elements.rotationDays
  const [startLongitude] = useState(() => planetLongitude(elements, julianDate(Date.now())))

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1)
    // Motion comes from the shared simulation clock (lib/simClock.js): the
    // educational mode keeps today's real positions as a starting point and
    // compresses the speeds; the real-dates mode follows JPL's elements.
    const real = clock.mode === 'real'
    const angle = real ? planetLongitude(elements, clock.jd) : startLongitude + clock.t * angularSpeed
    if (orbitRef.current) {
      // Ecliptic longitude increases counter-clockwise seen from the north.
      orbitRef.current.position.set(Math.cos(angle) * orbitRadius, 0, -Math.sin(angle) * orbitRadius)
    }

    const spin = real ? (Math.PI * 2 * (clock.jd - J2000)) / rotationDays : rotationSpeed * clock.t
    if (spinRef.current) spinRef.current.rotation.y = spin
    // Neptune's high cirrus races ahead of the deck below; Earth's weather
    // drifts slowly against the ground.
    if (cloudsRef.current) cloudsRef.current.rotation.y = spin * (planet.id === 'neptune' ? 1.6 : 1.18)
    if (cloudsRef.current && spinRef.current) {
      material.userData.uniforms.uCloudShift.value =
        (cloudsRef.current.rotation.y - spinRef.current.rotation.y) / TAU
    }

    if (highlightRef.current) {
      // Deliberately faint: the information panel already says what is
      // selected, so the ring only has to locate it in the scene.
      const target = selected ? 0.3 : hovered ? 0.16 : 0
      const material = highlightRef.current.material
      material.opacity += (target - material.opacity) * Math.min(1, step * 8)
      highlightRef.current.visible = material.opacity > 0.01
    }
  })


  return (
    <group ref={orbitRef}>
      <group rotation={[0, 0, tilt * DEG]}>
        <group scale={radius}>
          <mesh ref={spinRef} geometry={SPHERE} material={material} raycast={() => null} />

          {cloudMap && (
            <mesh
              ref={cloudsRef}
              geometry={SPHERE}
              scale={planet.id === 'earth' ? 1.012 : 1.006}
              raycast={() => null}
            >
              <meshStandardMaterial
                map={cloudMap}
                transparent
                opacity={planet.id === 'earth' ? 1 : 0.8}
                depthWrite={false}
                roughness={1}
                metalness={0}
              />
            </mesh>
          )}

          {atmosphere && (
            <PlanetAtmosphere
              geometry={SPHERE}
              color={atmosphere.color}
              intensity={atmosphere.intensity}
            />
          )}

          {effects.auroras && AURORA_BODIES.includes(planet.id) && <Aurora body={planet.id} geometry={SPHERE} reducedMotion={reducedMotion} />}

          {ring && (
            <SaturnRings inner={ring.inner} outer={ring.outer} texture={ringTexture} opacity={ring.opacity ?? 1} />
          )}
        </group>
      </group>

      <Billboard>
        <mesh ref={highlightRef} geometry={HIGHLIGHT_RING} scale={radius * 1.32} visible={false}>
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>

      {/* Invisible, oversized hit target so small worlds like Mercury are
          easy to click. Opacity 0 rather than visible={false}: Three's
          raycaster skips invisible objects entirely. */}
      <mesh
        geometry={HIT_SPHERE}
        scale={Math.max(radius * 1.9, 0.42)}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(planet.id)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          onHover(planet.id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = 'auto'
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}
