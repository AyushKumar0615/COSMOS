import { motion } from 'framer-motion'
import { CATALOGUE_BY_ID, OBJECT_TYPES, nearbyObjects, systemMembers } from '../../../data/catalogue/index.js'
import { toggleBookmark, useDiscovery } from '../../../lib/discovery.js'
import { formatDistance, objectProperties } from '../../../lib/formatObject.js'

const stroke = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

/** A single object's profile, with everything connected to it. */
export default function ObjectPanel({ entry, systemId, onOpen, onOpenSystem, onExplore, onClose, reducedMotion }) {
  const state = useDiscovery()
  const saved = state.bookmarks.includes(entry.id)
  const rows = objectProperties(entry)
  // Previous and Next walk whatever is on screen: in a moon system, the planet
  // and its moons, rather than the planet's neighbours in the solar system.
  const moonView = systemId?.startsWith('moons:')
  const siblings = moonView
    ? [CATALOGUE_BY_ID[systemId.slice(6)], ...systemMembers(systemId)]
    : entry.system
      ? systemMembers(entry.system).filter((other) => other.type !== 'star' || other.id === entry.id)
      : []
  const index = siblings.findIndex((other) => other.id === entry.id)
  const previous = siblings.length > 1 ? siblings[(index - 1 + siblings.length) % siblings.length] : null
  const next = siblings.length > 1 ? siblings[(index + 1) % siblings.length] : null
  const nearby = nearbyObjects(entry, 5)
  const parent = entry.parent ? CATALOGUE_BY_ID[entry.parent] : null

  return (
    <motion.aside
      aria-label={entry.name}
      className="glass pointer-events-auto absolute inset-x-3 bottom-3 flex max-h-[56vh] flex-col overflow-hidden rounded-3xl bg-[#070a17]/85 md:inset-x-auto md:bottom-10 md:right-6 md:top-24 md:max-h-none md:w-[360px] lg:right-10"
      initial={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-5 [scrollbar-width:thin]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="readout truncate" style={{ color: OBJECT_TYPES[entry.type].color }}>{OBJECT_TYPES[entry.type].one}</p>
            <h2 className="mt-1.5 text-2xl font-light tracking-[-0.02em] text-ink">{entry.name}</h2>
            <p className="mt-0.5 text-[0.8125rem] font-light text-ink-dim">{entry.class}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button type="button" onClick={() => toggleBookmark(entry.id)} aria-pressed={saved} aria-label={saved ? `Remove bookmark for ${entry.name}` : `Bookmark ${entry.name}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12">
              <svg viewBox="0 0 16 16" className={`h-4 w-4 ${saved ? 'text-[#ffd28a]' : 'text-ink-dim'}`} aria-hidden="true">
                <path d="m8 2 1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5z" {...stroke} fill={saved ? 'currentColor' : 'none'} />
              </svg>
            </button>
            <button type="button" onClick={onClose} aria-label="Close profile" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-ink-dim">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" {...stroke} /></svg>
            </button>
          </div>
        </div>

        {entry.note && <p className="mt-3 text-[0.8125rem] font-light leading-relaxed text-ink-dim">{entry.note}</p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.explorer && (
            <button type="button" onClick={() => onExplore(entry.explorer)} className="rounded-full border border-cyan/40 px-3.5 py-1.5 text-[0.8125rem] font-light text-ink">
              Explore in 3D
            </button>
          )}
          {entry.moonSystem && systemMembers(entry.moonSystem).length > 0 && (
            <button type="button" onClick={() => onOpenSystem(entry.moonSystem)} className="rounded-full border border-cyan/40 px-3.5 py-1.5 text-[0.8125rem] font-light text-ink">
              View its moons
            </button>
          )}
          {parent && (
            <button type="button" onClick={() => onOpen(parent.id)} className="rounded-full border border-white/12 px-3.5 py-1.5 text-[0.8125rem] font-light text-ink-dim">
              Go to {parent.name}
            </button>
          )}
        </div>

        <div className="hairline my-4 h-px w-full opacity-60" />
        <dl className="space-y-3">
          {rows.map((row) => (
            <div key={`${row.label}-${row.value}`}>
              <dt className="readout opacity-60">{row.label}{row.estimated ? ' · estimate' : ''}</dt>
              <dd className="mt-1 text-[0.8125rem] leading-snug text-ink">{row.value}</dd>
              {row.note && <dd className="mt-0.5 text-[0.6875rem] font-light leading-snug text-muted">{row.note}</dd>}
            </div>
          ))}
          {entry.facts?.map((fact) => (
            <div key={fact.label}>
              <dt className="readout opacity-60">{fact.label}</dt>
              <dd className="mt-1 text-[0.8125rem] leading-snug text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {entry.temperate && (
          <p className="mt-3 text-[0.75rem] font-light leading-relaxed text-[#9fe0b8]">
            Temperate by a simple test of size and equilibrium temperature. That is not the same as habitable: nothing is known yet about whether it has an atmosphere or water.
          </p>
        )}

        {nearby.length > 0 && (
          <>
            <h3 className="readout mt-5 opacity-60">Nearby</h3>
            <ul className="mt-1.5">
              {nearby.map((other) => (
                <li key={other.id}>
                  <button type="button" onClick={() => onOpen(other.id)} className="flex w-full items-baseline justify-between gap-3 py-1 text-left">
                    <span className="truncate text-[0.8125rem] font-light text-ink-dim hover:text-ink">{other.name}</span>
                    {other.awayLy != null && <span className="readout shrink-0 opacity-50">{formatDistance(other.awayLy)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="readout mt-5 opacity-60">Sources</h3>
        <ul className="mt-1.5 space-y-1">
          {entry.sources?.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" className="text-[0.75rem] font-light text-ink-dim underline decoration-white/20 underline-offset-2 hover:text-ink">{source.label}</a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.6875rem] font-light leading-relaxed text-muted">The figures above are measurements. The view around them is illustrative: sizes, distances and speeds on screen are compressed.</p>
      </div>

      {previous && (
        <div className="flex items-center gap-3 border-t border-white/[0.07] px-6 py-3">
          <button type="button" onClick={() => onOpen(previous.id)} aria-label={`Previous: ${previous.name}`} className="min-w-0 flex-1 text-left">
            <span className="readout block opacity-50">Previous</span>
            <span className="block truncate text-[0.8125rem] font-light text-ink-dim">{previous.name}</span>
          </button>
          <span className="h-6 w-px bg-white/10" aria-hidden="true" />
          <button type="button" onClick={() => onOpen(next.id)} aria-label={`Next: ${next.name}`} className="min-w-0 flex-1 text-right">
            <span className="readout block opacity-50">Next</span>
            <span className="block truncate text-[0.8125rem] font-light text-ink-dim">{next.name}</span>
          </button>
        </div>
      )}
    </motion.aside>
  )
}
