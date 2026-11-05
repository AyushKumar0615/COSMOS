import { useEffect } from 'react'
import { motion } from 'framer-motion'
import VirtualJoystick from './VirtualJoystick.jsx'
import { FLIGHT_SPEED } from '../../data/flight.js'

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
}

function Key({ children }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-1.5 font-mono text-[0.625rem] text-ink-dim">
      {children}
    </kbd>
  )
}

/** Press-and-hold button that writes -1/0/1 into input.vertical. */
function HoldButton({ input, direction, label, children }) {
  const set = (value) => {
    input.current.vertical = value
  }
  // Released on unmount too, so leaving flight mid-press cannot leave the
  // camera climbing next time.
  useEffect(() => () => {
    input.current.vertical = 0
  }, [input])
  return (
    <button
      type="button"
      aria-label={label}
      className="glass pointer-events-auto flex h-14 w-14 touch-none select-none items-center justify-center rounded-full text-ink-dim active:border-cyan/50 active:text-ink"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        set(direction)
      }}
      onPointerUp={() => set(0)}
      onPointerCancel={() => set(0)}
      onLostPointerCapture={() => set(0)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  )
}

/**
 * Free-flight overlay. Desktop gets a compact key legend; touch layouts get
 * a joystick, up/down buttons and speed steppers. Both get speed, reset and
 * an always-visible exit.
 */
export default function FlightHud({ input, speed, onSpeedChange, onReset, onExit, touch, reducedMotion, sceneLabel = null, children = null }) {
  const stepSpeed = (factor) => {
    const next = Math.min(FLIGHT_SPEED.max, Math.max(FLIGHT_SPEED.min, speed * factor))
    input.current.speed = next
    onSpeedChange(next)
  }

  const blurAfter = (fn) => (event) => {
    fn()
    // Space flies upward; a focused button would also be "pressed" by it.
    event.currentTarget.blur()
  }

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.5 }}
    >
      {/* Centre reticle: a fixed reference point while turning. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/35"
      >
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/80" />
      </span>

      <div className="pointer-events-auto absolute left-4 top-20 sm:left-6 sm:top-24 lg:left-10">
        <button
          type="button"
          onClick={blurAfter(onExit)}
          className="group glass flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5 transition-colors duration-300 hover:border-white/20"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" {...stroke} className="text-cyan" />
          </svg>
          <span className="eyebrow text-ink-dim transition-colors group-hover:text-ink">
            Exit flight
          </span>
        </button>
        {sceneLabel && <p className="readout mt-3 pl-1 opacity-70">Flying · {sceneLabel}</p>}
      </div>

      <div className="glass pointer-events-auto absolute right-4 top-36 flex items-center gap-1 rounded-full py-1.5 pl-4 pr-1.5 sm:right-6 sm:top-24 lg:right-10">
        <span className="readout mr-1 opacity-60">Speed</span>
        <span className="mr-1 w-10 font-mono text-[0.75rem] tabular-nums text-ink" aria-live="polite">
          {speed.toFixed(speed < 10 ? 1 : 0)}
        </span>
        {touch && (
          <>
            <button
              type="button"
              aria-label="Slower"
              onClick={blurAfter(() => stepSpeed(1 / 1.5))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-white/[0.06]"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true"><path d="M3.5 8h9" {...stroke} /></svg>
            </button>
            <button
              type="button"
              aria-label="Faster"
              onClick={blurAfter(() => stepSpeed(1.5))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:bg-white/[0.06]"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" {...stroke} /></svg>
            </button>
          </>
        )}
        <span className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />
        <button
          type="button"
          onClick={blurAfter(onReset)}
          aria-label="Reset position"
          title="Reset position"
          className="flex h-8 items-center gap-2 rounded-full px-3 text-ink-dim transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M3 8a5 5 0 1 0 1.6-3.7M3 3v2.6h2.6" {...stroke} />
          </svg>
          <span className="eyebrow hidden sm:inline">Reset</span>
        </button>
      </div>

      {touch ? (
        <>
          <div className="absolute bottom-8 left-6">
            <VirtualJoystick input={input} />
          </div>
          <div className="absolute bottom-8 right-6 flex flex-col gap-3">
            <HoldButton input={input} direction={1} label="Fly up">
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><path d="M3.5 10 8 5.5l4.5 4.5" {...stroke} /></svg>
            </HoldButton>
            <HoldButton input={input} direction={-1} label="Fly down">
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6" {...stroke} /></svg>
            </HoldButton>
          </div>
          <p className="readout absolute inset-x-0 top-52 text-center opacity-60 sm:top-40">Drag anywhere to look around</p>
        </>
      ) : (
        <div className="absolute inset-x-0 bottom-9 flex justify-center px-6">
          <div className="glass flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full px-6 py-3">
            <span className="flex items-center gap-1.5">
              <Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key>
              <span className="readout ml-1 opacity-70">Move</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Key>Drag</Key>
              <span className="readout ml-1 opacity-70">Look</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Key>Space</Key><Key>Shift</Key>
              <span className="readout ml-1 opacity-70">Up / Down</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Key>Scroll</Key>
              <span className="readout ml-1 opacity-70">Speed</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Key>Esc</Key>
              <span className="readout ml-1 opacity-70">Exit</span>
            </span>
          </div>
        </div>
      )}
      {children}
    </motion.div>
  )
}
