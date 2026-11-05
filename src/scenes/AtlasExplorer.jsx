import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import AtlasMap, { MAP_OBJECTS } from '../components/3d/atlas/AtlasMap.jsx'
import SystemView from '../components/3d/atlas/SystemView.jsx'
import ExplorerRig from '../components/3d/ExplorerRig.jsx'
import Starfield from '../components/3d/Starfield.jsx'
import { CATALOGUE_BY_ID } from '../data/catalogue/index.js'
import { buildSystem } from '../lib/systems.js'
import { selectObject } from '../lib/atlas.js'
import gsap from '../lib/gsapConfig.js'

const HOME = { position: [24, 15, 34], target: [4, 0, 0] }
const QUAD = new THREE.PlaneGeometry(2, 2)

function Veil({ amount }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { uVeil: { value: 0 } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform float uVeil; void main() { gl_FragColor = vec4(0.012, 0.016, 0.043, uVeil); }',
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    material.uniforms.uVeil.value = amount.current.value
  })
  return <mesh geometry={QUAD} material={material} frustumCulled={false} renderOrder={60} raycast={() => null} />
}

const positionOf = (entry) => MAP_OBJECTS.find((object) => object.entry.id === entry.id || object.entry.system === entry.system)?.position ?? [0, 0, 0]

/**
 * The Universe scene. The map is always the way in: choosing an object flies
 * the camera to it, then fades into that object's own system. The heavy
 * meshes exist only inside SystemView, for the one system on screen.
 */
export default function AtlasExplorer({ atlas, setAtlas, view, reducedMotion, viewShift }) {
  const { focusId, systemId } = atlas
  const pick = useCallback((id) => selectObject(setAtlas, id), [setAtlas])
  const [shownSystem, setShownSystem] = useState(null)
  const [, refresh] = useReducer((n) => n + 1, 0)
  const veil = useRef({ value: 0 })
  const stars = useRef({ value: reducedMotion ? 1 : 0 })
  const tween = useRef(null)

  useEffect(() => {
    const t = gsap.to(stars.current, { value: 1, duration: reducedMotion ? 0.01 : 1.4 })
    return () => t.kill()
  }, [reducedMotion])

  const pose = useMemo(() => {
    const entry = CATALOGUE_BY_ID[focusId]
    if (!entry) return HOME
    const p = positionOf(entry)
    const out = new THREE.Vector3().fromArray(p)
    const away = out.length() > 0.1 ? out.clone().normalize() : new THREE.Vector3(0.4, 0.3, 0.8)
    return { position: out.clone().addScaledVector(away, 5).add(new THREE.Vector3(0, 1.6, 0)).toArray(), target: p }
  }, [focusId])

  // Into a system: fly there first, then fade across. Out: fade back at once.
  useEffect(() => {
    tween.current?.kill()
    if (systemId === shownSystem) return
    const swap = () => {
      setShownSystem(systemId)
      refresh()
    }
    if (reducedMotion) {
      swap()
      return
    }
    const fromMap = shownSystem === null
    tween.current = gsap
      .timeline()
      .to(veil.current, { value: 1, duration: 0.45, delay: fromMap ? 1.25 : 0, ease: 'power2.in' })
      .call(swap)
      .to(veil.current, { value: 0, duration: 0.6, ease: 'power2.out' })
    return () => tween.current?.kill()
  }, [systemId, shownSystem, reducedMotion])

  const system = useMemo(() => (shownSystem ? buildSystem(shownSystem) : null), [shownSystem])

  useEffect(() => {
    view.current.mode = system ? 'system' : 'map'
  }, [system, view])

  return (
    <>
      {system ? (
        <>
          <Starfield count={2600} innerRadius={300} outerRadius={900} sizeBase={0.6} sizeVariance={2.4} twinkle={!reducedMotion} scale={3.4} />
          <SystemView system={system} selectedId={focusId} onSelect={pick} view={view} reducedMotion={reducedMotion} />
        </>
      ) : (
        <>
          <ExplorerRig pose={pose} poseKey={focusId ?? 'home'} reducedMotion={reducedMotion} minDistance={1.5} maxDistance={140} viewShift={viewShift} autoRotate={!focusId} />
          <AtlasMap view={view} onPick={pick} opacityRef={stars} reducedMotion={reducedMotion} selectedId={focusId} />
        </>
      )}
      <Veil amount={veil} />
    </>
  )
}
