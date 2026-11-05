import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DIVE_STAGES, BLACK_HOLES_BY_ID } from '../../data/blackholes.js'
import { EvidenceTag } from './BlackHoleHud.jsx'
import { useTelemetry } from '../../hooks/useTelemetry.js'
import {
  clockRate,
  fallSpeed,
  formatAcceleration,
  formatSeconds,
  properTimeToSingularity,
  tidalAcceleration,
} from '../../lib/relativity.js'

const stroke = { stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

function stageAt(progress) {
  let index = 0
  DIVE_STAGES.forEach((stage, i) => {
    if (progress >= stage.at) index = i
  })
  return index
}

/**
 * The guided descent. Everything is live from the fall itself, and the
 * labelling changes at the horizon: above it the view is a calculation, below
 * it an artistic impression, and the interface says so in plain words.
 */
export default function DiveHud({ dive, holeId, onReturn, reducedMotion }) {
  const hole = BLACK_HOLES_BY_ID[holeId]
  const live = useTelemetry(dive, true, 100)
  const [, force] = useState(0)
  const progress = live.progress ?? 0
  const r = live.r ?? 30
  const index = stageAt(progress)
  const stage = DIVE_STAGES[index]
  const inside = r < 1
  const ended = progress >= 1

  const setProgress = (value) => {
    dive.current.progress = value
    force((n) => n + 1)
  }
  const togglePlay = () => {
    if (dive.current.progress >= 1) return
    dive.current.playing = !dive.current.playing
    force((n) => n + 1)
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === ' ' && event.target === document.body) {
        event.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // togglePlay only touches refs and a counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const readings = [
    { label: 'Radius', value: `${r.toFixed(r < 10 ? 3 : 1)} r` },
    { label: 'Your time left', value: formatSeconds(properTimeToSingularity(hole.massSuns, r)) },
    inside
      ? { label: 'Static clocks', value: 'None can exist here' }
      : { label: 'Static clock rate', value: `${(clockRate(r) * 100).toFixed(1)}%` },
    inside
      ? { label: 'Fall speed', value: 'Undefined inside' }
      : { label: 'Fall speed', value: `${(fallSpeed(r) * 100).toFixed(1)}% of light` },
    { label: 'Tide on a body', value: r < 0.01 ? 'Diverges' : formatAcceleration(tidalAcceleration(hole.massSuns, r)) },
  ]

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.6 }}
    >
      <div className="pointer-events-auto absolute left-4 top-20 sm:left-6 sm:top-24 lg:left-10">
        <button
          type="button"
          onClick={onReturn}
          className="glass flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" aria-hidden="true">
            <path d="M10 3 5 8l5 5" {...stroke} />
          </svg>
          <span className="eyebrow text-ink-dim">Return to exterior</span>
        </button>
      </div>

      <div className="absolute left-4 top-[8rem] max-w-[70%] sm:left-auto sm:right-6 sm:top-24 sm:text-right lg:right-10" role="status">
        <p className={`readout ${inside ? 'text-[#ff9ab8]' : 'text-cyan/80'}`}>
          {inside ? 'Hypothetical visualization' : 'Ray-traced simulation'}
        </p>
        <p className="readout mt-1 opacity-60">{hole.name}{inside ? ' · not observed, not calculated' : ' · playback not real time'}</p>
      </div>

      <div className="glass pointer-events-auto absolute inset-x-3 bottom-3 max-h-[52vh] overflow-y-auto rounded-3xl bg-[#070a17]/80 px-5 py-4 sm:px-6 md:inset-x-auto md:bottom-10 md:left-1/2 md:w-[min(46rem,calc(100vw-3rem))] md:-translate-x-1/2 short:max-h-[62vh] short:py-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-light tracking-[-0.01em] text-ink short:text-base">{stage.label}</h2>
          <EvidenceTag kind={stage.evidence} />
        </div>
        <p className="mt-1.5 text-[0.8125rem] font-light leading-relaxed text-ink-dim short:text-[0.75rem]">{stage.caption}</p>

        {ended && (
          <p className="mt-2 text-[0.8125rem] font-light leading-relaxed text-ink">
            A real observer could not come back from here: this return exists only because this is a simulation.
          </p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5 short:hidden">
          {readings.map((reading) => (
            <div key={reading.label}>
              <dt className="readout opacity-60">{reading.label}</dt>
              <dd className="mt-0.5 font-mono text-[0.75rem] tabular-nums text-ink">{reading.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={ended}
            aria-label={live.playing ? 'Pause descent' : 'Play descent'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-ink disabled:opacity-30"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              {live.playing ? <path d="M5.5 3.5v9M10.5 3.5v9" {...stroke} /> : <path d="M5 3.2 12.5 8 5 12.8z" {...stroke} />}
            </svg>
          </button>
          <div className="relative min-w-0 flex-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
              aria-label="Position along the descent"
              aria-valuetext={`${stage.label}, ${r.toFixed(2)} Schwarzschild radii`}
              className="w-full accent-[#ffb37a]"
            />
          </div>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DIVE_STAGES.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setProgress(entry.at + 0.0005)}
              aria-current={i === index ? 'step' : undefined}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.75rem] font-light ${
                i === index ? 'border-cyan/50 text-ink' : 'border-white/10 text-ink-dim'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
