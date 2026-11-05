import { useEffect, useMemo, useReducer } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Starfield from '../components/3d/Starfield.jsx'
import ExplorerRig from '../components/3d/ExplorerRig.jsx'
import SupernovaModel from '../components/3d/lab/SupernovaModel.jsx'
import PulsarModel from '../components/3d/lab/PulsarModel.jsx'
import WormholeModel from '../components/3d/lab/WormholeModel.jsx'
import SpacetimeModel from '../components/3d/lab/SpacetimeModel.jsx'
import ExoplanetModel from '../components/3d/lab/ExoplanetModel.jsx'
import CosmicScaleModel from '../components/3d/lab/CosmicScaleModel.jsx'
import LifeCycleModel from '../components/3d/lab/LifeCycleModel.jsx'
import { PHENOMENA_BY_ID } from '../data/phenomena.js'
import { useCrossfade } from '../hooks/useCrossfade.js'

const QUAD = new THREE.PlaneGeometry(2, 2)

/** Fades whatever is on screen, so each experience can be simple about it. */
function FadeVeil({ opacityRef }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { uVeil: { value: 1 } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform float uVeil; void main() { gl_FragColor = vec4(0.012, 0.016, 0.043, uVeil); }',
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    material.uniforms.uVeil.value = 1 - opacityRef.current.value
  })
  return <mesh geometry={QUAD} material={material} frustumCulled={false} renderOrder={50} raycast={() => null} />
}

/** The lab scene: one experience at a time, driven by `lab` from the interface. */
export default function PhenomenaExplorer({ phenomenonId, reducedMotion, viewShift, lab }) {
  const { shownId, opacity } = useCrossfade(phenomenonId, reducedMotion)
  const entry = PHENOMENA_BY_ID[shownId]
  const pixelRatio = useThree((state) => state.viewport.dpr)
  const [, refresh] = useReducer((n) => n + 1, 0)
  const ownSky = entry.kind === 'wormhole'

  return (
    <>
      {!ownSky && entry.kind !== 'scale' && (
        <Starfield count={3400} innerRadius={420} outerRadius={1100} sizeBase={0.6} sizeVariance={2.6} twinkle={!reducedMotion} scale={4} />
      )}

      <ExplorerRig
        pose={entry.pose}
        poseKey={entry.id}
        reducedMotion={reducedMotion}
        minDistance={entry.minDistance}
        maxDistance={entry.maxDistance}
        viewShift={viewShift}
        autoRotate={entry.kind === 'exoplanet' || entry.kind === 'supernova'}
      />

      {entry.kind === 'supernova' && <SupernovaModel key="supernova" control={lab.supernova} reducedMotion={reducedMotion} pixelRatio={pixelRatio} />}
      {entry.kind === 'pulsar' && <PulsarModel key="pulsar" control={lab.pulsar} reducedMotion={reducedMotion} />}
      {entry.kind === 'wormhole' && <WormholeModel key="wormhole" control={lab.wormhole} reducedMotion={reducedMotion} />}
      {entry.kind === 'spacetime' && <SpacetimeModel key="spacetime" control={lab.spacetime} onChange={refresh} />}
      {entry.kind === 'scale' && <CosmicScaleModel key="scale" control={lab.scale} />}
      {entry.kind === 'lifecycle' && <LifeCycleModel key="lifecycle" control={lab.lifecycle} reducedMotion={reducedMotion} pixelRatio={pixelRatio} />}
      {entry.kind === 'exoplanet' && <ExoplanetModel key={entry.id} entry={entry} reducedMotion={reducedMotion} />}

      <FadeVeil opacityRef={opacity} />
    </>
  )
}
