import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BODY_ORDER, BODIES_BY_ID } from '../../data/planets.js'
import { SOLAR_BODIES, KIND_LABEL } from '../../data/solarNames.js'
import { SATELLITES } from '../../data/satellites.js'
import { useEffects } from '../../lib/effects.js'

const GROUPS = [
  ['Sun and planets', (b) => b.group === 'planet'],
  ['Moons', (b) => b.kind === 'moon'],
  ['Dwarf planets', (b) => b.kind === 'dwarf'],
  ['Asteroids', (b) => b.kind === 'asteroid' || b.kind === 'near-earth'],
  ['Comets', (b) => b.kind === 'comet'],
  ['Spacecraft', (b) => b.group === 'spacecraft'],
]

/**
 * Search and jump to anything in the solar system scene: planets, moons,
 * dwarf planets, asteroids, comets and spacecraft. Names that start with the
 * query rank above names that merely contain it.
 */
export default function FindPanel({ onSelect, reducedMotion }) {
  const effects = useEffects()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  const all = useMemo(
    () => [
      ...BODY_ORDER.map((id) => ({ id, name: BODIES_BY_ID[id].name, group: 'planet', detail: id === 'sun' ? 'Star' : 'Planet' })),
      ...SOLAR_BODIES.map((b) => ({ ...b, detail: b.kind === 'moon' ? `Moon of ${BODIES_BY_ID[b.host]?.name ?? 'Pluto'}` : KIND_LABEL[b.kind] })),
      ...(effects.satellites ? SATELLITES.map((s) => ({ id: s.id, name: s.name, group: 'spacecraft', detail: s.category })) : []),
    ],
    [effects.satellites],
  )

  const q = query.trim().toLowerCase()
  const matches = q
    ? all
        .filter((b) => b.name.toLowerCase().includes(q) || b.id.includes(q))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
    : all

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

  const choose = (id) => {
    onSelect(id)
    setOpen(false)
    setQuery('')
  }

  const item = (b) => (
    <li key={b.id}>
      <button
        type="button"
        onClick={() => choose(b.id)}
        className="flex w-full items-baseline justify-between gap-3 py-1.5 text-left text-[0.8125rem] font-light text-ink-dim transition-colors hover:text-ink"
      >
        <span className="truncate">{b.name}</span>
        <span className="readout shrink-0 opacity-50">{b.detail}</span>
      </button>
    </li>
  )

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="find-panel"
        aria-label="Find"
        className="glass flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5 transition-colors duration-300 hover:border-white/20"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="eyebrow hidden text-ink-dim sm:inline">Find</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="find-panel"
            role="dialog"
            aria-label="Find in the solar system"
            className="glass fixed inset-x-4 top-[8.25rem] z-30 flex max-h-[calc(100dvh-9.5rem)] flex-col rounded-3xl bg-[#070a17]/90 px-5 pb-3 pt-4 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-3 sm:max-h-[calc(100dvh-9rem)] sm:w-[21rem]"
            initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <input
              type="search"
              // The dialog exists to type into, so focus goes straight there.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && matches[0]) choose(matches[0].id)
              }}
              placeholder="Planet, moon, comet, spacecraft…"
              aria-label="Search the solar system"
              className="w-full rounded-full border border-white/12 bg-transparent px-4 py-2 text-[0.8125rem] font-light text-ink placeholder:text-muted focus:border-cyan/40 focus:outline-none"
            />
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
              {q ? (
                matches.length ? (
                  <ul>{matches.slice(0, 30).map(item)}</ul>
                ) : (
                  <p className="py-3 text-[0.8125rem] font-light text-muted">Nothing here by that name.</p>
                )
              ) : (
                GROUPS.map(([label, test]) => {
                  const list = all.filter(test)
                  if (!list.length) return null
                  return (
                    <div key={label} className="mb-2">
                      <p className="readout mt-1 opacity-60">{label}</p>
                      <ul>{list.map(item)}</ul>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
