import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BOOT_MESSAGES } from '../../data/navigation.js'

const BOOT_DURATION = 1900

/**
 * Entry transition shown while the app mounts and the shaders compile.
 * The bar tracks the boot sequence's own elapsed time — it is a transition,
 * not a download meter, and it never claims to be one.
 */
export default function Loader({ onDone, reducedMotion }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (reducedMotion) {
      setProgress(100)
      const id = window.setTimeout(onDone, 120)
      return () => window.clearTimeout(id)
    }

    let frame = 0
    const start = performance.now()

    const tick = (now) => {
      const elapsed = now - start
      const ratio = Math.min(1, elapsed / BOOT_DURATION)
      // Ease-out so the bar decelerates into place rather than stopping dead.
      setProgress(Math.round((1 - Math.pow(1 - ratio, 2)) * 100))
      if (ratio < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        window.setTimeout(onDone, 260)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onDone, reducedMotion])

  const messageIndex = Math.min(
    BOOT_MESSAGES.length - 1,
    Math.floor((progress / 100) * BOOT_MESSAGES.length),
  )

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-void px-6"
      initial={{ opacity: 1 }}
      // While it fades the landing page is already readable underneath, so
      // the overlay stops taking clicks — otherwise the first press on
      // "Enter Universe" lands on a curtain that is on its way out.
      exit={{ opacity: 0, filter: 'blur(6px)', pointerEvents: 'none' }}
      transition={{ duration: reducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-col items-center gap-8">
        <motion.div
          className="text-[0.7rem] font-mono tracking-[0.62em] text-ink/90 pl-[0.62em]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.8, ease: 'easeOut' }}
        >
          COSMOS
        </motion.div>

        <div className="w-56 sm:w-72">
          <div className="h-px w-full overflow-hidden bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-violet via-blue to-cyan"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="readout text-ink-dim/70">
              {BOOT_MESSAGES[messageIndex]}
            </span>
            <span
              className="font-mono text-[0.625rem] tabular-nums tracking-[0.1em] text-ink/70"
              aria-hidden="true"
            >
              {String(progress).padStart(3, '0')}
            </span>
          </div>
        </div>
      </div>

      <span className="sr-only" role="status">
        Preparing the COSMOS environment
      </span>
    </motion.div>
  )
}
