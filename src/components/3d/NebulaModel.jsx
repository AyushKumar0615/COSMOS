import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import CloudSprites from './CloudSprites.jsx'
import PointCloud from './PointCloud.jsx'
import GlowSprite from './GlowSprite.jsx'
import { generateNebula } from '../../lib/nebulaGenerator.js'
import { getCloudTexture } from '../../lib/cloudTexture.js'

/**
 * One nebula, layered in a fixed order so dust sits over the glowing gas and
 * lit rims sit over the dust: gas (additive), dust (normal), rims
 * (additive), stars, then glows.
 */
export default function NebulaModel({ nebulaId, opacityRef, reducedMotion }) {
  const gl = useThree((state) => state.gl)
  const texture = useMemo(() => getCloudTexture(gl), [gl])
  const data = useMemo(() => generateNebula(nebulaId), [nebulaId])

  return (
    <group>
      <CloudSprites sprites={data.clouds} texture={texture} opacityRef={opacityRef} reducedMotion={reducedMotion} renderOrder={1} />
      <CloudSprites sprites={data.dust} texture={texture} blending="normal" opacityRef={opacityRef} reducedMotion={reducedMotion} renderOrder={2} />
      <CloudSprites sprites={data.rims} texture={texture} opacityRef={opacityRef} reducedMotion={reducedMotion} renderOrder={3} />
      <PointCloud {...data.stars} alpha={0.95} scale={1} maxSize={18} opacityRef={opacityRef} renderOrder={4} />
      {data.glows.map((glow, index) => (
        <GlowSprite
          key={index}
          position={glow.position}
          size={glow.size}
          color={glow.color}
          intensity={glow.intensity}
          power={glow.power ?? 2.2}
          pulseRate={glow.pulseRate ?? 0}
          pulseAmount={glow.pulseAmount ?? 0}
          opacityRef={opacityRef}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
