import { CATALOGUE_BY_ID, truePosition } from '../data/catalogue/index.js'
import { recordVisit } from './discovery.js'

/** Go to an object: fly there, and open its system if it has one. */
export function selectObject(setAtlas, id) {
  const entry = CATALOGUE_BY_ID[id]
  if (!entry) return
  // A planet stays in its moons' view when picked from there.
  setAtlas((current) => ({
    ...current,
    focusId: id,
    systemId: current.systemId === `moons:${id}` ? current.systemId : (entry.system ?? null),
    catalogueOpen: false,
  }))
  recordVisit({ id, name: entry.name, type: entry.type, position: truePosition(entry) })
}

/** Open a nested system, such as a planet's moons, keeping the planet selected. */
export function openSystem(setAtlas, systemId, focusId = null) {
  setAtlas((current) => ({ ...current, systemId, focusId: focusId ?? current.focusId }))
}

export function returnToUniverse(setAtlas) {
  setAtlas((current) => ({ ...current, focusId: null, systemId: null }))
}
