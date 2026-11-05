import { useEffect, useRef, useState } from 'react'
import gsap from '../lib/gsapConfig.js'

/**
 * Swap the displayed object only once the current one has faded out, then
 * fade the new one in. Returns the id to render and an opacity ref
 * ({ value }) for materials to read each frame, so the fade never causes a
 * React render.
 */
export function useCrossfade(targetId, reducedMotion) {
  const [shownId, setShownId] = useState(targetId)
  const opacity = useRef({ value: reducedMotion ? 1 : 0 })

  useEffect(() => {
    let tween
    if (targetId === shownId) {
      tween = gsap.to(opacity.current, {
        value: 1,
        duration: reducedMotion ? 0.01 : 1.3,
        ease: 'power2.out',
      })
    } else {
      tween = gsap.to(opacity.current, {
        value: 0,
        duration: reducedMotion ? 0.01 : 0.45,
        ease: 'power2.in',
        onComplete: () => setShownId(targetId),
      })
    }
    return () => tween.kill()
  }, [targetId, shownId, reducedMotion])

  return { shownId, opacity }
}
