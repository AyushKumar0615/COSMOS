import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getOpenSettings, ship } from '../../../lib/openWorldStore.js'

const COUNT = 520
const HALF = 34

const vertexShader = /* glsl */ `
  uniform vec3 uPhase;
  uniform vec3 uVelocity;  // direction of travel, render space
  uniform float uStreak;
  uniform float uHalf;
  attribute vec3 aBase;
  attribute float aEnd;
  varying float vFade;
  void main() {
    vec3 p = (fract(aBase - uPhase) - 0.5) * 2.0 * uHalf;
    // The tail trails behind the particle, opposite to the ship's motion.
    p -= uVelocity * uStreak * aEnd;
    float d = length(p);
    vFade = smoothstep(uHalf, uHalf * 0.55, d) * smoothstep(2.0, 6.0, d) * (1.0 - aEnd * 0.85);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float a = vFade * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(0.75, 0.84, 1.0, a);
  }
`

/**
 * Motion cues: faint motes that drift past the ship, at a rate that grows
 * with the logarithm of speed so it reads at a walk and at a billion times
 * the speed of light alike, stretching into short streaks when fast. Purely
 * a visual cue; reduced motion keeps them as still points.
 */
export default function SpaceDust({ reducedMotion }) {
  const { geometry, material } = useMemo(() => {
    const base = new Float32Array(COUNT * 2 * 3)
    const end = new Float32Array(COUNT * 2)
    for (let i = 0; i < COUNT; i += 1) {
      const x = Math.random()
      const y = Math.random()
      const z = Math.random()
      base.set([x, y, z, x, y, z], i * 6)
      end[i * 2 + 1] = 1
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3))
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    // Positions are computed in the shader; this attribute only sets the count.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 2 * 3), 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uPhase: { value: new THREE.Vector3() },
        uVelocity: { value: new THREE.Vector3() },
        uStreak: { value: 0 },
        uHalf: { value: HALF },
        uOpacity: { value: 0.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry: geo, material: mat }
  }, [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1)
    const speed = ship.speed
    const rate = 0.055 * Math.log10(1 + speed) // cube widths per second
    const u = material.uniforms
    if (speed > 0) {
      const inv = 1 / Math.hypot(ship.vel[0], ship.vel[1], ship.vel[2]) || 0
      u.uVelocity.value.set(-ship.vel[0] * inv, -ship.vel[1] * inv, -ship.vel[2] * inv)
      if (!reducedMotion) u.uPhase.value.addScaledVector(u.uVelocity.value, -rate * dt * 0.5)
    }
    const on = getOpenSettings().dust
    u.uStreak.value = reducedMotion || !on ? 0 : Math.min(rate * 9, 12)
    u.uOpacity.value = on ? 0.18 + Math.min(rate, 1) * 0.35 : 0
  })

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={-50} raycast={() => null} />
}
