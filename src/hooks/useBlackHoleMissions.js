import { useCallback, useEffect, useRef, useState } from 'react'
import { BLACK_HOLE_MISSIONS } from '../data/blackholes.js'

const STORAGE_KEY = 'cosmos.blackhole.missions.v1'
const TICK_MS = 200

function loadCompleted() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function saveCompleted(ids) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Progress simply lasts for this visit when storage is unavailable.
  }
}

/**
 * Watches live telemetry and completes missions. A mission counts only once
 * its condition has held for `hold` seconds, so skimming past a target does
 * not trigger it. Progress survives between visits where storage allows.
 */
export function useBlackHoleMissions(telemetry, enabled, onComplete) {
  const [completed, setCompleted] = useState(loadCompleted)
  const [progress, setProgress] = useState({})
  const held = useRef({})
  const completedRef = useRef(completed)
  const notify = useRef(onComplete)
  useEffect(() => {
    notify.current = onComplete
  })

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      const t = telemetry.current
      if (t.r == null) return
      const next = {}
      for (const mission of BLACK_HOLE_MISSIONS) {
        if (completedRef.current.includes(mission.id)) continue
        const passing = mission.check(t)
        held.current[mission.id] = passing ? (held.current[mission.id] ?? 0) + TICK_MS / 1000 : 0
        next[mission.id] = mission.progress(t, held.current[mission.id])
        if (passing && held.current[mission.id] >= mission.hold) {
          const updated = [...completedRef.current, mission.id]
          completedRef.current = updated
          saveCompleted(updated)
          setCompleted(updated)
          notify.current?.(mission)
        }
      }
      setProgress(next)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [enabled, telemetry])

  const reset = useCallback(() => {
    completedRef.current = []
    held.current = {}
    telemetry.current.diskCrossed = false
    saveCompleted([])
    setCompleted([])
  }, [telemetry])

  return { completed, progress, reset }
}
