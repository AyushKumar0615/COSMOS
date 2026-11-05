import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from '../../lib/gsapConfig.js'
import Sun from './Sun.jsx'
import Planet from './Planet.jsx'
import OrbitPaths from './OrbitPaths.jsx'
import { PLANETS } from '../../data/planets.js'
import { getPlanetTextures } from '../../lib/planetTextures.js'

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
          onRegister={onRegister}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
