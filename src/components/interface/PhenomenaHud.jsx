import { useState } from 'react'
import ExplorerHud from './ExplorerHud.jsx'
import { EvidenceTag } from './BlackHoleHud.jsx'
import { LIFE_PATHS, MASS_TYPES, PHENOMENA, PHENOMENA_BY_ID, PHENOMENA_SCALE_NOTE, SCALE_STOPS, SUPERNOVA_STAGES } from '../../data/phenomena.js'
import { useTelemetry } from '../../hooks/useTelemetry.js'

const stroke = { stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.75rem] font-light ${active ? 'border-cyan/50 text-ink' : 'border-white/10 text-ink-dim'}`}
    >
      {children}
    </button>
  )
}

function Dock({ children, panelOpen }) {
  return (
    <div
      className={`glass pointer-events-auto absolute inset-x-3 rounded-3xl bg-[#070a17]/80 px-5 py-3.5 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 ${
        panelOpen ? 'bottom-[calc(58vh+1rem)] md:bottom-20 md:left-[calc(50%-200px)] md:w-[min(32rem,calc(100vw-30rem))]' : 'bottom-[4.5rem] md:bottom-20 md:w-[min(38rem,calc(100vw-3rem))]'
      } short:bottom-16 short:py-2`}
    >
      {children}
    </div>
  )
}

function stageAt(stages, value, key) {
  let found = stages[0]
  for (const stage of stages) if (value >= stage[key]) found = stage
  return found
}

function SupernovaControls({ control, panelOpen, reducedMotion }) {
  const live = useTelemetry(control, true, 100)
  const [, force] = useState(0)
  const stage = stageAt(SUPERNOVA_STAGES, live.t, 'at')
  const set = (value) => {
    control.current.t = value
    force((n) => n + 1)
  }
  const toggle = () => {
    const c = control.current
    if (c.t >= 1) c.t = 0
    c.playing = !c.playing
    force((n) => n + 1)
  }
  return (
    <Dock panelOpen={panelOpen}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.9375rem] font-normal text-ink">{stage.label}</h3>
        <EvidenceTag kind="model" />
      </div>
      <p className="mt-1 text-[0.8125rem] font-light leading-relaxed text-ink-dim short:hidden">{stage.caption}</p>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={toggle} aria-label={live.playing ? 'Pause simulation' : 'Play simulation'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-ink">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            {live.playing ? <path d="M5.5 3.5v9M10.5 3.5v9" {...stroke} /> : <path d="M5 3.2 12.5 8 5 12.8z" {...stroke} />}
          </svg>
        </button>
        <input type="range" min="0" max="1" step="0.001" value={live.t} onChange={(event) => set(Number(event.target.value))} aria-label="Supernova timeline" className="min-w-0 flex-1 accent-[#ff8a3d]" />
      </div>
      {reducedMotion && <p className="mt-1 text-[0.6875rem] font-light text-muted">Reduced motion: drag the timeline to step through.</p>}
    </Dock>
  )
}

function PulsarControls({ control, panelOpen }) {
  const [speed, setSpeed] = useState(control.current.speed)
  return (
    <Dock panelOpen={panelOpen}>
      <label className="flex items-center gap-3">
        <span className="readout shrink-0 opacity-70">Rotation</span>
        <input
          type="range"
          min="0"
          max="6"
          step="0.05"
          value={speed}
          onChange={(event) => {
            const value = Number(event.target.value)
            control.current.speed = value
            setSpeed(value)
          }}
          className="min-w-0 flex-1 accent-cyan"
        />
        <span className="w-24 shrink-0 text-right font-mono text-[0.75rem] tabular-nums text-ink-dim">{(speed / (Math.PI * 2)).toFixed(2)} turns/s</span>
      </label>
      <p className="mt-1 text-[0.75rem] font-light text-muted short:hidden">The Crab pulsar turns about 30 times a second, far faster than this slider.</p>
    </Dock>
  )
}

function WormholeControls({ control, panelOpen }) {
  const live = useTelemetry(control, true, 150)
  return (
    <Dock panelOpen={panelOpen}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <EvidenceTag kind="theory" />
          <p className="mt-0.5 text-[0.8125rem] font-light text-ink-dim">{live.side > 0 ? 'Near side: our universe, in this model.' : 'Far side: an invented universe with a grid.'}</p>
        </div>
        <button
          type="button"
          disabled={live.travelling}
          onClick={() => {
            control.current.travelling = true
            control.current.progress = 0
          }}
          className="shrink-0 rounded-full border border-[#b9a3ff]/50 px-4 py-2 text-[0.8125rem] font-light text-ink disabled:opacity-40"
        >
          {live.travelling ? 'Travelling' : 'Go through'}
        </button>
      </div>
    </Dock>
  )
}

function SpacetimeControls({ control, panelOpen }) {
  const live = useTelemetry(control, true, 150)
  const [, force] = useState(0)
  return (
    <Dock panelOpen={panelOpen}>
      <p className="text-[0.8125rem] font-light text-ink-dim">Choose a mass, then click the grid to place it.</p>
      <div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Object.entries(MASS_TYPES).map(([id, type]) => (
          <Chip
            key={id}
            active={live.place === id}
            onClick={() => {
              control.current.place = id
              force((n) => n + 1)
            }}
          >
            {type.label}
          </Chip>
        ))}
        <button
          type="button"
          onClick={() => {
            control.current.masses.length = 0
            force((n) => n + 1)
          }}
          className="ml-auto shrink-0 px-2 text-[0.75rem] font-light text-muted underline underline-offset-4"
        >
          Clear
        </button>
      </div>
    </Dock>
  )
}

function formatSpan(log) {
  const metres = Math.pow(10, log)
  const lightYears = metres / 9.4607e15
  if (lightYears >= 1e9) return `${(lightYears / 1e9).toPrecision(3)} billion light-years`
  if (lightYears >= 1e6) return `${(lightYears / 1e6).toPrecision(3)} million light-years`
  if (lightYears >= 0.5) return `${Number(lightYears.toPrecision(3)).toLocaleString('en-GB')} light-years`
  const au = metres / 1.495979e11
  if (au >= 0.5) return `${Number(au.toPrecision(3)).toLocaleString('en-GB')} AU`
  return `${Number((metres / 1000).toPrecision(3)).toLocaleString('en-GB')} km`
}

function ScaleControls({ control, panelOpen }) {
  const [log, setLog] = useState(control.current.log)
  const stop = stageAt(SCALE_STOPS, log + 0.3, 'log')
  const set = (value) => {
    control.current.log = value
    setLog(value)
  }
  return (
    <Dock panelOpen={panelOpen}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.9375rem] font-normal text-ink">{stop.label}</h3>
        <span className="font-mono text-[0.75rem] tabular-nums text-ink-dim">{formatSpan(log)} across</span>
      </div>
      <p className="mt-0.5 text-[0.8125rem] font-light leading-relaxed text-ink-dim short:hidden">{stop.detail}</p>
      <input type="range" min="7" max="26.9" step="0.01" value={log} onChange={(event) => set(Number(event.target.value))} aria-label="Scale of the view" className="mt-2 w-full accent-[#ffd28a]" />
      <div className="mt-1.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SCALE_STOPS.map((entry) => (
          <Chip key={entry.label} active={stop.label === entry.label} onClick={() => set(entry.log)}>
            {entry.label}
          </Chip>
        ))}
      </div>
    </Dock>
  )
}

function LifeCycleControls({ control, panelOpen }) {
  const [state, setState] = useState({ path: control.current.path, stage: control.current.stage })
  const path = LIFE_PATHS[state.path]
  const stage = path.stages[state.stage]
  const set = (next) => {
    Object.assign(control.current, next)
    setState({ path: control.current.path, stage: control.current.stage })
  }
  return (
    <Dock panelOpen={panelOpen}>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Object.entries(LIFE_PATHS).map(([id, option]) => (
          <Chip key={id} active={state.path === id} onClick={() => set({ path: id, stage: Math.min(state.stage, option.stages.length - 1) })}>
            {option.label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[0.9375rem] font-normal text-ink">{stage.label}</h3>
        <span className="readout shrink-0 opacity-60">{path.range}</span>
      </div>
      <p className="mt-0.5 text-[0.8125rem] font-light leading-relaxed text-ink-dim short:hidden">{stage.caption}</p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => set({ stage: Math.max(0, state.stage - 1) })} disabled={state.stage === 0} aria-label="Previous stage" className="h-9 w-9 shrink-0 rounded-full border border-white/15 text-ink disabled:opacity-30">‹</button>
        <input type="range" min="0" max={path.stages.length - 1} step="1" value={state.stage} onChange={(event) => set({ stage: Number(event.target.value) })} aria-label="Stage of the star’s life" aria-valuetext={stage.label} className="min-w-0 flex-1 accent-[#ffd28a]" />
        <button type="button" onClick={() => set({ stage: Math.min(path.stages.length - 1, state.stage + 1) })} disabled={state.stage === path.stages.length - 1} aria-label="Next stage" className="h-9 w-9 shrink-0 rounded-full border border-white/15 text-ink disabled:opacity-30">›</button>
      </div>
    </Dock>
  )
}

const CONTROLS = {
  lifecycle: LifeCycleControls,
  supernova: SupernovaControls,
  pulsar: PulsarControls,
  wormhole: WormholeControls,
  spacetime: SpacetimeControls,
  scale: ScaleControls,
}

/** The lab overlay: the shared explorer shell, plus each experience's dock. */
export default function PhenomenaHud({ selectedId, onSelect, onExit, panelOpen, onPanelOpenChange, lab, reducedMotion }) {
  const entry = PHENOMENA_BY_ID[selectedId]
  const Controls = CONTROLS[entry.kind]
  return (
    <ExplorerHud
      title="Phenomena"
      items={PHENOMENA}
      selectedId={selectedId}
      onSelect={onSelect}
      onExit={onExit}
      scaleNote={PHENOMENA_SCALE_NOTE}
      panelOpen={panelOpen}
      onPanelOpenChange={onPanelOpenChange}
      reducedMotion={reducedMotion}
      docked={Boolean(Controls)}
    >
      {Controls && <Controls key={entry.id} control={lab[entry.kind]} panelOpen={panelOpen} reducedMotion={reducedMotion} />}
    </ExplorerHud>
  )
}
