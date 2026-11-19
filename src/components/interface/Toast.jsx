import { motion } from 'framer-motion'

/**
 * Transient notice. `top` places it under the navigation bar, for screens
 * whose bottom edge is taken by controls and sheets.
 */
export default function Toast({ message, reducedMotion, top = false }) {
  const shift = reducedMotion ? 0 : top ? -12 : 12
  return (
    <motion.div
      className={`pointer-events-none absolute inset-x-0 z-40 flex justify-center px-6 ${top ? 'top-[4.75rem]' : 'bottom-24 sm:bottom-28'}`}
      initial={{ opacity: 0, y: shift }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shift }}
      transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live="polite"
    >
      <div className="glass flex items-center gap-3 rounded-full px-5 py-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet" aria-hidden="true" />
        <span className="text-[0.8125rem] font-light text-ink-dim">{message}</span>
      </div>
    </motion.div>
  )
}
