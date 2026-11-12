import { motion } from 'framer-motion'
import orbits from '../../data/catalogue/orbits.json' with { type: 'json' }
import { DWARF_NOTES, MOON_NOTES } from '../../data/catalogue/notes.js'
import { PLANETS_BY_ID } from '../../data/planets.js'
import { KIND_LABEL, SOLAR_BODIES, SOLAR_BODIES_BY_ID } from '../../data/solarNames.js'
import { dateFromJulian, julianDate } from '../../lib/orbits.js'

const SOURCES = {
  moons: { label: 'JPL satellite elements and physical parameters', url: 'https://ssd.jpl.nasa.gov/sats/elem/' },
  small: { label: 'JPL Small-Body Database', url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html' },
  nasa: { label: 'NASA: dwarf planets', url: 'https://science.nasa.gov/dwarf-planets/' },
}

const fmt = (value, digits = 0) =>
  value == null ? null : Number(value).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

const COMET_NOTES = {
  halley: 'The best-known periodic comet, seen at every return since at least 240 BC. Its next perihelion is in 2061.',
  encke: 'The shortest-period comet known, returning about every 3.3 years.',
  'churyumov-gerasimenko': 'The comet ESA’s Rosetta orbited from 2014 to 2016, and where the Philae lander touched down.',
  'swift-tuttle': 'The parent comet of the Perseid meteor shower each August.',
  'hale-bopp': 'The Great Comet of 1997, visible to the naked eye for a record 18 months.',
}
const SMALL_NOTES = {
  vesta: 'The second-largest body in the asteroid belt, mapped from orbit by NASA’s Dawn in 2011–2012.',
  pallas: 'One of the largest asteroids, on a steeply inclined orbit.',
  hygiea: 'A large, nearly round main-belt asteroid, considered a dwarf-planet candidate.',
  eros: 'The first asteroid orbited and landed on, by NASA’s NEAR Shoemaker in 2000–2001.',
  bennu: 'Sampled by NASA’s OSIRIS-REx, which returned material to Earth in September 2023.',
  apophis: 'A near-Earth asteroid that will pass within about 32,000 km of Earth’s surface on 13 April 2029.',
}

function Facts({ rows }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
      {rows
        .filter(([, value]) => value != null)
        .map(([label, value, wide]) => (
          <div key={label} className={wide ? 'col-span-2' : ''}>
            <dt className="readout opacity-60">{label}</dt>
            <dd className="mt-1.5 text-[0.875rem] font-normal leading-snug text-ink tabular-nums">{value}</dd>
          </div>
        ))}
    </dl>
  )
}

function moonRows(id) {
  const m = orbits.moons[id]
  const host = id === 'charon' ? 'Pluto' : PLANETS_BY_ID[m.planet]?.name
  return [
    ['Orbits', host],
    ['Radius', `${fmt(m.radiusKm, 1)} km`],
    ['Orbital radius', `${fmt(m.orbitKm)} km`, true],
    ['Orbital period', `${fmt(m.periodDays, 3)} days${m.i > 90 ? ', retrograde' : ''}`, true],
    ['Eccentricity', fmt(m.eccentricity, 4)],
    ['Inclination', `${fmt(m.i, 2)}° to the ${m.frame === 'ecliptic' ? 'ecliptic' : m.frame === 'Laplace' ? 'Laplace plane' : 'planet’s equator'}`],
    ['Rotation', 'Tidally locked: one face always towards its planet', true],
  ]
}

function smallRows(id) {
  const b = orbits.small[id]
  const kind = SOLAR_BODIES_BY_ID[id].kind
  const years = b.periodDays / 365.25
  const now = julianDate(Date.now())
  let perihelion = null
  // A two-body estimate is only fair from recent elements: planets perturb
  // comets enough that Halley's 1968 elements miss its 2061 return by months.
  const recentElements = now - b.epochJd < 3650
  if (kind === 'comet' && b.perihelionJd && recentElements) {
    const turns = Math.ceil((now - b.perihelionJd) / b.periodDays)
    const next = dateFromJulian(b.perihelionJd + turns * b.periodDays)
    perihelion = next.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const diameter = b.diameterKm ?? (b.radiusKm ? b.radiusKm * 2 : null)
  return [
    ['Orbit class', b.orbitClass?.replace(/\*$/, ''), true],
    ['Diameter', diameter ? `${fmt(diameter, diameter < 10 ? 2 : 0)} km` : null],
    ['Rotation', b.rotationHours ? `${fmt(b.rotationHours, 2)} hours` : null],
    ['Semi-major axis', `${fmt(b.a, 3)} AU`],
    ['Eccentricity', fmt(b.e, 3)],
    ['Closest to the Sun', `${fmt(b.q, 3)} AU`],
    ['Farthest from the Sun', b.Q ? `${fmt(b.Q, 2)} AU` : null],
    ['Inclination', `${fmt(b.i, 1)}° to the ecliptic`],
    ['Orbital period', years > 2 ? `${fmt(years, 1)} years` : `${fmt(b.periodDays, 0)} days`],
    ['Next perihelion (two-body estimate)', perihelion, true],
  ]
}

/**
 * Inspection panel for a moon, dwarf planet, asteroid or comet. Every figure
 * is JPL's (orbits.json); the notes are the catalogue's own short context.
 */
export default function BodyPanel({ bodyId, onClose, onSelect, reducedMotion }) {
  const body = SOLAR_BODIES_BY_ID[bodyId]
  const moon = body.kind === 'moon'
  const peers = SOLAR_BODIES.filter((b) => (moon ? b.kind === 'moon' && b.host === body.host : b.kind === body.kind))
  const index = peers.findIndex((b) => b.id === bodyId)
  const prev = peers[(index - 1 + peers.length) % peers.length]
  const next = peers[(index + 1) % peers.length]
  const host = moon ? (body.host === 'pluto' ? { id: 'pluto', name: 'Pluto' } : PLANETS_BY_ID[body.host]) : null
  const note = moon ? MOON_NOTES[bodyId]?.[2] : body.kind === 'dwarf' ? DWARF_NOTES[bodyId]?.[0] : body.kind === 'comet' ? COMET_NOTES[bodyId] : SMALL_NOTES[bodyId]
  const sizeNote = !moon ? orbits.small[bodyId]?.diameterNote : null
  const transition = { duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }

  return (
    <motion.aside
      aria-labelledby="body-panel-title"
      className="glass pointer-events-auto absolute inset-x-3 bottom-3 flex max-h-[58vh] flex-col overflow-hidden rounded-3xl bg-[#070a17]/80 md:inset-x-auto md:bottom-10 md:right-6 md:top-24 md:max-h-none md:w-[360px] lg:right-10"
      initial={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
      transition={transition}
    >
      <div className="flex-1 overflow-y-auto px-6 pb-5 pt-6 sm:px-7 [scrollbar-width:thin]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="readout text-cyan/80">{moon ? `Moon of ${host.name}` : KIND_LABEL[body.kind]}</p>
            <motion.h2
              key={bodyId}
              id="body-panel-title"
              className="mt-2.5 text-[1.875rem] font-light leading-tight tracking-[-0.02em] text-ink"
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

        <motion.div key={`${bodyId}-body`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...transition, delay: reducedMotion ? 0 : 0.08 }}>
          {note && <p className="mt-4 text-[0.875rem] font-light leading-relaxed text-ink-dim">{note}</p>}
          <div className="hairline my-5 h-px w-full opacity-60" />
          <Facts rows={moon ? moonRows(bodyId) : smallRows(bodyId)} />
          {sizeNote && <p className="mt-3 text-[0.6875rem] font-light leading-relaxed text-muted">Diameter: {sizeNote}</p>}

          {host && (
            <button
              type="button"
              onClick={() => onSelect(host.id)}
              className="mt-5 rounded-full border border-white/12 px-4 py-2 text-[0.75rem] font-light text-ink-dim transition-colors hover:border-white/25 hover:text-ink"
            >
              Back to {host.name}
            </button>
          )}

          <p className="mt-5 text-[0.6875rem] font-light leading-relaxed text-muted">
            <a className="underline decoration-white/20 underline-offset-2 hover:text-ink-dim" href={(moon ? SOURCES.moons : SOURCES.small).url} target="_blank" rel="noreferrer">
              {(moon ? SOURCES.moons : SOURCES.small).label}
            </a>
            {sizeNote && (
              <>
                {' · '}
                <a className="underline decoration-white/20 underline-offset-2 hover:text-ink-dim" href={SOURCES.nasa.url} target="_blank" rel="noreferrer">
                  {SOURCES.nasa.label}
                </a>
              </>
            )}
            {` · retrieved ${orbits.retrieved} · on screen, sizes and distances are compressed`}
            {body.kind === 'comet' && '; tail length and brightness are illustrative'}
          </p>
        </motion.div>
      </div>

      {peers.length > 1 && (
        <div className="flex items-center gap-4 border-t border-white/[0.07] px-6 py-3.5 sm:px-7">
          <button type="button" onClick={() => onSelect(prev.id)} className="group min-w-0 flex-1 py-1 text-left" aria-label={`Previous: ${prev.name}`}>
            <span className="readout block opacity-50">Previous</span>
            <span className="block truncate text-[0.8125rem] font-light text-ink-dim group-hover:text-ink">{prev.name}</span>
          </button>
          <span className="h-6 w-px bg-white/10" aria-hidden="true" />
          <button type="button" onClick={() => onSelect(next.id)} className="group min-w-0 flex-1 py-1 text-right" aria-label={`Next: ${next.name}`}>
            <span className="readout block opacity-50">Next</span>
            <span className="block truncate text-[0.8125rem] font-light text-ink-dim group-hover:text-ink">{next.name}</span>
          </button>
        </div>
      )}
    </motion.aside>
  )
}
