import { useSyncExternalStore } from 'react'
import { julianDate } from './orbits.js'

/**
 * One clock for everything that moves in the solar system.
 *
 *   Educational: the familiar compressed motion. Every orbit and spin keeps
 *   its real order, but speeds are squeezed so Neptune visibly moves while
 *   Mercury does not blur. `t` counts simulated seconds at a speed factor.
 *
 *   Real dates: positions are computed for a calendar date from JPL
 *   elements, and the date advances at a chosen rate (days per second).
 *   Distances and sizes stay compressed; angles and timing are real.
 *
 * Frame-loop readers use `clock` directly (no React work per frame); the
 * interface subscribes to the settings and a slow-ticking readout.
 */
export const EDUCATIONAL_SPEEDS = [0.25, 1, 4, 16]
export const REAL_RATES = [
  { days: 1 / 24, label: '1 hour / s' },
  { days: 1, label: '1 day / s' },
  { days: 7, label: '1 week / s' },
  { days: 30, label: '1 month / s' },
  { days: 365.25, label: '1 year / s' },
]

/** Mutable state read inside useFrame. */
export const clock = {
  t: 0,
  jd: julianDate(Date.now()),
  mode: 'educational',
  playing: true,
}

let settings = { mode: 'educational', playing: true, speed: 1, rate: 1 }
let readout = { jd: clock.jd, t: 0 }
const listeners = new Set()
const readoutListeners = new Set()

function emit(set) {
  set.forEach((listener) => listener())
}

export function setSimulation(patch) {
  settings = { ...settings, ...patch }
  clock.mode = settings.mode
  clock.playing = settings.playing
  emit(listeners)
}

/** Jump to a calendar date (real-dates mode). */
export function setSimulationDate(date) {
  clock.jd = julianDate(date.getTime())
  readout = { ...readout, jd: clock.jd }
  emit(readoutListeners)
}

export function resetToNow() {
  setSimulationDate(new Date())
}

let lastReadout = 0

/** Advance the clock; called once per frame, before anything reads it. */
export function tickClock(delta, wallSeconds) {
  const step = Math.min(delta, 0.1)
  if (settings.playing) {
    clock.t += step * EDUCATIONAL_SPEEDS[settings.speed]
    if (settings.mode === 'real') clock.jd += step * REAL_RATES[settings.rate].days
  }
  // The on-screen readout only needs a few updates a second.
  if (wallSeconds - lastReadout > 0.25) {
    lastReadout = wallSeconds
    readout = { jd: clock.jd, t: clock.t }
    emit(readoutListeners)
  }
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const subscribeReadout = (listener) => {
  readoutListeners.add(listener)
  return () => readoutListeners.delete(listener)
}

export const useSimulation = () => useSyncExternalStore(subscribe, () => settings, () => settings)
export const useSimulationReadout = () => useSyncExternalStore(subscribeReadout, () => readout, () => readout)
export const getSimulation = () => settings
