import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MissionArt from './MissionArt.jsx'
import MissionDetail from './MissionDetail.jsx'
import {
  AGENCIES,
  MISSIONS,
  MISSIONS_BY_ID,
  MISSION_SOURCE_NOTE,
  MISSION_TYPES,
  STATUS_LABELS,
} from '../../data/missions.js'

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
}

const STATUS_DOT = {
  active: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',
  completed: 'bg-cyan/80',
  ended: 'bg-muted',
}

const year = (iso) => iso.slice(0, 4)

const searchText = (mission) =>
  [
    mission.name,
    mission.shortName,
    mission.fullName,
    mission.agency,
    AGENCIES[mission.agency].fullName,
    AGENCIES[mission.agency].country,
    ...mission.partners,
    mission.target,
    mission.tagline,
    ...mission.types.map((type) => MISSION_TYPES[type]),
    STATUS_LABELS[mission.status],
    year(mission.launch.date),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const INDEX = MISSIONS.map((mission) => ({ mission, text: searchText(mission) }))

function FilterChip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-light transition-colors duration-200 ${
        active
          ? 'border-cyan/60 bg-cyan/10 text-ink'
          : 'border-white/10 bg-white/[0.03] text-ink-dim hover:border-white/25 hover:text-ink'
      }`}
    >
      {children}
      {count != null && <span className="font-mono text-[0.625rem] tabular-nums text-muted">{count}</span>}
    </button>
  )
}

function MissionCard({ mission, onOpen, reducedMotion, index }) {
  const agency = AGENCIES[mission.agency]
  return (
    <motion.li
      layout={!reducedMotion}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      // Cards enter with a gentle stagger, but leave at once: carrying the
      // stagger into the exit makes filtering feel like it lags behind typing.
      exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.18, delay: 0 } }}
      transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={(event) => onOpen(mission.id, event.currentTarget)}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070a17]/85 text-left transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-white/20 focus-visible:-translate-y-0.5"
        aria-label={`${mission.name} — ${agency.name}, launched ${mission.launch.label}. ${STATUS_LABELS[mission.status]}. Open details`}
      >
        <div className="relative aspect-[5/3] overflow-hidden">
          <MissionArt mission={mission} className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#070a17] to-transparent" aria-hidden="true" />
          <span className="readout absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 !text-ink-dim">
            {agency.name}
          </span>
          <span className="readout absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 !text-ink-dim">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[mission.status]}`} aria-hidden="true" />
            {STATUS_LABELS[mission.status]}
          </span>
        </div>
        <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
          <p className="readout flex items-center gap-2">
            <span className="tabular-nums text-cyan/80">{year(mission.launch.date)}</span>
            <span aria-hidden="true" className="h-px w-3 bg-white/20" />
            <span className="truncate">{mission.types.map((type) => MISSION_TYPES[type]).join(' · ')}</span>
          </p>
          <h3 className="mt-2 text-xl font-light tracking-[-0.01em] text-ink">{mission.name}</h3>
          <p className="mt-1.5 text-[0.8125rem] font-light leading-relaxed text-ink-dim">{mission.tagline}</p>
          <span className="mt-auto flex items-center gap-2 pt-4 text-[0.75rem] font-light text-muted transition-colors group-hover:text-ink-dim">
            <span className="truncate">{mission.target}</span>
            <svg viewBox="0 0 16 16" className="ml-auto h-3.5 w-3.5 shrink-0 text-cyan transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" {...stroke} />
            </svg>
          </span>
        </div>
      </button>
    </motion.li>
  )
}

/**
 * Space mission explorer (Phase 6): a scrollable archive laid over the live
 * starfield. A cinematic header, search, agency / type / status filters, a
 * card grid and a detail dialog with a timeline and official sources.
 */
export default function MissionExplorer({ onExit, reducedMotion }) {
  const [query, setQuery] = useState('')
  const [agency, setAgency] = useState('all')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [newestFirst, setNewestFirst] = useState(false)
  const [openId, setOpenId] = useState(null)

  const scrollRef = useRef(null)
  const gridRef = useRef(null)
  const searchRef = useRef(null)
  const returnFocus = useRef(null)

  const deferredQuery = useDeferredValue(query)

  const results = useMemo(() => {
    const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const list = INDEX.filter(({ mission, text }) => {
      if (agency !== 'all' && mission.agency !== agency) return false
      if (type !== 'all' && !mission.types.includes(type)) return false
      if (status !== 'all' && mission.status !== status) return false
      return terms.every((term) => text.includes(term))
    }).map(({ mission }) => mission)
    list.sort((a, b) => (newestFirst ? b.launch.date.localeCompare(a.launch.date) : a.launch.date.localeCompare(b.launch.date)))
    return list
  }, [deferredQuery, agency, type, status, newestFirst])

  // Counts reflect the other active filters, so a chip never promises
  // results that are not there.
  const counts = useMemo(() => {
    const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matches = (mission, text, skip) =>
      (skip === 'agency' || agency === 'all' || mission.agency === agency) &&
      (skip === 'type' || type === 'all' || mission.types.includes(type)) &&
      (skip === 'status' || status === 'all' || mission.status === status) &&
      terms.every((term) => text.includes(term))
    const tally = { agency: {}, type: {}, status: {} }
    for (const { mission, text } of INDEX) {
      if (matches(mission, text, 'agency')) tally.agency[mission.agency] = (tally.agency[mission.agency] ?? 0) + 1
      if (matches(mission, text, 'type')) for (const t of mission.types) tally.type[t] = (tally.type[t] ?? 0) + 1
      if (matches(mission, text, 'status')) tally.status[mission.status] = (tally.status[mission.status] ?? 0) + 1
    }
    return tally
  }, [deferredQuery, agency, type, status])

  const filtersActive = query || agency !== 'all' || type !== 'all' || status !== 'all'
  const clearFilters = () => {
    setQuery('')
    setAgency('all')
    setType('all')
    setStatus('all')
    searchRef.current?.focus()
  }

  const openMission = useCallback((id, origin) => {
    returnFocus.current = origin ?? null
    setOpenId(id)
  }, [])

  const closeMission = useCallback(() => {
    setOpenId(null)
    // Return focus to the card that opened the dialog.
    const origin = returnFocus.current
    window.requestAnimationFrame(() => origin?.focus?.({ preventScroll: true }))
  }, [])

  // Detail navigation follows the filtered, sorted list the visitor sees.
  const openIndex = openId ? results.findIndex((mission) => mission.id === openId) : -1
  const navList = openIndex >= 0 ? results : MISSIONS
  const currentIndex = openId ? navList.findIndex((mission) => mission.id === openId) : -1
  const stepMission = (delta) => {
    if (currentIndex < 0) return
    const next = navList[(currentIndex + delta + navList.length) % navList.length]
    setOpenId(next.id)
  }

  const scrollToGrid = () => {
    gridRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

  // "/" focuses search, as in most archive UIs.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || openId) return
      const target = event.target
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  const activeCount = MISSIONS.filter((mission) => mission.status === 'active').length
  const firstYear = year(MISSIONS.reduce((min, mission) => (mission.launch.date < min ? mission.launch.date : min), '9999'))
  const transition = { duration: reducedMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }

  return (
    <motion.section
      aria-label="Space mission explorer"
      // Raised above the navigation bar while the modal dialog is open.
      className={`absolute inset-0 ${openId ? 'z-40' : 'z-20'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.6 }}
    >
      {/* Keeps the navigation bar readable over scrolled content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-void via-void/80 to-transparent" />

      <div
        ref={scrollRef}
        inert={openId ? true : undefined}
        className="h-full overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]"
      >
        {/* --- Cinematic header ------------------------------------------ */}
        <header className="relative flex min-h-[78svh] flex-col px-6 pb-12 pt-24 sm:px-10 sm:pt-28 lg:min-h-[82svh] lg:px-16">
          <div className="mx-auto w-full max-w-[1400px]">
            <button
              type="button"
              onClick={onExit}
              className="group glass flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5 transition-colors duration-300 hover:border-white/20"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M10 3 5 8l5 5" {...stroke} className="text-cyan transition-transform duration-300 group-hover:-translate-x-0.5" />
              </svg>
              <span className="eyebrow text-ink-dim transition-colors group-hover:text-ink">Exit</span>
            </button>
          </div>

          <div className="mx-auto mt-auto w-full max-w-[1400px] pt-14">
            <motion.p className="eyebrow text-cyan/80" initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
              Mission archive
            </motion.p>
            <motion.h1
              className="text-cosmic mt-5 max-w-[14ch] text-[clamp(2.6rem,7vw,6rem)] font-light leading-[0.95] tracking-[-0.035em]"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: reducedMotion ? 0 : 0.08 }}
            >
              Space missions
            </motion.h1>
            <motion.p
              className="mt-6 max-w-[56ch] text-[0.98rem] font-light leading-relaxed text-ink-dim sm:text-[1.05rem]"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: reducedMotion ? 0 : 0.16 }}
            >
              Fourteen journeys that changed what we know — from the first footsteps on the Moon to probes in interstellar space, observatories at L2 and samples carried home from an asteroid.
            </motion.p>

            <motion.dl
              className="mt-10 grid max-w-[720px] grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...transition, delay: reducedMotion ? 0 : 0.28 }}
            >
              {[
                ['Missions', MISSIONS.length],
                ['Agencies', Object.keys(AGENCIES).length],
                ['Still active', activeCount],
                ['Since', firstYear],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-white/10 pl-4">
                  <dt className="readout">{label}</dt>
                  <dd className="mt-1.5 font-mono text-2xl font-light tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </motion.dl>

            <motion.button
              type="button"
              onClick={scrollToGrid}
              className="group mt-12 flex items-center gap-3 text-ink-dim transition-colors hover:text-ink"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...transition, delay: reducedMotion ? 0 : 0.4 }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 transition-colors group-hover:border-cyan/60">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" aria-hidden="true">
                  <path d="M8 3v9M4.5 8.5 8 12l3.5-3.5" {...stroke} />
                </svg>
              </span>
              <span className="eyebrow">Browse missions</span>
            </motion.button>
          </div>
        </header>

        {/* --- Toolbar ----------------------------------------------------- */}
        <div ref={gridRef} className="scroll-mt-20 md:scroll-mt-24" />
        {/* The toolbar only sticks when the viewport is tall enough to spare
            the room; on a phone held sideways a pinned toolbar would cover
            the cards it filters. */}
        <div className="z-[2] px-4 sm:px-10 lg:px-16 [@media(min-width:768px)_and_(min-height:640px)]:sticky [@media(min-width:768px)_and_(min-height:640px)]:top-24">
          <div className="mx-auto max-w-[1400px] rounded-2xl border border-white/[0.08] bg-[#070a17]/92 px-4 py-3.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative flex min-w-0 flex-1 items-center lg:max-w-sm">
                <span className="sr-only">Search missions</span>
                <svg viewBox="0 0 16 16" className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-muted" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.5" {...stroke} />
                  <path d="m10.5 10.5 3 3" {...stroke} />
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && query) {
                      event.stopPropagation()
                      setQuery('')
                    }
                  }}
                  placeholder="Search missions, targets, agencies…"
                  className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-10 text-[0.875rem] font-light text-ink placeholder:text-muted focus:border-cyan/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                  autoComplete="off"
                  spellCheck="false"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      searchRef.current?.focus()
                    }}
                    className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-ink"
                    aria-label="Clear search"
                  >
                    <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" {...stroke} />
                    </svg>
                  </button>
                )}
              </label>

              <div role="group" aria-label="Filter by space agency" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <FilterChip active={agency === 'all'} onClick={() => setAgency('all')}>
                  All agencies
                </FilterChip>
                {Object.values(AGENCIES).map((entry) => (
                  <FilterChip
                    key={entry.id}
                    active={agency === entry.id}
                    onClick={() => setAgency(agency === entry.id ? 'all' : entry.id)}
                    count={counts.agency[entry.id] ?? 0}
                  >
                    {entry.name}
                  </FilterChip>
                ))}
              </div>

              <div className="flex items-center gap-2 lg:ml-auto">
                <label className="relative">
                  <span className="sr-only">Sort order</span>
                  <select
                    value={newestFirst ? 'newest' : 'oldest'}
                    onChange={(event) => setNewestFirst(event.target.value === 'newest')}
                    className="appearance-none rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-3.5 pr-8 text-[0.8125rem] font-light text-ink-dim focus:border-cyan/50 focus:outline-none"
                  >
                    <option value="oldest">Oldest first</option>
                    <option value="newest">Newest first</option>
                  </select>
                  <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" aria-hidden="true">
                    <path d="m4.5 6.5 3.5 3.5 3.5-3.5" {...stroke} />
                  </svg>
                </label>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2.5 border-t border-white/[0.06] pt-3 md:flex-row md:items-center md:gap-4">
              <div role="group" aria-label="Filter by mission type" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <FilterChip active={type === 'all'} onClick={() => setType('all')}>
                  All types
                </FilterChip>
                {Object.entries(MISSION_TYPES).map(([key, label]) => (
                  <FilterChip key={key} active={type === key} onClick={() => setType(type === key ? 'all' : key)} count={counts.type[key] ?? 0}>
                    {label}
                  </FilterChip>
                ))}
              </div>
              <div role="group" aria-label="Filter by status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:ml-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <FilterChip key={key} active={status === key} onClick={() => setStatus(status === key ? 'all' : key)} count={counts.status[key] ?? 0}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[key]}`} aria-hidden="true" />
                    {label}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- Results ----------------------------------------------------- */}
        <div className="px-4 pb-24 pt-6 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-[1400px]">
            <div className="flex items-center justify-between gap-4 px-1">
              <p className="readout" role="status" aria-live="polite">
                {results.length === MISSIONS.length ? `${results.length} missions` : `${results.length} of ${MISSIONS.length} missions`}
              </p>
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="readout !text-cyan/80 hover:!text-cyan">
                  Clear filters
                </button>
              )}
            </div>

            {results.length > 0 ? (
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                <AnimatePresence initial={false} mode="popLayout">
                  {results.map((mission, index) => (
                    <MissionCard key={mission.id} mission={mission} index={index} onOpen={openMission} reducedMotion={reducedMotion} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
                <p className="text-lg font-light text-ink">No missions match</p>
                <p className="mt-2 max-w-sm text-[0.875rem] font-light text-ink-dim">
                  Try another search term, or widen the agency, type or status filters.
                </p>
                <button type="button" onClick={clearFilters} className="glass mt-6 rounded-full px-5 py-2.5 text-[0.8125rem] text-ink">
                  Show all missions
                </button>
              </div>
            )}

            <p className="mt-12 px-1 text-[0.75rem] font-light leading-relaxed text-muted">{MISSION_SOURCE_NOTE}</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {openId && (
          <MissionDetail
            key="detail"
            mission={MISSIONS_BY_ID[openId]}
            position={currentIndex}
            total={navList.length}
            onPrev={() => stepMission(-1)}
            onNext={() => stepMission(1)}
            onClose={closeMission}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>
    </motion.section>
  )
}
