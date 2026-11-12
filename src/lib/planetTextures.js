import * as THREE from 'three'
import { NOISE_GLSL } from '../components/3d/shaders/noise.glsl.js'
import { PLANETS } from '../data/planets.js'
import { releaseBake, renderToTexture } from './bakeTexture.js'
import { quality } from './quality.js'

/**
 * Planet surfaces are generated once on the GPU into render targets and then
 * used as ordinary texture maps.
 *
 * Why bake rather than evaluate noise per frame: a five-octave 3D fbm costs
 * roughly forty hash evaluations per pixel, and crater fields cost more.
 * Fine as a one-off pass, ruinous on integrated graphics when a focused
 * planet fills a 1440p viewport every frame. Baking moves that cost to a few
 * milliseconds at startup and leaves the frame loop sampling flat textures.
 *
 * Each solar-system planet gets two maps from the same shader:
 *   colour — the albedo map.
 *   data   — R height (used as a bump map), G roughness, B night lights.
 * Packing three scalar maps into one texture costs one bake and one sampler.
 *
 * Everything here is procedural. The surfaces are plausible planetary
 * terrain styled on each planet's real character, not photographic maps:
 * Earth's continents are generated, not Earth's actual geography. Ring
 * profiles are the exception: Saturn's, Uranus's and Neptune's ring and gap
 * radii are placed at their published distances (NASA ring fact sheets).
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
  uniform int uPlanet;      // 0 any world; 1-8 Mercury to Neptune
  uniform int uOutput;      // 0 colour; 1 data (height, roughness, lights)
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform float uSeed;
  uniform float uContrast;
  uniform vec4 uSpot;        // x: lat(rad), y: lon(rad), z: size, w: enabled
  uniform vec3 uSpotColor;

  varying vec2 vUv;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  // Cellular crater field: a bowl below the surroundings, a raised rim and
  // a little ejecta, sized by a power law so small craters outnumber large.
  float craterField(vec3 p, float density) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float h = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 o = vec3(float(x), float(y), float(z));
          vec3 c = i + o;
          if (hash13(c + 17.0) > density) continue;
          vec3 jitter = vec3(hash13(c), hash13(c + 5.3), hash13(c + 9.1));
          float r = 0.16 + 0.32 * pow(hash13(c + 3.7), 2.2);
          float d = length(o + jitter - f) / r;
          if (d < 1.0) h += (d * d - 1.0) * 0.9 * r;
          h += exp(-pow((d - 1.0) * 4.5, 2.0)) * 0.4 * r;
          h += exp(-(d - 1.0) * 2.5) * step(1.0, d) * 0.05 * r;
        }
      }
    }
    return h;
  }

  vec3 spotDirection(float lat, float lon) {
    float cosLat = cos(lat);
    return vec3(cos(lon) * cosLat, sin(lat), sin(lon) * cosLat);
  }

  // An oval storm, flattened in latitude, with a turbulent edge.
  float oval(vec3 dir, vec3 centre, float size, float squash) {
    vec3 delta = dir - centre;
    delta.y *= squash;
    float d = length(delta) + fbm3(dir * 9.0 + uSeed) * 0.03;
    return 1.0 - smoothstep(size * 0.45, size, d);
  }

  vec3 applySpot(vec3 color, vec3 dir) {
    if (uSpot.w < 0.5) return color;
    vec3 centre = spotDirection(uSpot.x, uSpot.y);
    // Spiral the interior so the storm reads as a vortex, not a stain.
    vec3 delta = dir - centre;
    float d = length(delta * vec3(1.0, 2.3, 1.0));
    float swirl = fbm3(dir * 14.0 + vec3(d * 30.0) + uSeed);
    float core = 1.0 - smoothstep(uSpot.z * 0.4, uSpot.z, d + swirl * 0.025);
    float collar = (1.0 - smoothstep(uSpot.z, uSpot.z * 1.45, d)) - core;
    color = mix(color, uSpotColor * (0.9 + swirl * 0.3), core * 0.9);
    // Lighter collar: the Red Spot sits in a pale "hollow" in its belt.
    return mix(color, uColorMid, max(collar, 0.0) * 0.35);
  }

  // Rotate p about axis a by angle t (Rodrigues).
  vec3 rotateAbout(vec3 p, vec3 a, float t) {
    return p * cos(t) + cross(a, p) * sin(t) + a * dot(a, p) * (1.0 - cos(t));
  }

  void surface(vec3 dir, out vec3 color, out float height, out float rough, out float lights) {
    height = 0.5;
    rough = 0.92;
    lights = 0.0;

    if (uKind == 0) {
      // Rocky and cratered: three crater scales over a broad height field.
      float base = fbm3(dir * 3.1 + uSeed);
      float craters = craterField(dir * 5.0 + uSeed, 0.5)
        + craterField(dir * 13.0 + uSeed * 1.7, 0.55) * 0.55
        + craterField(dir * 34.0 + uSeed * 2.3, 0.6) * 0.25;
      float detail = fbm3(dir * 24.0 + uSeed);
      float h = base * 0.45 + craters * 1.5 + detail * 0.1;

      color = mix(uColorHigh, uColorLow, smoothstep(-0.4, 0.25, h));
      color = mix(color, uColorMid, smoothstep(0.05, 0.5, h));
      color *= 0.86 + 0.28 * (detail * 0.5 + 0.5);

      if (uPlanet == 1) {
        // Mercury: bright rays splashed from a few young craters.
        float rays = pow(max(ridged3(dir * vec3(9.0, 2.0, 9.0) + uSeed) - 0.55, 0.0) * 2.2, 2.0);
        color += vec3(0.22) * rays * smoothstep(0.2, 0.6, fbm3(dir * 2.0 + 7.0) + 0.5);
      }

      if (uPlanet == 4) {
        // Mars: dark basaltic provinces, Tharsis-style shield volcanoes, a
        // long equatorial canyon, and water-ice polar caps.
        float provinces = smoothstep(-0.05, 0.22, fbm3(dir * 1.6 + uSeed * 0.3));
        color = mix(color * vec3(0.55, 0.5, 0.48), color, provinces);

        float shield = 0.0;
        shield += exp(-pow(length(dir - spotDirection(0.31, 1.9)) / 0.09, 2.0)) * 1.0;
        shield += exp(-pow(length(dir - spotDirection(0.03, 1.75)) / 0.06, 2.0)) * 0.7;
        shield += exp(-pow(length(dir - spotDirection(-0.16, 1.85)) / 0.06, 2.0)) * 0.7;
        h += shield * 0.9;
        color = mix(color, color * 1.15, shield);

        float lon = atan(dir.z, dir.x);
        float canyon = exp(-pow((dir.y + 0.14 + fbm3(dir * 8.0) * 0.02) / 0.022, 2.0))
          * smoothstep(2.05, 2.25, lon) * (1.0 - smoothstep(2.95, 3.15, lon));
        h -= canyon * 0.8;
        color *= 1.0 - canyon * 0.35;

        float ice = smoothstep(0.88, 0.94, abs(dir.y) + fbm3(dir * 6.0 + uSeed) * 0.05 + (dir.y > 0.0 ? 0.02 : 0.0));
        color = mix(color, vec3(0.92, 0.9, 0.88), ice);
        h = mix(h, 0.3, ice * 0.6);
        rough = mix(0.96, 0.7, ice);
      } else {
        rough = 0.95;
      }
      height = clamp(h * 0.5 + 0.5, 0.0, 1.0);
    } else if (uKind == 1) {
      // Thick cloud deck. On Venus the cloud tops super-rotate faster near
      // the equator, shearing features into the sideways "Y" seen in UV.
      float cosLat = sqrt(max(1.0 - dir.y * dir.y, 0.0));
      float lon = atan(dir.z, dir.x) + abs(dir.y) * (uPlanet == 2 ? 2.4 : 0.0);
      vec3 sheared = vec3(cos(lon) * cosLat, dir.y, sin(lon) * cosLat);

      float swirl = fbm3(sheared * 2.3 + vec3(0.0, dir.y * 3.2, 0.0) + uSeed);
      float band = sin(dir.y * 8.5 + swirl * 4.2) * 0.5 + 0.5;
      float streaks = fbm3(sheared * vec3(2.0, 9.0, 2.0) + uSeed) * 0.5 + 0.5;
      float fine = fbm3(sheared * 11.0 + uSeed) * 0.5 + 0.5;

      float value = clamp(band * 0.45 + streaks * 0.35 + fine * 0.2, 0.0, 1.0);
      color = mix(uColorLow, uColorMid, value);
      color = mix(color, uColorHigh, (1.0 - smoothstep(0.35, 0.6, value)) * 0.35);
      color = mix(color, uColorMid * 1.05, smoothstep(0.65, 1.0, abs(dir.y)) * 0.35);
      rough = 1.0;
    } else if (uKind == 2) {
      // Ocean world: warped fbm thresholded into landmasses, climate belts
      // by latitude and moisture, mountain snow and polar ice.
      float warp = fbm3(dir * 1.7 + uSeed) * 0.55;
      float land = fbm3(dir * 2.2 + warp + uSeed) + fbm3(dir * 11.0 + uSeed) * 0.06;
      float shore = smoothstep(0.012, 0.05, land);
      float lat = abs(dir.y);

      float depth = fbm3(dir * 4.2 + uSeed * 3.0) * 0.5 + 0.5;
      vec3 ocean = mix(uColorLow * 0.42, uColorLow * 0.9, depth);
      float shallow = 1.0 - smoothstep(-0.07, 0.012, land);
      ocean = mix(ocean, vec3(0.09, 0.42, 0.52), (1.0 - shallow) * 0.55);

      float relief = ridged3(dir * 5.5 + uSeed);
      float moisture = fbm3(dir * 3.0 + uSeed * 5.0) * 0.5 + 0.5;
      float desertBelt = 1.0 - smoothstep(0.0, 0.18, abs(lat - 0.4));
      float arid = clamp(desertBelt * 1.2 - moisture * 0.7, 0.0, 1.0);

      vec3 tropical = uColorMid * vec3(0.7, 0.95, 0.65);
      vec3 temperate = uColorMid * vec3(1.05, 1.05, 0.85);
      vec3 boreal = vec3(0.17, 0.24, 0.16);
      vec3 tundra = vec3(0.42, 0.4, 0.34);
      vec3 sand = vec3(0.76, 0.63, 0.42);

      vec3 landColor = mix(tropical, temperate, smoothstep(0.15, 0.4, lat));
      landColor = mix(landColor, boreal, smoothstep(0.5, 0.62, lat));
      landColor = mix(landColor, tundra, smoothstep(0.66, 0.76, lat));
      landColor = mix(landColor, sand, arid);
      landColor = mix(landColor, vec3(0.38, 0.32, 0.26), smoothstep(0.55, 0.8, relief) * 0.7);
      float snow = smoothstep(0.78, 0.9, relief + lat * 0.25);
      landColor = mix(landColor, vec3(0.92, 0.94, 0.97), snow);
      landColor *= 0.88 + 0.24 * (fbm3(dir * 30.0 + uSeed) * 0.5 + 0.5);

      color = mix(ocean, landColor, shore);

      float ice = smoothstep(0.8, 0.9, lat + fbm3(dir * 5.0 + uSeed) * 0.07);
      color = mix(color, uColorHigh, ice);

      height = mix(0.42, 0.5 + relief * 0.5, shore);
      height = mix(height, 0.55, ice);
      rough = mix(0.32, 0.88, shore);
      rough = mix(rough, 0.55, ice);

      if (uPlanet == 3) {
        // Night lights: clustered along coasts and temperate latitudes,
        // absent from deserts, high mountains and ice.
        float coast = 1.0 - smoothstep(0.05, 0.22, land);
        float clusters = fbm3(dir * 26.0 + uSeed) * 0.5 + 0.5;
        float towns = fbm3(dir * 70.0 + uSeed * 2.0) * 0.5 + 0.5;
        float habitable = shore * (1.0 - ice) * (1.0 - arid * 0.85) * (1.0 - snow)
          * (1.0 - smoothstep(0.6, 0.75, lat));
        float density = smoothstep(0.55, 0.8, clusters + coast * 0.18) * smoothstep(0.5, 0.8, towns);
        lights = clamp(density * habitable * 1.3, 0.0, 1.0);
      }
    } else if (uKind == 3) {
      // Gas giant: belts and zones. Band edges come from warping latitude
      // itself; irregular band widths from 1D noise along latitude.
      vec3 w = dir + 0.035 * vec3(fbm3(dir * 7.0 + uSeed), fbm3(dir * 7.0 + uSeed + 3.1), fbm3(dir * 7.0 + uSeed + 6.2));
      float turbulence = fbm3(w * vec3(2.0, 6.0, 2.0) + uSeed);
      float lat = w.y + turbulence * 0.07;

      float coarse = sin(lat * 7.0 + 1.3) * 0.5 + 0.5;
      float irregular = fbm3(vec3(lat * 14.0, uSeed, 0.5)) * 0.5 + 0.5;
      float fine = sin(lat * 26.0 + irregular * 3.0) * 0.5 + 0.5;
      float value = clamp(coarse * 0.45 + irregular * 0.35 + fine * 0.2, 0.0, 1.0);

      float grain = fbm3(w * vec3(18.0, 40.0, 18.0) + uSeed) * 0.5 + 0.5;
      value = clamp(mix(0.5, value, uContrast) * 0.86 + grain * 0.14, 0.0, 1.0);

      color = mix(uColorHigh, uColorLow, value);
      color = mix(color, uColorMid, smoothstep(0.6, 1.0, value));

      if (uPlanet == 5) {
        // Jupiter: blue-grey festoons along the equatorial belt edge, white
        // ovals in the southern hemisphere, and greyer polar regions.
        float festoon = smoothstep(0.62, 0.8, fbm3(w * vec3(6.0, 22.0, 6.0) + uSeed * 3.0))
          * exp(-pow((dir.y - 0.12) / 0.04, 2.0));
        color = mix(color, vec3(0.38, 0.42, 0.5), festoon * 0.6);
        for (int k = 0; k < 4; k++) {
          float lon = 0.7 + float(k) * 1.55;
          color = mix(color, vec3(0.95, 0.93, 0.88), oval(dir, spotDirection(-0.58, lon), 0.045, 1.8) * 0.8);
        }
        color = mix(color, color * vec3(0.78, 0.8, 0.86), smoothstep(0.62, 0.9, abs(dir.y)));
      }
      if (uPlanet == 6) {
        // Saturn's north polar hexagon, a six-sided jet stream near 78°N.
        if (dir.y > 0.8) {
          float colat = acos(clamp(dir.y, -1.0, 1.0));
          float a = atan(dir.z, dir.x);
          float sector = mod(a, 1.0471976) - 0.5235988;
          float hexR = 0.21 / cos(sector);
          float inside = 1.0 - smoothstep(hexR - 0.008, hexR + 0.008, colat);
          float edge = exp(-pow((colat - hexR) / 0.012, 2.0));
          color = mix(color, vec3(0.52, 0.56, 0.58), inside * 0.6);
          color = mix(color, color * 1.18, edge * 0.5);
        }
      }

      color *= 1.0 - 0.22 * smoothstep(0.7, 1.0, abs(dir.y));
      color = applySpot(color, dir);
      rough = 1.0;
    } else {
      // Ice giant: nearly featureless, faint banding only.
      float turbulence = fbm3(dir * vec3(2.0, 4.0, 2.0) + uSeed);
      float band = sin((dir.y + turbulence * 0.1) * 9.0) * 0.5 + 0.5;
      float haze = fbm3(dir * 6.0 + uSeed) * 0.5 + 0.5;
      float value = mix(0.5, band * 0.45 + haze * 0.55, uContrast);

      color = mix(uColorHigh, uColorLow, value);
      color = mix(color, uColorMid, smoothstep(0.68, 1.0, value) * 0.55);
      color = applySpot(color, dir);

      if (uPlanet == 8 && uSpot.w > 0.5) {
        // Bright methane-ice clouds ride alongside Neptune's dark spots.
        vec3 companion = spotDirection(uSpot.x - 0.08, uSpot.y + 0.05);
        color = mix(color, vec3(0.9, 0.94, 1.0), oval(dir, companion, 0.06, 3.5) * 0.7);
      }
      if (uPlanet == 7) {
        // Uranus: a slightly brighter polar hood.
        color = mix(color, uColorMid, smoothstep(0.75, 1.0, dir.y) * 0.25);
      }
      rough = 1.0;
    }
  }

  void main() {
    vec3 dir = sphereDirection(vUv);
    vec3 color;
    float height;
    float rough;
    float lights;
    surface(dir, color, height, rough, lights);

    if (uOutput == 1) gl_FragColor = vec4(height, rough, lights, 1.0);
    else gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

const CLOUD_FRAGMENT = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uSeed;
  uniform int uStyle;       // 0 Earth weather; 1 Neptune's high cirrus streaks
  varying vec2 vUv;

  vec3 rotateAbout(vec3 p, vec3 a, float t) {
    return p * cos(t) + cross(a, p) * sin(t) + a * dot(a, p) * (1.0 - cos(t));
  }

  void main() {
    vec3 dir = sphereDirection(vUv);
    float alpha;

    if (uStyle == 1) {
      float streak = fbm3(dir * vec3(3.0, 26.0, 3.0) + uSeed) * 0.5 + 0.5;
      float belt = exp(-pow((abs(dir.y) - 0.42) / 0.14, 2.0)) + exp(-pow((dir.y + 0.12) / 0.05, 2.0)) * 0.5;
      alpha = smoothstep(0.6, 0.78, streak) * belt * 0.85;
    } else {
      // Cyclones: twist the sampling space around a few storm centres, so
      // the cloud bands curl into spirals (opposite senses per hemisphere).
      vec3 p = dir;
      for (int k = 0; k < 5; k++) {
        float fk = float(k);
        float lat = (fract(sin(fk * 12.9898 + uSeed) * 43758.5) - 0.5) * 1.6;
        float lon = fract(sin(fk * 78.233 + uSeed) * 12345.6) * 6.2831;
        vec3 c = vec3(cos(lon) * cos(lat), sin(lat), sin(lon) * cos(lat));
        float d = length(p - c);
        float twist = (1.0 - smoothstep(0.0, 0.32, d)) * 4.0 * sign(lat);
        p = rotateAbout(p, c, twist);
      }

      float warp = fbm3(p * 2.3 + uSeed) * 0.65;
      float cloud = fbm3(p * 3.6 + warp + uSeed) * 0.5 + 0.5;
      float detail = fbm3(p * 14.0 + uSeed) * 0.5 + 0.5;

      // Weather follows latitude: a wet equator, dry subtropics, storm tracks.
      float banding = 0.5 + 0.5 * sin(dir.y * 7.5 + 1.0);
      float coverage = cloud * 0.66 + banding * 0.22 + detail * 0.12;
      alpha = smoothstep(0.47, 0.75, coverage) * 0.92;
    }

    // White everywhere, with coverage carried entirely by alpha: the RGB of
    // a fully transparent texel still gets blended in by bilinear filtering.
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`

/**
 * Ring brightness and opacity across the ring plane. U runs from the inner
 * to the outer radius given in uInner/uOuter (planet radii), so features sit
 * at their real distances whatever the ring's on-screen size.
 *
 * Radii from the NASA Saturnian, Uranian and Neptunian ring fact sheets,
 * divided by each planet's equatorial radius (60,268 / 25,559 / 24,764 km).
 * Opacities and colours are illustrative.
 */
const RING_FRAGMENT = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uSeed;
  uniform int uProfile;     // 0 Saturn, 1 Uranus, 2 Neptune, 3 faint dust
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vUv;

  float band(float r, float a, float b, float e) {
    return smoothstep(a - e, a + e, r) * (1.0 - smoothstep(b - e, b + e, r));
  }
  float line(float r, float c, float w) {
    return exp(-pow((r - c) / w, 2.0));
  }

  void main() {
    float r = mix(uInner, uOuter, vUv.x);
    float fine = fbm3(vec3(r * 260.0, uSeed, 0.0)) * 0.5 + 0.5;
    float ringlets = 0.5 + 0.5 * sin(r * 1400.0 + fine * 6.0);
    vec3 color;
    float density;

    if (uProfile == 0) {
      float c = band(r, 1.2388, 1.5265, 0.003);
      float b = band(r, 1.5265, 1.9510, 0.002);
      float cassini = band(r, 1.9510, 2.0271, 0.002);
      float a = band(r, 2.0271, 2.2694, 0.002);
      float bInner = smoothstep(1.53, 1.66, r);
      density = c * (0.14 + 0.12 * ringlets)
        + b * (0.62 + 0.3 * bInner + 0.1 * fine)
        + cassini * 0.07
        + a * (0.52 + 0.1 * fine + 0.06 * ringlets);
      // Encke (133,589 km) and Keeler (136,530 km) gaps, and the F ring.
      density *= 1.0 - line(r, 2.2166, 0.0024);
      density *= 1.0 - 0.9 * line(r, 2.2654, 0.0007);
      density += line(r, 2.3260, 0.0012) * 0.45;
      density = clamp(density, 0.0, 1.0);
      color = vec3(0.47, 0.42, 0.37) * c + vec3(0.88, 0.8, 0.66) * b
        + vec3(0.6, 0.55, 0.5) * cassini + vec3(0.8, 0.76, 0.68) * a;
      color += vec3(0.75) * line(r, 2.3260, 0.0012);
      color *= 0.9 + 0.2 * fine;
    } else if (uProfile == 1) {
      // Rings 6, 5, 4, alpha, beta, eta, gamma, delta, lambda, epsilon.
      density = 0.0;
      density += line(r, 1.6369, 0.0011) * 0.3;
      density += line(r, 1.6524, 0.0011) * 0.3;
      density += line(r, 1.6656, 0.0011) * 0.3;
      density += line(r, 1.7496, 0.0014) * 0.4;
      density += line(r, 1.7865, 0.0014) * 0.4;
      density += line(r, 1.8458, 0.0011) * 0.25;
      density += line(r, 1.8634, 0.0012) * 0.35;
      density += line(r, 1.8897, 0.0013) * 0.4;
      density += line(r, 1.9572, 0.0009) * 0.15;
      density += line(r, 2.0012, 0.0028) * 0.75;
      density = clamp(density, 0.0, 1.0);
      color = vec3(0.42, 0.42, 0.44);
    } else if (uProfile == 2) {
      // Galle (broad), Le Verrier, Lassell (broad, faint), Arago, Adams.
      density = band(r, 1.65, 1.73, 0.02) * 0.04
        + line(r, 2.1483, 0.003) * 0.45
        + band(r, 2.15, 2.31, 0.01) * 0.02
        + line(r, 2.3098, 0.003) * 0.2
        + line(r, 2.5413, 0.003) * 0.6;
      color = vec3(0.5, 0.48, 0.5);
    } else {
      density = band(r, uInner + 0.05, uOuter - 0.05, 0.05) * (0.4 + 0.3 * fine);
      color = vec3(0.6, 0.55, 0.5);
    }

    gl_FragColor = vec4(color, clamp(density, 0.0, 1.0));
  }
`

const SURFACE_KIND = { rocky: 0, cloudy: 1, terrestrial: 2, banded: 3, ice: 4 }
const PLANET_INDEX = { mercury: 1, venus: 2, earth: 3, mars: 4, jupiter: 5, saturn: 6, uranus: 7, neptune: 8 }

// Uranus is genuinely near-featureless; Neptune and the gas giants are not.
const CONTRAST = { uranus: 0.35, neptune: 0.85, jupiter: 1.0, saturn: 0.75 }

/** Ring profiles, each with the radial span (planet radii) its texture covers. */
export const RING_PROFILES = {
  saturn: { index: 0, inner: 1.235, outer: 2.335 },
  uranus: { index: 1, inner: 1.62, outer: 2.02 },
  neptune: { index: 2, inner: 1.6, outer: 2.6 },
  faint: { index: 3, inner: 1.3, outer: 1.9 },
}

function toVec3(hex) {
  const color = new THREE.Color(hex)
  return new THREE.Vector3(color.r, color.g, color.b)
}

function surfaceMaterial(planet, output) {
  const { palette, spot } = planet.sim
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: SURFACE_FRAGMENT,
    uniforms: {
      uKind: { value: SURFACE_KIND[planet.surface] ?? 0 },
      uPlanet: { value: PLANET_INDEX[planet.id] ?? 0 },
      uOutput: { value: output },
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
}

function bakeSurface(renderer, planet, size) {
  return renderToTexture(renderer, size[0], size[1], surfaceMaterial(planet, 0))
}

function bakeData(renderer, planet, size) {
  return renderToTexture(renderer, size[0], size[1], surfaceMaterial(planet, 1), {
    colorSpace: THREE.NoColorSpace,
  })
}

function bakeClouds(renderer, size, style, seed) {
  return renderToTexture(
    renderer,
    size[0],
    size[1],
    new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT,
      uniforms: { uSeed: { value: seed }, uStyle: { value: style } },
    }),
  )
}

function bakeRing(renderer, profile) {
  const texture = renderToTexture(
    renderer,
    2048,
    4,
    new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: RING_FRAGMENT,
      uniforms: {
        uSeed: { value: 2.3 },
        uProfile: { value: profile.index },
        uInner: { value: profile.inner },
        uOuter: { value: profile.outer },
      },
    }),
  )
  texture.wrapS = THREE.ClampToEdgeWrapping
  return texture
}

const worlds = new Map()
const MAX_WORLDS = 48

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

// Worlds with relief worth a bump map, roughness variation or lights.
const DATA_MAPS = new Set(['mercury', 'earth', 'mars'])
// The planets a viewer studies close up get the sharpest maps.
const DETAILED = new Set(['earth', 'jupiter', 'saturn'])

let cache = null

/**
 * Bakes every surface once per renderer and memoises the result, so React
 * StrictMode's double invocation cannot produce two sets of render targets.
 */
export function getPlanetTextures(renderer) {
  if (cache && cache.renderer === renderer) return cache

  const { tier } = quality()
  const sharp = tier === 'high' ? [2048, 1024] : [1024, 512]
  const surfaces = {}
  const data = {}
  for (const planet of PLANETS) {
    const large = planet.sim.radius >= 0.38 || planet.id === 'earth'
    const size = DETAILED.has(planet.id) ? sharp : large ? [1024, 512] : [512, 256]
    surfaces[planet.id] = bakeSurface(renderer, planet, size)
    if (DATA_MAPS.has(planet.id)) {
      data[planet.id] = bakeData(renderer, planet, tier === 'low' ? [512, 256] : [1024, 512])
    }
  }

  const clouds = bakeClouds(renderer, tier === 'high' ? [2048, 1024] : [1024, 512], 0, 4.7)
  const neptuneClouds = bakeClouds(renderer, [512, 256], 1, 8.1)

  const ringProfiles = {}
  for (const [id, profile] of Object.entries(RING_PROFILES)) ringProfiles[id] = bakeRing(renderer, profile)

  cache = { renderer, surfaces, data, clouds, neptuneClouds, rings: ringProfiles.saturn, ringProfiles }
  return cache
}
