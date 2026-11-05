import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'

const QUAD = new THREE.PlaneGeometry(1, 1)

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uPulse;
  varying vec2 vUv;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    // A bright core plus a long soft halo reads as light, not as a disc.
    float halo = pow(1.0 - r, uPower);
    float core = pow(1.0 - r, uPower * 4.0);
    float alpha = (halo * 0.7 + core * 0.6) * uIntensity * uPulse;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

/**
 * Camera-facing radial glow for galaxy cores, star clusters and the light
 * sources inside nebulae. An optional slow pulse (used for the Crab pulsar)
 * is disabled under reduced motion.
 */
export default function GlowSprite({
  position = [0, 0, 0],
  size = 1,
  color = '#ffffff',
  intensity = 1,
  power = 2,
  pulseRate = 0,
  pulseAmount = 0,
  opacityRef,
  reducedMotion = false,
  renderOrder = 5,
}) {
  const materialRef = useRef(null)

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uPulse: { value: 1 },
    }),
    [color, intensity, power],
  )

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    const pulse =
      pulseRate && !reducedMotion
        ? 1 + pulseAmount * Math.sin(state.clock.elapsedTime * pulseRate)
        : 1
    material.uniforms.uPulse.value = pulse
    material.uniforms.uIntensity.value = intensity * (opacityRef ? opacityRef.current.value : 1)
  })

  return (
    <Billboard position={position}>
      <mesh geometry={QUAD} scale={size} renderOrder={renderOrder} raycast={() => null}>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  )
}
