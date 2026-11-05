import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CATALOGUE, DATA_RETRIEVED, OBJECT_TYPES } from '../../../data/catalogue/index.js'
import { BADGE_RULES, CHALLENGES, MILESTONES } from '../../../data/catalogue/achievements.js'
import { recordCompare, resetDiscovery, toggleBookmark, useDiscovery } from '../../../lib/discovery.js'
import { SORTS, formatDistance, formatMass, formatPeriod, formatRadius, formatTemperature, objectProperties } from '../../../lib/formatObject.js'

const SHOWN = { name: (e) => e.class, distance: (e) => formatDistance(e.distanceLy), radius: (e) => formatRadius(e.radiusKm), temperature: (e) => formatTemperature(e.temperatureK), mass: (e) => formatMass(e.massKg), period: (e) => formatPeriod(e.periodDays) }

const stroke = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

function Chip({ active, onClick, children, count }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.75rem] font-light ${active ? 'border-cyan/50 text-ink' : 'border-white/10 text-ink-dim'}`}>
      {children}
      {count != null && <span className="ml-1.5 text-muted">{count}</span>}
    </button>
  )
}

function Star({ on }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 ${on ? 'text-[#ffd28a]' : 'text-muted'}`} aria-hidden="true">
      <path d="m8 2 1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5z" {...stroke} fill={on ? 'currentColor' : 'none'} />
    </svg>
  )
}

function CompareSheet({ items, onClose, onOpen }) {
  const sized = items.filter((entry) => entry.radiusKm)
  const largest = Math.max(...sized.map((entry) => entry.radiusKm), 1)
  const smallest = Math.min(...sized.map((entry) => entry.radiusKm), largest)
  const logarithmic = largest / smallest > 400
  const drawn = (km) => (logarithmic ? 8 + 42 * (Math.log(km / smallest) / Math.log(largest / smallest)) : Math.max(1.5, (50 * km) / largest))
  const labels = [...new Set(items.flatMap((entry) => objectProperties(entry).map((row) => row.label)))]
  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-3xl bg-[#060915]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7">
        <h3 className="text-lg font-light text-ink">Compare</h3>
        <button type="button" onClick={onClose} className="readout hover:text-ink">Close compare</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 pb-6 sm:px-7">
        <div className="mt-4 flex items-end gap-4 overflow-x-auto pb-2">
          {items.map((entry) => (
            <div key={entry.id} className="flex min-w-24 flex-col items-center gap-2">
              <svg viewBox="0 0 104 104" className="h-24 w-24" aria-hidden="true">
                {entry.radiusKm && <circle cx="52" cy="52" r={drawn(entry.radiusKm)} fill={OBJECT_TYPES[entry.type].color} fillOpacity="0.8" />}
              </svg>
              <button type="button" onClick={() => onOpen(entry.id)} className="text-center text-[0.8125rem] font-light text-ink underline decoration-white/20 underline-offset-4">{entry.name}</button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[0.6875rem] font-light text-muted">
          {sized.length < 2 ? 'Sizes are shown where a radius is known.' : logarithmic ? 'Too different to draw to scale: circle sizes here are logarithmic.' : 'Circles are drawn to true relative scale.'}
        </p>
        <table className="mt-4 w-full min-w-[32rem] text-left text-[0.8125rem] font-light">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="readout py-2 pr-3 font-normal opacity-60">Property</th>
              {items.map((entry) => <th key={entry.id} className="py-2 pr-3 font-normal text-ink">{entry.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label} className="border-b border-white/[0.04] align-top">
                <td className="readout py-2 pr-3 opacity-60">{label}</td>
                {items.map((entry) => <td key={entry.id} className="py-2 pr-3 text-ink-dim">{objectProperties(entry).find((row) => row.label === label)?.value ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DiscoveryTab({ onOpen }) {
  const state = useDiscovery()
  const found = Object.keys(state.visited).length
  const stats = [
    ['Objects discovered', `${found} of ${CATALOGUE.length}`],
    ['Distance travelled', state.distanceLy >= 1 ? formatDistance(state.distanceLy) : 'Not yet'],
    ['Badges earned', `${state.badges.length} of ${BADGE_RULES.length}`],
    ['Bookmarks', state.bookmarks.length],
  ]
  const progressRows = [
    ...MILESTONES.map((m) => {
      const [value, goal] = m.progress(state)
      return { ...m, ratio: Math.min(1, value / goal) }
    }),
    ...CHALLENGES.map((c) => ({ ...c, ratio: c.ids.filter((id) => state.visited[id]).length / c.ids.length })),
  ]
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] px-4 py-3">
            <dt className="readout opacity-60">{label}</dt>
            <dd className="mt-1 text-[0.9375rem] font-light text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="readout mt-6 opacity-70">Badges</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {BADGE_RULES.map((badge) => {
          const earned = state.badges.includes(badge.id)
          return (
            <li key={badge.id} title={badge.description} className={`rounded-full border px-3 py-1 text-[0.75rem] font-light ${earned ? 'border-[#ffd28a]/50 text-ink' : 'border-white/[0.07] text-muted'}`}>
              {badge.title}
            </li>
          )
        })}
      </ul>

      <h3 className="readout mt-6 opacity-70">Milestones and challenges</h3>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {progressRows.map((row) => (
          <li key={row.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] font-light text-ink">{row.title}</span>
              <span className="readout opacity-60">{Math.round(row.ratio * 100)}%</span>
            </div>
            <div className="mt-1 h-px w-full bg-white/10"><div className="h-px bg-cyan/80" style={{ width: `${row.ratio * 100}%` }} /></div>
            <p className="mt-1 text-[0.75rem] font-light text-muted">{row.description}</p>
          </li>
        ))}
      </ul>

      <h3 className="readout mt-6 opacity-70">Discovery log</h3>
      {state.log.length === 0 ? (
        <p className="mt-2 text-[0.8125rem] font-light text-muted">Nothing yet. Choose any object to begin.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {state.log.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onOpen(item.id)} className="flex w-full items-baseline justify-between gap-3 py-1 text-left">
                <span className="text-[0.8125rem] font-light text-ink-dim hover:text-ink">{item.name}</span>
                <span className="readout shrink-0 opacity-50">{new Date(item.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={resetDiscovery} className="readout mt-5 underline-offset-4 hover:underline">Reset progress</button>
      <p className="mt-2 text-[0.6875rem] font-light text-muted">Saved only in this browser.</p>
    </div>
  )
}

/** The searchable catalogue, compare view and discovery log. */
export default function CataloguePanel({ onOpen, onClose, initialTab = 'catalogue', reducedMotion }) {
  const state = useDiscovery()
  const [tab, setTab] = useState(initialTab)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('name')
  const [descending, setDescending] = useState(false)
  const [onlySaved, setOnlySaved] = useState(false)
  const [picked, setPicked] = useState([])
  const [comparing, setComparing] = useState(false)

  const counts = useMemo(() => {
    const out = {}
    for (const entry of CATALOGUE) out[entry.type] = (out[entry.type] ?? 0) + 1
    return out
  }, [])

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const { value, text } = SORTS[sort]
    const list = CATALOGUE.filter((entry) => {
      if (type !== 'all' && entry.type !== type) return false
      if (onlySaved && !state.bookmarks.includes(entry.id)) return false
      const haystack = `${entry.name} ${entry.class} ${entry.host ?? ''} ${entry.spectralType ?? ''} ${OBJECT_TYPES[entry.type].one}`.toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
    // A name that starts with the search beats a passing mention, so "saturn"
    // finds Saturn before the moons that merely describe it.
    const lead = words[0]
    const direct = (entry) => (lead && entry.name.toLowerCase().startsWith(lead) ? 0 : 1)
    // Objects with no value sort last, whichever the direction.
    return list.sort((a, b) => {
      if (direct(a) !== direct(b)) return direct(a) - direct(b)
      const x = value(a)
      const y = value(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      const order = text ? x.localeCompare(y) : x - y
      return descending ? -order : order
    })
  }, [query, type, sort, descending, onlySaved, state.bookmarks])

  const toggleCompare = (id) => setPicked((list) => (list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id].slice(-4)))
  const pickedEntries = picked.map((id) => CATALOGUE.find((entry) => entry.id === id))

  return (
    <motion.section
      role="dialog"
      aria-label="Universe catalogue"
      className="pointer-events-auto absolute inset-x-2 bottom-2 top-[4.75rem] z-30 flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#060915]/95 backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:top-[5.5rem] lg:inset-x-[8%] short:top-[4.25rem]"
      initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.35 }}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.07] px-5 pb-0 pt-4 sm:px-7">
        {[['catalogue', 'Catalogue'], ['discovery', 'Discoveries']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`-mb-px border-b px-2 pb-3 text-[0.9375rem] font-light ${tab === id ? 'border-cyan/70 text-ink' : 'border-transparent text-ink-dim'}`}>
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose} aria-label="Close catalogue" className="ml-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-ink-dim">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" {...stroke} /></svg>
        </button>
      </header>

      {tab === 'discovery' ? (
        <DiscoveryTab onOpen={onOpen} />
      ) : (
        <>
          {/* On a phone held sideways the filters scroll away with the list. */}
          <div className="flex min-h-0 flex-1 flex-col short:block short:overflow-y-auto">
          <div className="space-y-2.5 px-5 pt-3.5 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <label className="min-w-0 flex-1 basis-56">
                <span className="sr-only">Search the catalogue</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search stars, planets, moons, galaxies…"
                  className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[0.875rem] font-light text-ink placeholder:text-muted focus:border-cyan/50 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="readout opacity-60">Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-full border border-white/10 bg-[#0b0f1f] px-3 py-2 text-[0.8125rem] font-light text-ink-dim">
                  {Object.entries(SORTS).map(([id, option]) => <option key={id} value={id}>{option.label}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setDescending((value) => !value)} aria-label={descending ? 'Sort descending' : 'Sort ascending'} className="rounded-full border border-white/10 px-3 py-2 text-[0.8125rem] font-light text-ink-dim">
                {descending ? '↓' : '↑'}
              </button>
              <Chip active={onlySaved} onClick={() => setOnlySaved((value) => !value)} count={state.bookmarks.length}>Saved</Chip>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip active={type === 'all'} onClick={() => setType('all')} count={CATALOGUE.length}>All</Chip>
              {Object.entries(OBJECT_TYPES).map(([id, info]) => (
                <Chip key={id} active={type === id} onClick={() => setType(id)} count={counts[id]}>{info.label}</Chip>
              ))}
            </div>
          </div>

          <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-5 short:overflow-visible" aria-label={`${results.length} objects`}>
            {results.map((entry) => {
              const seen = state.visited[entry.id]
              return (
                <li key={entry.id} className="flex items-center gap-1 rounded-xl hover:bg-white/[0.03]">
                  <button type="button" onClick={() => onOpen(entry.id)} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: OBJECT_TYPES[entry.type].color, opacity: seen ? 1 : 0.5 }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-light text-ink">{entry.name}</span>
                      <span className="block truncate text-[0.75rem] font-light text-muted">{entry.class}</span>
                    </span>
                    <span className="hidden shrink-0 text-right text-[0.75rem] font-light tabular-nums text-ink-dim sm:block">{SHOWN[sort](entry) ?? '—'}</span>
                  </button>
                  <button type="button" onClick={() => toggleCompare(entry.id)} aria-pressed={picked.includes(entry.id)} aria-label={`Compare ${entry.name}`} className={`h-8 w-8 shrink-0 rounded-full text-[0.8125rem] ${picked.includes(entry.id) ? 'bg-cyan/15 text-cyan' : 'text-muted'}`}>
                    ⇄
                  </button>
                  <button type="button" onClick={() => toggleBookmark(entry.id)} aria-pressed={state.bookmarks.includes(entry.id)} aria-label={`Bookmark ${entry.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <Star on={state.bookmarks.includes(entry.id)} />
                  </button>
                </li>
              )
            })}
            {results.length === 0 && <li className="px-3 py-8 text-center text-[0.875rem] font-light text-muted">No objects match.</li>}
          </ul>
          </div>

          <footer className="flex items-center gap-3 border-t border-white/[0.07] px-5 py-2.5 sm:px-7">
            <p className="min-w-0 flex-1 truncate text-[0.6875rem] font-light text-muted">
              {picked.length ? `${picked.length} selected to compare` : `Data from NASA, JPL and SIMBAD, retrieved ${DATA_RETRIEVED}`}
            </p>
            {picked.length > 0 && <button type="button" onClick={() => setPicked([])} className="readout">Clear</button>}
            <button
              type="button"
              disabled={picked.length < 2}
              onClick={() => {
                recordCompare()
                setComparing(true)
              }}
              className="rounded-full border border-cyan/40 px-3.5 py-1.5 text-[0.8125rem] font-light text-ink disabled:opacity-30"
            >
              Compare
            </button>
          </footer>
        </>
      )}

      {comparing && <CompareSheet items={pickedEntries} onClose={() => setComparing(false)} onOpen={onOpen} />}
    </motion.section>
  )
}
