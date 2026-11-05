import { AnimatePresence, motion } from 'framer-motion'
import PlanetSelector from './PlanetSelector.jsx'
import PlanetPanel from './PlanetPanel.jsx'
import ViewControls from './ViewControls.jsx'
import FocusTitle from './FocusTitle.jsx'

/**
 * Overlay for the solar system. Layout, desktop:
 *   left   — exit, body rail, view controls
 *   right  — information panel (only while something is selected)
 *   bottom — interaction hint (only while nothing is selected)
 * Small screens collapse the rail into a chip row and the panel into a
 * bottom sheet that covers it.
 */
export default function UniverseHud({
  onExit,
  selectedId,
  onSelect,
  onClearSelection,
  onZoomIn,
  onZoomOut,
  onReset,
  reducedMotion,
}) {
  const transition = {
    duration: reducedMotion ? 0 : 0.6,
    ease: [0.22, 1, 0.36, 1],
  }

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
    >
      <div className="pointer-events-auto absolute left-4 top-20 sm:left-6 sm:top-24 lg:left-10">
        <button
          type="button"
          onClick={onExit}
          className="group glass flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5 transition-colors duration-300 hover:border-white/20"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path
              d="M10 3 5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-cyan transition-transform duration-300 group-hover:-translate-x-0.5"
            />
          </svg>
          <span className="eyebrow text-ink-dim transition-colors group-hover:text-ink">
            Exit
          </span>
        </button>
      </div>

      {!selectedId && (
        <p className="readout absolute right-6 top-24 hidden max-w-[15rem] text-right leading-relaxed opacity-50 tall:block lg:right-10">
          Simulation · sizes, distances and orbital speeds are compressed, not to scale
        </p>
      )}

      <PlanetSelector
        selectedId={selectedId}
        onSelect={onSelect}
        hidden={Boolean(selectedId)}
      />

      <ViewControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onReset} />

      <FocusTitle bodyId={selectedId} reducedMotion={reducedMotion} />

      <AnimatePresence>
        {!selectedId && (
          <motion.p
            key="hint"
            className="readout absolute inset-x-0 bottom-10 hidden text-center opacity-70 tall:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            Select a planet&nbsp;&nbsp;·&nbsp;&nbsp;Drag to orbit&nbsp;&nbsp;·&nbsp;&nbsp;Right-drag to pan&nbsp;&nbsp;·&nbsp;&nbsp;Scroll to zoom
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedId && (
          <PlanetPanel
            key="panel"
            bodyId={selectedId}
            onClose={onClearSelection}
            onSelect={onSelect}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
