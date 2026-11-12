import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE_GLSL } from './shaders/noise.glsl.js'
import { getEffects } from '../../lib/effects.js'
import { clock } from '../../lib/simClock.js'

/**
 * Auroral ovals: rings of light around each magnetic pole where charged
 * particles from the solar wind strike the upper atmosphere. Drawn as a thin
 * shell in the planet's tilted (not spinning) frame, brightest on the night
 * side, with curtains that ripple along the oval.
 *
 * Earth's are green (atomic oxygen, 557.7 nm) with a red upper fringe (630 nm).
 * Jupiter's and Saturn's aurorae are brightest in ultraviolet, invisible to
 * the eye; they are shown here in false colour, as Hubble's images are.
 * Oval latitudes and brightness are illustrative.
 */
const vertexShader = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vLocal = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform float uLatitude;   // oval colatitude, radians from the pole
  uniform float uWidth;
  uniform float uStrength;
  uniform vec3 uLow;
  uniform vec3 uHigh;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    float colat = acos(clamp(abs(vLocal.y), 0.0, 1.0));
    float lon = atan(vLocal.z, vLocal.x);
    // Curtains: folds that drift along the oval.
    float folds = noise3(vec3(lon * 6.0, uTime * 0.15, vLocal.y > 0.0 ? 1.0 : 7.0)) * 0.5 + 0.5;
    float wobble = noise3(vec3(lon * 2.0, uTime * 0.05, 3.0)) * uWidth * 1.4;
    float band = exp(-pow((colat - uLatitude - wobble) / uWidth, 2.0));
    // Fine vertical rays, irregular in spacing and brightness.
    float rays = 0.6 + 0.4 * noise3(vec3(lon * 55.0 + folds * 4.0, uTime * 0.4, colat * 8.0));

    vec3 n = normalize(vNormal);
    float sunFacing = dot(n, normalize(-vWorld));
    float night = 1.0 - smoothstep(-0.1, 0.35, sunFacing);
    vec3 view = normalize(cameraPosition - vWorld);
    float limb = 0.35 + pow(1.0 - abs(dot(n, view)), 1.5);

    float a = band * folds * rays * (0.25 + 0.75 * night) * limb * uStrength;
    if (a < 0.004) discard;
    vec3 color = mix(uLow, uHigh, smoothstep(0.4, 1.0, folds));
    // Additive blending multiplies by alpha itself: send colour and alpha
    // separately, not premultiplied, or faint light is squared away.
    gl_FragColor = vec4(color, min(a, 1.0));
  }
`

const LOOKS = {
  earth: { latitude: 22, width: 3.2, low: '#3dff8f', high: '#ff5a6e', strength: 1.1 },
  jupiter: { latitude: 16, width: 2.6, low: '#7a8cff', high: '#d07bff', strength: 0.8 },
  saturn: { latitude: 15, width: 2.4, low: '#8a7dff', high: '#e07bd8', strength: 0.7 },
}

export const AURORA_BODIES = Object.keys(LOOKS)

export default function Aurora({ body, geometry, reducedMotion }) {
  const look = LOOKS[body]
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uLatitude: { value: (look.latitude * Math.PI) / 180 },
          uWidth: { value: (look.width * Math.PI) / 180 },
          uStrength: { value: look.strength },
          uLow: { value: new THREE.Color(look.low) },
          uHigh: { value: new THREE.Color(look.high) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [look],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame((_, delta) => {
    if (!reducedMotion && clock.playing) material.uniforms.uTime.value += Math.min(delta, 0.1)
    material.uniforms.uStrength.value = look.strength * getEffects().intensity
  })
  return <mesh geometry={geometry} material={material} scale={1.025} raycast={() => null} />
}
