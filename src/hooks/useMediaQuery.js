import { useEffect, useState } from 'react'

/** Live boolean for a CSS media query. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (!window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * Touch-first layout: a coarse pointer (phones, tablets) or a narrow
 * viewport. Tablets are wide but still need on-screen flight controls.
 */
export function useTouchLayout() {
  const coarse = useMediaQuery('(pointer: coarse)')
  const narrow = useMediaQuery('(max-width: 767px)')
  return coarse || narrow
}
