import { useSyncExternalStore } from 'react'

/**
 * Notable alignments happening right now in the simulation (eclipses), so the
 * interface can announce them. Written by the frame loop only when the set
 * changes, never every frame.
 */
let events = []
let key = ''
const listeners = new Set()

export function reportEvents(next) {
  const nextKey = next.map((e) => `${e.kind}:${e.body}:${e.type}`).join('|')
  if (nextKey === key) return
  key = nextKey
  events = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSolarEvents = () => useSyncExternalStore(subscribe, () => events, () => events)
