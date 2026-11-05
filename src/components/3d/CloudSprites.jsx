import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;

  attribute vec3 aOffset;
  attribute vec2 aScale;     // x: size, y: horizontal stretch
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aRotation;
  attribute float aVariant;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vVariant;

  void main() {
    vUv = uv;
    vColor = aColor;
    vVariant = aVariant;

    vec4 viewCenter = viewMatrix * modelMatrix * vec4(aOffset, 1.0);

    // Each sprite turns very slowly in its own direction, so the cloud
    // shimmers without any of it visibly travelling.
    float spin = (fract(aVariant * 7.13) - 0.5) * 0.02 * uTime * uMotion;
    float angle = aRotation + spin;
    vec2 corner = position.xy;
    corner.x *= aScale.y;
    corner = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * corner * aScale.x;

    // Billboard in view space: always faces the camera.
    viewCenter.xy += corner;

    // Fade sprites as the camera reaches them, so flying into a cloud never
    // fills the screen with one flat, oversized sprite.
    float depth = -viewCenter.z;
    vAlpha = aAlpha * smoothstep(aScale.x * 0.2, aScale.x * 0.9, depth);

    gl_Position = projectionMatrix * viewCenter;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uNoise;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vVariant;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float mask = 1.0 - smoothstep(0.3, 1.0, r);
    if (mask <= 0.0) discard;

    vec2 shift = vec2(fract(vVariant * 3.7), fract(vVariant * 5.3)) * 0.18;
    vec4 n = texture2D(uNoise, vUv * 0.82 + shift);
    float v = vVariant < 0.25 ? n.r : (vVariant < 0.5 ? n.g : (vVariant < 0.75 ? n.b : n.a));

    float alpha = v * mask * vAlpha * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

const BASE = new THREE.PlaneGeometry(1, 1)

/**
 * Instanced, camera-facing cloud sprites: one draw call per layer however
 * many sprites it holds. Overlapping sprites at different depths give the
 * nebulae parallax and volume without ray-marching, which would be far too
 * expensive for integrated graphics.
 *
 * sprites: [{ p: [x,y,z], s: size, st: stretch, c: [r,g,b], a: alpha,
 *            r: rotation, v: variant 0-1 (picks the noise channel) }]
 */
export default function CloudSprites({
  sprites,
  texture,
  blending = 'additive',
  opacityRef,
  renderOrder = 1,
  reducedMotion = false,
}) {
  const materialRef = useRef(null)

  const geometry = useMemo(() => {
    const count = sprites.length
    const offset = new Float32Array(count * 3)
    const scale = new Float32Array(count * 2)
    const color = new Float32Array(count * 3)
    const alpha = new Float32Array(count)
    const rotation = new Float32Array(count)
    const variant = new Float32Array(count)

    sprites.forEach((sprite, i) => {
      offset.set(sprite.p, i * 3)
      scale[i * 2] = sprite.s
      scale[i * 2 + 1] = sprite.st ?? 1
      color.set(sprite.c, i * 3)
      alpha[i] = sprite.a
      rotation[i] = sprite.r ?? 0
      variant[i] = sprite.v ?? 0
    })

    // Own copies of the quad's (tiny) buffers: sharing them would let one
    // layer's disposal delete GPU buffers another layer is still drawing.
    const geo = new THREE.InstancedBufferGeometry()
    geo.setIndex(BASE.index.clone())
    geo.setAttribute('position', BASE.attributes.position.clone())
    geo.setAttribute('uv', BASE.attributes.uv.clone())
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3))
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 2))
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3))
    geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(alpha, 1))
    geo.setAttribute('aRotation', new THREE.InstancedBufferAttribute(rotation, 1))
    geo.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variant, 1))
    geo.instanceCount = count
    return geo
  }, [sprites])

  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(
    () => ({
      uNoise: { value: texture },
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uOpacity: { value: 1 },
    }),
    [texture],
  )

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMotion.value = reducedMotion ? 0 : 1
    material.uniforms.uOpacity.value = opacityRef ? opacityRef.current.value : 1
  })

  if (sprites.length === 0) return null

  return (
    <mesh geometry={geometry} renderOrder={renderOrder} frustumCulled={false} raycast={() => null}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </mesh>
  )
}
