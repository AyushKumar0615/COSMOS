import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import StarBody from '../atlas/StarBody.jsx'
import { LIFE_PATHS } from '../../../data/phenomena.js'
import { createRandom } from '../../../lib/random.js'
import { scaleCount } from '../../../lib/quality.js'

const SHAPES = { cloud: 0, disc: 1, shell: 2 }
const SPHERE = new THREE.SphereGeometry(1, 48, 32)
const RING = new THREE.RingGeometry(1.25, 1.34, 96)

const vertexShader = /* glsl */ `
  uniform float uDisc;
  uniform float uShell;
  uniform float uRadius;
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec3 aDirection;
  attribute vec3 aSeed;
  varying float vFade;

  void main() {
    // One particle set, three shapes: blended, so stages flow into each other.
    vec3 cloud = aDirection * aSeed.x * 1.3 + vec3(sin(aSeed.y * 40.0), cos(aSeed.z * 40.0), sin(aSeed.z * 30.0)) * 0.22;
    float angle = atan(aDirection.z, aDirection.x) + uTime * 0.5 / (0.3 + aSeed.x);
    float reach = 0.22 + aSeed.x * 0.82;
    vec3 disc = vec3(cos(angle) * reach, (aSeed.y - 0.5) * 0.05, sin(angle) * reach);
    vec3 shell = aDirection * (0.92 + 0.14 * aSeed.y);
    vec3 p = mix(mix(cloud, disc, uDisc), shell, uShell) * uRadius;
    vFade = 0.45 + 0.55 * aSeed.z;
    vec4 view = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(uPixelRatio * (140.0 + 260.0 * aSeed.z) / max(-view.z, 1.0), 1.0, 11.0 * uPixelRatio);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float glow = pow(max(1.0 - d, 0.0), 2.0);
    if (glow < 0.01) discard;
    gl_FragColor = vec4(uColor * glow * vFade * uOpacity, 1.0);
  }
`

/**
 * A star's life as a sequence of stages. One particle system morphs between
 * cloud, disc and shell, while the star itself eases to its next size.
 */
export default function LifeCycleModel({ control, reducedMotion, pixelRatio = 1 }) {
  const { geometry, material } = useMemo(() => {
    const count = scaleCount(26000, 3000)
    const rng = createRandom(1604)
    const direction = new Float32Array(count * 3)
    const seed = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      direction.set(rng.direction(), i * 3)
      seed.set([Math.pow(rng.next(), 0.6), rng.next(), rng.next()], i * 3)
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    buffer.setAttribute('aDirection', new THREE.BufferAttribute(direction, 3))
    buffer.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    return {
      geometry: buffer,
      material: new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uDisc: { value: 0 },
          uShell: { value: 0 },
          uRadius: { value: 30 },
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color('#7a4a8a') },
        },
      }),
    }
  }, [pixelRatio])

  const ringMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb36b', side: THREE.DoubleSide }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      ringMaterial.dispose()
    },
    [geometry, material, ringMaterial],
  )

  const [stage, setStage] = useState(LIFE_PATHS.sun.stages[0])
  const starGroup = useRef(null)
  const size = useRef(0.01)
  const target = useRef(new THREE.Color())

  useFrame((_, delta) => {
    const c = control.current
    const next = LIFE_PATHS[c.path].stages[c.stage]
    if (next !== stage) setStage(next)
    const dt = Math.min(delta, 0.1)
    const k = reducedMotion ? 1 : 1 - Math.exp(-2.6 * dt)
    const u = material.uniforms
    const gas = next.gas
    const shape = gas ? SHAPES[gas.shape] : -1
    u.uDisc.value += ((shape === 1 ? 1 : 0) - u.uDisc.value) * k
    u.uShell.value += ((shape === 2 ? 1 : 0) - u.uShell.value) * k
    u.uRadius.value += ((gas?.radius ?? u.uRadius.value) - u.uRadius.value) * k
    u.uOpacity.value += ((gas ? (gas.brightness ?? 0.5) : 0) - u.uOpacity.value) * k
    if (gas) u.uColor.value.lerp(target.current.set(gas.color), k)
    if (!reducedMotion) u.uTime.value += dt
    size.current += ((next.star?.r ?? (next.hole ? 2.6 : 0.01)) - size.current) * k
    if (starGroup.current) starGroup.current.scale.setScalar(Math.max(size.current, 0.01))
  })

  return (
    <group>
      <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      <group ref={starGroup}>
        {stage.star && <StarBody key={stage.star.t} temperature={stage.star.t} radius={1} reducedMotion={reducedMotion} />}
        {stage.hole && (
          <>
            <mesh geometry={SPHERE} raycast={() => null}>
              <meshBasicMaterial color="#000000" />
            </mesh>
            <mesh geometry={RING} material={ringMaterial} rotation={[Math.PI / 2 - 0.2, 0, 0]} raycast={() => null} />
          </>
        )}
      </group>
    </group>
  )
}
