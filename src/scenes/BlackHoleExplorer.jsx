import { useMemo } from 'react'
import BlackHoleModel from '../components/3d/BlackHoleModel.jsx'
import InfallParticles from '../components/3d/InfallParticles.jsx'
import DiveController from '../components/3d/DiveController.jsx'
import ExplorerRig from '../components/3d/ExplorerRig.jsx'
import FlightControls, { blackHoleFlightSpace } from '../components/3d/FlightControls.jsx'
import { BLACK_HOLES_BY_ID } from '../data/blackholes.js'
import { useCrossfade } from '../hooks/useCrossfade.js'

/**
 * Black hole explorer. Three ways to hold the camera: orbiting (the rig),
 * free flight, and the guided descent. All of them share the ray tracer, which
 * reads the camera wherever it happens to be.
 */
export default function BlackHoleExplorer({
  blackHoleId,
  reducedMotion,
  viewShift,
  flying = false,
  flightInput,
  flightReset,
  onFlightSpeed,
  diving = false,
  overlay = false,
  telemetry,
  dive,
}) {
  const { shownId, opacity } = useCrossfade(blackHoleId, reducedMotion)
  const hole = BLACK_HOLES_BY_ID[shownId]
  const flightSpace = useMemo(() => blackHoleFlightSpace(hole), [hole])

  return (
    <>
      <ExplorerRig
        pose={hole.pose}
        poseKey={hole.id}
        reducedMotion={reducedMotion}
        minDistance={2.3}
        maxDistance={90}
        viewShift={diving ? null : viewShift}
        suspended={flying || diving}
      />

      {flying && (
        <FlightControls
          input={flightInput}
          reducedMotion={reducedMotion}
          resetSignal={flightReset}
          onSpeedChange={onFlightSpeed}
          space={flightSpace}
        />
      )}

      {diving && <DiveController dive={dive} reducedMotion={reducedMotion} />}

      <BlackHoleModel
        hole={hole}
        opacityRef={opacity}
        overlay={overlay}
        reducedMotion={reducedMotion}
        telemetry={telemetry}
        dive={dive}
      />
      <InfallParticles hole={hole} opacityRef={opacity} reducedMotion={reducedMotion} />
    </>
  )
}
