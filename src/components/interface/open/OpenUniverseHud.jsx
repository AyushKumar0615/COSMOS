import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import VirtualJoystick from '../VirtualJoystick.jsx'
import { HoldButton, Key } from '../FlightHud.jsx'
import UniverseMap from './UniverseMap.jsx'
import { findTarget, getWorld, referenceSpeeds, TYPE_LOOK } from '../../../lib/worldCatalogue.js'
import {
  commands,
  input,
  markers,
  onOpenEvent,
  removePlace,
  savePlace,
  getOpenSettings,
  setOpenSettings,
  ship,
  useOpenSettings,
  usePlaces,
  useTelemetry,
} from '../../../lib/openWorldStore.js'
import { C_KM_S, SPEED_LOG, formatDuration, formatKm, formatSpeed } from '../../../lib/openWorld.js'
import { objectProperties } from '../../../lib/formatObject.js'
import { toggleBookmark, useDiscovery } from '../../../lib/discovery.js'
import { CATALOGUE_BY_ID } from '../../../data/catalogue/index.js'
import { createSpaceAudio } from '../../../lib/spaceAudio.js'
import { useMediaQuery } from '../../../hooks/useMediaQuery.js'

const stroke = { stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
const MARKERS = 12

// Speed presets for the number keys: from manoeuvring to crossing the cosmos.
const SPEED_PRESETS = [
  { label: 'Manoeuvre', log: 0 },
  { label: 'Orbital', log: 1 },
  { label: 'Interplanetary', log: 3 },
  { label: 'Light speed', log: Math.log10(C_KM_S) },
  { label: 'Interstellar', log: 9 },
  { label: 'Star hopping', log: 12 },
  { label: 'Galactic', log: 15 },
  { label: 'Intergalactic', log: 18 },
  { label: 'Cosmic', log: 21 },
]

const presetFor = (log) => SPEED_PRESETS.reduce((best, p) => (Math.abs(p.log - log) < Math.abs(best.log - log) ? p : best))
const typeColor = (type) => TYPE_LOOK[type]?.color ?? '#ffffff'
const isTyping = (target) => target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

function Icon({ d, className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d={d} {...stroke} />
    </svg>
  )
}

function ToolButton({ label, pressed, onClick, children, keyHint }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick()
        event.currentTarget.blur()
      }}
      aria-label={label}
      aria-pressed={pressed}
      title={keyHint ? `${label} (${keyHint})` : label}
      className={`flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-[0.75rem] transition-colors ${pressed ? 'bg-cyan/15 text-ink' : 'text-ink-dim hover:bg-white/[0.06] hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

/** Live readouts and controls for the open universe. */
export default function OpenUniverseHud({ onExit, onExplore, showToast, reducedMotion, touch, compact: narrow }) {
  // Phones in landscape are short rather than narrow: the same compact panels,
  // with speed as a single pill so the joystick has the lower left.
  const short = useMediaQuery('(max-height: 560px)')
  const compact = narrow || short
  const settings = useOpenSettings()
  const t = useTelemetry()
  const places = usePlaces()
  const discovery = useDiscovery()
  const [panel, setPanel] = useState(compact || touch ? null : 'ahead')
  const [inspectId, setInspectId] = useState(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [displayOpen, setDisplayOpen] = useState(false)
  const poolRef = useRef(null)
  const arrowRef = useRef(null)
  const audio = useRef(null)
  const references = useMemo(() => referenceSpeeds(), [])
  const parker = references.find((r) => r.id === 'parker-solar-probe')
  // Stable, so the touch controls' release-on-unmount does not fire on every render.
  const inputRef = useMemo(() => ({ current: input }), [])

  useLayoutEffect(() => {
    markers.root = poolRef.current
    markers.arrow = arrowRef.current
    return () => {
      markers.root = null
      markers.arrow = null
    }
  }, [])

  const target = (id) => setOpenSettings({ targetId: id, autopilot: false })
  const inspect = (id) => {
    target(id)
    setInspectId(id)
  }
  const engage = () => settings.targetId && setOpenSettings({ autopilot: true, paused: false })
  const cancel = () => setOpenSettings({ autopilot: false })
  const face = (id = settings.targetId) => {
    if (id) commands.face = { id, at: performance.now() }
  }

  // Notices: discoveries, autopilot, light speed. A chime when sound is on.
  const toastRef = useRef(showToast)
  useEffect(() => {
    toastRef.current = showToast
  })
  useEffect(
    () =>
      onOpenEvent((event) => {
        const say = toastRef.current
        if (event.type === 'region') {
          if (event.discovered) {
            say(`Discovered: ${event.name}`)
            audio.current?.chime()
          } else say(`Entering ${event.name}`)
        } else if (event.type === 'arrived') {
          say(`Arrived: ${event.name}`)
          audio.current?.blip('arrive')
        } else if (event.type === 'autopilot') {
          say(`Autopilot engaged · ${event.name}`)
          audio.current?.blip('engage')
        } else if (event.type === 'cancelled') {
          say('Autopilot cancelled')
          audio.current?.blip('cancel')
        }
      }),
    [],
  )
  const ftl = (t?.speed ?? 0) > C_KM_S
  const warned = useRef(false)
  useEffect(() => {
    if (ftl && !warned.current) {
      warned.current = true
      showToast('Faster than light: the simulation allows it, physics does not.')
    }
  }, [ftl, showToast])

  // A tone when a target is locked.
  useEffect(() => {
    if (settings.targetId) audio.current?.blip('lock')
  }, [settings.targetId])
  useEffect(() => {
    audio.current?.setVolume(settings.volume)
  }, [settings.volume])

  // Sound: created on the visitor's click, updated from the ship.
  useEffect(() => {
    if (!settings.sound) return
    audio.current = createSpaceAudio(getOpenSettings().volume)
    const id = window.setInterval(() => audio.current?.update(ship.thrust, Math.log10(1 + ship.speed)), 120)
    return () => {
      window.clearInterval(id)
      audio.current?.close()
      audio.current = null
    }
  }, [settings.sound])

  // Keyboard shortcuts (movement keys belong to the scene).
  const latest = useRef({})
  useEffect(() => {
    latest.current = { settings, t, inspectId, mapOpen, helpOpen, onExit }
  })
  useEffect(() => {
    const onKey = (event) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      const { settings: s, t: tel, inspectId: open, mapOpen: map, helpOpen: help, onExit: exit } = latest.current
      const key = event.key.toLowerCase()
      if (event.key === 'Escape') {
        if (help) setHelpOpen(false)
        else if (map) setMapOpen(false)
        else if (open) setInspectId(null)
        else if (s.autopilot) setOpenSettings({ autopilot: false })
        else exit()
        return
      }
      if (/^[1-9]$/.test(event.key)) setOpenSettings({ speedLog: SPEED_PRESETS[Number(event.key) - 1].log })
      else if (key === '=' || key === '+') setOpenSettings({ speedLog: Math.min(SPEED_LOG.max, Math.round(s.speedLog) + 1) })
      else if (key === '-' || key === '_') setOpenSettings({ speedLog: Math.max(SPEED_LOG.min, Math.round(s.speedLog) - 1) })
      else if (key === 'v') setOpenSettings({ camera: s.camera === 'third' ? 'first' : 'third' })
      else if (key === 'p') setOpenSettings({ paused: !s.paused })
      else if (key === 'r') commands.reset += 1
      else if (key === 'm') setMapOpen((v) => !v)
      else if (key === 'h' || key === '?') setHelpOpen((v) => !v)
      else if (key === 'l') setPanel((p) => (p ? null : 'ahead'))
      else if (key === 't' && tel?.ahead[0]) setOpenSettings({ targetId: tel.ahead[0].id, autopilot: false })
      else if (key === 'g' && s.targetId) setOpenSettings({ autopilot: !s.autopilot, paused: false })
      else if (key === 'x') setOpenSettings({ targetId: null, autopilot: false })
      else if (key === 'f' && s.targetId) commands.face = { id: s.targetId, at: performance.now() }
      else if (key === 'i' && s.targetId) setInspectId(s.targetId)
      else if (key === 'b' && s.targetId && CATALOGUE_BY_ID[s.targetId]) toggleBookmark(s.targetId)
      else if (key === 'n') savePlace(`Near ${tel?.region.name ?? 'here'}`)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleSteer = () => {
    const canvas = document.querySelector('canvas')
    if (document.pointerLockElement) document.exitPointerLock()
    else canvas?.requestPointerLock?.()
  }

  const speed = formatSpeed(t?.speed ?? 0)
  const cruise = formatSpeed(10 ** settings.speedLog)
  const preset = presetFor(settings.speedLog)
  const status = !t || t.speed < 1e-3 ? 'Holding position' : t.speed <= (parker?.kms ?? 0) ? 'Within reach of real spacecraft' : t.speed <= C_KM_S ? 'Faster than any spacecraft so far' : 'Faster than light · simulation only'

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.5 }}
    >
      {/* First person: a faint helmet rim. */}
      {settings.camera === 'first' && (
        <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(120% 95% at 50% 50%, transparent 62%, rgba(8,12,24,0.55) 82%, rgba(4,6,14,0.9) 100%)' }} />
      )}

      {/* World-anchored markers, positioned by the scene every frame. */}
      <div ref={poolRef} className="absolute inset-0" aria-label="Objects in view">
        {Array.from({ length: MARKERS }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={(event) => event.currentTarget.dataset.id && inspect(event.currentTarget.dataset.id)}
            className="group absolute left-0 top-0 h-0 w-0 opacity-0"
            style={{ pointerEvents: 'none' }}
          >
            <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-[3px] border border-white/45 group-data-[target=true]:border-cyan group-data-[target=true]:shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
            <span className="absolute left-4 -top-2.5 whitespace-nowrap text-left">
              <span data-name className="block text-[0.75rem] font-light leading-tight text-ink [text-shadow:0_1px_3px_#000]" />
              <span data-distance className="readout block leading-tight opacity-80 [text-shadow:0_1px_3px_#000]" />
            </span>
          </button>
        ))}
      </div>
      <div ref={arrowRef} aria-hidden="true" className="absolute left-0 top-0 -ml-3 -mt-3 opacity-0">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-cyan drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]">
          <path d="M6 5l12 7-12 7 3-7z" fill="currentColor" />
        </svg>
      </div>

      {/* Reticle. */}
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/30">
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/80" />
      </span>

      {/* Top left: exit, where you are, and the toolbar. */}
      <div className="pointer-events-auto absolute left-3 top-20 flex max-w-[calc(100vw-1.5rem)] flex-col gap-2 sm:left-6 sm:top-24 lg:left-10">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onExit} className="glass flex items-center gap-2.5 rounded-full py-2 pl-3.5 pr-4 text-ink-dim hover:text-ink">
            <Icon d="M4 4l8 8M12 4l-8 8" className="h-3.5 w-3.5 text-cyan" />
            <span className="eyebrow">Exit</span>
          </button>
          <div className="glass flex items-center rounded-full p-0.5">
            <ToolButton label={settings.camera === 'third' ? 'Switch to first-person view' : 'Switch to third-person view'} keyHint="V" pressed={settings.camera === 'first'} onClick={() => setOpenSettings({ camera: settings.camera === 'third' ? 'first' : 'third' })}>
              <span className="readout text-inherit">{settings.camera === 'third' ? '3rd' : '1st'}</span>
            </ToolButton>
            <ToolButton label={settings.paused ? 'Resume flight' : 'Pause flight'} keyHint="P" pressed={settings.paused} onClick={() => setOpenSettings({ paused: !settings.paused })}>
              <Icon d={settings.paused ? 'M5 3.5v9l7-4.5z' : 'M5.5 3.5v9M10.5 3.5v9'} />
            </ToolButton>
            <ToolButton label="Reset position" keyHint="R" onClick={() => (commands.reset += 1)}>
              <Icon d="M3 8a5 5 0 1 0 1.6-3.7M3 3v2.6h2.6" />
            </ToolButton>
            <ToolButton label="Open map" keyHint="M" pressed={mapOpen} onClick={() => setMapOpen(true)}>
              <Icon d="M2.5 4l3.5-1.5 4 1.5 3.5-1.5v9.5L10 13.5 6 12l-3.5 1.5zM6 2.5V12M10 4v9.5" />
            </ToolButton>
            {!touch && (
              <ToolButton label={settings.mouseSteer ? 'Release mouse' : 'Steer with the mouse'} pressed={settings.mouseSteer} onClick={toggleSteer}>
                <Icon d="M8 2v4M8 10v4M2 8h4M10 8h4" />
              </ToolButton>
            )}
            <ToolButton label={settings.sound ? 'Turn sound off' : 'Turn sound on'} pressed={settings.sound} onClick={() => setOpenSettings({ sound: !settings.sound })}>
              <Icon d={settings.sound ? 'M3 6h2.5L9 3v10L5.5 10H3zM11.5 5.5a3.5 3.5 0 0 1 0 5' : 'M3 6h2.5L9 3v10L5.5 10H3zM11.5 6l3 4M14.5 6l-3 4'} />
            </ToolButton>
            <ToolButton label="Display and sound settings" pressed={displayOpen} onClick={() => setDisplayOpen((v) => !v)}>
              <Icon d="M3 4.5h10M3 8h10M3 11.5h10M6 3v3M10 6.5v3M5 10v3" />
            </ToolButton>
            <ToolButton label="Controls and help" keyHint="H" pressed={helpOpen} onClick={() => setHelpOpen((v) => !v)}>
              <span className="text-[0.8125rem]">?</span>
            </ToolButton>
          </div>
        </div>
        {displayOpen && <DisplaySettings settings={settings} />}
        {/* Where a dedicated explorer exists (a ray-traced black hole, a
            galaxy or nebula model), offer it from inside the region. */}
        {(() => {
          const explorer = t?.region.id && t.region.id !== 'milky-way' ? CATALOGUE_BY_ID[t.region.id]?.explorer : null
          if (!explorer || !onExplore) return null
          return (
            <button type="button" onClick={() => onExplore(explorer)} className="glass w-fit rounded-full px-3.5 py-1.5 text-[0.75rem] font-light text-ink-dim hover:text-ink">
              {t.region.type === 'blackhole' ? 'See its lensing, ray-traced' : 'Open the detailed explorer'} →
            </button>
          )
        })()}
        <p className="readout pl-1" aria-live="polite">
          <span className="text-cyan">{t?.region.name ?? 'Locating…'}</span>
          {compact && t && <span className="ml-2 tabular-nums">l {t.heading.l.toFixed(0)}° b {t.heading.b.toFixed(0)}°</span>}
          {settings.paused && <span className="ml-2 text-[#ffd28a]">· Paused</span>}
          {t?.autopilot && <span className="ml-2 text-cyan">· Autopilot</span>}
        </p>

        <Velocity compact={compact} short={short} t={t} speed={speed} cruise={cruise} preset={preset} settings={settings} status={status} parker={parker} references={references} />
      </div>

      {/* Top right: compass and radar. */}
      <div className="absolute right-3 top-20 flex flex-col items-end gap-2 sm:right-6 sm:top-24 lg:right-10">
        {t && !compact && <Compass heading={t.heading} />}
        {t && !compact && <Radar items={t.radar} targetId={settings.targetId} />}
        {t && !compact && !inspectId && <Position t={t} />}
      </div>

      {/* Target, with guidance and autopilot. */}
      <AnimatePresence>
        {t?.target && !(compact && (panel || inspectId)) && (
          <TargetBar
            key="target"
            info={t.target}
            autopilot={settings.autopilot}
            onEngage={engage}
            onCancel={cancel}
            onFace={() => face()}
            onInspect={() => setInspectId(t.target.id)}
            onClear={() => setOpenSettings({ targetId: null, autopilot: false })}
            compact={compact}
            short={short}
            touch={touch}
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>

      {/* Discovery panel. */}
      <AnimatePresence>
        {panel && !inspectId && (
          <Discovery key="discovery" panel={panel} setPanel={setPanel} t={t} places={places} discovery={discovery} onPick={inspect} targetId={settings.targetId} compact={compact} touch={touch} reducedMotion={reducedMotion} />
        )}
        {inspectId && (
          <Inspect key={`inspect-${inspectId}`} id={inspectId} t={t} places={places} discovery={discovery} onClose={() => setInspectId(null)} onEngage={() => (target(inspectId), setOpenSettings({ autopilot: true, paused: false }))} onFace={() => face(inspectId)} onExplore={onExplore} compact={compact} touch={touch} reducedMotion={reducedMotion} />
        )}
      </AnimatePresence>
      {!panel && !inspectId && (
        <button type="button" onClick={() => setPanel('ahead')} className={`glass pointer-events-auto absolute flex items-center gap-2 rounded-full px-4 py-2 text-ink-dim hover:text-ink ${short ? 'right-3 top-20' : compact ? 'right-3 top-[9.5rem]' : touch ? 'right-6 top-[32rem]' : 'bottom-10 right-6 lg:right-10'}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden="true" />
          <span className="eyebrow">Discover</span>
        </button>
      )}

      {/* Touch controls. */}
      {touch ? (
        !(compact && (panel || inspectId)) && (
        <>
          <div className="pointer-events-auto absolute bottom-6 left-5">
            <VirtualJoystick input={inputRef} />
          </div>
          <div className="pointer-events-auto absolute bottom-6 right-5 flex flex-col items-center gap-2.5">
            <HoldButton input={inputRef} direction={1} label="Fly up"><Icon d="M3.5 10 8 5.5l4.5 4.5" className="h-4 w-4" /></HoldButton>
            <button
              type="button"
              aria-label="Boost"
              className="glass flex h-12 w-12 touch-none select-none items-center justify-center rounded-full text-[0.625rem] text-ink-dim active:border-cyan/50 active:text-ink"
              onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), (input.boost = true))}
              onPointerUp={() => (input.boost = false)}
              onPointerCancel={() => (input.boost = false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              ×10
            </button>
            <HoldButton input={inputRef} direction={-1} label="Fly down"><Icon d="M3.5 6 8 10.5 12.5 6" className="h-4 w-4" /></HoldButton>
          </div>
        </>
        )
      ) : (
        !compact && (
          <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-3 lg:flex">
            <span className="flex items-center gap-1"><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key><span className="readout ml-1">Move</span></span>
            <span className="flex items-center gap-1"><Key>Space</Key><Key>Ctrl</Key><span className="readout ml-1">Up / down</span></span>
            <span className="flex items-center gap-1"><Key>Shift</Key><span className="readout ml-1">×10</span></span>
            <span className="flex items-center gap-1"><Key>1–9</Key><span className="readout ml-1">Speed</span></span>
            <span className="flex items-center gap-1"><Key>H</Key><span className="readout ml-1">All keys</span></span>
          </div>
        )
      )}

      <AnimatePresence>
        {mapOpen && <UniverseMap key="map" targetId={settings.targetId} onPick={(id) => (target(id), setMapOpen(false), setInspectId(id))} onClose={() => setMapOpen(false)} reducedMotion={reducedMotion} />}
        {helpOpen && <Help key="help" onClose={() => setHelpOpen(false)} reducedMotion={reducedMotion} touch={touch} references={references} />}
      </AnimatePresence>
    </motion.div>
  )
}

// --- Panels ------------------------------------------------------------------------------

function Velocity({ compact, short, t, speed, cruise, settings, preset, status }) {
  if (short) {
    return (
      <div className="glass pointer-events-auto flex w-fit items-center gap-2 rounded-full py-1 pl-3.5 pr-1" aria-label="Velocity">
        <span className="font-mono text-[0.75rem] tabular-nums text-ink" data-testid="open-speed">{speed.kms}</span>
        <span className="readout">· {cruise.kms}</span>
        <button type="button" aria-label="Slower" onClick={() => setOpenSettings({ speedLog: Math.max(SPEED_LOG.min, Math.round(settings.speedLog) - 1) })} className="h-7 w-7 rounded-full border border-white/12 text-ink-dim">−</button>
        <button type="button" aria-label="Faster" onClick={() => setOpenSettings({ speedLog: Math.min(SPEED_LOG.max, Math.round(settings.speedLog) + 1) })} className="h-7 w-7 rounded-full border border-white/12 text-ink-dim">+</button>
      </div>
    )
  }
  return (
    <div className={`glass pointer-events-auto rounded-2xl ${compact ? 'w-[210px] px-3.5 py-2.5' : 'w-[268px] px-4 py-3.5'}`} aria-label="Velocity">
      <div className="flex items-baseline justify-between gap-2">
        <span className="readout">Velocity</span>
        <span className={`readout ${t?.speed > C_KM_S ? 'text-[#ffb36b]' : 'text-ink-dim'}`}>{speed.c}</span>
      </div>
      <p className="mt-1 font-mono text-[1.05rem] tabular-nums leading-tight text-ink" data-testid="open-speed">{speed.kms}</p>
      {!compact && (
        <p className="readout mt-0.5 tabular-nums opacity-80">
          {speed.aus}
          {speed.lys && ` · ${speed.lys}`}
        </p>
      )}
      <p className="mt-1 text-[0.6875rem] font-light leading-snug text-ink-dim">{status}</p>
      <div className="hairline my-2.5 h-px w-full opacity-50" />
      <div className="flex items-baseline justify-between gap-2">
        <span className="readout">Cruise · {preset.label}</span>
        <span className="readout text-ink-dim">{input.boost ? 'Boost ×10' : ''}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <button type="button" aria-label="Slower" onClick={() => setOpenSettings({ speedLog: Math.max(SPEED_LOG.min, Math.round(settings.speedLog) - 1) })} className="h-7 w-7 shrink-0 rounded-full border border-white/12 text-ink-dim">−</button>
        <input
          type="range"
          aria-label="Cruise speed"
          min={SPEED_LOG.min}
          max={SPEED_LOG.max}
          step={0.05}
          value={settings.speedLog}
          onChange={(event) => setOpenSettings({ speedLog: Number(event.target.value) })}
          onPointerUp={(event) => event.currentTarget.blur()}
          className="h-1 min-w-0 flex-1 accent-cyan"
        />
        <button type="button" aria-label="Faster" onClick={() => setOpenSettings({ speedLog: Math.min(SPEED_LOG.max, Math.round(settings.speedLog) + 1) })} className="h-7 w-7 shrink-0 rounded-full border border-white/12 text-ink-dim">+</button>
      </div>
      <p className="mt-1 font-mono text-[0.75rem] tabular-nums text-ink" data-testid="open-cruise">{cruise.kms}</p>
      {!compact && (
        <>
          <div className="mt-2 flex items-center gap-1" role="group" aria-label="Acceleration">
            {[
              ['Gentle', 2.5],
              ['Normal', 1],
              ['Snappy', 0.3],
            ].map(([label, value]) => (
              <button key={label} type="button" aria-pressed={settings.response === value} onClick={(e) => (setOpenSettings({ response: value }), e.currentTarget.blur())} className={`flex-1 rounded-full border px-2 py-1 text-[0.6875rem] ${settings.response === value ? 'border-cyan/45 text-ink' : 'border-white/10 text-ink-dim'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-center justify-between gap-2 text-[0.6875rem] font-light text-ink-dim">
            Inertial dampers {settings.dampers ? '(stop when idle)' : '(coast)'}
            <input type="checkbox" checked={settings.dampers} onChange={(e) => (setOpenSettings({ dampers: e.target.checked }), e.currentTarget.blur())} className="accent-cyan" />
          </label>
        </>
      )}
    </div>
  )
}

function Compass({ heading }) {
  const width = 240
  const span = 120 // degrees across the strip
  const ticks = []
  for (let l = Math.floor((heading.l - span / 2) / 15) * 15; l <= heading.l + span / 2; l += 15) {
    const x = ((l - heading.l) / span + 0.5) * width
    const norm = ((l % 360) + 360) % 360
    const label = norm === 0 ? 'GC' : norm === 180 ? 'AC' : norm % 45 === 0 ? String(norm) : null
    ticks.push(
      <g key={l}>
        <line x1={x} x2={x} y1={label ? 4 : 8} y2={14} stroke="rgba(200,215,255,0.5)" strokeWidth="1" />
        {label && <text x={x} y={26} fontSize="9" textAnchor="middle" fill={norm === 0 ? '#22d3ee' : 'rgba(200,215,255,0.6)'} fontFamily="monospace">{label}</text>}
      </g>,
    )
  }
  return (
    <div className="glass rounded-2xl px-3 py-2" aria-label={`Heading: galactic longitude ${heading.l.toFixed(0)}°, latitude ${heading.b.toFixed(0)}°`}>
      <svg width={width} height={30} aria-hidden="true">
        {ticks}
        <path d={`M${width / 2 - 5} 0 L${width / 2 + 5} 0 L${width / 2} 6 Z`} fill="#22d3ee" />
      </svg>
      <p className="readout mt-0.5 flex justify-between tabular-nums">
        <span>l {heading.l.toFixed(1)}°</span>
        <span>b {heading.b >= 0 ? '+' : ''}{heading.b.toFixed(1)}°</span>
      </p>
    </div>
  )
}

function Radar({ items, targetId }) {
  const R = 54
  return (
    <div className="glass rounded-full p-2" aria-label="Radar: the nearest objects around you">
      <svg width={R * 2} height={R * 2} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} aria-hidden="true">
        <circle r={R - 1} fill="rgba(10,16,32,0.4)" stroke="rgba(143,212,255,0.25)" />
        <circle r={(R - 1) * 0.55} fill="none" stroke="rgba(143,212,255,0.12)" />
        <line x1={0} x2={0} y1={-R} y2={R} stroke="rgba(143,212,255,0.1)" />
        <line y1={0} y2={0} x1={-R} x2={R} stroke="rgba(143,212,255,0.1)" />
        <path d="M0 -6 L4 4 L0 2 L-4 4 Z" fill="#22d3ee" />
        {items.map((item) => (
          <g key={item.id} transform={`translate(${item.x * (R - 6)} ${item.y * (R - 6)})`}>
            <line x1={0} x2={0} y1={0} y2={-item.up * 8} stroke={typeColor(item.type)} strokeOpacity="0.6" />
            <circle r={item.id === targetId ? 3.6 : 2.4} fill={typeColor(item.type)} stroke={item.id === targetId ? '#22d3ee' : 'none'} />
          </g>
        ))}
      </svg>
    </div>
  )
}

function Position({ t }) {
  const [x, y, z] = t.position
  return (
    <div className="glass w-[260px] rounded-2xl px-4 py-3" aria-label="Position">
      <p className="readout">Position · galactic</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[0.6875rem] tabular-nums text-ink-dim">
        <dt>X</dt><dd className="truncate text-right">{x < 0 ? '−' : ''}{formatKm(Math.abs(x))}</dd>
        <dt>Y</dt><dd className="truncate text-right">{y < 0 ? '−' : ''}{formatKm(Math.abs(y))}</dd>
        <dt>Z</dt><dd className="truncate text-right">{z < 0 ? '−' : ''}{formatKm(Math.abs(z))}</dd>
        <dt>Sun</dt><dd className="truncate text-right text-ink">{formatKm(t.fromSun)}</dd>
        <dt>Centre</dt><dd className="truncate text-right">{formatKm(t.fromCentre)}</dd>
      </dl>
      <p className="mt-2 text-[0.625rem] font-light leading-snug text-muted">Depth is compressed for display. Directions, angular sizes and every distance shown are true.</p>
    </div>
  )
}

function TargetBar({ info, autopilot, onEngage, onCancel, onFace, onInspect, onClear, compact, short, touch, reducedMotion }) {
  const [x, y, z] = info.local
  // A small 3D guide: where the target is relative to where you face.
  const guide = { x: Math.max(-1, Math.min(1, x)) * 16, y: Math.max(-1, Math.min(1, -y)) * 16 }
  return (
    <motion.div
      className={`glass pointer-events-auto absolute flex items-center gap-3 rounded-2xl px-4 py-3 ${
        short && touch
          ? 'bottom-3 left-1/2 w-[min(480px,calc(100vw-22rem))] -translate-x-1/2'
          : touch && !compact
            ? 'bottom-[13.5rem] left-6 w-[min(440px,calc(100vw-24rem))]'
            : `left-1/2 w-[min(560px,calc(100vw-1.5rem))] -translate-x-1/2 ${touch ? 'bottom-[13.5rem]' : compact ? 'bottom-4' : 'bottom-12'}`
      }`}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      aria-label={`Target: ${info.name}`}
    >
      <svg width="40" height="40" viewBox="-20 -20 40 40" className="shrink-0" aria-label={z > 0 ? 'Target ahead' : 'Target behind you'}>
        <circle r="18" fill="none" stroke={z > 0 ? 'rgba(34,211,238,0.5)' : 'rgba(255,179,107,0.6)'} strokeDasharray={z > 0 ? '0' : '3 3'} />
        <circle cx={guide.x} cy={guide.y} r="3.5" fill="#22d3ee" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="readout truncate" style={{ color: typeColor(info.type) }}>{info.klass ?? 'Target'}</p>
        <p className="truncate text-[0.9375rem] font-light text-ink">{info.name}</p>
        <p className="readout mt-0.5 truncate tabular-nums text-ink-dim">
          {info.distance}
          {info.autopilot ? ` · arriving in ${info.autopilot.remaining}` : ` · ${info.eta} at cruise speed`}
          {z <= 0 && ' · behind you'}
        </p>
        {info.autopilot && (
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded bg-white/10">
            <div className="h-full bg-cyan" style={{ width: `${Math.round(info.autopilot.progress * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {autopilot ? (
          <button type="button" onClick={onCancel} className="rounded-full border border-[#ffb36b]/50 px-3 py-1.5 text-[0.75rem] text-ink">Cancel</button>
        ) : (
          <button type="button" onClick={onEngage} aria-label={`Autopilot to ${info.name}`} className="rounded-full border border-cyan/50 bg-cyan/10 px-3 py-1.5 text-[0.75rem] text-ink">Autopilot</button>
        )}
        {!compact && <button type="button" onClick={onFace} className="rounded-full border border-white/12 px-3 py-1.5 text-[0.75rem] text-ink-dim">Face</button>}
        <button type="button" onClick={onInspect} className="rounded-full border border-white/12 px-3 py-1.5 text-[0.75rem] text-ink-dim">Info</button>
        <button type="button" onClick={onClear} aria-label="Clear target" className="h-8 w-8 rounded-full border border-white/12 text-ink-dim">×</button>
      </div>
    </motion.div>
  )
}

function Row({ item, onPick, targetId, showEta = true }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(item.id)} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.04] ${item.id === targetId ? 'bg-cyan/[0.07]' : ''}`}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: typeColor(item.type) }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-light text-ink">{item.name}</span>
          <span className="readout block truncate opacity-70">{item.behind ? `Behind ${item.behind}` : item.klass}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-[0.6875rem] tabular-nums text-ink-dim">{item.distance}</span>
          {showEta && <span className="readout block tabular-nums opacity-60">{item.eta}</span>}
        </span>
      </button>
    </li>
  )
}

function Discovery({ panel, setPanel, t, places, discovery, onPick, targetId, compact, touch, reducedMotion }) {
  const [query, setQuery] = useState('')
  const world = getWorld()
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return world.objects.filter((o) => o.name.toLowerCase().includes(q) || (o.klass ?? '').toLowerCase().includes(q)).slice(0, 30)
  }, [query, world])
  const live = (obj) => {
    const d = Math.hypot(obj.pos[0] - ship.pos[0], obj.pos[1] - ship.pos[1], obj.pos[2] - ship.pos[2])
    return { id: obj.id, name: obj.name, type: obj.type, klass: obj.klass, distance: formatKm(d), eta: formatDuration(d / (t?.cruise ?? 1)) }
  }
  const bookmarks = discovery.bookmarks.map((id) => world.byId[id]).filter(Boolean)
  const tabs = [
    ['ahead', 'Ahead'],
    ['nearby', 'Nearby'],
    ['find', 'Find'],
    ['saved', 'Saved'],
    ['history', 'History'],
  ]
  return (
    <motion.aside
      aria-label="Discovery"
      className={`glass pointer-events-auto absolute flex flex-col overflow-hidden rounded-3xl bg-[#070a17]/80 ${compact ? 'inset-x-3 bottom-3 max-h-[46vh]' : `${touch ? 'bottom-[13.5rem]' : 'bottom-28'} right-6 top-[31rem] w-[340px] lg:right-10`}`}
      initial={{ opacity: 0, x: reducedMotion || compact ? 0 : 20, y: compact && !reducedMotion ? 20 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.35 }}
    >
      <div className="flex items-center gap-0.5 border-b border-white/[0.06] px-2 py-2" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={panel === id} onClick={() => setPanel(id)} className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] ${panel === id ? 'bg-white/[0.08] text-ink' : 'text-ink-dim'}`}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setPanel(null)} aria-label="Close discovery panel" className="ml-auto h-7 w-7 shrink-0 rounded-full text-ink-dim hover:text-ink">×</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:thin]">
        {panel === 'ahead' && (
          <>
            <p className="readout px-2 pb-1 opacity-70">Within 14° of your view · nearest first</p>
            <ul aria-label="Objects ahead">{t?.ahead.length ? t.ahead.map((item) => <Row key={item.id} item={item} onPick={onPick} targetId={targetId} />) : <li className="px-2 py-3 text-[0.8125rem] font-light text-ink-dim">Nothing catalogued straight ahead. Turn, or open the map.</li>}</ul>
          </>
        )}
        {panel === 'nearby' && <ul aria-label="Nearest objects">{t?.nearby.map((item) => <Row key={item.id} item={item} onPick={onPick} targetId={targetId} />)}</ul>}
        {panel === 'find' && (
          <>
            <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stars, planets, galaxies…" aria-label="Search the universe" className="mb-1 w-full rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[0.8125rem] text-ink placeholder:text-muted focus:border-cyan/40 focus:outline-none" />
            <ul aria-label="Search results">{found.map((obj) => <Row key={obj.id} item={live(obj)} onPick={onPick} targetId={targetId} />)}</ul>
          </>
        )}
        {panel === 'history' && (
          <>
            <p className="readout px-2 pb-1 opacity-70">Places you have reached, newest first · shared with the atlas</p>
            <ul aria-label="Exploration history">
              {discovery.log.length ? (
                discovery.log.map((item) => {
                  const obj = world.byId[item.id]
                  return obj ? <Row key={`${item.id}-${item.at}`} item={{ ...live(obj), eta: new Date(item.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }} onPick={onPick} targetId={targetId} /> : null
                })
              ) : (
                <li className="px-2 py-3 text-[0.8125rem] font-light text-ink-dim">Nothing yet: fly to a planet, star or galaxy.</li>
              )}
            </ul>
          </>
        )}
        {panel === 'saved' && (
          <>
            <button type="button" onClick={() => savePlace(`Near ${t?.region.name ?? 'here'}`)} className="mx-2 mb-2 rounded-full border border-cyan/40 px-3 py-1.5 text-[0.75rem] text-ink">Save this spot</button>
            {places.length > 0 && <p className="readout px-2 pt-1 opacity-70">Saved places</p>}
            <ul>
              {places.map((place) => (
                <li key={place.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1"><Row item={{ id: place.id, name: place.name, type: 'spacecraft', klass: 'Saved place', distance: formatKm(Math.hypot(place.pos[0] - ship.pos[0], place.pos[1] - ship.pos[1], place.pos[2] - ship.pos[2])) }} onPick={onPick} targetId={targetId} showEta={false} /></div>
                  <button type="button" onClick={() => removePlace(place.id)} aria-label={`Remove ${place.name}`} className="h-7 w-7 shrink-0 rounded-full text-ink-dim">×</button>
                </li>
              ))}
            </ul>
            <p className="readout px-2 pt-2 opacity-70">Bookmarks</p>
            <ul>{bookmarks.length ? bookmarks.map((obj) => <Row key={obj.id} item={live(obj)} onPick={onPick} targetId={targetId} />) : <li className="px-2 py-2 text-[0.75rem] font-light text-ink-dim">Star an object in its profile to keep it here.</li>}</ul>
          </>
        )}
      </div>
      <p className="border-t border-white/[0.06] px-4 py-2 text-[0.6875rem] font-light leading-snug text-muted">Named objects are catalogued. Unnamed background stars are procedural: simulated, not real discoveries.</p>
    </motion.aside>
  )
}

function Inspect({ id, places, discovery, onClose, onEngage, onFace, onExplore, compact, touch, reducedMotion, t }) {
  const obj = findTarget(id, places)
  if (!obj) return null
  const entry = obj.entry
  const rows = entry ? objectProperties(entry).filter((row) => !(row.label === 'Distance from Earth' && obj.type !== 'star' && entry.distanceLy === 0)) : []
  const catalogued = Boolean(CATALOGUE_BY_ID[obj.id])
  const saved = discovery.bookmarks.includes(obj.id)
  const d = Math.hypot(obj.pos[0] - ship.pos[0], obj.pos[1] - ship.pos[1], obj.pos[2] - ship.pos[2])
  return (
    <motion.aside
      aria-label={`${obj.name} profile`}
      className={`glass pointer-events-auto absolute flex flex-col overflow-hidden rounded-3xl bg-[#070a17]/88 ${compact ? 'inset-x-3 bottom-3 max-h-[58vh]' : `${touch ? 'bottom-[13.5rem]' : 'bottom-28'} right-6 top-[19.5rem] w-[340px] lg:right-10`}`}
      initial={{ opacity: 0, x: reducedMotion || compact ? 0 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.35 }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="readout" style={{ color: typeColor(obj.type) }}>{TYPE_LOOK[obj.type]?.one ?? 'Place'}</p>
            <h2 className="mt-1 truncate text-xl font-light text-ink">{obj.name}</h2>
            <p className="text-[0.75rem] font-light text-ink-dim">{obj.klass}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {catalogued && (
              <button type="button" onClick={() => toggleBookmark(obj.id)} aria-pressed={saved} aria-label={saved ? `Remove bookmark for ${obj.name}` : `Bookmark ${obj.name}`} className={`h-8 w-8 rounded-full border border-white/12 ${saved ? 'text-[#ffd28a]' : 'text-ink-dim'}`}>★</button>
            )}
            <button type="button" onClick={onClose} aria-label="Close profile" className="h-8 w-8 rounded-full border border-white/12 text-ink-dim">×</button>
          </div>
        </div>
        <p className="mt-2 font-mono text-[0.75rem] tabular-nums text-ink">
          {formatKm(d)} away · {formatDuration(d / (t?.cruise ?? 1))} at cruise speed
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={onEngage} className="rounded-full border border-cyan/50 bg-cyan/10 px-3 py-1.5 text-[0.75rem] text-ink">Autopilot here</button>
          <button type="button" onClick={onFace} className="rounded-full border border-white/12 px-3 py-1.5 text-[0.75rem] text-ink-dim">Face it</button>
          {entry?.explorer && onExplore && (
            <button type="button" onClick={() => onExplore(entry.explorer)} className="rounded-full border border-white/12 px-3 py-1.5 text-[0.75rem] text-ink-dim">Explore in detail</button>
          )}
        </div>
        {entry?.note && <p className="mt-3 text-[0.75rem] font-light leading-relaxed text-ink-dim">{entry.note}</p>}
        {(obj.positionNote || obj.sizeNote) && (
          <ul className="mt-3 space-y-1.5">
            {obj.positionNote && <li className="flex gap-2 text-[0.6875rem] font-light leading-snug text-ink-dim"><span className="readout shrink-0 text-[#c9b2ff]">{/illustrative|approximate/i.test(obj.positionNote) ? 'Model' : 'Observed'}</span>{obj.positionNote}</li>}
            {obj.sizeNote && <li className="flex gap-2 text-[0.6875rem] font-light leading-snug text-ink-dim"><span className="readout shrink-0 text-[#c9b2ff]">{/horizon/i.test(obj.sizeNote) ? 'Theory' : 'Model'}</span>{obj.sizeNote}</li>}
          </ul>
        )}
        {rows.length > 0 && (
          <dl className="mt-3 space-y-2">
            {rows.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt className="readout opacity-60">{row.label}{row.estimated ? ' · estimate' : ''}</dt>
                <dd className="mt-0.5 text-[0.8125rem] text-ink">{row.value}</dd>
                {row.note && <dd className="text-[0.6875rem] font-light text-muted">{row.note}</dd>}
              </div>
            ))}
          </dl>
        )}
        {entry?.facts?.map?.((fact) => (
          <div key={fact.label} className="mt-2">
            <p className="readout opacity-60">{fact.label}</p>
            <p className="mt-0.5 text-[0.8125rem] text-ink">{fact.value}</p>
          </div>
        ))}
        {entry?.sources?.length > 0 && (
          <>
            <p className="readout mt-4 opacity-60">Sources</p>
            <ul className="mt-1 space-y-0.5">
              {entry.sources.map((source) => (
                <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-[0.75rem] font-light text-ink-dim underline decoration-white/20 underline-offset-2 hover:text-ink">{source.label}</a></li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-[0.6875rem] font-light leading-relaxed text-muted">Directions and angular sizes on screen are true; depth is compressed so near and far fit one view.</p>
      </div>
    </motion.aside>
  )
}

function Help({ onClose, reducedMotion, touch, references }) {
  const rows = touch
    ? [
        ['Joystick', 'Move forward, back and sideways'],
        ['Drag', 'Look around'],
        ['▲ ▼', 'Up and down'],
        ['×10', 'Hold to boost'],
      ]
    : [
        ['W A S D', 'Forward, left, back (reverse thrust), right'],
        ['Space · Ctrl or C', 'Up · down'],
        ['Drag · arrows', 'Look and steer'],
        ['Q · E', 'Roll'],
        ['Shift', 'Boost ×10'],
        ['1–9 · + − · wheel', 'Speed presets · step · fine'],
        ['T · G · X · F', 'Target ahead · autopilot · clear · face'],
        ['I · B · N', 'Info · bookmark · save this spot'],
        ['M · L · V · P · R', 'Map · list · camera · pause · reset'],
        ['Esc', 'Close, cancel autopilot, or exit'],
      ]
  return (
    <motion.div role="dialog" aria-label="Controls" className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4 pt-20 sm:pt-24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }} onClick={onClose}>
      <div className="glass w-full max-w-[460px] rounded-3xl bg-[#070a17]/90 p-6" onClick={(e) => e.stopPropagation()}>
        <p className="readout text-cyan">Controls</p>
        <dl className="mt-3 space-y-2">
          {rows.map(([keys, action]) => (
            <div key={keys} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[0.75rem] text-ink">{keys}</dt>
              <dd className="text-right text-[0.75rem] font-light text-ink-dim">{action}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[0.6875rem] font-light leading-relaxed text-muted">
          {references.map((r) => `${r.label}: ${formatSpeed(r.kms).kms}`).join(' · ')} (measured from JPL Horizons tracks). Nothing built has gone faster than Parker, and nothing can pass light speed: the higher settings exist only so the distances can be crossed at all.
        </p>
        <button type="button" onClick={onClose} className="mt-4 rounded-full border border-white/12 px-4 py-1.5 text-[0.75rem] text-ink-dim">Close</button>
      </div>
    </motion.div>
  )
}

function DisplaySettings({ settings }) {
  const toggles = [
    ['labels', 'Floating markers'],
    ['route', 'Route to the target'],
    ['dust', 'Speed streaks'],
    ['field', 'Procedural field stars'],
    ['belts', 'Asteroid and Kuiper belts (model)'],
  ]
  return (
    <div className="glass pointer-events-auto w-[268px] rounded-2xl px-4 py-3" role="group" aria-label="Display and sound">
      <p className="readout">Display</p>
      {toggles.map(([key, label]) => (
        <label key={key} className="mt-1.5 flex items-center justify-between gap-2 text-[0.75rem] font-light text-ink-dim">
          {label}
          <input type="checkbox" checked={settings[key]} onChange={(e) => (setOpenSettings({ [key]: e.target.checked }), e.currentTarget.blur())} className="accent-cyan" />
        </label>
      ))}
      <p className="readout mt-3">Sound</p>
      <label className="mt-1.5 flex items-center justify-between gap-2 text-[0.75rem] font-light text-ink-dim">
        Ambience and interface tones
        <input type="checkbox" checked={settings.sound} onChange={(e) => (setOpenSettings({ sound: e.target.checked }), e.currentTarget.blur())} className="accent-cyan" />
      </label>
      <label className="mt-2 flex items-center gap-2 text-[0.75rem] font-light text-ink-dim">
        Volume
        <input type="range" min={0} max={1} step={0.05} value={settings.volume} aria-label="Volume" onChange={(e) => setOpenSettings({ volume: Number(e.target.value) })} onPointerUp={(e) => e.currentTarget.blur()} className="h-1 min-w-0 flex-1 accent-cyan" />
      </label>
    </div>
  )
}
