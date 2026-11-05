import { motion } from 'framer-motion'

/**
 * Fade-through-black used when moving between scenes (solar system,
 * galaxies, nebulae, home). The swap happens while the screen is fully
 * dark, so no scene is ever seen half-built or from the wrong camera.
 */
export default function TravelOverlay({ label, reducedMotion }) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.45, 0, 0.55, 1] }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-56 flex-col items-center gap-4">
        <span className="eyebrow text-ink-dim">{label}</span>
        <span className="h-px w-full overflow-hidden bg-white/10">
          <motion.span
            className="block h-full bg-gradient-to-r from-violet via-blue to-cyan"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.45, 0, 0.55, 1] }}
          />
        </span>
      </div>
    </motion.div>
  )
}
