import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * Keep the subject clear of whichever panel is open by shifting the
 * projection's principal point, as a fraction of the viewport. x > 0 moves
 * the subject left, y > 0 moves it up. Moving the principal point rather
 * than the camera leaves OrbitControls' framing untouched.
 *
 * The shift eases towards its target, so opening or closing a panel glides
 * the view across instead of jumping it.
 */
export function useViewShift(target, reducedMotion) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const current = useRef({ x: 0, y: 0 })
  const applied = useRef({ x: NaN, y: NaN, w: 0, h: 0 })

  useEffect(() => () => camera.clearViewOffset(), [camera])

  useFrame((_, delta) => {
    const c = current.current
    const tx = target?.x ?? 0
    const ty = target?.y ?? 0
    const k = reducedMotion ? 1 : 1 - Math.exp(-4 * Math.min(delta, 0.1))
    c.x += (tx - c.x) * k
    c.y += (ty - c.y) * k

    const a = applied.current
    const settled = Math.abs(c.x) < 1e-4 && Math.abs(c.y) < 1e-4
    if (settled) {
      if (camera.view?.enabled) camera.clearViewOffset()
      a.x = a.y = NaN
      return
    }
    // Only touch the projection when something actually changed.
    if (Math.abs(a.x - c.x) < 1e-5 && Math.abs(a.y - c.y) < 1e-5 && a.w === size.width && a.h === size.height) {
      return
    }
    camera.setViewOffset(size.width, size.height, c.x * size.width, c.y * size.height, size.width, size.height)
    a.x = c.x
    a.y = c.y
    a.w = size.width
    a.h = size.height
  })
}
