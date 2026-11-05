import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import CataloguePanel from './CataloguePanel.jsx'
import ObjectPanel from './ObjectPanel.jsx'
import { CATALOGUE_BY_ID } from '../../../data/catalogue/index.js'
import { BADGE_RULES } from '../../../data/catalogue/achievements.js'
import { openSystem, returnToUniverse, selectObject } from '../../../lib/atlas.js'
import { onBadge, setBadgeRules } from '../../../lib/discovery.js'
import { buildSystem } from '../../../lib/systems.js'

const LABELS = 26
const stroke = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

/** Everything on screen in the Universe scene, in its own lazy chunk. */
export default function AtlasLayer({ atlas, setAtlas, view, onExit, onExplore, showToast, reducedMotion }) {
  const entry = CATALOGUE_BY_ID[atlas.focusId]
  const system = atlas.systemId ? buildSystem(atlas.systemId) : null
  const open = (id) => selectObject(setAtlas, id)
  const setCatalogue = (tab) => setAtlas((current) => ({ ...current, catalogueOpen: tab }))

  useEffect(() => {
    setBadgeRules(BADGE_RULES)
    return onBadge((badge) => showToast(`${badge.kind} earned: ${badge.title}`))
  }, [showToast])

  return (
    <motion.div className="pointer-events-none absolute inset-0 z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.6 }}>
      <div
        ref={(node) => {
          view.current.labels = node
        }}
        aria-hidden="false"
        className="absolute inset-0 overflow-hidden"
      >
        {Array.from({ length: LABELS }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={(event) => open(event.currentTarget.dataset.id)}
            style={{ opacity: 0, pointerEvents: 'none' }}
            className="absolute left-0 top-0 whitespace-nowrap py-0.5 pr-1 text-[0.6875rem] font-light tracking-[0.04em] text-ink-dim transition-opacity duration-300 will-change-transform hover:text-ink data-[selected=true]:text-cyan"
          />
        ))}
      </div>

      <div className="pointer-events-auto absolute left-4 top-20 flex flex-wrap items-center gap-2 sm:left-6 sm:top-24 lg:left-10">
        <button type="button" onClick={system || entry ? () => returnToUniverse(setAtlas) : onExit} className="glass flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" aria-hidden="true"><path d="M10 3 5 8l5 5" {...stroke} /></svg>
          <span className="eyebrow text-ink-dim">{system || entry ? 'Universe' : 'Exit'}</span>
        </button>
        <button type="button" onClick={() => setCatalogue('catalogue')} aria-label="Search the universe" className="glass flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" aria-hidden="true"><circle cx="7" cy="7" r="4.5" {...stroke} /><path d="m10.5 10.5 3 3" {...stroke} /></svg>
          <span className="eyebrow text-ink-dim">Search</span>
        </button>
        <button type="button" onClick={() => setCatalogue('discovery')} aria-label="Open discoveries" className="glass flex h-[2.625rem] w-[2.625rem] items-center justify-center rounded-full text-ink-dim">
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><path d="m8 2 1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5z" {...stroke} /></svg>
        </button>
      </div>

      {system?.parent && (
        <button type="button" onClick={() => openSystem(setAtlas, system.parent, atlas.systemId.slice(6))} className="glass pointer-events-auto absolute left-4 top-[8.25rem] rounded-full px-4 py-2 text-[0.75rem] font-light text-ink-dim sm:left-6 sm:top-[8.75rem] lg:left-10">
          Back to {buildSystem(system.parent).title}
        </button>
      )}

      {!entry && !system && (
        <p className="readout absolute inset-x-0 bottom-8 hidden px-6 text-center leading-relaxed opacity-60 tall:block">
          Click a label to fly there&nbsp;&nbsp;·&nbsp;&nbsp;Drag to look around&nbsp;&nbsp;·&nbsp;&nbsp;Scroll to zoom
          <span className="mt-1.5 block opacity-70">Real sky directions, distances compressed logarithmically · the Sun at the centre · background stars are procedural</span>
        </p>
      )}
      {system && !system.cluster && (
        <p className="readout absolute bottom-3 left-4 hidden opacity-50 tall:block md:bottom-10 lg:left-10">
          {system.title} · sizes, orbits and speeds compressed, not to scale
        </p>
      )}

      <AnimatePresence>
        {entry && !atlas.catalogueOpen && (
          <ObjectPanel
            key={entry.id}
            entry={entry}
            systemId={atlas.systemId}
            onOpen={open}
            onOpenSystem={(systemId) => openSystem(setAtlas, systemId)}
            onExplore={onExplore}
            onClose={() => setAtlas((current) => ({ ...current, focusId: null }))}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {atlas.catalogueOpen && (
          <CataloguePanel key={atlas.catalogueOpen} initialTab={atlas.catalogueOpen} onOpen={open} onClose={() => setCatalogue(false)} reducedMotion={reducedMotion} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
