import { useSyncExternalStore } from 'react'
import { SPEED_LOG } from './openWorld.js'

/**
 * Shared state for the open universe, between the 3D scene and its HUD (two
 * lazy chunks). The ship and input are mutated every frame without React;
 * settings and telemetry are small snapshots React subscribes to.
 */

// --- Per-frame state (never triggers a render) -----------------------------------

export const ship = {
  pos: [0, 0, 0], // km, world frame
  quat: [0, 0, 0, 1],
  vel: [0, 0, 0], // km/s, world frame
  speed: 0, // km/s actually travelled this frame (autopilot included)
  thrust: 0, // 0..1, for the astronaut and audio
}

export const input = {
  joystick: { x: 0, y: 0 },
  vertical: 0,
  boost: false,
  look: { x: 0, y: 0 }, // accumulated pointer deltas, consumed by the scene
}

/** DOM marker pool, owned by the HUD and written by the scene each frame. */
export const markers = { root: null, arrow: null }

/** One-shot requests from the HUD to the scene. */
export const commands = { reset: 0, face: null }

// --- Settings ---------------------------------------------------------------------

let settings = {
  speedLog: SPEED_LOG.initial,
  camera: 'third', // 'third' | 'first'
  paused: false,
  dampers: true,
  response: 1, // seconds to reach the set speed
  targetId: null,
  autopilot: false,
  sound: false,
  volume: 0.6,
  dust: true, // speed streaks
  field: true, // procedural field stars
  labels: true, // floating markers
  route: true, // line to the target
  belts: true, // asteroid and Kuiper belts (modelled)
  constellations: false, // figure lines, near the Sun only
  mouseSteer: false,
}
// Display and volume choices last between visits; sound itself never starts
// on its own (browsers block autoplay, and it should be the visitor's choice).
const SAVED_KEY = 'cosmos.open.settings.v1'
const SAVED = ['volume', 'dust', 'field', 'labels', 'route', 'belts', 'constellations', 'camera', 'response', 'dampers']
try {
  if (typeof window !== 'undefined') {
    const stored = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '{}')
    for (const key of SAVED) if (key in stored && typeof stored[key] === typeof settings[key]) settings[key] = stored[key]
  }
} catch {
  // Storage is optional.
}
const settingListeners = new Set()

export function setOpenSettings(patch) {
  const next = typeof patch === 'function' ? patch(settings) : patch
  settings = { ...settings, ...next }
  if (SAVED.some((key) => key in next)) {
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(Object.fromEntries(SAVED.map((key) => [key, settings[key]]))))
    } catch {
      // Storage is optional.
    }
  }
  settingListeners.forEach((listener) => listener())
}
export const getOpenSettings = () => settings
export const useOpenSettings = () =>
  useSyncExternalStore(
    (listener) => (settingListeners.add(listener), () => settingListeners.delete(listener)),
    () => settings,
    () => settings,
  )

// --- Telemetry (published a few times a second) --------------------------------------

let telemetry = null
const telemetryListeners = new Set()
export function publishTelemetry(next) {
  telemetry = next
  telemetryListeners.forEach((listener) => listener())
}
export const useTelemetry = () =>
  useSyncExternalStore(
    (listener) => (telemetryListeners.add(listener), () => telemetryListeners.delete(listener)),
    () => telemetry,
    () => telemetry,
  )

// --- Events (discoveries, autopilot arrivals) ----------------------------------------

const eventListeners = new Set()
export const onOpenEvent = (listener) => (eventListeners.add(listener), () => eventListeners.delete(listener))
export const emitOpenEvent = (event) => eventListeners.forEach((listener) => listener(event))

// --- Saved places (positions, not catalogue objects) -----------------------------------

const PLACES_KEY = 'cosmos.open.places.v1'
let places = (() => {
  try {
    return typeof window === 'undefined' ? [] : JSON.parse(window.localStorage.getItem(PLACES_KEY) ?? '[]')
  } catch {
    return []
  }
})()
const placeListeners = new Set()
function commitPlaces(next) {
  places = next
  try {
    window.localStorage.setItem(PLACES_KEY, JSON.stringify(places))
  } catch {
    // Storage is optional.
  }
  placeListeners.forEach((listener) => listener())
}
export function savePlace(name) {
  const id = `place:${Date.now().toString(36)}`
  commitPlaces([{ id, name, pos: [...ship.pos] }, ...places].slice(0, 30))
  return id
}
export const removePlace = (id) => commitPlaces(places.filter((p) => p.id !== id))
export const getPlaces = () => places
export const usePlaces = () =>
  useSyncExternalStore(
    (listener) => (placeListeners.add(listener), () => placeListeners.delete(listener)),
    () => places,
    () => places,
  )
