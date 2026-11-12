import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BODIES_BY_ID } from '../../data/planets.js'
import { SATELLITES, SATELLITES_BY_ID, SATELLITE_FACT_FIELDS, isProbe } from '../../data/satellites.js'
import { useSimulation, useSimulationReadout } from '../../lib/simClock.js'
import { dateFromJulian, julianDate } from '../../lib/orbits.js'

const NOW = julianDate(Date.now())
const AU_KM = 149597870.7
const HORIZONS_URL = 'https://ssd.jpl.nasa.gov/horizons/'

const formatDate = (jd) =>
  dateFromJulian(jd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function formatAu(au) {
  const value = au.toLocaleString('en-GB', { maximumFractionDigits: au < 10 ? 3 : 1 })
  if (au >= 10) return `${value} AU`
  const km = (au * AU_KM) / 1e6
  return `${value} AU (${km.toLocaleString('en-GB', { maximumFractionDigits: 1 })} million km)`
}

function formatLightTime(hours) {
  const minutes = Math.round(hours * 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/**
 * Distances for the date the craft is shown at, from JPL Horizons. The
 * ephemeris loads with the first spacecraft panel that needs it.
 */
function Ephemeris({ craft }) {
  const [lib, setLib] = useState(null)
  const sim = useSimulation()
  const readout = useSimulationReadout()
  useEffect(() => {
    let live = true
    import('../../lib/trajectories.js').then((module) => live && setLib(module))
    return () => {
      live = false
    }
  }, [])
  if (!lib) return null
  const id = craft.trajectory
  const loops = isProbe(craft) && Boolean(lib.trajectoryPeriod(id))
  const jd = lib.probeJd(id, { mode: sim.mode, jd: readout.jd, t: readout.t }, NOW, loops)
  const d = lib.probeDistances(id, jd)
  const range = lib.trajectoryRange(id)
  const label = sim.mode === 'real' ? `On ${formatDate(jd)}` : loops ? `Shown at its ${formatDate(jd)} position` : 'Today'

  return (
    <div className="mt-5">
      <p className="readout text-cyan/80">{label}</p>
      {d ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
          <div className="col-span-2">
            <dt className="readout opacity-60">From the Sun</dt>
            <dd className="mt-1.5 text-[0.875rem] font-normal leading-snug text-ink tabular-nums">{formatAu(d.sun)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="readout opacity-60">From Earth</dt>
            <dd className="mt-1.5 text-[0.875rem] font-normal leading-snug text-ink tabular-nums">{formatAu(d.earth)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="readout opacity-60">Radio signal time from Earth</dt>
            <dd className="mt-1.5 text-[0.875rem] font-normal leading-snug text-ink tabular-nums">{formatLightTime(d.lightHours)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-[0.8125rem] font-light leading-relaxed text-ink-dim">
          No ephemeris downloaded for this date: the data covers {formatDate(range[0])} to {formatDate(range[1])}.
        </p>
      )}
      <p className="mt-3 text-[0.6875rem] font-light leading-relaxed text-muted">
        <a className="underline decoration-white/20 underline-offset-2 hover:text-ink-dim" href={HORIZONS_URL} target="_blank" rel="noreferrer">
          JPL Horizons
        </a>
        {` ephemeris, retrieved ${lib.TRAJECTORY_RETRIEVED}: reconstructed and planned trajectory, interpolated between samples. Not live tracking.`}
      </p>
    </div>
  )
}

/**
 * Information panel for a spacecraft, in the same frame as PlanetPanel.
 * Facts come from data/satellites.js `facts`; the simulated orbit is never
 * shown as data, and the panel says how the view differs from reality.
 */
export default function SatellitePanel({ satelliteId, onClose, onSelect, reducedMotion }) {
  const craft = SATELLITES_BY_ID[satelliteId]
  const host = BODIES_BY_ID[craft.host]
  const probe = isProbe(craft)
  const index = SATELLITES.findIndex((s) => s.id === satelliteId)
  const prev = SATELLITES[(index - 1 + SATELLITES.length) % SATELLITES.length]
  const next = SATELLITES[(index + 1) % SATELLITES.length]
  const transition = { duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }
  const fields = SATELLITE_FACT_FIELDS.filter((field) => craft.facts[field.key])

  return (
    <motion.aside
      aria-labelledby="satellite-panel-title"
      className="glass pointer-events-auto absolute inset-x-3 bottom-3 flex max-h-[58vh] flex-col overflow-hidden rounded-3xl bg-[#070a17]/80 md:inset-x-auto md:bottom-10 md:right-6 md:top-24 md:max-h-none md:w-[360px] lg:right-10"
      initial={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
      transition={transition}
    >
      <div className="flex-1 overflow-y-auto px-6 pb-5 pt-6 sm:px-7 [scrollbar-width:thin]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="readout text-cyan/80">{craft.category}</p>
            <motion.h2
              key={satelliteId}
              id="satellite-panel-title"
              className="mt-2.5 text-[1.875rem] font-light leading-tight tracking-[-0.02em] text-ink"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              {craft.name}
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

        <motion.div key={`${satelliteId}-body`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...transition, delay: reducedMotion ? 0 : 0.08 }}>
          <p className="mt-4 text-[0.875rem] font-light leading-relaxed text-ink-dim">{craft.facts.description}</p>

          <div className="hairline my-5 h-px w-full opacity-60" />

          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            {fields.map((field) => (
              <div key={field.key} className={field.key === 'orbit' || field.key === 'operator' || field.key === 'period' ? 'col-span-2' : ''}>
                <dt className="readout opacity-60">{field.label}</dt>
                <dd className="mt-1.5 text-[0.875rem] font-normal leading-snug text-ink tabular-nums">{craft.facts[field.key]}</dd>
              </div>
            ))}
          </dl>

          {craft.trajectory && <Ephemeris craft={craft} />}

          <button
            type="button"
            onClick={() => onSelect(host.id)}
            className="mt-5 rounded-full border border-white/12 px-4 py-2 text-[0.75rem] font-light text-ink-dim transition-colors hover:border-white/25 hover:text-ink"
          >
            Back to {host.name}
          </button>

          <p className="mt-5 text-[0.6875rem] font-light leading-relaxed text-muted">
            {probe
              ? 'Published mission figures · the model is enlarged; its direction from the Sun is real for the date, its distance compressed like the planets’'
              : 'Published mission figures · the model is enlarged and its orbit compressed to be visible; orbital speeds keep their real order, not their real pace'}
          </p>
        </motion.div>
      </div>

      <div className="flex items-center gap-4 border-t border-white/[0.07] px-6 py-3.5 sm:px-7">
        <button type="button" onClick={() => onSelect(prev.id)} className="group min-w-0 flex-1 py-1 text-left" aria-label={`Previous: ${prev.name}`}>
          <span className="readout block opacity-50">Previous</span>
          <span className="block truncate text-[0.8125rem] font-light text-ink-dim group-hover:text-ink">{prev.short}</span>
        </button>
        <span className="h-6 w-px bg-white/10" aria-hidden="true" />
        <button type="button" onClick={() => onSelect(next.id)} className="group min-w-0 flex-1 py-1 text-right" aria-label={`Next: ${next.name}`}>
          <span className="readout block opacity-50">Next</span>
          <span className="block truncate text-[0.8125rem] font-light text-ink-dim group-hover:text-ink">{next.short}</span>
        </button>
      </div>
    </motion.aside>
  )
}
