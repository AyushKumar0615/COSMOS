import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BODIES_BY_ID } from '../../data/planets.js'

const VISIBLE_MS = 1500

/**
 * Brief cinematic title shown while the camera flies to a body. It clears
 * itself before the camera arrives so it never sits over the planet.
 */
export default function FocusTitle({ bodyId, reducedMotion }) {
  // Derived rather than mirrored: the title shows for the current body
  // until its timer has expired. State only changes from the timer.
  const [expiredFor, setExpiredFor] = useState(null)
  const shown = bodyId && !reducedMotion && expiredFor !== bodyId ? bodyId : null

  useEffect(() => {
    if (!bodyId || reducedMotion) return
    const id = window.setTimeout(() => setExpiredFor(bodyId), VISIBLE_MS)
    return () => window.clearTimeout(id)
  }, [bodyId, reducedMotion])

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center px-6"
      aria-hidden="true"
    >
      <AnimatePresence mode="wait">
        {shown && (
          <motion.div
            key={shown}
            className="flex flex-col items-center gap-3 text-center"
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow text-cyan/80">Approaching</span>
            <span className="text-[clamp(2.25rem,6vw,4.5rem)] font-light uppercase leading-none tracking-[0.12em] text-ink/90">
              {BODIES_BY_ID[shown].name}
            </span>
            <span className="mt-1 h-px w-24 bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
