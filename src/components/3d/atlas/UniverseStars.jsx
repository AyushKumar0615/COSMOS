import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { generateStarfield } from '../../../lib/starPopulations.js'
import { quality } from '../../../lib/quality.js'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uMotion;
  attribute vec3 aColor;
  attribute vec4 aShape;   // size, light, twinkle, pulse
  attribute vec2 aOrbit;   // radius, phase
  varying vec3 vColor;
  varying float vLight;

  void main() {
    vec3 world = position;

    // Slow drift, and the pairs that circle each other.
    float seed = aShape.z * 6.2831853;
    world += vec3(sin(uTime * 0.05 + seed), cos(uTime * 0.04 + seed * 1.7), sin(uTime * 0.03 + seed * 2.3)) * 0.006 * uMotion;
    float turn = aOrbit.y + uTime * 0.35 * uMotion;
    world += vec3(cos(turn), 0.0, sin(turn)) * aOrbit.x;

    vec4 view = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * view;

    float twinkle = 1.0 + (sin(uTime * (1.1 + aShape.z * 3.2) + seed) * 0.16 + sin(uTime * (2.7 + aShape.z * 2.1) + seed * 3.1) * 0.08) * uMotion;
    // Neutron stars flash, slowly, instead of shimmering.
    float pulse = mix(1.0, 0.5 + 1.5 * pow(0.5 + 0.5 * sin(uTime * 3.0 + seed), 8.0), aShape.w * uMotion);
    vLight = aShape.y * twinkle * pulse;
    vColor = aColor;

    float depth = max(-view.z, 0.5);
    float size = aShape.x * (0.95 + 9.0 / depth);
    gl_PointSize = clamp(size * uPixelRatio, 1.0 * uPixelRatio, 7.0 * uPixelRatio);
    // A point below a pixel or so dims rather than shrinks, so dense regions
    // build up into a soft glow instead of a white wall.
    vLight *= clamp(size / 2.4, 0.26, 1.0) * 0.86;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vLight;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 14.0);
    float halo = pow(1.0 - d, 2.4) * 0.34;
    vec3 color = mix(vColor, vec3(1.0), core * 0.62);
    gl_FragColor = vec4(color * (core + halo) * vLight * uOpacity, 1.0);
  }
`

/**
 * The whole star population in one draw call. Everything moving happens in
 * the vertex shader. Detail is controlled by `drawRange`: the buffer is
 * shuffled, so drawing less of it simply thins the sky when frames run long.
 */
export default function UniverseStars({ compress, clusters, opacityRef, reducedMotion }) {
  const pixelRatio = useThree((state) => state.viewport.dpr)

  const { geometry, material, total } = useMemo(() => {
    const data = generateStarfield(quality().stars, compress, clusters)
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    buffer.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3))
    buffer.setAttribute('aShape', new THREE.BufferAttribute(data.shape, 4))
    buffer.setAttribute('aOrbit', new THREE.BufferAttribute(data.orbits, 2))
    buffer.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500)
    return {
      total: data.count,
      geometry: buffer,
      material: new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uMotion: { value: 1 }, uOpacity: { value: 0 } },
      }),
    }
  }, [compress, clusters])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const budget = useRef({ visible: 1, average: 1 / 60, frames: 0 })

  useFrame((_, delta) => {
    const u = material.uniforms
    u.uTime.value += reducedMotion ? 0 : Math.min(delta, 0.1)
    u.uMotion.value = reducedMotion ? 0 : 1
    u.uPixelRatio.value = pixelRatio
    u.uOpacity.value = opacityRef.current.value

    const b = budget.current
    if (delta < 0.25) {
      b.average += (delta - b.average) * 0.06
      b.frames += 1
      if (b.frames > 45) {
        b.frames = 0
        if (b.average > 1 / 38) b.visible = Math.max(0.3, b.visible * 0.85)
        else if (b.average < 1 / 55) b.visible = Math.min(1, b.visible * 1.06)
        geometry.setDrawRange(0, Math.round(total * b.visible))
      }
    }
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-5} raycast={() => null} />
}
