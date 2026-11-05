import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scaleCount } from '../../lib/quality.js'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;
  uniform float uScale;

  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    // Each star breathes on its own phase so the field never pulses in unison.
    float twinkle = 1.0 - uTwinkle * 0.42 * (0.5 + 0.5 * sin(uTime * 1.35 + aPhase * 6.2831853));

    vColor = aColor;
    vIntensity = twinkle;

    float dist = max(-viewPosition.z, 0.001);
    gl_PointSize = aSize * uScale * uPixelRatio * (240.0 / dist) * twinkle;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    // Soft round sprite built in the shader: no texture to download.
    float d = length(gl_PointCoord - vec2(0.5));
    float disc = 1.0 - smoothstep(0.0, 0.5, d);
    float core = pow(disc, 3.0);
    float alpha = core * vIntensity;

    if (alpha < 0.008) discard;

    gl_FragColor = vec4(vColor * (0.55 + core * 0.75), alpha);
  }
`

// Weighted stellar palette: mostly cool white, a few cyan, violet and warm
// stars so the field reads as varied rather than uniformly blue.
const PALETTE = [
  { color: [0.84, 0.89, 1.0], weight: 0.6 },
  { color: [0.62, 0.9, 1.0], weight: 0.16 },
  { color: [0.76, 0.69, 1.0], weight: 0.13 },
  { color: [1.0, 0.85, 0.68], weight: 0.11 },
]

function pickColor(random) {
  let roll = random
  for (const entry of PALETTE) {
    if (roll < entry.weight) return entry.color
    roll -= entry.weight
  }
  return PALETTE[0].color
}

/**
 * A GPU-side point cloud distributed through a spherical shell.
 * One geometry, one draw call, no textures.
 */
export default function Starfield({
  count: requestedCount = 6500,
  innerRadius = 16,
  outerRadius = 220,
  sizeBase = 0.55,
  sizeVariance = 4.2,
  twinkle = true,
  scale = 1,
}) {
  const materialRef = useRef(null)
  const viewport = useThree((state) => state.viewport)
  // Fewer stars on weaker hardware: this is the biggest point cloud on screen
  // in every scene, so it is the first thing worth scaling.
  const count = scaleCount(requestedCount, 1200)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i += 1) {
      // Uniform density through the shell volume (cube-root of the radial t).
      const t = Math.random()
      const radius =
        innerRadius + (outerRadius - innerRadius) * Math.cbrt(t)

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const sinPhi = Math.sin(phi)

      positions[i * 3] = radius * sinPhi * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.75
      positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta)

      const [r, g, b] = pickColor(Math.random())
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b

      // Steep falloff keeps most stars small with a handful of bright ones.
      sizes[i] = sizeBase + Math.pow(Math.random(), 4) * sizeVariance
      phases[i] = Math.random()
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outerRadius)
    return geo
  }, [count, innerRadius, outerRadius, sizeBase, sizeVariance])

  // Geometry built here is owned here: release its GPU buffers when the
  // scene changes, or every visit would leave a copy behind.
  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uTwinkle: { value: twinkle ? 1 : 0 },
      uScale: { value: scale },
    }),
    // Values are written imperatively below; this only builds the object once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uPixelRatio.value = Math.min(viewport.dpr, 2)
    material.uniforms.uTwinkle.value = twinkle ? 1 : 0
    material.uniforms.uScale.value = scale
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
