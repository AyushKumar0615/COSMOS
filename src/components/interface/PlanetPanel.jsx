import { motion } from 'framer-motion'
import {
  BODIES_BY_ID,
  BODY_ORDER,
  CATEGORY,
  DATA_SOURCES,
  FACT_FIELDS,
  PLANETS,
} from '../../data/planets.js'

function NavButton({ direction, body, onClick }) {
  const isPrev = direction === 'prev'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-w-0 flex-1 items-center gap-2.5 py-1 ${isPrev ? '' : 'justify-end text-right'}`}
      aria-label={`${isPrev ? 'Previous' : 'Next'}: ${body.name}`}
    >
      {isPrev && <Arrow flip />}
      <span className="min-w-0">
        <span className="readout block opacity-50">{isPrev ? 'Previous' : 'Next'}</span>
        <span className="block truncate text-[0.8125rem] font-light text-ink-dim transition-colors group-hover:text-ink">
          {body.name}
        </span>
      </span>
      {!isPrev && <Arrow />}
    </button>
  )
}

function Arrow({ flip }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 text-cyan transition-transform duration-300 ${
        flip ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'
      }`}
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Information panel for the selected body. A right-hand column on desktop,
 * a bottom sheet on small screens. Every value shown comes from the `facts`
 * block of data/planets.js; nothing from the simulation is displayed as data.
 */
export default function PlanetPanel({ bodyId, onClose, onSelect, reducedMotion }) {
  const body = BODIES_BY_ID[bodyId]
  const index = BODY_ORDER.indexOf(bodyId)
  const prev = BODIES_BY_ID[BODY_ORDER[(index - 1 + BODY_ORDER.length) % BODY_ORDER.length]]
  const next = BODIES_BY_ID[BODY_ORDER[(index + 1) % BODY_ORDER.length]]
  const planetNumber = PLANETS.findIndex((p) => p.id === bodyId) + 1

  const transition = { duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }

  return (
    <motion.aside
      aria-labelledby="planet-panel-title"
      className="glass pointer-events-auto absolute inset-x-3 bottom-3 flex max-h-[58vh] flex-col overflow-hidden rounded-3xl bg-[#070a17]/80 md:inset-x-auto md:bottom-10 md:right-6 md:top-24 md:max-h-none md:w-[360px] lg:right-10"
      initial={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
      transition={transition}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 pb-5 pt-6 sm:px-7 [scrollbar-width:thin]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="readout flex items-center gap-2 text-cyan/80">
              {planetNumber > 0 && (
                <span className="tabular-nums text-ink-dim/70">
                  {String(planetNumber).padStart(2, '0')} / 08
                </span>
              )}
              <span>{CATEGORY[bodyId]}</span>
            </p>
            <motion.h2
              key={bodyId}
              id="planet-panel-title"
              className="mt-2.5 text-4xl font-light tracking-[-0.02em] text-ink"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              {body.name}
            </motion.h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 transition-colors duration-300 hover:border-white/25"
            aria-label="Clear selection"
            title="Clear selection"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-ink-dim" />
            </svg>
          </button>
        </div>

        <motion.div
          key={`${bodyId}-body`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...transition, delay: reducedMotion ? 0 : 0.08 }}
        >
          <p className="mt-4 text-[0.875rem] font-light leading-relaxed text-ink-dim">
            {body.facts.description}
          </p>

          <div className="hairline my-5 h-px w-full opacity-60" />

          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            {FACT_FIELDS.map((field) => (
              <div key={field.key} className={field.key === 'distance' || field.key === 'rotationPeriod' ? 'col-span-2' : ''}>
                <dt className="readout opacity-60">{field.label}</dt>
                <dd className="mt-1.5 text-[0.875rem] font-normal leading-snug text-ink tabular-nums">
                  {body.facts[field.key]}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-[0.6875rem] font-light leading-relaxed text-muted">
            {DATA_SOURCES.physical} · moon counts {DATA_SOURCES.moonsAsOf} ·
            on-screen scale is illustrative
          </p>
        </motion.div>
      </div>
      {/* Signals that the panel keeps going past the fold. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#070a17]/85 to-transparent" />
      </div>

      <div className="flex items-center gap-4 border-t border-white/[0.07] px-6 py-3.5 sm:px-7">
        <NavButton direction="prev" body={prev} onClick={() => onSelect(prev.id)} />
        <span className="h-6 w-px bg-white/10" aria-hidden="true" />
        <NavButton direction="next" body={next} onClick={() => onSelect(next.id)} />
      </div>
    </motion.aside>
  )
}
