import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import GlowSprite from '../GlowSprite.jsx'
import PlanetAtmosphere from '../PlanetAtmosphere.jsx'
import { getWorldTexture } from '../../../lib/planetTextures.js'

const SPHERE = new THREE.SphereGeometry(1, 72, 52)
const STAR_POSITION = [-210, 46, 34]
const ALWAYS = { current: { value: 1 } }

/** A model world lit by its own star, whose colour sets the whole mood. */
export default function ExoplanetModel({ entry, reducedMotion }) {
  const gl = useThree((state) => state.gl)
  const { world } = entry
  const texture = useMemo(() => getWorldTexture(gl, world), [gl, world])
  const spin = useRef(null)

  useFrame((_, delta) => {
    if (spin.current && !reducedMotion) spin.current.rotation.y += Math.min(delta, 0.1) * 0.05
  })

  return (
    <group>
      <directionalLight position={STAR_POSITION} color={world.star} intensity={3.1} />
      <ambientLight intensity={0.1} />
      <group scale={6.4}>
        <mesh ref={spin} geometry={SPHERE} raycast={() => null}>
          <meshStandardMaterial
            map={texture}
            roughness={0.9}
            metalness={0}
            emissive={world.emissive ? '#ffffff' : '#000000'}
            emissiveMap={world.emissive ? texture : null}
            emissiveIntensity={world.emissive ?? 0}
          />
        </mesh>
        <PlanetAtmosphere geometry={SPHERE} color={world.atmosphere} intensity={world.atmosphereGlow} />
      </group>
      <GlowSprite position={STAR_POSITION} size={world.starSize * 3} color={world.star} intensity={0.9} power={2.4} opacityRef={ALWAYS} />
    </group>
  )
}
