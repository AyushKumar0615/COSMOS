import { useEffect, useRef, useState } from 'react'

const TICK_MS = 100

/**
 * Dwell timer for one tour stop. Returns progress in [0, 1] and calls
 * `onComplete` once when the stop's time is up. Pausing freezes progress;
 * a new `stepKey` starts the count again from zero.
 *
 * Progress is derived from state keyed by the step rather than reset in an
 * effect, so moving to another stop never renders a stale bar.
 */
export function useTourTimer({ stepKey, active, paused, duration, onComplete }) {
  const [elapsed, setElapsed] = useState({ key: stepKey, ms: 0 })
  const done = useRef(onComplete)
  const fired = useRef(null)

  // Keep the latest callback without writing a ref during render.
  useEffect(() => {
    done.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!active || paused) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const step = now - last
      last = now
      setElapsed((previous) => {
        const base = previous.key === stepKey ? previous.ms : 0
        return { key: stepKey, ms: Math.min(base + step, duration * 1000) }
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [active, paused, stepKey, duration])

  const ms = elapsed.key === stepKey ? elapsed.ms : 0
  const progress = Math.min(1, ms / (duration * 1000))

  // Completion is signalled from an effect, outside render, exactly once
  // per stop.
  useEffect(() => {
    if (!active || progress < 1 || fired.current === stepKey) return
    fired.current = stepKey
    done.current?.()
  }, [active, progress, stepKey])

  return progress
}
