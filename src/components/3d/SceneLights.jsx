import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const SYSTEM_PHASES = new Set(['entering', 'universe'])

/**
 * Every light in the scene, always mounted. Adding or removing a light
 * forces Three.js to recompile every lit material, so instead the two rigs
 * crossfade by intensity:
 *
 *  - landing: cool directional key plus violet and cyan accents (Phase 2).
 *  - solar system: a single point light at the Sun, plus a little ambient
 *    fill so a planet between the camera and the Sun reads as a dark world
 *    rather than a hole cut out of the starfield.
 *
 * The Sun's light has falloff disabled (decay 0). With physical
 * inverse-square falloff across compressed orbits, Mercury blows out while
 * Neptune goes black; like the scale, the lighting favours legibility.
 */
export default function SceneLights({ phase, reducedMotion }) {
  const blend = useRef(SYSTEM_PHASES.has(phase) ? 1 : 0)

  const sun = useRef(null)
  const key = useRef(null)
  const violet = useRef(null)
  const cyan = useRef(null)
  const ambient = useRef(null)

  useFrame((_, delta) => {
    const target = SYSTEM_PHASES.has(phase) ? 1 : 0
    blend.current = reducedMotion
      ? target
      : blend.current + (target - blend.current) * Math.min(1, delta * 1.8)

    const s = blend.current
    const l = 1 - s
    if (sun.current) sun.current.intensity = 2.7 * s
    if (key.current) key.current.intensity = 1.1 * l
    if (violet.current) violet.current.intensity = 28 * l
    if (cyan.current) cyan.current.intensity = 18 * l
    if (ambient.current) ambient.current.intensity = 0.35 * l + 0.17 * s
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.35} color="#4a5a8c" />
      <pointLight ref={sun} position={[0, 0, 0]} intensity={0} decay={0} color="#fff4e2" />
      <directionalLight ref={key} position={[14, 10, 8]} intensity={1.1} color="#cfe0ff" />
      <pointLight ref={violet} position={[-16, -6, -10]} intensity={28} distance={60} color="#7c4dff" />
      <pointLight ref={cyan} position={[12, 4, -14]} intensity={18} distance={55} color="#22d3ee" />
    </>
  )
}
