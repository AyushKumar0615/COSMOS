import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
}

function InfoPanel({ item, index, total, onClose, onPrev, onNext, prev, next, reducedMotion, tabs = [], badge = null }) {
  const [tab, setTab] = useState('overview')
  const active = tabs.find((entry) => entry.id === tab)
  const transition = { duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }
  return (
    <motion.aside
      aria-labelledby="explorer-panel-title"
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
              <span className="shrink-0 whitespace-nowrap tabular-nums text-ink-dim/70">
                {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              <span className="truncate">{item.category}</span>
            </p>
            <motion.h2
              key={item.id}
              id="explorer-panel-title"
              className="mt-2.5 text-3xl font-light tracking-[-0.02em] text-ink"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              {item.fullName ?? item.name}
            </motion.h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 transition-colors duration-300 hover:border-white/25"
            aria-label="Hide information"
            title="Hide information"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-dim" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" {...stroke} />
            </svg>
          </button>
        </div>

        {tabs.length > 0 && (
          <div role="tablist" aria-label={`About ${item.name}`} className="mt-4 flex items-center gap-1 border-b border-white/[0.07]">
            {[{ id: 'overview', label: 'Overview' }, ...tabs].map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={`-mb-px border-b px-2.5 py-2 text-[0.8125rem] font-light transition-colors ${
                  tab === entry.id ? 'border-cyan/70 text-ink' : 'border-transparent text-ink-dim hover:text-ink'
                }`}
              >
                {entry.label}
              </button>
            ))}
            {badge && <span className="ml-auto pl-2">{badge}</span>}
          </div>
        )}

        {active ? (
          <div className="mt-4">{active.content}</div>
        ) : (
        <motion.div
          key={`${item.id}-body`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...transition, delay: reducedMotion ? 0 : 0.08 }}
        >
          <p className="mt-4 text-[0.875rem] font-light leading-relaxed text-ink-dim">{item.description}</p>
          <div className="hairline my-5 h-px w-full opacity-60" />
          <dl className="space-y-4">
            {item.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="readout opacity-60">{fact.label}</dt>
                <dd className="mt-1.5 text-[0.875rem] leading-snug text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
          {item.note && (
            <p className="mt-5 text-[0.6875rem] font-light leading-relaxed text-muted">{item.note}</p>
          )}
          {item.sources?.length > 0 && (
            <div className="mt-4">
              <p className="readout opacity-60">Sources</p>
              <ul className="mt-1.5 space-y-1">
                {item.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="text-[0.75rem] font-light text-ink-dim underline decoration-white/20 underline-offset-2 hover:text-ink">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
        )}
      </div>
      {/* Signals that the panel keeps going past the fold. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#070a17]/85 to-transparent" />
      </div>

      <div className="flex items-center gap-4 border-t border-white/[0.07] px-6 py-3.5 sm:px-7">
        <button type="button" onClick={onPrev} className="group flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left" aria-label={`Previous: ${prev.name}`}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 rotate-180 text-cyan" aria-hidden="true">
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" {...stroke} />
          </svg>
          <span className="min-w-0">
            <span className="readout block opacity-50">Previous</span>
            <span className="block truncate text-[0.8125rem] font-light text-ink-dim group-hover:text-ink">{prev.name}</span>
          </span>
        </button>
        <span className="h-6 w-px bg-white/10" aria-hidden="true" />
        <button type="button" onClick={onNext} className="group flex min-w-0 flex-1 items-center justify-end gap-2.5 py-1 text-right" aria-label={`Next: ${next.name}`}>
          <span className="min-w-0">
            <span className="readout block opacity-50">Next</span>
            <span className="block truncate text-[0.8125rem] font-light text-ink-dim group-hover:text-ink">{next.name}</span>
          </span>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden="true">
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" {...stroke} />
          </svg>
        </button>
      </div>
    </motion.aside>
  )
}

/**
 * Shared overlay for the galaxy and nebula explorers: exit, a selector, an
 * information panel and an interaction hint. On touch layouts the panel
 * starts closed so the 3D scene gets the screen, and opens from a button.
 */
export default function ExplorerHud({
  title,
  items,
  selectedId,
  onSelect,
  onExit,
  onFly,
  scaleNote,
  panelOpen,
  onPanelOpenChange,
  reducedMotion,
  tabs,
  badge,
  actions = null,
  docked = false,
  children = null,
}) {
  const setPanelOpen = onPanelOpenChange
  const index = Math.max(0, items.findIndex((item) => item.id === selectedId))
  const item = items[index]
  const prev = items[(index - 1 + items.length) % items.length]
  const next = items[(index + 1) % items.length]

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.6 }}
    >
      <div className="pointer-events-auto absolute left-4 top-20 flex gap-2 sm:left-6 sm:top-24 lg:left-10">
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
        {onFly && (
          <button
            type="button"
            onClick={onFly}
            className={`group glass flex items-center gap-2.5 rounded-full py-2.5 transition-colors duration-300 hover:border-white/20 ${
              actions ? 'px-3.5 sm:pl-4 sm:pr-5' : 'pl-4 pr-5'
            }`}
            aria-label={`Fly freely around ${item.name}`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" aria-hidden="true">
              <path d="M2.5 9.5 13.5 3l-3.2 10.5-2.6-4.2z" {...stroke} />
            </svg>
            <span className={`eyebrow text-ink-dim transition-colors group-hover:text-ink ${actions ? 'hidden sm:inline' : ''}`}>Fly</span>
          </button>
        )}
        {actions}
      </div>

      {/* Desktop selector rail */}
      <nav aria-label={title} className="pointer-events-auto absolute left-6 top-1/2 hidden -translate-y-1/2 tall:block lg:left-10">
        <p className="readout mb-4 pl-5 opacity-50">{title}</p>
        <ul className="relative max-h-[calc(100vh-22rem)] space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span aria-hidden="true" className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-white/0 via-white/12 to-white/0" />
          {items.map((entry) => {
            const active = entry.id === selectedId
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  aria-current={active ? 'true' : undefined}
                  className="group relative flex items-center gap-3.5 py-1.5 pr-3"
                >
                  <span
                    className={`relative z-10 h-[11px] w-[11px] rounded-full ring-1 transition-all duration-300 ${
                      active ? 'ring-cyan/90 ring-offset-2 ring-offset-void' : 'ring-white/15'
                    }`}
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className={`eyebrow transition-colors duration-300 ${active ? 'text-ink' : 'text-muted group-hover:text-ink-dim'}`}>
                    {entry.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Mobile chips */}
      {/* Hidden under an open sheet: its glass would show the chips through. */}
      <nav
        aria-label={title}
        // inert, not aria-hidden: it also takes the hidden chips out of the
        // tab order.
        inert={panelOpen}
        className={`absolute inset-x-0 bottom-5 transition-opacity duration-300 tall:hidden ${
          panelOpen ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
        }`}
      >
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((entry) => {
            const active = entry.id === selectedId
            return (
              <li key={entry.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`glass flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3.5 ${active ? 'border-cyan/50' : ''}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className={`text-[0.8125rem] font-light ${active ? 'text-ink' : 'text-ink-dim'}`}>{entry.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <AnimatePresence>
        {panelOpen ? (
          <InfoPanel
            key="panel"
            item={item}
            index={index}
            total={items.length}
            prev={prev}
            next={next}
            onPrev={() => onSelect(prev.id)}
            onNext={() => onSelect(next.id)}
            onClose={() => setPanelOpen(false)}
            reducedMotion={reducedMotion}
            tabs={tabs}
            badge={badge}
          />
        ) : (
          <motion.button
            key="open"
            type="button"
            onClick={() => setPanelOpen(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // With a control dock along the bottom, the button moves up out of its way.
            className={`glass pointer-events-auto absolute right-4 flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5 md:bottom-auto md:right-6 md:top-24 lg:right-10 ${
              docked ? 'top-20 sm:top-24' : 'bottom-20'
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" aria-hidden="true">
              <circle cx="8" cy="8" r="6" {...stroke} />
              <path d="M8 7.2v4M8 4.8v.01" {...stroke} />
            </svg>
            <span className="eyebrow text-ink-dim">About {item.name}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* The hint centres on the part of the scene the viewer can actually
          see: with the panel open it keeps to the left of it, rather than
          running underneath. */}
      <p
        className={`readout absolute bottom-10 left-0 hidden px-6 text-center leading-relaxed opacity-60 tall:block ${
          panelOpen ? 'right-[400px] lg:right-[420px]' : 'right-0'
        }`}
      >
        Drag to orbit&nbsp;&nbsp;·&nbsp;&nbsp;Right-drag to pan&nbsp;&nbsp;·&nbsp;&nbsp;Scroll to zoom
        <span className="mt-1.5 block opacity-70">{scaleNote}</span>
      </p>

      {children}
    </motion.div>
  )
}
