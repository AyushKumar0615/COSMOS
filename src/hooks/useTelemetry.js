import { useEffect, useState } from 'react'

/**
 * Snapshot of a frequently changing ref, at a rate an interface can use. The
 * 3D scene writes the ref every frame without causing a single React render.
 */
export function useTelemetry(ref, enabled = true, intervalMs = 120) {
  const [snapshot, setSnapshot] = useState(() => ({ ...ref.current }))
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setSnapshot({ ...ref.current }), intervalMs)
    return () => window.clearInterval(id)
  }, [ref, enabled, intervalMs])
  return snapshot
}
