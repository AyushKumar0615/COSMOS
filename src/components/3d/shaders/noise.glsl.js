/**
 * Shared GLSL noise, injected into the planet-texture bake and the Sun.
 *
 * Everything is 3D and sampled on the unit sphere, which is what makes the
 * baked equirectangular maps seamless: no longitude seam to hide and no
 * noise distortion at the poles.
 */
export const NOISE_GLSL = /* glsl */ `
  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(dot(hash33(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
            dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
        mix(dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
            dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x),
        u.y),
      mix(
        mix(dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
            dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
        mix(dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
            dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x),
        u.y),
      u.z);
  }

  // Fixed octave counts: these only ever run in a one-off bake or on a
  // single object, so generosity costs nothing at frame time.
  float fbm3(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise3(p);
      norm += amplitude;
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value / norm;
  }

  float ridged3(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 5; i++) {
      float n = 1.0 - abs(noise3(p));
      value += amplitude * n * n;
      norm += amplitude;
      p *= 2.07;
      amplitude *= 0.5;
    }
    return value / norm;
  }

  // Equirectangular UV -> direction on the unit sphere. Matches the UV
  // layout of THREE.SphereGeometry.
  vec3 sphereDirection(vec2 uv) {
    float lon = uv.x * 6.28318530718;
    float lat = (uv.y - 0.5) * 3.14159265359;
    float cosLat = cos(lat);
    return vec3(cos(lon) * cosLat, sin(lat), sin(lon) * cosLat);
  }
`
