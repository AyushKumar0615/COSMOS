import { useSyncExternalStore } from 'react'

/**
 * Visual-effect preferences, remembered in this browser. They switch purely
 * illustrative layers on and off; nothing here changes any data shown.
 */
const KEY = 'cosmos.effects.v1'

export const EFFECT_DEFAULTS = {
  meteors: true,
  satellites: true,
  orbits: false,
  events: true,
  auroras: true,
  // 0 to 1.5: scales meteor frequency and brightness, dust and distant events.
  intensity: 1,
}

function load() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? '{}')
    const next = { ...EFFECT_DEFAULTS }
    for (const key of Object.keys(EFFECT_DEFAULTS)) {
      if (typeof saved[key] === typeof EFFECT_DEFAULTS[key]) next[key] = saved[key]
    }
    next.intensity = Math.min(1.5, Math.max(0, next.intensity))
    return next
  } catch {
    return { ...EFFECT_DEFAULTS }
  }
}

let state = typeof window === 'undefined' ? EFFECT_DEFAULTS : load()
const listeners = new Set()

export function setEffect(key, value) {
  if (!(key in EFFECT_DEFAULTS) || state[key] === value) return
  state = { ...state, [key]: value }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage is optional: the choice then lasts for the visit.
  }
  listeners.forEach((listener) => listener())
}

export function getEffects() {
  return state
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useEffects() {
  return useSyncExternalStore(subscribe, getEffects, () => EFFECT_DEFAULTS)
}
