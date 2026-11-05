import { useSyncExternalStore } from 'react'

/**
 * Exploration progress, kept in this browser only. No account and nothing
 * leaves the device. Every read and write tolerates storage being unavailable,
 * in which case progress simply lasts for the visit.
 */
const KEY = 'cosmos.discovery.v1'
const LOG_LENGTH = 60

const EMPTY = { visited: {}, log: [], distanceLy: 0, bookmarks: [], compared: 0, descents: 0, badges: [], last: null }

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(window.localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...EMPTY }
  }
}

let state = typeof window === 'undefined' ? EMPTY : load()
const listeners = new Set()
const unlockListeners = new Set()
let badgeRules = []

function commit(next) {
  state = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage is optional.
  }
  listeners.forEach((listener) => listener())
  checkBadges()
}

function checkBadges() {
  const earned = badgeRules.filter((rule) => !state.badges.includes(rule.id) && rule.test(state))
  if (!earned.length) return
  state = { ...state, badges: [...state.badges, ...earned.map((rule) => rule.id)] }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage is optional.
  }
  listeners.forEach((listener) => listener())
  earned.forEach((rule) => unlockListeners.forEach((listener) => listener(rule)))
}

/** Rules live with the catalogue, so they load only when they can be earned. */
export function setBadgeRules(rules) {
  badgeRules = rules
  checkBadges()
}

export function onBadge(listener) {
  unlockListeners.add(listener)
  return () => unlockListeners.delete(listener)
}

/** Record a visit. `position` is true light-years, when known. */
export function recordVisit({ id, name, type, position = null }) {
  const first = !state.visited[id]
  let distanceLy = state.distanceLy
  if (position && state.last) {
    distanceLy += Math.hypot(position[0] - state.last[0], position[1] - state.last[1], position[2] - state.last[2])
  }
  if (!first && distanceLy === state.distanceLy) return
  commit({
    ...state,
    visited: first ? { ...state.visited, [id]: type } : state.visited,
    log: first ? [{ id, name, type, at: Date.now() }, ...state.log].slice(0, LOG_LENGTH) : state.log,
    distanceLy,
    last: position ?? state.last,
  })
}

export function toggleBookmark(id) {
  const has = state.bookmarks.includes(id)
  commit({ ...state, bookmarks: has ? state.bookmarks.filter((entry) => entry !== id) : [...state.bookmarks, id] })
}

export const recordCompare = () => commit({ ...state, compared: state.compared + 1 })
export const recordDescent = () => commit({ ...state, descents: state.descents + 1 })

export function resetDiscovery() {
  commit({ ...EMPTY })
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDiscovery() {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}
