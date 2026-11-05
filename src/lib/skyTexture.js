import * as THREE from 'three'
import { NOISE_GLSL } from '../components/3d/shaders/noise.glsl.js'
import { renderToTexture } from './bakeTexture.js'
import { quality } from './quality.js'

/**
 * The sky behind a black hole, baked once into an equirectangular map. Rays
 * bent by the hole look up the direction they finally leave in, so this is
 * what appears stretched and duplicated around the shadow. Baking it keeps
 * the per-pixel cost of the ray tracer down to one texture read.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  ${NOISE_GLSL}
  varying vec2 vUv;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  vec3 jitter(vec3 p) {
    return vec3(hash31(p), hash31(p + 17.1), hash31(p + 41.7));
  }

  // One star per occupied cell of a grid laid over the sphere.
  vec3 starLayer(vec3 dir, float cells, float density, float size) {
    vec3 scaled = dir * cells;
    vec3 base = floor(scaled);
    vec3 result = vec3(0.0);
    for (int i = 0; i < 8; i += 1) {
      vec3 cell = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
      float present = step(1.0 - density, hash31(cell + 3.7));
      if (present < 0.5) continue;
      vec3 center = normalize(cell + jitter(cell));
      // Chord length: acos loses all precision at these tiny angles.
      float d = length(dir - center) * cells;
      float glow = exp(-d * d / (size * size));
      float tint = hash31(cell + 9.1);
      vec3 color = tint < 0.34 ? vec3(0.72, 0.82, 1.0) : tint < 0.72 ? vec3(1.0, 0.95, 0.86) : vec3(1.0, 0.76, 0.56);
      result += color * glow * (0.35 + 0.65 * pow(hash31(cell + 5.3), 3.0));
    }
    return result;
  }

  void main() {
    float lon = (vUv.x - 0.5) * 6.2831853;
    float lat = (vUv.y - 0.5) * 3.1415927;
    vec3 dir = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));

    vec3 color = starLayer(dir, 24.0, 0.05, 0.022) * 1.5;
    color += starLayer(dir, 60.0, 0.05, 0.05) * 0.8;
    color += starLayer(dir, 150.0, 0.045, 0.11) * 0.4;

    // A faint galactic band and dust, so lensing has something large to bend.
    vec3 tilted = normalize(vec3(dir.x, dir.y * 0.92 + dir.x * 0.38, dir.z));
    float band = exp(-pow(tilted.y * 4.2, 2.0));
    float clouds = fbm3(dir * 3.2) * 0.5 + 0.5;
    float fine = fbm3(dir * 9.0 + 4.0) * 0.5 + 0.5;
    color += vec3(0.1, 0.13, 0.24) * band * clouds * 0.2;
    color += vec3(0.24, 0.13, 0.1) * band * pow(fine, 3.0) * 0.16;
    color += vec3(0.1, 0.06, 0.2) * pow(clouds, 4.0) * 0.05;

    gl_FragColor = vec4(color, 1.0);
  }
`

let cache = null

/** Baked once per renderer; shared by every black hole and the wormhole. */
export function getSkyTexture(renderer) {
  if (cache && cache.renderer === renderer) return cache.texture
  const size = quality().skySize
  const texture = renderToTexture(
    renderer,
    size,
    size / 2,
    new THREE.ShaderMaterial({ vertexShader, fragmentShader }),
    { colorSpace: THREE.NoColorSpace },
  )
  cache = { renderer, texture }
  return texture
}
