import Starfield from '../components/3d/Starfield.jsx'
import NebulaModel from '../components/3d/NebulaModel.jsx'
import ExplorerRig from '../components/3d/ExplorerRig.jsx'
import { NEBULAE_BY_ID } from '../data/nebulae.js'
import { useMemo } from 'react'
import FlightControls, { explorerFlightSpace } from '../components/3d/FlightControls.jsx'
import { useCrossfade } from '../hooks/useCrossfade.js'

/**
 * Nebula explorer: one nebula at a time inside a field of background stars.
 * Switching cross-fades the clouds and flies the camera to the next view.
 */
export default function NebulaExplorer({
  nebulaId,
  reducedMotion,
  viewShift,
  flying = false,
  flightInput,
  flightReset,
  onFlightSpeed,
}) {
  const { shownId, opacity } = useCrossfade(nebulaId, reducedMotion)
  const nebula = NEBULAE_BY_ID[shownId]
  const flightSpace = useMemo(() => explorerFlightSpace(nebula), [nebula])

  return (
    <>
      <Starfield
        count={3600}
        innerRadius={500}
        outerRadius={1200}
        sizeBase={0.6}
        sizeVariance={3}
        twinkle={!reducedMotion}
        scale={4}
      />

      <NebulaModel key={nebula.id} nebulaId={nebula.id} opacityRef={opacity} reducedMotion={reducedMotion} />

      <ExplorerRig
        pose={nebula.pose}
        poseKey={nebula.id}
        reducedMotion={reducedMotion}
        minDistance={nebula.minDistance}
        maxDistance={nebula.maxDistance}
        viewShift={viewShift}
        suspended={flying}
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
    </>
  )
}
