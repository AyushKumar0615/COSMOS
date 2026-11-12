import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from '../../lib/gsapConfig.js'
import Sun from './Sun.jsx'
import Planet from './Planet.jsx'
import OrbitPaths from './OrbitPaths.jsx'
import Satellites from './Satellites.jsx'
import { PLANETS } from '../../data/planets.js'
import { getPlanetTextures } from '../../lib/planetTextures.js'
import { useEffects } from '../../lib/effects.js'

// Moons, dwarf planets, belts and comets: fetched once the system is entered.
const SolarExtras = lazy(() => import('./SolarExtras.jsx'))
// Voyager, New Horizons and Parker, placed from JPL Horizons ephemerides.
const Probes = lazy(() => import('./Probes.jsx'))

const COLLAPSED = 0.015

/**
 * The Sun, eight planets and their orbits.
 *
 * Mounted only once the visitor enters, so the landing page pays nothing for
 * it. On entry the system unfolds outward from the Sun while the camera
 * pulls back; on exit it collapses back into the Sun before unmounting,
 * which avoids the whole system popping in or out.
 *
 * Planet surfaces are baked once on the GPU the first time this mounts
 * (see lib/planetTextures.js).
 */
export default function SolarSystem({
  phase,
  selectedId,
  onSelect,
  onRegister,
  reducedMotion,
}) {
  const gl = useThree((state) => state.gl)
  const textures = useMemo(() => getPlanetTextures(gl), [gl])
  const [hoveredId, setHoveredId] = useState(null)
  const effects = useEffects()

  // Planets register with the camera rig and, here, with the spacecraft
  // that follow them round their orbits.
  const hosts = useRef(new Map())
  const registerPlanet = useCallback(
    (id, node) => {
      if (node) hosts.current.set(id, node)
      else hosts.current.delete(id)
      onRegister(id, node)
    },
    [onRegister],
  )

  const groupRef = useRef(null)
  // Captured once: the group's starting scale must not be re-applied on
  // later renders, or a hover would snap the system back to collapsed.
  const [initialScale] = useState(() => (reducedMotion ? 1 : COLLAPSED))
  const reveal = useRef({ value: initialScale })

  useEffect(() => {
    const target = phase === 'exiting' ? COLLAPSED : 1
    if (reducedMotion) {
      reveal.current.value = target
      return
    }
    const tween = gsap.to(reveal.current, {
      value: target,
      duration: phase === 'exiting' ? 1.1 : 2.0,
      ease: phase === 'exiting' ? 'power2.in' : 'expo.out',
      overwrite: true,
    })
    return () => tween.kill()
  }, [phase, reducedMotion])

  useFrame(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(reveal.current.value)
  })

  // Reset the pointer if the system unmounts while a planet is hovered.
  useEffect(
    () => () => {
      document.body.style.cursor = 'auto'
    },
    [],
  )

  return (
    <group ref={groupRef} scale={initialScale}>
      <Sun
        reducedMotion={reducedMotion}
        onSelect={onSelect}
        selected={selectedId === 'sun'}
      />

      <OrbitPaths selectedId={selectedId} hoveredId={hoveredId} />

      {PLANETS.map((planet) => (
        <Planet
          key={planet.id}
          planet={planet}
          textures={textures}
          selected={selectedId === planet.id}
          hovered={hoveredId === planet.id}
          onSelect={onSelect}
          onHover={setHoveredId}
          onRegister={registerPlanet}
          reducedMotion={reducedMotion}
        />
      ))}

      <Suspense fallback={null}>
        <SolarExtras
          hosts={hosts}
          selectedId={selectedId}
          onSelect={onSelect}
          onRegister={onRegister}
          showOrbits={effects.orbits}
        />
      </Suspense>

      {effects.satellites && (
        <Suspense fallback={null}>
          <Probes selectedId={selectedId} showTracks={effects.orbits} onSelect={onSelect} onRegister={onRegister} />
        </Suspense>
      )}

      {effects.satellites && (
        <Satellites
          hosts={hosts}
          selectedId={selectedId}
          showOrbits={effects.orbits}
          onSelect={onSelect}
          onRegister={onRegister}
          reducedMotion={reducedMotion}
        />
      )}
    </group>
  )
}
