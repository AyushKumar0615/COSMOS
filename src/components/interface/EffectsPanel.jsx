import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { setEffect, useEffects } from '../../lib/effects.js'
import { SATELLITES } from '../../data/satellites.js'

function Toggle({ label, hint, checked, disabled, onChange }) {
  return (
    <label className={`flex items-center justify-between gap-4 py-2 ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-light text-ink">{label}</span>
        {hint && <span className="block text-[0.6875rem] font-light leading-snug text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/60 ${
          checked ? 'border-cyan/60 bg-cyan/25' : 'border-white/15 bg-white/[0.04]'
        }`}
      >
        <span
          className={`absolute top-[3px] h-3 w-3 rounded-full transition-all duration-300 ${
            checked ? 'left-[19px] bg-cyan' : 'left-[3px] bg-ink-dim/70'
          }`}
        />
      </span>
    </label>
  )
}

/**
 * Visual-effects controls for the solar system: independent switches for
 * meteors, spacecraft, their orbits and distant events, an intensity slider,
 * and a list of spacecraft to fly to. Choices persist in this browser.
 */
export default function EffectsPanel({ onSelect, reducedMotion }) {
  const effects = useEffects()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    // Captured and stopped here, so Esc closes only this menu and does not
    // also reach the app's own Esc handling (clear selection, leave scene).
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const transition = { duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }

  return (
    <div ref={panelRef} className="pointer-events-auto relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="effects-panel"
        aria-label="Effects"
        className="glass flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5 transition-colors duration-300 hover:border-white/20"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-cyan" fill="none" aria-hidden="true">
          <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2 2M10.6 10.6l2 2M12.6 3.4l-2 2M5.4 10.6l-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="eyebrow hidden text-ink-dim sm:inline">Effects</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="effects-panel"
            role="dialog"
            aria-label="Visual effects"
            className="glass fixed inset-x-4 top-[8.25rem] z-30 max-h-[calc(100dvh-9.5rem)] overflow-y-auto rounded-3xl bg-[#070a17]/90 px-5 pb-4 pt-4 [scrollbar-width:thin] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-3 sm:max-h-[calc(100dvh-9rem)] sm:w-[19rem]"
            initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            transition={transition}
          >
            <p className="readout text-cyan/80">Visual effects</p>
            <div className="mt-2 divide-y divide-white/[0.06]">
              <Toggle
                label="Meteors"
                hint={reducedMotion ? 'Off while reduced motion is on' : 'Shooting stars and occasional showers'}
                checked={effects.meteors && !reducedMotion}
                disabled={reducedMotion}
                onChange={(value) => setEffect('meteors', value)}
              />
              <Toggle
                label="Spacecraft"
                hint="Stations, telescopes, orbiters and probes"
                checked={effects.satellites}
                onChange={(value) => setEffect('satellites', value)}
              />
              <Toggle
                label="Orbit lines"
                hint="Spacecraft, moons, dwarf planets and comets"
                checked={effects.orbits}
                onChange={(value) => setEffect('orbits', value)}
              />
              <Toggle
                label="Auroras"
                hint="Earth’s, and Jupiter’s and Saturn’s in false colour"
                checked={effects.auroras}
                onChange={(value) => setEffect('auroras', value)}
              />
              <Toggle
                label="Distant events"
                hint="Far-off flares that brighten and fade"
                checked={effects.events && !reducedMotion}
                disabled={reducedMotion}
                onChange={(value) => setEffect('events', value)}
              />
            </div>

            <label className="mt-3 block">
              <span className="flex items-center justify-between">
                <span className="text-[0.8125rem] font-light text-ink">Effect intensity</span>
                <span className="readout tabular-nums opacity-70">{Math.round(effects.intensity * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="150"
                step="5"
                value={Math.round(effects.intensity * 100)}
                onChange={(event) => setEffect('intensity', Number(event.target.value) / 100)}
                className="mt-2 w-full accent-cyan"
                aria-label="Effect intensity"
              />
            </label>

            {effects.satellites && (
              <>
                <div className="hairline my-3 h-px w-full opacity-60" />
                <p className="readout opacity-60">Spacecraft</p>
                <ul className="mt-1.5">
                  {SATELLITES.map((craft) => (
                    <li key={craft.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(craft.id)
                          setOpen(false)
                        }}
                        className="flex w-full items-baseline justify-between gap-3 py-1.5 text-left text-[0.8125rem] font-light text-ink-dim transition-colors hover:text-ink"
                      >
                        <span className="truncate">{craft.name}</span>
                        <span className="readout shrink-0 opacity-50">{craft.host}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="mt-3 text-[0.6875rem] font-light leading-relaxed text-muted">
              Meteors, dust and distant events are procedural effects, not observations.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
