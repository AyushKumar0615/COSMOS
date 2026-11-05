import Starfield from '../components/3d/Starfield.jsx'
import GalaxyModel from '../components/3d/GalaxyModel.jsx'
import ExplorerRig from '../components/3d/ExplorerRig.jsx'
import { GALAXIES_BY_ID } from '../data/galaxies.js'
import { useMemo } from 'react'
import FlightControls, { explorerFlightSpace } from '../components/3d/FlightControls.jsx'
import { useCrossfade } from '../hooks/useCrossfade.js'

/**
 * Galaxy explorer: one galaxy at a time, seen from intergalactic space.
 * Selecting another fades the current one out, swaps it, and flies the
 * camera to the new galaxy's vantage point while it fades in.
 */
export default function GalaxyExplorer({
  galaxyId,
  reducedMotion,
  viewShift,
  flying = false,
  flightInput,
  flightReset,
  onFlightSpeed,
}) {
  const { shownId, opacity } = useCrossfade(galaxyId, reducedMotion)
  const galaxy = GALAXIES_BY_ID[shownId]
  const flightSpace = useMemo(() => explorerFlightSpace(galaxy), [galaxy])

  return (
    <>
      {/* Distant background: sparse, faint, and far beyond any galaxy. */}
      <Starfield
        count={3200}
        innerRadius={900}
        outerRadius={1800}
        sizeBase={0.6}
        sizeVariance={2.4}
        twinkle={!reducedMotion}
        scale={5}
      />

      <GalaxyModel key={galaxy.id} galaxy={galaxy} opacityRef={opacity} reducedMotion={reducedMotion} />

      <ExplorerRig
        pose={galaxy.pose}
        poseKey={galaxy.id}
        reducedMotion={reducedMotion}
        minDistance={galaxy.minDistance}
        maxDistance={galaxy.maxDistance}
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
