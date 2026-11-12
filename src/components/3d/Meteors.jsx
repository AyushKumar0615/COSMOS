import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getEffects } from '../../lib/effects.js'

/**
 * Shooting stars: a procedural visual effect, not a simulation of real
 * meteors (which burn up in a planet's atmosphere, not in open space).
 *
 * One instanced draw call for the whole pool. Each meteor is a quad that the
 * vertex shader stretches from its tail to its head in view space, so the
 * streak keeps a constant screen width at any angle, and everything after
 * spawning (motion, burn-out, the fading train) runs on the GPU. The CPU
 * only writes one instance's attributes when a meteor is born.
 *
 * Meteors spawn at random times (a Poisson process) in front of the camera
 * at varying depths, so they parallax as the view moves. Every minute or two
 * a shower arrives: several meteors over a few seconds, all diverging from
 * one radiant point, as real showers appear to.
 */
const POOL = 48

const vertexShader = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aVelocity;
  attribute vec4 aTiming;    // birth, burn time, train length (s), width
  attribute vec4 aLook;      // rgb tint, brightness

  uniform float uTime;
  uniform float uPixel;      // world units per pixel at distance 1

  varying float vAlong;
  varying float vAcross;
  varying float vFade;
  varying vec4 vLook;
  varying float vSeed;

  void main() {
    float age = uTime - aTiming.x;
    float burn = aTiming.y;
    // The train lingers and dissipates for a moment after the head burns out.
    float linger = 0.7;
    if (age < 0.0 || age > burn + linger || aLook.w <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    float headAge = min(age, burn);
    vec3 head = aStart + aVelocity * headAge;
    vec3 tail = head - aVelocity * min(headAge, aTiming.z);

    vec4 hv = viewMatrix * vec4(head, 1.0);
    vec4 tv = viewMatrix * vec4(tail, 1.0);

    // position.x runs 0 (tail) to 1 (head), plus a short cap past the head.
    float along = position.x;
    vec3 p = mix(tv.xyz, hv.xyz, min(along, 1.0));
    vec3 seg = normalize(hv.xyz - tv.xyz + vec3(1e-5));
    p += seg * max(along - 1.0, 0.0) * length(hv.xyz - tv.xyz);

    vec3 side = normalize(cross(seg, normalize(p)));
    // At least ~1.5 px wide at any depth, wider at the head.
    float width = max(aTiming.w, uPixel * 1.5 * -p.z) * mix(0.25, 1.0, smoothstep(0.0, 1.0, along));
    p += side * position.y * width;

    float flare = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(burn * 0.75, burn, age));
    float dissipate = 1.0 - smoothstep(burn, burn + linger, age);
    vFade = max(flare, dissipate * 0.35 * step(burn * 0.75, age));
    vAlong = along;
    vAcross = position.y;
    vLook = aLook;
    vSeed = aTiming.x;

    gl_Position = projectionMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying float vAlong;
  varying float vAcross;
  varying float vFade;
  varying vec4 vLook;
  varying float vSeed;

  void main() {
    float core = exp(-vAcross * vAcross * 6.0);
    float trail = pow(clamp(vAlong, 0.0, 1.0), 1.8);
    // Uneven ablation: the train breaks into knots rather than a clean line.
    float knots = 0.65 + 0.35 * sin(vAlong * 37.0 + vSeed * 13.0 - uTime * 6.0);
    float head = exp(-pow((vAlong - 1.0) / 0.035, 2.0));

    vec3 color = mix(vLook.rgb, vec3(1.0, 0.98, 0.94), head * 0.85 + trail * 0.2);
    float intensity = (trail * knots * 0.75 + head * 2.4) * core * vFade * vLook.w;
    if (intensity < 0.004) discard;
    gl_FragColor = vec4(color * intensity, intensity);
  }
`

// Tints after the light of common meteor elements: magnesium green, sodium
// yellow-orange, iron yellow, oxygen and nitrogen reds, and plain white.
const TINTS = [
  [0.75, 1.0, 0.8],
  [1.0, 0.82, 0.55],
  [1.0, 0.94, 0.7],
  [1.0, 0.6, 0.55],
  [0.85, 0.9, 1.0],
  [0.85, 0.9, 1.0],
]

function buildGeometry() {
  const base = new THREE.PlaneGeometry(1, 2, 12, 1)
  // Plane x runs -0.5..0.5; remap to 0..1.12 along the streak.
  const position = base.attributes.position
  for (let i = 0; i < position.count; i += 1) position.setX(i, (position.getX(i) + 0.5) * 1.12)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = base.index
  geometry.setAttribute('position', position)
  geometry.instanceCount = POOL
  const attribute = (size) => new THREE.InstancedBufferAttribute(new Float32Array(POOL * size), size).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aStart', attribute(3))
  geometry.setAttribute('aVelocity', attribute(3))
  geometry.setAttribute('aTiming', attribute(4))
  geometry.setAttribute('aLook', attribute(4))
  // Positions are computed in the shader; never cull the pool.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
  return geometry
}

const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3()
const direction = new THREE.Vector3()
const start = new THREE.Vector3()
const velocity = new THREE.Vector3()
const radiant = new THREE.Vector3()

export default function Meteors({ enabled = true }) {
  const camera = useThree((state) => state.camera)
  const geometry = useMemo(() => buildGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: { value: 0 }, uPixel: { value: 0.001 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const state = useRef({ time: 0, next: 0, shower: null, nextShower: 50 + Math.random() * 60 })

  const spawn = (now, intensity, showerRadiant = null) => {
    const s = state.current
    const slot = s.next
    s.next = (s.next + 1) % POOL

    camera.getWorldDirection(forward)
    right.crossVectors(forward, camera.up).normalize()
    up.crossVectors(right, forward).normalize()

    const distance = 35 + Math.random() * 110
    const speed = (18 + Math.random() * 38) * (distance / 80)

    if (showerRadiant) {
      // Spread out from the radiant: start a little way from it and travel
      // directly away from it across the sky.
      const angle = Math.random() * Math.PI * 2
      const spread = 0.12 + Math.random() * 0.5
      direction
        .copy(showerRadiant)
        .addScaledVector(right, Math.cos(angle) * spread)
        .addScaledVector(up, Math.sin(angle) * spread)
        .normalize()
      start.copy(camera.position).addScaledVector(direction, distance)
      velocity.copy(direction).sub(showerRadiant).normalize()
      velocity.addScaledVector(direction, -velocity.dot(direction)).normalize().multiplyScalar(speed)
    } else {
      // Somewhere in (or just outside) the view, heading in any direction
      // across it, with a slight preference for falling.
      direction
        .copy(forward)
        .addScaledVector(right, (Math.random() * 2 - 1) * 0.95)
        .addScaledVector(up, (Math.random() * 2 - 1) * 0.6)
        .normalize()
      start.copy(camera.position).addScaledVector(direction, distance)
      const heading = Math.random() * Math.PI * 2
      velocity
        .copy(right)
        .multiplyScalar(Math.cos(heading))
        .addScaledVector(up, Math.sin(heading) - 0.35)
        .addScaledVector(forward, (Math.random() - 0.5) * 0.6)
        .normalize()
        .multiplyScalar(speed)
    }

    const burn = 0.35 + Math.random() * Math.random() * 1.3
    const train = 0.12 + Math.random() * 0.3
    // Brightness follows a steep distribution: most are faint, a few are fireballs.
    const fireball = Math.random() < 0.06
    const brightness = (0.35 + Math.pow(Math.random(), 3) * 1.2 + (fireball ? 1.6 : 0)) * (0.5 + intensity * 0.5)
    const tint = TINTS[Math.floor(Math.random() * TINTS.length)]
    const width = distance * 0.0016 * (fireball ? 2.2 : 1) * (0.7 + Math.random() * 0.6)

    const a = geometry.attributes
    a.aStart.setXYZ(slot, start.x, start.y, start.z)
    a.aVelocity.setXYZ(slot, velocity.x, velocity.y, velocity.z)
    a.aTiming.setXYZW(slot, now, burn * (fireball ? 1.6 : 1), train, width)
    a.aLook.setXYZW(slot, tint[0], tint[1], tint[2], brightness)
    a.aStart.needsUpdate = true
    a.aVelocity.needsUpdate = true
    a.aTiming.needsUpdate = true
    a.aLook.needsUpdate = true
  }

  useFrame((_, delta) => {
    const s = state.current
    // Our own clock, advanced by a clamped delta: after a hidden tab the
    // meteors resume where they were instead of all expiring at once.
    const step = Math.min(delta, 0.1)
    s.time += step
    material.uniforms.uTime.value = s.time
    material.uniforms.uPixel.value =
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, window.innerHeight)

    const { intensity } = getEffects()
    if (!enabled || intensity <= 0) return

    // Sporadic meteors: about one every five seconds at full intensity.
    if (Math.random() < step * 0.2 * intensity) spawn(s.time, intensity)

    if (!s.shower && s.time > s.nextShower) {
      camera.getWorldDirection(forward)
      radiant
        .copy(forward)
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5))
        .normalize()
      s.shower = { radiant: radiant.clone(), until: s.time + 5 + Math.random() * 5 }
    }
    if (s.shower) {
      if (Math.random() < step * 2.4 * Math.max(0.3, intensity)) spawn(s.time, intensity, s.shower.radiant)
      if (s.time > s.shower.until) {
        s.shower = null
        s.nextShower = s.time + (60 + Math.random() * 80) / Math.max(0.3, intensity)
      }
    }
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
}
