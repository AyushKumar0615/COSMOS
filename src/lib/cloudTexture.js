import * as THREE from 'three'
import { NOISE_GLSL } from '../components/3d/shaders/noise.glsl.js'
import { renderToTexture } from './bakeTexture.js'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Four cloud textures packed into one RGBA image, so every nebula sprite
 * samples one texture and picks a channel:
 *   R  billowing fbm         — soft glowing gas
 *   G  ridged noise          — filaments and sharp edges
 *   B  domain-warped fbm     — wisps and streamers
 *   A  thresholded fbm       — clumpy knots, used mostly for dust
 */
const fragmentShader = /* glsl */ `
  ${NOISE_GLSL}
  varying vec2 vUv;

  void main() {
    vec3 p = vec3(vUv * 4.0, 0.0);

    float soft = smoothstep(0.22, 0.82, fbm3(p + 3.1) * 0.5 + 0.5);
    float ridge = smoothstep(0.35, 0.95, ridged3(p * 1.2 + vec3(7.3, 1.1, 0.0)));

    vec2 warp = vec2(fbm3(p * 0.8 + 11.0), fbm3(p * 0.8 + 19.0));
    float wisp = smoothstep(0.25, 0.85, fbm3(vec3(vUv * 4.0 + warp * 1.7, 2.0)) * 0.5 + 0.5);

    float blob = smoothstep(0.42, 0.78, fbm3(p * 1.6 + 5.0) * 0.5 + 0.5);

    gl_FragColor = vec4(soft, ridge, wisp, blob);
  }
`

let cache = null

/** Baked once per renderer; nebula sprites share it. */
export function getCloudTexture(renderer) {
  if (cache && cache.renderer === renderer) return cache.texture
  const texture = renderToTexture(
    renderer,
    512,
    512,
    new THREE.ShaderMaterial({ vertexShader, fragmentShader }),
    { colorSpace: THREE.NoColorSpace, wrap: THREE.ClampToEdgeWrapping },
  )
  cache = { renderer, texture }
  return texture
}
