import { motion } from 'framer-motion'

/**
 * Short entry transition shown while the camera pulls back and the solar
 * system unfolds (which is also when planet surfaces are baked). The line
 * tracks the length of the camera move itself, not a download.
 */
export default function SystemTransition({ duration }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-60 flex-col items-center gap-4">
        <span className="eyebrow text-ink-dim">Charting the solar system</span>
        <span className="h-px w-full overflow-hidden bg-white/10">
          <motion.span
            className="block h-full bg-gradient-to-r from-violet via-blue to-cyan"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: duration / 1000, ease: [0.45, 0, 0.55, 1] }}
          />
        </span>
      </div>
    </motion.div>
  )
}
