import { useEffect, useRef } from 'react'

const RADIUS = 52
// Thumb jitter near the centre should not drift the camera; beyond the dead
// zone the response is rescaled so full deflection is still reachable.
const DEAD_ZONE = 0.1

/**
 * Touch joystick for free flight. Writes a normalised vector into
 * `input.current.joystick` ({ x: strafe, y: forward }, each in [-1, 1]).
 *
 * Responsiveness: the knob follows the thumb with no CSS transition, the
 * output has a dead zone and a mild curve for fine control, and the stick
 * re-centres on its own the moment the touch ends or is cancelled.
 */
export default function VirtualJoystick({ input }) {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const pointer = useRef(null)
  const centre = useRef({ x: 0, y: 0 })

  const write = (x, y, knobX, knobY) => {
    const stick = input.current.joystick
    stick.x = x
    stick.y = y
    if (knobRef.current) knobRef.current.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`
  }

  const update = (event) => {
    let dx = event.clientX - centre.current.x
    let dy = event.clientY - centre.current.y
    const length = Math.hypot(dx, dy)
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS
      dy = (dy / length) * RADIUS
    }
    const magnitude = Math.min(1, length / RADIUS)
    if (magnitude < DEAD_ZONE) {
      write(0, 0, dx, dy)
      return
    }
    // Rescale past the dead zone, then ease the curve for precision.
    const scaled = Math.pow((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 1.35)
    const nx = dx / (length || 1)
    const ny = dy / (length || 1)
    write(nx * scaled, -ny * scaled, dx, dy)
  }

  const release = (event) => {
    if (event && event.pointerId !== pointer.current) return
    pointer.current = null
    write(0, 0, 0, 0)
  }

  // Never leave a vector behind when the HUD unmounts or the tab hides.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'visible') release()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onHide)
      const stick = input.current.joystick
      stick.x = 0
      stick.y = 0
    }
    // release only touches refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Movement joystick: drag to fly forward, back and sideways"
      className="glass pointer-events-auto relative flex h-36 w-36 touch-none select-none items-center justify-center rounded-full [-webkit-touch-callout:none]"
      onPointerDown={(event) => {
        if (pointer.current !== null) return
        event.preventDefault()
        pointer.current = event.pointerId
        const rect = baseRef.current.getBoundingClientRect()
        centre.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event)
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== pointer.current) return
        // Coalesced events give every sample since the last frame; the
        // latest is what matters for position.
        const samples = event.nativeEvent.getCoalescedEvents?.()
        update(samples && samples.length ? samples[samples.length - 1] : event)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="pointer-events-none absolute inset-3 rounded-full border border-white/[0.07]" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-[38%] rounded-full border border-white/[0.05]" aria-hidden="true" />
      <span
        ref={knobRef}
        aria-hidden="true"
        className="pointer-events-none h-14 w-14 rounded-full border border-cyan/50 bg-cyan/15 shadow-[0_0_24px_rgba(34,211,238,0.25)] will-change-transform"
      />
    </div>
  )
}
