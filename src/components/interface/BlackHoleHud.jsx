import { useEffect, useMemo, useRef, useState } from 'react'
import ExplorerHud from './ExplorerHud.jsx'
import {
  BLACK_HOLE_MISSIONS,
  BLACK_HOLE_SCALE_NOTE,
  BLACK_HOLE_TOPICS,
  BLACK_HOLES,
  BLACK_HOLES_BY_ID,
  EVIDENCE,
} from '../../data/blackholes.js'
import {
  clockRate,
  evaporationYears,
  formatAcceleration,
  formatDistanceKm,
  formatKelvin,
  formatSeconds,
  formatYears,
  hawkingTemperature,
  lightCrossingSeconds,
  properTimeToSingularity,
  schwarzschildRadiusKm,
  tidalAcceleration,
  tidalRadiusX,
} from '../../lib/relativity.js'
import { useTelemetry } from '../../hooks/useTelemetry.js'

export function EvidenceTag({ kind }) {
  const evidence = EVIDENCE[kind]
  return <span className={`readout shrink-0 ${evidence.tone}`}>{evidence.label}</span>
}

/** Live distance, clock and tide readings for wherever the camera is. */
export function ProximityGauge({ telemetry, hole, className = '' }) {
  const t = useTelemetry(telemetry)
  const r = t.r ?? 30
  const radiusKm = schwarzschildRadiusKm(hole.massSuns)
  const rate = clockRate(r)

  // Two clocks, run from real time, so the gap between them can be watched.
  const [clocks, setClocks] = useState({ you: 0, distant: 0 })
  const rateRef = useRef(rate)
  useEffect(() => {
    rateRef.current = rate
  }, [rate])
  useEffect(() => {
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.min((now - last) / 1000, 0.5)
      last = now
      setClocks((c) => ({ you: c.you + elapsed * rateRef.current, distant: c.distant + elapsed }))
    }, 200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className={`glass pointer-events-none rounded-2xl bg-[#070a17]/70 px-4 py-2.5 ${className}`}
      role="status"
      aria-label={`${r.toFixed(2)} Schwarzschild radii from the centre`}
    >
      <dl className="flex items-baseline gap-x-5 gap-y-1">
        <div>
          <dt className="readout opacity-60">Distance</dt>
          <dd className="mt-0.5 font-mono text-[0.8125rem] tabular-nums text-ink">{r.toFixed(2)} r<sub>s</sub></dd>
        </div>
        <div className="hidden sm:block">
          <dt className="readout opacity-60">Actual</dt>
          <dd className="mt-0.5 font-mono text-[0.8125rem] tabular-nums text-ink-dim">{formatDistanceKm(r * radiusKm)}</dd>
        </div>
        <div>
          <dt className="readout opacity-60">Clock rate</dt>
          <dd className="mt-0.5 font-mono text-[0.8125rem] tabular-nums text-ink">{(rate * 100).toFixed(1)}%</dd>
        </div>
        <div className="hidden lg:block">
          <dt className="readout opacity-60">You / distant</dt>
          <dd className="mt-0.5 font-mono text-[0.8125rem] tabular-nums text-ink-dim">
            {clocks.you.toFixed(1)}s / {clocks.distant.toFixed(1)}s
          </dd>
        </div>
        <div>
          <dt className="readout opacity-60">Tide on a body</dt>
          <dd className="mt-0.5 font-mono text-[0.8125rem] tabular-nums text-ink">{formatAcceleration(tidalAcceleration(hole.massSuns, r))}</dd>
        </div>
      </dl>
    </div>
  )
}

function ScienceTab({ hole }) {
  const [open, setOpen] = useState('schwarzschild')
  const figures = useMemo(() => {
    const m = hole.massSuns
    const shredded = tidalRadiusX(m)
    return [
      { label: 'Schwarzschild radius', value: formatDistanceKm(schwarzschildRadiusKm(m)) },
      { label: 'Light crossing time', value: formatSeconds(lightCrossingSeconds(m)) },
      { label: 'Tide at the horizon, 2 m body', value: formatAcceleration(tidalAcceleration(m, 1)) },
      {
        label: 'Lethal tides begin',
        value: shredded > 1 ? `Outside the horizon, at ${formatDistanceKm(shredded * schwarzschildRadiusKm(m))}` : 'Only well inside the horizon',
      },
      { label: 'Horizon to singularity', value: `About ${formatSeconds(properTimeToSingularity(m, 1))} of your time` },
      { label: 'Hawking temperature', value: formatKelvin(hawkingTemperature(m)) },
      { label: 'Evaporation time', value: formatYears(evaporationYears(m)) },
    ]
  }, [hole])

  return (
    <div>
      <p className="readout mt-1 opacity-60">Calculated for {hole.name}</p>
      <dl className="mt-3 space-y-3">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt className="readout opacity-60">{figure.label}</dt>
            <dd className="mt-1 text-[0.8125rem] leading-snug text-ink">{figure.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[0.6875rem] font-light leading-relaxed text-muted">
        Derived from the mass above with the Schwarzschild solution, assuming no spin. Hawking figures are theoretical: the effect has not been detected.
      </p>

      <div className="hairline my-5 h-px w-full opacity-60" />
      <ul className="space-y-1">
        {BLACK_HOLE_TOPICS.map((topic) => {
          const expanded = open === topic.id
          return (
            <li key={topic.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : topic.id)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 py-2 text-left"
              >
                <span className={`text-[0.875rem] font-light ${expanded ? 'text-ink' : 'text-ink-dim'}`}>{topic.title}</span>
                <EvidenceTag kind={topic.evidence} />
              </button>
              {expanded && <p className="pb-3 text-[0.8125rem] font-light leading-relaxed text-ink-dim">{topic.body}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MissionsTab({ missions }) {
  const { completed, progress, reset } = missions
  return (
    <div>
      <p className="mt-1 text-[0.8125rem] font-light leading-relaxed text-ink-dim">
        {completed.length} of {BLACK_HOLE_MISSIONS.length} complete. Missions track where you take the camera, in any black hole.
      </p>
      <ul className="mt-4 space-y-4">
        {BLACK_HOLE_MISSIONS.map((mission, index) => {
          const done = completed.includes(mission.id)
          const value = done ? 1 : (progress[mission.id] ?? 0)
          return (
            <li key={mission.id} data-mission={mission.id} data-complete={done}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[0.875rem] font-normal text-ink">
                  <span className="mr-2 font-mono text-[0.6875rem] text-muted">{String(index + 1).padStart(2, '0')}</span>
                  {mission.title}
                </h3>
                <span className={`readout shrink-0 ${done ? 'text-cyan' : 'opacity-50'}`}>{done ? 'Complete' : `${Math.round(value * 100)}%`}</span>
              </div>
              <div className="mt-2 h-px w-full bg-white/10">
                <div className="h-px bg-cyan/80" style={{ width: `${value * 100}%` }} />
              </div>
              <p className="mt-2 text-[0.8125rem] font-light leading-relaxed text-ink-dim">{mission.objective}</p>
              <p className="mt-1 text-[0.75rem] font-light leading-relaxed text-muted">{done ? mission.learned : mission.how}</p>
            </li>
          )
        })}
      </ul>
      {completed.length > 0 && (
        <button type="button" onClick={reset} className="readout mt-5 underline-offset-4 hover:underline">
          Reset missions
        </button>
      )}
    </div>
  )
}

const stroke = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

/**
 * Exploring a black hole: the shared explorer overlay, with Science and
 * Missions tabs, a live gauge, and the way into the guided descent.
 */
export default function BlackHoleHud({
  selectedId,
  onSelect,
  onExit,
  onFly,
  onDive,
  overlay,
  onOverlayChange,
  panelOpen,
  onPanelOpenChange,
  telemetry,
  missions,
  reducedMotion,
}) {
  const hole = BLACK_HOLES_BY_ID[selectedId]

  return (
    <ExplorerHud
      title="Black Holes"
      items={BLACK_HOLES}
      selectedId={selectedId}
      onSelect={onSelect}
      onExit={onExit}
      onFly={onFly}
      scaleNote={BLACK_HOLE_SCALE_NOTE}
      panelOpen={panelOpen}
      onPanelOpenChange={onPanelOpenChange}
      reducedMotion={reducedMotion}
      badge={<EvidenceTag kind={hole.evidence} />}
      tabs={[
        { id: 'science', label: 'Science', content: <ScienceTab hole={hole} /> },
        { id: 'missions', label: 'Missions', content: <MissionsTab missions={missions} /> },
      ]}
      actions={
        onDive && (
        <>
          <button
            type="button"
            onClick={onDive}
            className="group flex items-center gap-2.5 rounded-full border border-[#ffb37a]/40 bg-[#ff8a3d]/10 py-2.5 pl-4 pr-5 backdrop-blur-xl transition-colors duration-300 hover:border-[#ffb37a]/70"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#ffb37a]" aria-hidden="true">
              <circle cx="8" cy="8" r="2.4" {...stroke} />
              <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5M8 14.5A6.5 6.5 0 0 1 1.5 8" {...stroke} />
            </svg>
            <span className="eyebrow text-ink">Enter</span>
          </button>
          <button
            type="button"
            onClick={() => onOverlayChange(!overlay)}
            aria-pressed={overlay}
            aria-label="Show event horizon and photon ring boundaries"
            title="Show event horizon and photon ring boundaries"
            className={`glass flex h-[2.625rem] w-[2.625rem] items-center justify-center rounded-full ${overlay ? 'border-cyan/50 text-cyan' : 'text-ink-dim'}`}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <circle cx="8" cy="8" r="6" {...stroke} strokeDasharray="1.6 1.8" />
              <circle cx="8" cy="8" r="2.6" {...stroke} />
            </svg>
          </button>
        </>
        )
      }
    >
      {onDive && (
        <ProximityGauge
          telemetry={telemetry}
          hole={hole}
          className="absolute left-4 top-[8.25rem] sm:left-6 sm:top-[8.75rem] tall:left-1/2 tall:top-auto tall:bottom-24 tall:-translate-x-1/2"
        />
      )}
      {overlay && (
        <p className="readout absolute bottom-[7.5rem] left-4 max-w-[15rem] leading-relaxed text-ink-dim tall:hidden">
          <span className="text-cyan">Cyan</span>: shadow edge and horizon. <span className="text-[#ffb37a]">Amber</span>: innermost stable orbit.
        </p>
      )}
    </ExplorerHud>
  )
}
