import { motion } from 'framer-motion'

function IconButton({ label, onClick, children, emphasis = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick()
        event.currentTarget.blur()
      }}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-10 items-center justify-center gap-2 rounded-full px-3.5 transition-colors duration-200 disabled:pointer-events-none disabled:opacity-30 ${
        emphasis
          ? 'border border-cyan/40 bg-cyan/10 text-ink hover:bg-cyan/15'
          : 'text-ink-dim hover:bg-white/[0.06] hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
}

/**
 * Guided tour overlay: a single card holding the stop's content, progress
 * and every tour control. The rest of the solar-system interface is hidden
 * while touring so the 3D view stays the focus.
 */
export default function TourHud({
  stop,
  index,
  total,
  progress,
  paused,
  finished,
  onPrev,
  onNext,
  onTogglePause,
  onExit,
  reducedMotion,
}) {
  const transition = { duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }
  const isLast = index === total - 1

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
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" {...stroke} className="text-cyan" />
          </svg>
          <span className="eyebrow text-ink-dim transition-colors group-hover:text-ink">
            Exit tour
          </span>
        </button>
      </div>

      <section
        aria-label="Guided tour"
        className="glass pointer-events-auto absolute inset-x-3 bottom-3 flex max-h-[52vh] flex-col overflow-hidden rounded-3xl bg-[#070a17]/80 md:inset-x-auto md:bottom-10 md:left-6 md:max-h-[calc(100vh-11rem)] md:w-[400px] lg:left-10"
      >
        {/* Progress: one segment per stop, the current one filling. */}
        <div className="flex gap-1 px-6 pt-5 sm:px-7" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full bg-gradient-to-r from-violet via-blue to-cyan"
                style={{
                  width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                }}
              />
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-5 sm:px-7 [scrollbar-width:thin]">
          {/* Keyed fade-in only, no exit phase: the card always shows the
              current stop immediately, however fast Next is pressed. */}
          <motion.div
              key={stop.id}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, duration: reducedMotion ? 0 : 0.35 }}
            >
              <p className="readout flex items-center gap-2 text-cyan/80">
                <span className="tabular-nums text-ink-dim/70">
                  {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </span>
                <span>{stop.eyebrow}</span>
              </p>
              <h2 className="mt-2.5 text-3xl font-light tracking-[-0.02em] text-ink sm:text-4xl">
                {stop.title}
              </h2>
              <p className="mt-4 text-[0.875rem] font-light leading-relaxed text-ink-dim">
                {stop.text}
              </p>

              <ul className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-4">
                {stop.facts.map((fact) => (
                  <li key={fact} className="flex gap-3 text-[0.8125rem] font-light leading-relaxed text-ink-dim">
                    <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-cyan/80" aria-hidden="true" />
                    {fact}
                  </li>
                ))}
              </ul>
            </motion.div>
        </div>
        <p className="sr-only" aria-live="polite">
          {`Stop ${index + 1} of ${total}: ${stop.title}`}
        </p>

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3 sm:px-5">
          <IconButton label="Previous stop" onClick={onPrev} disabled={index === 0}>
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <path d="M10 3 5 8l5 5" {...stroke} />
            </svg>
            <span className="eyebrow hidden sm:inline">Prev</span>
          </IconButton>

          <IconButton
            label={finished ? 'Tour complete' : paused ? 'Resume tour' : 'Pause tour'}
            onClick={onTogglePause}
            disabled={finished}
          >
            {paused || finished ? (
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path d="M5 3.5v9l7.5-4.5z" {...stroke} />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path d="M5.5 3.5v9M10.5 3.5v9" {...stroke} />
              </svg>
            )}
            <span className="eyebrow">
              {finished ? 'Complete' : paused ? 'Resume' : 'Pause'}
            </span>
          </IconButton>

          <IconButton
            label={isLast ? 'Finish tour' : 'Next stop'}
            onClick={onNext}
            emphasis
          >
            <span className="eyebrow">{isLast ? 'Finish' : 'Next'}</span>
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <path d="M6 3l5 5-5 5" {...stroke} />
            </svg>
          </IconButton>
        </div>
      </section>

      <p className="readout absolute bottom-10 right-10 hidden max-w-[16rem] text-right leading-relaxed opacity-50 lg:block">
        {paused && !finished
          ? 'Paused · drag to look around · resume when ready'
          : 'Drag to look around · the tour pauses while you do'}
      </p>
    </motion.div>
  )
}
