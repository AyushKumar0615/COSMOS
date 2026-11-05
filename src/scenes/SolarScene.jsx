import { useCallback, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import Starfield from '../components/3d/Starfield.jsx'
import Nebula from '../components/3d/Nebula.jsx'
import Debris from '../components/3d/Debris.jsx'
import CameraRig from '../components/3d/CameraRig.jsx'
import SceneLights from '../components/3d/SceneLights.jsx'
import SolarSystem from '../components/3d/SolarSystem.jsx'
import FlightControls from '../components/3d/FlightControls.jsx'
import { framingRadius } from '../lib/cameraFraming.js'

const SYSTEM_PHASES = new Set(['entering', 'universe', 'exiting'])

/**
 * The deep-space backdrop (Phase 2) plus the solar system (Phase 3), and
 * the two Phase 5 ways of moving through it: guided tours and free flight.
 *
 * OrbitControls stays mounted throughout the universe phase and is merely
 * disabled during free flight. Unmounting it would re-create it with a
 * default target, and its first update would snap the view to the origin.
 */
export default function SolarScene({
  phase,
  reducedMotion,
  selectedId,
  onSelect,
  cameraCommand,
  onPhaseSettled,
  mode = 'explore',
  focusView = null,
  flightInput,
  flightReset,
  onFlightSpeed,
  onUserOrbit,
  tourPlaying = false,
  viewShift = null,
  flightKey = null,
  onFlightSettled,
}) {
  const motion = reducedMotion ? 0 : 1
  const isUniverse = phase === 'universe'
  const flying = mode === 'flight' && isUniverse

  // Planets register their scene nodes here so the camera can follow them.
  const bodies = useRef(new Map())
  const registerBody = useCallback((id, node) => {
    if (node) bodies.current.set(id, node)
    else bodies.current.delete(id)
  }, [])

  const focused = Boolean(selectedId) && !flying

  return (
    <>
      <CameraRig
        phase={phase}
        reducedMotion={reducedMotion}
        focusId={flying ? null : selectedId}
        focusView={flying ? null : focusView}
        command={cameraCommand}
        bodies={bodies}
        onPhaseSettled={onPhaseSettled}
        suspended={flying}
        viewShift={viewShift}
        flightKey={flying ? null : flightKey}
        onFlightSettled={onFlightSettled}
      />

      <SceneLights phase={phase} reducedMotion={reducedMotion} />

      <Nebula motion={motion} />

      {/* Far field: the dense starfield. */}
      <Starfield
        count={6500}
        innerRadius={30}
        outerRadius={230}
        sizeBase={0.5}
        sizeVariance={4.0}
        twinkle={!reducedMotion}
      />

      {/* Near field, pushed out beyond Neptune's orbit so no star ever sits
          between the planets, while still parallaxing against the far field. */}
      <Starfield
        count={900}
        innerRadius={26}
        outerRadius={70}
        sizeBase={0.4}
        sizeVariance={1.3}
        twinkle={false}
        scale={0.85}
      />

      <Debris count={170} motion={motion} />

      {SYSTEM_PHASES.has(phase) && (
        <SolarSystem
          phase={phase}
          selectedId={flying ? null : selectedId}
          onSelect={onSelect}
          onRegister={registerBody}
          reducedMotion={reducedMotion}
        />
      )}

      {isUniverse && (
        <OrbitControls
          makeDefault
          enabled={!flying}
          enableDamping
          dampingFactor={0.07}
          rotateSpeed={0.45}
          zoomSpeed={0.7}
          // Panning would drag the target off a followed planet, so it is
          // available in the overview only. Reset restores the centre.
          enablePan={!focused}
          panSpeed={0.6}
          screenSpacePanning
          minDistance={focused ? framingRadius(selectedId) * 1.6 : 3.2}
          maxDistance={90}
          // A slow drift around each tour stop, unless the visitor prefers
          // reduced motion or has paused the tour.
          autoRotate={tourPlaying && !reducedMotion}
          autoRotateSpeed={0.35}
          onStart={onUserOrbit}
        />
      )}

      {flying && (
        <FlightControls
          input={flightInput}
          reducedMotion={reducedMotion}
          resetSignal={flightReset}
          onSpeedChange={onFlightSpeed}
        />
      )}
    </>
  )
}
