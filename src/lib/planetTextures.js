import * as THREE from 'three'
import { NOISE_GLSL } from '../components/3d/shaders/noise.glsl.js'
import { PLANETS } from '../data/planets.js'
import { releaseBake, renderToTexture } from './bakeTexture.js'

/**
 * Planet surfaces are generated once on the GPU into render targets and then
 * used as ordinary texture maps.
 *
 * Why bake rather than evaluate noise per frame: a five-octave 3D fbm costs
 * roughly forty hash evaluations per pixel. Fine as a one-off pass over a
 * 1024x512 target, ruinous on integrated graphics when a focused planet
 * fills a 1440p viewport every frame. Baking moves that cost to a few
 * milliseconds at startup and leaves the frame loop sampling flat textures.
 *
 * Everything here is procedural. The surfaces are plausible planetary
 * terrain, not photographic maps: Earth's continents are generated, not
 * Earth's actual geography.
 */

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SURFACE_FRAGMENT = /* glsl */ `
  ${NOISE_GLSL}

  uniform int uKind;
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform float uSeed;
  uniform float uContrast;
  uniform vec4 uSpot;        // x: lat(rad), y: lon(rad), z: size, w: enabled
  uniform vec3 uSpotColor;

  varying vec2 vUv;

  vec3 applySpot(vec3 color, vec3 dir) {
    if (uSpot.w < 0.5) return color;

    float cosLat = cos(uSpot.x);
    vec3 spotDir = vec3(cos(uSpot.y) * cosLat, sin(uSpot.x), sin(uSpot.y) * cosLat);

    // Flatten the offset in latitude so the storm reads as a wide oval.
    vec3 delta = dir - spotDir;
    delta.y *= 2.3;
    float d = length(delta) + fbm3(dir * 9.0 + uSeed) * 0.035;

    float core = 1.0 - smoothstep(uSpot.z * 0.42, uSpot.z, d);
    float halo = 1.0 - smoothstep(uSpot.z, uSpot.z * 1.5, d);
    return mix(color, uSpotColor, core * 0.88 + halo * 0.12);
  }

  void main() {
    vec3 dir = sphereDirection(vUv);
    vec3 color;

    if (uKind == 0) {
      // Rocky and cratered: ridged noise over a broad height field.
      float base = fbm3(dir * 3.1 + uSeed);
      float craters = ridged3(dir * 7.5 + uSeed * 2.0);
      float detail = fbm3(dir * 19.0 + uSeed);
      float height = base * 0.62 + (craters - 0.52) * 0.55 + detail * 0.16;

      color = mix(uColorHigh, uColorLow, smoothstep(-0.34, 0.3, height));
      color = mix(color, uColorMid, smoothstep(0.08, 0.46, height));
      color *= 0.84 + 0.32 * (detail * 0.5 + 0.5);
    } else if (uKind == 1) {
      // Thick uniform cloud deck, lightly sheared into latitude bands.
      float swirl = fbm3(dir * 2.3 + vec3(0.0, dir.y * 3.2, 0.0) + uSeed);
      float band = sin(dir.y * 8.5 + swirl * 4.2) * 0.5 + 0.5;
      float fine = fbm3(dir * 9.5 + uSeed) * 0.5 + 0.5;

      color = mix(uColorLow, uColorMid, clamp(band * 0.68 + fine * 0.32, 0.0, 1.0));
      color = mix(color, uColorHigh, smoothstep(0.6, 1.0, abs(dir.y)) * 0.3);
    } else if (uKind == 2) {
      // Ocean world: warped fbm thresholded into landmasses, with arid
      // belts near the horse latitudes and noisy polar ice.
      float warp = fbm3(dir * 1.7 + uSeed) * 0.55;
      float land = fbm3(dir * 2.2 + warp + uSeed);
      float shore = smoothstep(0.015, 0.085, land);

      float depth = fbm3(dir * 4.2 + uSeed * 3.0) * 0.5 + 0.5;
      vec3 ocean = mix(uColorLow * 0.55, uColorLow, depth);

      float relief = fbm3(dir * 6.8 + uSeed) * 0.5 + 0.5;
      float desert = 1.0 - smoothstep(0.0, 0.26, abs(abs(dir.y) - 0.45));
      vec3 land_color = mix(uColorMid, vec3(0.63, 0.53, 0.33), desert * 0.72);
      land_color = mix(land_color, land_color * 0.62, smoothstep(0.45, 0.9, relief));

      color = mix(ocean, land_color, shore);

      float ice = smoothstep(0.76, 0.94, abs(dir.y) + fbm3(dir * 5.0 + uSeed) * 0.09);
      color = mix(color, uColorHigh, ice);
    } else if (uKind == 3) {
      // Gas giant: latitude bands with the latitude itself perturbed, which
      // is what gives belts their turbulent edges.
      float turbulence = fbm3(dir * vec3(2.0, 5.2, 2.0) + uSeed);
      float lat = dir.y + turbulence * 0.13;

      float coarse = sin(lat * 7.0 + 1.3) * 0.5 + 0.5;
      float fine = sin(lat * 16.5) * 0.5 + 0.5;
      float value = clamp(coarse * 0.55 + fine * 0.45, 0.0, 1.0);

      float grain = fbm3(dir * 15.0 + uSeed) * 0.5 + 0.5;
      value = clamp(mix(0.5, value, uContrast) * 0.84 + grain * 0.16, 0.0, 1.0);

      color = mix(uColorHigh, uColorLow, value);
      color = mix(color, uColorMid, smoothstep(0.62, 1.0, value));
      color *= 1.0 - 0.28 * smoothstep(0.68, 1.0, abs(dir.y));
      color = applySpot(color, dir);
    } else {
      // Ice giant: nearly featureless, faint banding only.
      float turbulence = fbm3(dir * vec3(2.0, 4.0, 2.0) + uSeed);
      float band = sin((dir.y + turbulence * 0.1) * 9.0) * 0.5 + 0.5;
      float haze = fbm3(dir * 6.0 + uSeed) * 0.5 + 0.5;
      float value = mix(0.5, band * 0.45 + haze * 0.55, uContrast);

      color = mix(uColorHigh, uColorLow, value);
      color = mix(color, uColorMid, smoothstep(0.68, 1.0, value) * 0.55);
      color = applySpot(color, dir);
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

const CLOUD_FRAGMENT = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uSeed;
  varying vec2 vUv;

  void main() {
    vec3 dir = sphereDirection(vUv);

    float warp = fbm3(dir * 2.3 + uSeed) * 0.65;
    float cloud = fbm3(dir * 3.6 + warp + uSeed) * 0.5 + 0.5;

    // Weather follows latitude: a wet equator, dry subtropics, storm tracks.
    float banding = 0.5 + 0.5 * sin(dir.y * 7.5 + 1.0);
    float coverage = cloud * 0.74 + banding * 0.26;

    float alpha = smoothstep(0.46, 0.76, coverage);

    // White everywhere, with coverage carried entirely by alpha: the RGB of
    // a fully transparent texel still gets blended in by bilinear filtering.
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.9);
  }
`

const RING_FRAGMENT = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uSeed;
  varying vec2 vUv;

  void main() {
    float r = vUv.x;

    float grain = fbm3(vec3(r * 42.0, uSeed, 0.0)) * 0.5 + 0.5;
    float ringlets = 0.55 + 0.45 * sin(r * 150.0 + grain * 7.0);
    float density = clamp(ringlets * 0.62 + grain * 0.38, 0.0, 1.0);

    // Two prominent divisions, in the spirit of the Cassini gap.
    density *= 1.0 - 0.95 * (1.0 - smoothstep(0.0, 0.022, abs(r - 0.41)));
    density *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.012, abs(r - 0.68)));

    // Fade both edges so the ring has no hard rim.
    density *= smoothstep(0.0, 0.07, r) * (1.0 - smoothstep(0.86, 1.0, r));

    vec3 color = mix(vec3(0.60, 0.53, 0.41), vec3(0.95, 0.90, 0.78), density);
    gl_FragColor = vec4(color, clamp(density, 0.0, 1.0) * 0.92);
  }
`

const SURFACE_KIND = { rocky: 0, cloudy: 1, terrestrial: 2, banded: 3, ice: 4 }

// Uranus is genuinely near-featureless; Neptune and the gas giants are not.
const CONTRAST = { uranus: 0.35, neptune: 0.85, jupiter: 1.0, saturn: 0.8 }

function toVec3(hex) {
  const color = new THREE.Color(hex)
  return new THREE.Vector3(color.r, color.g, color.b)
}

function bakeSurface(renderer, planet, size) {
  const { palette, spot } = planet.sim
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: SURFACE_FRAGMENT,
    uniforms: {
      uKind: { value: SURFACE_KIND[planet.surface] ?? 0 },
      uColorLow: { value: toVec3(palette[0]) },
      uColorMid: { value: toVec3(palette[1]) },
      uColorHigh: { value: toVec3(palette[2]) },
      uSeed: { value: planet.sim.phase * 7.3 + 1.1 },
      uContrast: { value: CONTRAST[planet.id] ?? 1 },
      uSpot: {
        value: spot
          ? new THREE.Vector4(spot.lat, spot.lon, spot.size, 1)
          : new THREE.Vector4(0, 0, 0, 0),
      },
      uSpotColor: { value: toVec3(spot ? spot.color : '#000000') },
    },
  })

  return renderToTexture(renderer, size[0], size[1], material)
}

const worlds = new Map()
const MAX_WORLDS = 24

/**
 * A surface for any other world, from the same shader, baked on first use.
 * The cache is bounded: the least recently used surface is freed, so touring
 * the whole catalogue cannot pile textures up on the GPU.
 */
export function getWorldTexture(renderer, world, size = [1024, 512]) {
  const key = world.id
  const cached = worlds.get(key)
  if (cached?.renderer === renderer) {
    worlds.delete(key)
    worlds.set(key, cached)
    return cached.texture
  }
  const texture = bakeSurface(
    renderer,
    {
      id: world.id,
      surface: world.surface,
      sim: { palette: world.palette, spot: null, phase: world.seed },
    },
    size,
  )
  worlds.set(key, { renderer, texture })
  if (worlds.size > MAX_WORLDS) {
    const [oldestKey, oldest] = worlds.entries().next().value
    worlds.delete(oldestKey)
    releaseBake(oldest.renderer, oldest.texture)
  }
  return texture
}

let cache = null

/**
 * Bakes every surface once per renderer and memoises the result, so React
 * StrictMode's double invocation cannot produce two sets of render targets.
 */
export function getPlanetTextures(renderer) {
  if (cache && cache.renderer === renderer) return cache

  const surfaces = {}
  for (const planet of PLANETS) {
    // Gas giants and Earth are the ones a viewer gets close to and studies;
    // the small rocky worlds hold up fine at half the resolution.
    const large = planet.sim.radius >= 0.38 || planet.id === 'earth'
    surfaces[planet.id] = bakeSurface(renderer, planet, large ? [1024, 512] : [512, 256])
  }

  const clouds = renderToTexture(
    renderer,
    768,
    384,
    new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT,
      uniforms: { uSeed: { value: 4.7 } },
    }),
  )

  const rings = renderToTexture(
    renderer,
    1024,
    4,
    new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: RING_FRAGMENT,
      uniforms: { uSeed: { value: 2.3 } },
    }),
  )
  rings.wrapS = THREE.ClampToEdgeWrapping

  cache = { renderer, surfaces, clouds, rings }
  return cache
}
