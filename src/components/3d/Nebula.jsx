import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Gradient-noise fbm with a single domain-warp pass. Five octaves is enough
// for soft interstellar cloud and stays cheap on integrated graphics.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uMotion;
  uniform vec3 uColorLow;
  uniform vec3 uColorHigh;

  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(in vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;

    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    float m = step(a.y, a.x);
    vec2 o = vec2(m, 1.0 - m);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;

    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(
      dot(a, hash2(i)),
      dot(b, hash2(i + o)),
      dot(c, hash2(i + 1.0))
    );
    return dot(n, vec3(70.0));
  }

  float fbm(vec2 p, const int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotate = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < octaves; i++) {
      value += amplitude * noise(p);
      p = rotate * p * 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    // Radial mask first: pixels outside the cloud body cost almost nothing.
    float radial = length(vUv - 0.5) * 2.0;
    float mask = 1.0 - smoothstep(0.2, 1.0, radial);
    if (mask <= 0.002) discard;

    vec2 uv = (vUv - 0.5) * 3.0;
    float t = uTime * 0.014 * uMotion;

    // Two cheap octaves drive the domain warp; four carry the detail.
    vec2 warp = vec2(
      fbm(uv + uSeed + t, 2),
      fbm(uv + vec2(5.2, 1.3) - t * 0.8, 2)
    );
    float density = fbm(uv + 1.7 * warp + uSeed, 4);
    // Raised floor keeps most of the frame near-black, so the cloud reads as
    // filaments against deep space rather than an even fog over everything.
    density = smoothstep(-0.35, 0.74, density);

    float alpha = density * mask * uOpacity;
    if (alpha <= 0.002) discard;

    vec3 color = mix(uColorLow, uColorHigh, clamp(density * 1.25, 0.0, 1.0));

    // Premultiplied for additive blending: no hard alpha edges.
    gl_FragColor = vec4(color * alpha, alpha);
  }
`

function NebulaCloud({
  position,
  rotation = [0, 0, 0],
  scale,
  colorLow,
  colorHigh,
  opacity,
  seed,
  motion,
}) {
  const materialRef = useRef(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uOpacity: { value: opacity },
      uMotion: { value: motion },
      uColorLow: { value: new THREE.Color(colorLow) },
      uColorHigh: { value: new THREE.Color(colorHigh) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMotion.value = motion
    material.uniforms.uOpacity.value = opacity
  })

  return (
    <mesh position={position} rotation={rotation} scale={scale} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/**
 * Four large, overlapping cloud planes sitting behind the starfield.
 * Violet and blue carry the mass; cyan is used sparingly as the highlight.
 */
export default function Nebula({ motion = 1 }) {
  return (
    <group>
      <NebulaCloud
        position={[-44, 12, -140]}
        rotation={[0, 0.22, 0.3]}
        scale={[300, 230, 1]}
        colorLow="#2a1673"
        colorHigh="#8f63ff"
        opacity={0.48}
        seed={1.7}
        motion={motion}
      />
      <NebulaCloud
        position={[58, -20, -165]}
        rotation={[0, -0.18, -0.42]}
        scale={[330, 240, 1]}
        colorLow="#0d2a6b"
        colorHigh="#4a81ff"
        opacity={0.40}
        seed={11.3}
        motion={motion}
      />
      <NebulaCloud
        position={[16, 36, -112]}
        rotation={[0, 0.08, 1.1]}
        scale={[215, 165, 1]}
        colorLow="#06303f"
        colorHigh="#36dcf3"
        opacity={0.21}
        seed={23.9}
        motion={motion}
      />
      <NebulaCloud
        position={[-8, -32, -84]}
        rotation={[0, 0.4, -0.9]}
        scale={[195, 155, 1]}
        colorLow="#1d0f56"
        colorHigh="#6a4bff"
        opacity={0.19}
        seed={37.2}
        motion={motion}
      />
    </group>
  )
}
