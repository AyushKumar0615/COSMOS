import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import GlowSprite from '../GlowSprite.jsx'
import { NOISE_GLSL } from '../shaders/noise.glsl.js'
import { createRandom } from '../../../lib/random.js'
import { scaleCount } from '../../../lib/quality.js'

const DURATION = 48
const SPHERE = new THREE.SphereGeometry(1, 64, 44)

const starMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeat: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uHeat;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        float cells = fbm3(vPosition * 3.0 + uTime * 0.05) * 0.5 + 0.5;
        float fine = fbm3(vPosition * 9.0 - uTime * 0.08) * 0.5 + 0.5;
        float limb = pow(max(vNormal.z, 0.0), 0.7);
        vec3 cool = mix(vec3(0.42, 0.05, 0.02), vec3(1.0, 0.36, 0.1), cells);
        vec3 color = mix(cool, vec3(1.0, 0.93, 0.8), uHeat) * (0.55 + 0.7 * fine) * (0.35 + 0.85 * limb);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })

const shellVertex = /* glsl */ `
  uniform float uRadius;
  uniform float uAge;
  uniform float uPixelRatio;
  attribute vec3 aDirection;
  attribute vec2 aSeed;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Fast clumps lead, slow ones lag, which roughens the shell into filaments.
    float reach = uRadius * (0.62 + 0.42 * aSeed.x);
    vec3 world = aDirection * reach;
    vec3 hot = vec3(0.86, 0.92, 1.0);
    vec3 warm = vec3(1.0, 0.62, 0.28);
    vec3 cool = mix(vec3(0.95, 0.24, 0.2), vec3(0.3, 0.72, 0.8), step(0.62, aSeed.y));
    vColor = mix(mix(hot, warm, smoothstep(0.0, 0.4, uAge)), cool, smoothstep(0.35, 0.9, uAge));
    vAlpha = smoothstep(0.0, 0.03, uAge) * (0.55 + 0.45 * aSeed.y);
    vec4 view = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(uPixelRatio * (220.0 + 320.0 * aSeed.y) / max(-view.z, 1.0), 1.0, 9.0 * uPixelRatio);
  }
`

const shellFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = pow(max(1.0 - d * 2.0, 0.0), 2.0);
    if (glow < 0.01) discard;
    gl_FragColor = vec4(vColor * glow * vAlpha * uOpacity, 1.0);
  }
`

const shockMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: { uStrength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying vec3 vNormal;
      void main() {
        float rim = pow(1.0 - abs(vNormal.z), 3.0);
        gl_FragColor = vec4(vec3(0.5, 0.75, 1.0) * rim * uStrength, 1.0);
      }
    `,
  })

/**
 * A massive star's death on one timeline. `control.t` is the single source of
 * truth: it advances while playing and can be scrubbed from the interface.
 */
export default function SupernovaModel({ control, reducedMotion, pixelRatio = 1 }) {
  const starRef = useRef(null)
  const shockRef = useRef(null)
  const flash = useRef({ value: 0 })
  const remnant = useRef({ value: 0 })
  const clock = useRef(0)

  const star = useMemo(starMaterial, [])
  const shock = useMemo(shockMaterial, [])
  const { geometry, material } = useMemo(() => {
    const count = scaleCount(46000, 4000)
    const rng = createRandom(1987)
    const direction = new Float32Array(count * 3)
    const seed = new Float32Array(count * 2)
    const clumps = Array.from({ length: 180 }, () => rng.direction())
    for (let i = 0; i < count; i += 1) {
      const center = rng.pick(clumps)
      const v = new THREE.Vector3(...center).addScaledVector(new THREE.Vector3(...rng.direction()), 0.22).normalize()
      direction.set([v.x, v.y, v.z], i * 3)
      seed[i * 2] = rng.next()
      seed[i * 2 + 1] = rng.next()
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    buffer.setAttribute('aDirection', new THREE.BufferAttribute(direction, 3))
    buffer.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2))
    buffer.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400)
    return {
      geometry: buffer,
      material: new THREE.ShaderMaterial({
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uRadius: { value: 0 }, uAge: { value: 0 }, uPixelRatio: { value: pixelRatio }, uOpacity: { value: 0 } },
      }),
    }
  }, [pixelRatio])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      star.dispose()
      shock.dispose()
    },
    [geometry, material, star, shock],
  )

  useFrame((_, delta) => {
    const c = control.current
    if (c.playing) {
      c.t = Math.min(1, c.t + Math.min(delta, 0.1) / DURATION)
      if (c.t >= 1) c.playing = false
    }
    if (!reducedMotion) clock.current += Math.min(delta, 0.1)
    const t = c.t
    const collapse = THREE.MathUtils.smoothstep(t, 0.2, 0.27)
    const age = THREE.MathUtils.clamp((t - 0.27) / 0.73, 0, 1)

    star.uniforms.uTime.value = clock.current
    star.uniforms.uHeat.value = collapse
    if (starRef.current) {
      const pulse = 1 + 0.012 * Math.sin(clock.current * 1.3)
      starRef.current.scale.setScalar(13 * pulse * (1 - 0.9 * collapse))
      starRef.current.visible = t < 0.285
    }

    const radius = 13 + 56 * Math.pow(age, 0.62)
    material.uniforms.uRadius.value = radius
    material.uniforms.uAge.value = age
    material.uniforms.uOpacity.value = t > 0.27 ? THREE.MathUtils.lerp(1, 0.72, age) : 0

    if (shockRef.current) {
      shockRef.current.scale.setScalar(radius * 1.1)
      shockRef.current.visible = t > 0.27
      shock.uniforms.uStrength.value = 0.8 * (1 - THREE.MathUtils.smoothstep(age, 0, 0.5))
    }

    // Bright, but capped by the same rule as the rest of the site: never a
    // full-screen strobe, and only a soft swell with reduced motion.
    const burst = Math.exp(-Math.pow((t - 0.285) / 0.022, 2))
    flash.current.value = burst * (reducedMotion ? 0.3 : 0.9)
    remnant.current.value = THREE.MathUtils.smoothstep(t, 0.72, 0.86)
  })

  return (
    <group>
      <mesh ref={starRef} geometry={SPHERE} material={star} raycast={() => null} />
      <mesh ref={shockRef} geometry={SPHERE} material={shock} visible={false} raycast={() => null} />
      <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      <GlowSprite position={[0, 0, 0]} size={210} color="#fff4e0" intensity={1} power={2.2} opacityRef={flash} />
      <GlowSprite position={[0, 0, 0]} size={13} color="#bcd6ff" intensity={0.95} power={3} opacityRef={remnant} />
    </group>
  )
}
