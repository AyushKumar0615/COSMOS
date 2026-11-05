import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import PointCloud from './PointCloud.jsx'
import GlowSprite from './GlowSprite.jsx'
import { generateGalaxy } from '../../lib/galaxyGenerator.js'

const MARKER_RING = new THREE.RingGeometry(1, 1.12, 48)

/**
 * One procedural galaxy. Layers render in a fixed order: stars (additive),
 * dust (normal blending, so it dims what is behind), star-forming knots,
 * then glows. The disc turns slowly as a rigid body; real galaxies rotate
 * differentially, but at any visible speed that would wind the arms up
 * within minutes, so the rotation here is illustrative only.
 */
export default function GalaxyModel({ galaxy, opacityRef, reducedMotion }) {
  const spinRef = useRef(null)
  const data = useMemo(() => generateGalaxy(galaxy.model), [galaxy])
  const { model } = galaxy

  useFrame((_, delta) => {
    if (spinRef.current && !reducedMotion) {
      spinRef.current.rotation.y += Math.min(delta, 0.1) * 0.008
    }
  })

  return (
    <group rotation={model.rotation}>
      <group ref={spinRef}>
        <PointCloud
          {...data.stars}
          alpha={0.82}
          scale={model.pointScale}
          maxSize={22}
          opacityRef={opacityRef}
          renderOrder={1}
        />
        <PointCloud
          {...data.dust}
          blending="normal"
          alpha={0.2}
          scale={model.pointScale}
          maxSize={40}
          opacityRef={opacityRef}
          renderOrder={2}
        />
        <PointCloud
          {...data.knots}
          alpha={0.55}
          scale={model.pointScale}
          maxSize={30}
          opacityRef={opacityRef}
          renderOrder={3}
        />

        {data.glows.map((glow, index) => (
          <GlowSprite
            key={index}
            position={glow.position}
            size={glow.size}
            color={glow.color}
            intensity={glow.intensity}
            power={2.4}
            opacityRef={opacityRef}
          />
        ))}

        {data.marker && <SunMarker position={data.marker} opacityRef={opacityRef} />}
      </group>
    </group>
  )
}

function SunMarker({ position, opacityRef }) {
  const materialRef = useRef(null)
  useFrame(() => {
    if (materialRef.current) materialRef.current.opacity = 0.85 * opacityRef.current.value
  })
  return (
    <Billboard position={position}>
      <mesh geometry={MARKER_RING} scale={1.6} renderOrder={6} raycast={() => null}>
        <meshBasicMaterial
          ref={materialRef}
          color="#22d3ee"
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  )
}
