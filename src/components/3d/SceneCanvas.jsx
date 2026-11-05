import { Component, Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import SpaceEnvironment from '../../scenes/SpaceEnvironment.jsx'
import StaticSpaceFallback from '../interface/StaticSpaceFallback.jsx'
import { LANDING_POSITION } from './CameraRig.jsx'
import { quality } from '../../lib/quality.js'

// Below this the scene turns soft, so a struggling device drops frames
// rather than resolution past this point.
const MIN_DPR = 0.75
const STEP = 0.25
// A lost context normally returns within a moment. If it has not by now the
// GPU is gone for good, and the static backdrop beats a black screen.
const CONTEXT_RESTORE_TIMEOUT = 6000

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    // Surfaced once, deliberately, so a renderer failure stays diagnosable.
    console.error('[COSMOS] 3D scene failed; falling back to static space.', error)
    this.props.onError?.()
  }

  render() {
    if (this.state.failed) return <StaticSpaceFallback />
    return this.props.children
  }
}

/**
 * Everything except the error and background-click handlers is passed
 * straight through to the scene router.
 */
export default function SceneCanvas({ onError, onBackgroundClick, ...sceneProps }) {
  const ceiling = quality().dprMax
  // Resolution starts at what this device looks able to drive and then
  // follows the frame rate: PerformanceMonitor steps it down while frames
  // are slow and back up when they recover, so an integrated GPU stays
  // smooth without every machine being held to its limits.
  const [dpr, setDpr] = useState(ceiling)

  const contextTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(contextTimer.current), [])

  return (
    <SceneErrorBoundary onError={onError}>
      <Canvas
        className="absolute inset-0"
        dpr={dpr}
        gl={{
          // On for Phase 3: orbit lines and planet limbs alias badly without
          // it on 1x displays. MSAA is a hardware resolve, not post-processing.
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{
          fov: 55,
          near: 0.1,
          // Far enough for the galaxy explorer, where Andromeda's disc and
          // the background stars sit hundreds of units from the camera.
          far: 4000,
          position: LANDING_POSITION.toArray(),
        }}
        performance={{ min: 0.5 }}
        onCreated={(state) => {
          state.gl.setClearColor('#03040B', 1)
          // Three.js recovers its own state and bakeTexture redraws the baked
          // maps; all that is left to decide here is when to give up.
          const canvas = state.gl.domElement
          canvas.addEventListener('webglcontextlost', () => {
            window.clearTimeout(contextTimer.current)
            contextTimer.current = window.setTimeout(() => onError?.(), CONTEXT_RESTORE_TIMEOUT)
          })
          canvas.addEventListener('webglcontextrestored', () => {
            window.clearTimeout(contextTimer.current)
          })
          // Opt-in diagnostics for automated tests: ?debug exposes the
          // renderer state (memory counters, camera) on window.
          if (new URLSearchParams(window.location.search).has('debug')) window.__cosmos = state
        }}
        // R3F only fires this for clicks that travel under a few pixels, so
        // ending an orbit-drag over empty space does not clear the selection.
        onPointerMissed={onBackgroundClick}
      >
        <PerformanceMonitor
          ms={250}
          iterations={5}
          flipflops={3}
          onDecline={() => setDpr((current) => Math.max(MIN_DPR, Number((current - STEP).toFixed(2))))}
          onIncline={() => setDpr((current) => Math.min(ceiling, Number((current + STEP).toFixed(2))))}
          // After enough swings back and forth, settle low and stop moving.
          onFallback={() => setDpr(MIN_DPR)}
        />
        <Suspense fallback={null}>
          <SpaceEnvironment {...sceneProps} />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  )
}
