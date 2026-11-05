import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import PlanetAtmosphere from './PlanetAtmosphere.jsx'
import SaturnRings from './SaturnRings.jsx'

// Shared across all eight planets: geometry is scaled, never rebuilt.
const SPHERE = new THREE.SphereGeometry(1, 56, 40)
const HIT_SPHERE = new THREE.SphereGeometry(1, 16, 12)
const HIGHLIGHT_RING = new THREE.RingGeometry(1.0, 1.018, 96)

const DEG = Math.PI / 180

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

  const { radius, orbitRadius, orbitPeriod, rotationSpeed, tilt, phase, ring } =
    planet.sim
  const angularSpeed = (Math.PI * 2) / orbitPeriod

  useLayoutEffect(() => {
    const node = orbitRef.current
    onRegister(planet.id, node)
    return () => onRegister(planet.id, null)
  }, [planet.id, onRegister])

  // A frozen system is still a valid solar system: with reduced motion the
  // planets hold their positions and only move when the user moves.
  const clock = useRef(0)

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1)
    if (!reducedMotion) clock.current += step

    const angle = phase + clock.current * angularSpeed
    if (orbitRef.current) {
      orbitRef.current.position.set(
        Math.cos(angle) * orbitRadius,
        0,
        Math.sin(angle) * orbitRadius,
      )
    }

    if (!reducedMotion) {
      if (spinRef.current) spinRef.current.rotation.y += rotationSpeed * step
      if (cloudsRef.current) cloudsRef.current.rotation.y += rotationSpeed * step * 1.18
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

  const atmosphere = ATMOSPHERE[planet.id]

  return (
    <group ref={orbitRef}>
      <group rotation={[0, 0, tilt * DEG]}>
        <group scale={radius}>
          <mesh ref={spinRef} geometry={SPHERE} raycast={() => null}>
            <meshStandardMaterial
              map={textures.surfaces[planet.id]}
              roughness={planet.surface === 'terrestrial' ? 0.72 : 0.92}
              metalness={0}
            />
          </mesh>

          {planet.id === 'earth' && (
            <mesh
              ref={cloudsRef}
              geometry={SPHERE}
              scale={1.018}
              raycast={() => null}
            >
              <meshStandardMaterial
                map={textures.clouds}
                transparent
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

          {planet.rings && ring && (
            <SaturnRings inner={ring.inner} outer={ring.outer} texture={textures.rings} />
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
