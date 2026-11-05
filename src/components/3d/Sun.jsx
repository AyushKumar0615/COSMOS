import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { NOISE_GLSL } from './shaders/noise.glsl.js'
import { SUN } from '../../data/planets.js'

const surfaceVertex = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vLocal = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

// Deliberately lean on noise octaves: unlike the baked planet maps this
// shader runs every frame, and a focused Sun can fill the viewport.
const surfaceFragment = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uTime;
  uniform float uMotion;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHot;

  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    float t = uTime * uMotion;

    float convection = fbm3(vLocal * 3.4 + vec3(0.0, t * 0.035, 0.0));
    float granules = noise3(vLocal * 13.0 - vec3(t * 0.07));
    float speckle = noise3(vLocal * 27.0 + vec3(t * 0.1));

    float heat = convection * 0.58 + granules * 0.27 + speckle * 0.15;
    heat = clamp(heat * 0.5 + 0.5, 0.0, 1.0);

    vec3 color = mix(uDeep, uMid, smoothstep(0.18, 0.62, heat));
    color = mix(color, uHot, smoothstep(0.58, 0.95, heat));

    // Limb brightening: the opposite of a lit sphere, and the main cue
    // that this body emits rather than reflects.
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float limb = 1.0 - max(dot(normalize(vWorldNormal), viewDirection), 0.0);
    color += uHot * pow(limb, 2.6) * 0.75;

    gl_FragColor = vec4(color, 1.0);
  }
`

const coronaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const coronaFragment = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uTime;
  uniform float uMotion;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uRayStrength;
  uniform float uInner;
  uniform vec3 uColor;

  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float radius = length(centered) * 2.0;
    if (radius > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float t = uTime * uMotion;

    // Streamers: noise sampled around a ring so it wraps without a seam.
    float streamer = noise3(
      vec3(cos(angle), sin(angle), t * 0.04) * 3.0 + radius * 1.5
    );
    float rays = 1.0 - uRayStrength + uRayStrength * (0.5 + 0.5 * streamer);

    // Fall off from the Sun's own limb outwards, not from the centre of
    // the quad. Everything inside uInner is behind the Sun's disc, so a
    // centre-based falloff spends almost all its brightness where it
    // cannot be seen and leaves the visible corona invisibly faint.
    float reach = clamp((radius - uInner) / max(1.0 - uInner, 0.001), 0.0, 1.0);
    float falloff = pow(1.0 - reach, uPower);
    float alpha = falloff * rays * uIntensity;
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`

const SPHERE = new THREE.SphereGeometry(1, 64, 48)
const QUAD = new THREE.PlaneGeometry(1, 1)

function CoronaLayer({ scale, color, intensity, power, rayStrength, motion, radius }) {
  const materialRef = useRef(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMotion: { value: motion },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uRayStrength: { value: rayStrength },
      // Fraction of the quad's half-width taken up by the Sun itself.
      uInner: { value: radius / (scale / 2) },
      uColor: { value: new THREE.Color(color) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uMotion.value = motion
  })

  return (
    <mesh geometry={QUAD} scale={scale} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={coronaVertex}
        fragmentShader={coronaFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/**
 * The Sun: an animated emissive surface and a two-layer corona that always
 * faces the camera. The light it casts lives in SceneLights so the scene's
 * light count never changes (changing it recompiles every lit material).
 */
export default function Sun({ reducedMotion, onSelect, selected }) {
  const materialRef = useRef(null)
  const meshRef = useRef(null)
  const radius = SUN.sim.radius
  const motion = reducedMotion ? 0 : 1

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMotion: { value: motion },
      uDeep: { value: new THREE.Color('#b63d05') },
      uMid: { value: new THREE.Color('#ff8c1a') },
      uHot: { value: new THREE.Color('#ffe9b0') },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uMotion.value = motion
    }
    if (meshRef.current && motion) {
      meshRef.current.rotation.y += delta * 0.012
    }
  })

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={SPHERE}
        scale={radius}
        onClick={(event) => {
          event.stopPropagation()
          onSelect('sun')
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={surfaceVertex}
          fragmentShader={surfaceFragment}
        />
      </mesh>

      <Billboard>
        <CoronaLayer
          radius={radius}
          scale={radius * 4.6}
          color="#ff9336"
          intensity={0.85}
          power={2.2}
          rayStrength={0.4}
          motion={motion}
        />
        <CoronaLayer
          radius={radius}
          scale={radius * 11.0}
          color="#ff6a1f"
          intensity={0.3}
          power={2.8}
          rayStrength={0.55}
          motion={motion}
        />
        {selected && (
          <CoronaLayer
            radius={radius}
            scale={radius * 6.0}
            color="#22d3ee"
            intensity={0.22}
            power={3.2}
            rayStrength={0.15}
            motion={motion}
          />
        )}
      </Billboard>
    </group>
  )
}
