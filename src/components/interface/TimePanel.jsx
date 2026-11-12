import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EDUCATIONAL_SPEEDS, REAL_RATES, resetToNow, setSimulation, setSimulationDate, useSimulation, useSimulationReadout } from '../../lib/simClock.js'
import { dateFromJulian } from '../../lib/orbits.js'
import { PLANETS_BY_ID } from '../../data/planets.js'
import { useSolarEvents } from '../../lib/solarEvents.js'

const EARTH_PERIOD = PLANETS_BY_ID.earth.sim.orbitPeriod

const formatDate = (jd) =>
  dateFromJulian(jd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function Chip({ active, onClick, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-light tabular-nums transition-colors ${
        active ? 'border-cyan/50 bg-cyan/15 text-ink' : 'border-white/12 text-ink-dim hover:border-white/25 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

const EVENT_TEXT = {
  solar: () => 'Solar eclipse: the Moon’s shadow is on Earth',
  lunar: (e) => `${e.type[0].toUpperCase() + e.type.slice(1)} lunar eclipse: the Moon is in Earth’s shadow`,
  transit: (e) => `${e.body[0].toUpperCase() + e.body.slice(1)} casts its shadow on ${e.type[0].toUpperCase() + e.type.slice(1)}`,
}

/** Eclipses happening now, announced once each and politely. */
export function EventBanner({ reducedMotion }) {
  const events = useSolarEvents()
  const { mode } = useSimulation()
  const shown = events.filter((e) => e.kind !== 'transit').slice(0, 2)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[8.5rem] flex flex-col items-center gap-2 px-4 sm:top-36" aria-live="polite">
      <AnimatePresence>
        {shown.map((e) => (
          <motion.p
            key={e.kind}
            className="glass rounded-full px-4 py-2 text-center text-[0.75rem] font-light text-ink"
            initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {EVENT_TEXT[e.kind](e)}
            <span className="ml-2 text-ink-dim/70">{mode === 'real' ? 'computed for this date' : 'simulated alignment'}</span>
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Time controls for the solar system: pause, speeds, and the choice between
 * the educational compressed motion and real dates computed from JPL
 * elements. The button shows the state at a glance.
 */
export default function TimePanel({ reducedMotion }) {
  const sim = useSimulation()
  const readout = useSimulationReadout()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const real = sim.mode === 'real'
  const years = readout.t / EARTH_PERIOD
  const status = real ? formatDate(readout.jd) : `${years < 10 ? years.toFixed(1) : Math.round(years)} yr`
  const isoDate = dateFromJulian(readout.jd).toISOString().slice(0, 10)

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="time-panel"
        aria-label={`Time: ${sim.playing ? 'running' : 'paused'}, ${real ? formatDate(readout.jd) : 'educational speed'}`}
        className="glass flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5 transition-colors duration-300 hover:border-white/20"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 4.6V8l2.4 1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="eyebrow hidden text-ink-dim sm:inline">{sim.playing ? status : `Paused · ${status}`}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="time-panel"
            role="dialog"
            aria-label="Time controls"
            className="glass fixed inset-x-4 top-[8.25rem] z-30 max-h-[calc(100dvh-9.5rem)] overflow-y-auto rounded-3xl bg-[#070a17]/90 px-5 pb-4 pt-4 [scrollbar-width:thin] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-3 sm:max-h-[calc(100dvh-9rem)] sm:w-[20rem]"
            initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="readout text-cyan/80">Time</p>
              <button
                type="button"
                onClick={() => setSimulation({ playing: !sim.playing })}
                className="rounded-full border border-white/15 px-4 py-1.5 text-[0.75rem] font-light text-ink transition-colors hover:border-white/30"
              >
                {sim.playing ? 'Pause' : 'Play'}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Motion">
              <Chip active={!real} onClick={() => setSimulation({ mode: 'educational' })}>Educational</Chip>
              <Chip active={real} onClick={() => setSimulation({ mode: 'real' })}>Real dates</Chip>
            </div>
            <p className="mt-2 text-[0.6875rem] font-light leading-relaxed text-muted">
              {real
                ? 'Planets, moons, comets and asteroids at their computed positions for the date, from JPL orbital elements. Distances and sizes stay compressed.'
                : 'Compressed speeds that keep every orbit’s real order, starting from today’s positions.'}
            </p>

            <p className="readout mt-4 opacity-60">Speed</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Speed">
              {real
                ? REAL_RATES.map((rate, i) => (
                    <Chip key={rate.label} active={sim.rate === i} onClick={() => setSimulation({ rate: i, playing: true })}>
                      {rate.label}
                    </Chip>
                  ))
                : EDUCATIONAL_SPEEDS.map((speed, i) => (
                    <Chip key={speed} active={sim.speed === i} onClick={() => setSimulation({ speed: i, playing: true })} label={`${speed} times`}>
                      {speed < 1 ? '¼' : speed}×
                    </Chip>
                  ))}
            </div>

            {real && (
              <div className="mt-4">
                <label className="readout block opacity-60" htmlFor="sim-date">
                  Date
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="sim-date"
                    type="date"
                    min="1800-01-01"
                    max="2050-12-31"
                    value={isoDate}
                    onChange={(event) => {
                      const date = new Date(`${event.target.value}T12:00:00Z`)
                      if (!Number.isNaN(date.getTime())) setSimulationDate(date)
                    }}
                    className="min-w-0 flex-1 rounded-full border border-white/12 bg-transparent px-3 py-1.5 text-[0.8125rem] font-light text-ink [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    onClick={resetToNow}
                    className="rounded-full border border-white/12 px-3 py-1.5 text-[0.75rem] font-light text-ink-dim transition-colors hover:border-white/25 hover:text-ink"
                  >
                    Today
                  </button>
                </div>
                <p className="mt-2 text-[0.6875rem] font-light leading-relaxed text-muted">
                  Planet elements are valid 1800–2050. Eclipse timing is good to within a few hours. Voyager, New Horizons and Parker follow JPL Horizons ephemerides; orbiting spacecraft keep compressed orbits.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
