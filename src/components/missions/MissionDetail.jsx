import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import MissionArt from './MissionArt.jsx'
import { AGENCIES, MISSION_TYPES, STATUS_LABELS } from '../../data/missions.js'

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
}

const STATUS_STYLE = {
  active: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  completed: 'border-cyan/35 bg-cyan/10 text-cyan',
  ended: 'border-white/15 bg-white/5 text-ink-dim',
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h3 className="readout !text-ink-dim/80">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-[0.8125rem] font-light text-ink-dim transition-colors hover:border-white/20 hover:text-ink"
    >
      <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden="true">
        <path d="M6.5 3.5H3.5v9h9v-3M9 3h4v4M13 3 7.5 8.5" {...stroke} />
      </svg>
      <span className="min-w-0 flex-1">
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </span>
    </a>
  )
}

/**
 * Mission detail dialog: a side sheet on wide screens, a full-height sheet
 * on phones. Focus is trapped inside while it is open and Escape closes it;
 * the explorer returns focus to the card that opened it.
 */
export default function MissionDetail({ mission, position, total, onPrev, onNext, onClose, reducedMotion }) {
  const dialogRef = useRef(null)
  const scrollRef = useRef(null)
  const agency = AGENCIES[mission.agency]

  // Focus the dialog on open, and back to the top for each mission.
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [mission.id])

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      // Handled here: the app-level Escape would otherwise leave the scene.
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const target = event.target
      if (target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      event.stopPropagation()
      ;(event.key === 'ArrowRight' ? onNext : onPrev)()
      return
    }
    if (event.key !== 'Tab') return
    const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null)
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const transition = { duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }
  const partners = mission.partners.length ? mission.partners.join(', ') : null

  return (
    <motion.div className="absolute inset-0 z-[40]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.3 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-void/70 backdrop-blur-[2px]" />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-detail-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="absolute inset-0 flex flex-col overflow-hidden bg-[#060914] focus:outline-none sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[min(620px,calc(100%-24px))] sm:rounded-3xl sm:border sm:border-white/[0.08] lg:inset-y-4 lg:right-4"
        initial={{ x: reducedMotion ? 0 : 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: reducedMotion ? 0 : 40, opacity: 0 }}
        transition={transition}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          <div className="relative aspect-[5/3] max-h-[42svh] w-full overflow-hidden sm:max-h-none">
            <MissionArt key={mission.id} mission={mission} className="h-full w-full" decorative={false} />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#060914] via-[#060914]/60 to-transparent" aria-hidden="true" />
            <p className="readout absolute left-4 top-5 rounded-full bg-black/45 px-2.5 py-1 !text-[0.5625rem]">Illustration</p>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-ink-dim backdrop-blur-md transition-colors hover:border-white/30 hover:text-ink"
              aria-label="Close mission details"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" {...stroke} />
              </svg>
            </button>
          </div>

          <motion.div key={mission.id} className="-mt-16 px-6 pb-10 sm:px-8" initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
            <p className="readout relative flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-cyan/85">{agency.name}</span>
              <span aria-hidden="true">·</span>
              <span>{mission.types.map((type) => MISSION_TYPES[type]).join(' · ')}</span>
            </p>
            <h2 id="mission-detail-title" className="relative mt-2 text-[clamp(1.9rem,5vw,2.6rem)] font-light leading-[1.05] tracking-[-0.025em] text-ink">
              {mission.fullName ?? mission.name}
            </h2>
            <p className="mt-2 text-[0.95rem] font-light text-ink-dim">{mission.tagline}</p>

            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06]">
              {[
                ['Agency', `${agency.name}${partners ? ` · with ${partners}` : ''}`],
                ['Launch', mission.launch.label],
                ['Destination', mission.target],
                ['Status', STATUS_LABELS[mission.status]],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#060914] px-4 py-3.5">
                  <dt className="readout">{label}</dt>
                  <dd className="mt-1.5 text-[0.875rem] font-light leading-snug text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className={`mt-4 rounded-2xl border px-4 py-3.5 ${STATUS_STYLE[mission.status]}`}>
              <p className="readout !text-current opacity-80">Status · as of {mission.statusAsOf}</p>
              <p className="mt-1.5 text-[0.875rem] font-light leading-relaxed text-ink">{mission.statusText}</p>
            </div>

            <Section title="Objective">
              <p className="text-[0.9375rem] font-light leading-relaxed text-ink-dim">{mission.objective}</p>
            </Section>

            <Section title="Spacecraft">
              <dl className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07]">
                {mission.spacecraft.map((row) => (
                  <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
                    <dt className="readout pt-0.5">{row.label}</dt>
                    <dd className="text-[0.875rem] font-light leading-snug text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title="Key discoveries & achievements">
              <ul className="space-y-3">
                {mission.discoveries.map((item) => (
                  <li key={item} className="flex gap-3 text-[0.9rem] font-light leading-relaxed text-ink-dim">
                    <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: mission.accent }} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Timeline">
              <ol className="relative ml-1.5 border-l border-white/10">
                {mission.timeline.map((entry) => (
                  <li key={`${entry.date}-${entry.event}`} className="relative pb-5 pl-6 last:pb-0">
                    <span
                      className={`absolute -left-[5px] top-[0.35rem] h-[9px] w-[9px] rounded-full ring-4 ring-[#060914] ${entry.planned ? 'border border-dashed border-ink-dim bg-transparent' : ''}`}
                      style={entry.planned ? undefined : { backgroundColor: mission.accent }}
                      aria-hidden="true"
                    />
                    <p className="font-mono text-[0.6875rem] tabular-nums tracking-[0.08em] text-muted">
                      {entry.label}
                      {entry.planned && <span className="ml-2 rounded-full border border-white/15 px-1.5 py-px text-[0.5625rem] uppercase tracking-[0.14em] text-ink-dim">Planned</span>}
                    </p>
                    <p className="mt-1 text-[0.875rem] font-light leading-snug text-ink">{entry.event}</p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="Images & official sources">
              <div className="space-y-2">
                <ExternalLink href={mission.gallery.url}>
                  <span className="text-ink">Photos and media</span>
                  <span className="block text-[0.75rem] text-muted">{mission.gallery.label}</span>
                </ExternalLink>
                {mission.sources.map((source) => (
                  <ExternalLink key={source.url} href={source.url}>
                    {source.label}
                  </ExternalLink>
                ))}
              </div>
              <p className="mt-4 text-[0.75rem] font-light leading-relaxed text-muted">
                The artwork above is an original illustration, not a photograph. Facts were checked against the agency pages listed here.
              </p>
            </Section>
          </motion.div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.07] bg-[#060914] px-4 py-3 sm:px-6">
          <button type="button" onClick={onPrev} className="flex items-center gap-2 rounded-full px-3 py-2 text-ink-dim transition-colors hover:text-ink" aria-label="Previous mission">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 rotate-180 text-cyan" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" {...stroke} />
            </svg>
            <span className="eyebrow !tracking-[0.2em]">Prev</span>
          </button>
          <p className="readout flex-1 text-center tabular-nums" aria-live="polite">
            {String(position + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>
          <button type="button" onClick={onNext} className="flex items-center gap-2 rounded-full px-3 py-2 text-ink-dim transition-colors hover:text-ink" aria-label="Next mission">
            <span className="eyebrow !tracking-[0.2em]">Next</span>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" {...stroke} />
            </svg>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
