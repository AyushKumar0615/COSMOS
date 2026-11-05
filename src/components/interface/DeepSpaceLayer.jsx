import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import ExplorerHud from './ExplorerHud.jsx'
import FlightHud from './FlightHud.jsx'
import { GALAXIES, GALAXIES_BY_ID, GALAXY_SCALE_NOTE } from '../../data/galaxies.js'
import { NEBULAE, NEBULAE_BY_ID, NEBULA_SCALE_NOTE } from '../../data/nebulae.js'
import { recordVisit } from '../../lib/discovery.js'

const SCENES = {
  galaxies: { title: 'Galaxies', items: GALAXIES, byId: GALAXIES_BY_ID, note: GALAXY_SCALE_NOTE, type: 'galaxy' },
  nebulae: { title: 'Nebulae', items: NEBULAE, byId: NEBULAE_BY_ID, note: NEBULA_SCALE_NOTE, type: 'nebula' },
}

/**
 * The galaxy and nebula interfaces, with all their data, in a lazy chunk: that
 * text is the bulk of the catalogue and the landing page never needs it.
 */
export default function DeepSpaceLayer({ scene, selectedId, flight, reducedMotion, ...hud }) {
  const config = SCENES[scene]
  const item = config.byId[selectedId]

  useEffect(() => {
    // The catalogue's id for the galaxy M87 differs from the model's.
    recordVisit({ id: item.id === 'virgo-a' ? 'm87' : item.id, name: item.name, type: config.type })
  }, [item, config])

  return (
    <AnimatePresence mode="wait">
      {flight ? (
        <FlightHud key="flight" {...flight} sceneLabel={item.name} reducedMotion={reducedMotion} />
      ) : (
        <ExplorerHud key={scene} title={config.title} items={config.items} selectedId={selectedId} scaleNote={config.note} reducedMotion={reducedMotion} {...hud} />
      )}
    </AnimatePresence>
  )
}
