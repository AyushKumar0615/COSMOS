import { AnimatePresence } from 'framer-motion'
import BlackHoleHud, { ProximityGauge } from './BlackHoleHud.jsx'
import DiveHud from './DiveHud.jsx'
import FlightHud from './FlightHud.jsx'
import { BLACK_HOLES_BY_ID } from '../../data/blackholes.js'
import { useBlackHoleMissions } from '../../hooks/useBlackHoleMissions.js'

/**
 * Everything on screen around a black hole, in one lazily loaded chunk so its
 * data and interface stay out of the first load. Missions are watched here
 * because they keep running while the visitor is in free flight.
 */
export default function BlackHoleLayer({ hud, flight, diving, dive, onEndDive, telemetry, onMissionComplete, reducedMotion }) {
  const missions = useBlackHoleMissions(telemetry, !diving, onMissionComplete)
  const hole = BLACK_HOLES_BY_ID[hud.selectedId]

  let content
  if (diving) {
    content = <DiveHud key="dive" dive={dive} holeId={hud.selectedId} onReturn={onEndDive} reducedMotion={reducedMotion} />
  } else if (flight) {
    content = (
      <FlightHud key="flight" {...flight} sceneLabel={hole.name} reducedMotion={reducedMotion}>
        <ProximityGauge
          telemetry={telemetry}
          hole={hole}
          className="absolute left-4 top-[8.25rem] sm:left-6 sm:top-[8.75rem] lg:left-10"
        />
      </FlightHud>
    )
  } else {
    content = <BlackHoleHud key="explore" {...hud} telemetry={telemetry} missions={missions} reducedMotion={reducedMotion} />
  }

  return <AnimatePresence mode="wait">{content}</AnimatePresence>
}
