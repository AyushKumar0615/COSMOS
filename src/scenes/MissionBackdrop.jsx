import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import Starfield from '../components/3d/Starfield.jsx'
import Nebula from '../components/3d/Nebula.jsx'

// The mission archive is an HTML page; the 3D scene behind it is ambience.
// It renders at a reduced, steady rate so scrolling and reading stay smooth
// on integrated graphics and phones.
const BACKDROP_FPS = 30
const RADIUS = 34

/**
 * Slowly drifting starfield behind the mission explorer. It reuses the
 * shared renderer and switches the frame loop to on-demand while mounted,
 * restoring it on the way out.
 */
export default function MissionBackdrop({ reducedMotion }) {
  const camera = useThree((state) => state.camera)
  const setFrameloop = useThree((state) => state.setFrameloop)
  const invalidate = useThree((state) => state.invalidate)
  const angle = useRef(0.35)

  useLayoutEffect(() => {
    camera.clearViewOffset()
    camera.position.set(Math.sin(angle.current) * RADIUS, 6, Math.cos(angle.current) * RADIUS)
    camera.lookAt(0, 2, 0)
  }, [camera])

  useEffect(() => {
    setFrameloop('demand')
    invalidate()
    if (reducedMotion) {
      return () => setFrameloop('always')
    }
    let id = 0
    const tick = () => {
      if (document.visibilityState === 'visible') invalidate()
    }
    id = window.setInterval(tick, 1000 / BACKDROP_FPS)
    return () => {
      window.clearInterval(id)
      setFrameloop('always')
    }
  }, [setFrameloop, invalidate, reducedMotion])

  useFrame((_, delta) => {
    if (reducedMotion) return
    angle.current += Math.min(delta, 0.1) * 0.012
    camera.position.set(Math.sin(angle.current) * RADIUS, 6, Math.cos(angle.current) * RADIUS)
    camera.lookAt(0, 2, 0)
  })

  return (
    <>
      <Nebula motion={reducedMotion ? 0 : 0.6} />
      <Starfield count={5200} innerRadius={30} outerRadius={230} sizeBase={0.5} sizeVariance={3.6} twinkle={!reducedMotion} />
    </>
  )
}
