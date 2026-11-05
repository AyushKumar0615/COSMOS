import { lazy, Suspense } from 'react'
import SolarScene from './SolarScene.jsx'
import MissionBackdrop from './MissionBackdrop.jsx'

// Each explorer is its own chunk, fetched the first time it is visited.
const GalaxyExplorer = lazy(() => import('./GalaxyExplorer.jsx'))
const NebulaExplorer = lazy(() => import('./NebulaExplorer.jsx'))
const BlackHoleExplorer = lazy(() => import('./BlackHoleExplorer.jsx'))
const PhenomenaExplorer = lazy(() => import('./PhenomenaExplorer.jsx'))
const AtlasExplorer = lazy(() => import('./AtlasExplorer.jsx'))

const explorerProps = (props) => ({
  reducedMotion: props.reducedMotion,
  viewShift: props.viewShift,
  flying: props.mode === 'flight',
  flightInput: props.flightInput,
  flightReset: props.flightReset,
  onFlightSpeed: props.onFlightSpeed,
})

/**
 * Scene router inside the single shared Canvas. Every scene reuses the same
 * renderer, camera and frame loop; switching scenes swaps what is mounted
 * under them, behind the travel overlay, never the Three.js infrastructure.
 */
export default function SpaceEnvironment(props) {
  const { phase, scene, reducedMotion } = props

  if (phase === 'universe' && scene === 'galaxies') {
    return (
      <Suspense fallback={null}>
        <GalaxyExplorer galaxyId={props.galaxyId} {...explorerProps(props)} />
      </Suspense>
    )
  }

  if (phase === 'universe' && scene === 'nebulae') {
    return (
      <Suspense fallback={null}>
        <NebulaExplorer nebulaId={props.nebulaId} {...explorerProps(props)} />
      </Suspense>
    )
  }

  if (phase === 'universe' && scene === 'black-holes') {
    return (
      <Suspense fallback={null}>
        <BlackHoleExplorer
          blackHoleId={props.blackHoleId}
          diving={props.diving}
          overlay={props.blackHoleOverlay}
          telemetry={props.blackHoleTelemetry}
          dive={props.dive}
          {...explorerProps(props)}
        />
      </Suspense>
    )
  }

  if (phase === 'universe' && scene === 'universe') {
    return (
      <Suspense fallback={null}>
        <AtlasExplorer
          atlas={props.atlas}
          setAtlas={props.setAtlas}
          view={props.atlasView}
          reducedMotion={reducedMotion}
          viewShift={props.viewShift}
        />
      </Suspense>
    )
  }

  if (phase === 'universe' && scene === 'phenomena') {
    return (
      <Suspense fallback={null}>
        <PhenomenaExplorer
          phenomenonId={props.phenomenonId}
          reducedMotion={reducedMotion}
          viewShift={props.viewShift}
          lab={props.lab}
        />
      </Suspense>
    )
  }

  if (phase === 'universe' && scene === 'missions') {
    return <MissionBackdrop reducedMotion={reducedMotion} />
  }

  return <SolarScene {...props} />
}
