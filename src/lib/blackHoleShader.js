/**
 * Ray tracer for the black hole explorer.
 *
 * Each pixel's light is followed backwards through Schwarzschild spacetime.
 * In units of r_s the path obeys u'' + u = (3/2) u² (u = 1/r), which is the
 * same as a particle in flat space under the acceleration
 *
 *     a = -(3/2) h² x / r⁵,    h = |x × v|.
 *
 * So the shadow, the lensed disc, the photon ring and the distorted stars are
 * consequences of the integration, not painted on. The disc's brightness uses
 * the exact Schwarzschild redshift for circular orbits, and its temperature
 * follows the standard thin-disc profile.
 *
 * The one part that is NOT a calculation is `interior()`: the view below the
 * horizon is an artistic impression, and the interface labels it as such.
 */

export const TRACE_VERTEX = /* glsl */ `
  uniform mat4 uInvProjection;
  uniform mat4 uCameraWorld;
  varying vec3 vRay;

  void main() {
    vec4 view = uInvProjection * vec4(position.xy, 1.0, 1.0);
    vRay = mat3(uCameraWorld) * (view.xyz / view.w);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const TRACE_FRAGMENT = /* glsl */ `
  #define PI 3.14159265
  #define TAU 6.2831853

  uniform sampler2D uSky;
  uniform vec3 uCamera;
  uniform float uTime;
  uniform float uStepScale;
  uniform float uFall;        // inward speed of a falling observer, 0 if static
  uniform float uDepth;       // 0 at the horizon, 1 at the singularity
  uniform float uOverlay;
  uniform float uPixel;       // apparent size of a pixel, for overlay line width

  uniform vec3 uCool;
  uniform vec3 uHot;
  uniform float uDiskInner;
  uniform float uDiskOuter;
  uniform float uDiskGain;
  uniform float uDiskOpacity;
  uniform float uTurbulence;
  uniform float uCorona;
  uniform float uJet;
  uniform vec3 uJetColor;
  uniform float uFlare;
  uniform vec4 uStar;         // companion: xyz position, w radius (0 = none)
  uniform vec3 uStarColor;

  varying vec3 vRay;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Value noise, periodic in x so the disc pattern has no seam at theta = 0.
  float noise(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, period);
    float x1 = mod(i.x + 1.0, period);
    return mix(
      mix(hash21(vec2(x0, i.y)), hash21(vec2(x1, i.y)), f.x),
      mix(hash21(vec2(x0, i.y + 1.0)), hash21(vec2(x1, i.y + 1.0)), f.x),
      f.y
    );
  }

  vec3 sky(vec3 d) {
    vec2 uv = vec2(atan(d.z, d.x) / TAU + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    return textureLod(uSky, uv, 0.0).rgb;
  }

  float diskPattern(float logR, float theta) {
    // Trailing spiral: the pattern shears with radius, as gas does.
    float t = (theta + logR * 1.6) / TAU;
    float a = noise(vec2(t * 28.0, logR * 7.0), 28.0);
    float b = noise(vec2(t * 64.0, logR * 16.0 + 3.0), 64.0);
    return a * 0.65 + b * 0.35;
  }

  // Differential rotation would wind any fixed pattern up tight, so two copies
  // advect in turn, each fading out before it shears too far.
  float flow(float r, float theta) {
    float logR = log(r);
    float omega = 1.5 / (r * sqrt(r));
    float span = 14.0;
    float p0 = fract(uTime / span);
    float p1 = fract(uTime / span + 0.5);
    float w = abs(p0 * 2.0 - 1.0);
    float a = diskPattern(logR + (p0 - 0.5) * 0.5, theta - omega * (p0 - 0.5) * span);
    float b = diskPattern(logR + (p1 - 0.5) * 0.5 + 2.3, theta - omega * (p1 - 0.5) * span);
    return mix(a, b, w);
  }

  vec3 thermal(float t) {
    vec3 color = mix(uCool, uHot, smoothstep(0.1, 1.0, t));
    return mix(color, vec3(1.0, 0.98, 0.95), smoothstep(1.0, 2.2, t));
  }

  // Returns emission (rgb) and opacity (a) where the ray pierces the disc.
  vec4 diskAt(vec3 hit, float angularMomentum, float cameraRate) {
    float r = length(hit.xz);
    float inner = smoothstep(uDiskInner * 0.94, uDiskInner * 1.12, r);
    float outer = 1.0 - smoothstep(uDiskOuter * 0.55, uDiskOuter, r);
    float edge = inner * outer;
    if (edge <= 0.0) return vec4(0.0);

    float theta = atan(hit.z, hit.x);
    float detail = flow(r, theta);
    float clumps = mix(1.0, smoothstep(0.22, 0.78, detail) * 1.7, uTurbulence);

    // Thin-disc temperature, normalised to about 1 at its peak.
    float temperature = 2.4 * pow(r / uDiskInner, -0.75) * pow(max(1.0 - sqrt(uDiskInner / r), 0.0), 0.25);

    // Exact redshift for a circular orbit: g = sqrt(1 - 3/(2r)) / (1 + Ω L).
    float omega = sqrt(0.5 / (r * r * r));
    float g = sqrt(max(1.0 - 1.5 / r, 0.02)) / max(1.0 + omega * angularMomentum, 0.1) / cameraRate;

    float shifted = temperature * g;
    float luminosity = pow(temperature, 1.6) * pow(g, 3.2);
    vec3 color = thermal(shifted) * luminosity * clumps * uDiskGain * 1.05;

    // A bright knot circling near the inner edge, as seen in Sagittarius A*.
    if (uFlare > 0.0) {
      float flareAngle = uTime * 0.55;
      vec2 spot = vec2(cos(flareAngle), sin(flareAngle)) * uDiskInner * 1.35;
      float flare = exp(-dot(hit.xz - spot, hit.xz - spot) * 1.1);
      color += uHot * flare * uFlare * 3.0 * pow(g, 3.0);
    }

    return vec4(color * edge, edge * uDiskOpacity * (0.45 + 0.55 * clumps));
  }

  // The view below the horizon. An artistic impression, not a calculation.
  vec3 interior(vec3 rd, vec3 outward) {
    float upness = dot(rd, outward);
    float depth = uDepth;
    float angle = acos(clamp(upness, -1.0, 1.0));

    vec3 refA = abs(outward.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangentA = normalize(cross(outward, refA));
    vec3 tangentB = cross(outward, tangentA);
    float azimuth = atan(dot(rd, tangentB), dot(rd, tangentA));

    // The outside universe survives as a shrinking, blueshifted circle: the
    // whole sky compressed into it, so its stars crowd together as it closes.
    float window = mix(0.95, 0.12, pow(depth, 0.8));
    float inside = 1.0 - smoothstep(window * 0.97, window, angle);
    float mapped = clamp(angle / window, 0.0, 1.0) * 3.0;
    vec3 sampled = sky(outward * cos(mapped) + (tangentA * cos(azimuth) + tangentB * sin(azimuth)) * sin(mapped));
    vec3 color = sampled * inside * (1.6 + 2.2 * depth) * mix(vec3(1.0), vec3(0.75, 0.86, 1.25), depth);

    // Its rim: the last of the disc's light, wrapped into thin nested rings.
    float gap = angle - window;
    vec3 rimColor = mix(uHot, vec3(0.72, 0.84, 1.0), depth);
    color += rimColor * exp(-gap * gap * 2600.0) * 1.5;
    color += uHot * exp(-pow(gap - 0.05, 2.0) * 3000.0) * 0.5;
    color += uCool * exp(-pow(gap - 0.13, 2.0) * 1400.0) * 0.28;

    // Infalling light, drawn out along the radial direction by the tide.
    float lanes = noise(vec2(azimuth / TAU * 120.0, 0.0), 120.0);
    float pulse = noise(vec2(azimuth / TAU * 40.0, log(max(gap, 0.01)) * 2.5 - uTime * 1.2), 40.0);
    float streak = smoothstep(0.66, 0.96, lanes) * smoothstep(0.35, 0.8, pulse);
    float fade = smoothstep(0.0, 0.08, gap) * exp(-gap * 1.3);
    color += mix(uCool, uHot, lanes) * streak * fade * (0.45 + 0.8 * depth);

    // Ahead lies only the future: the darkness closes in as r shrinks.
    color *= 1.0 - smoothstep(0.86, 1.0, depth);
    return color;
  }

  void main() {
    vec3 rd = normalize(vRay);
    vec3 position = uCamera;
    float cameraR = length(position);
    vec3 outward = position / cameraR;

    if (uDepth > 0.0) {
      gl_FragColor = vec4(interior(rd, outward), 1.0);
      return;
    }

    // Relativistic aberration: a falling observer's view, in the static frame.
    float along = dot(rd, -outward);
    vec3 tangent = rd + outward * along;
    float sideways = length(tangent);
    tangent = sideways > 1e-5 ? tangent / sideways : vec3(0.0);
    float gamma = 1.0;
    if (uFall > 0.0) {
      gamma = inversesqrt(max(1.0 - uFall * uFall, 1e-3));
      along = (along - uFall) / (1.0 - uFall * along);
      sideways = sqrt(max(1.0 - along * along, 0.0));
    }

    // From the observer's local angle to the coordinate direction of the
    // orbit equation: tan(beta) = tan(alpha) / sqrt(1 - 1/r). This is what
    // makes the shadow the right size when seen from close up.
    float rate = sqrt(max(1.0 - 1.0 / cameraR, 0.004));
    vec3 velocity = normalize(-outward * along * rate + tangent * sideways);

    vec3 momentum = cross(position, velocity);
    float h2 = dot(momentum, momentum);
    // Conserved impact parameter: 1/b² = (v_r/h)² + u² - u³.
    float u0 = 1.0 / cameraR;
    float radial = dot(velocity, outward);
    float impact = inversesqrt(max(radial * radial / max(h2, 1e-8) + u0 * u0 - u0 * u0 * u0, 1e-8));
    float angularMomentum = -momentum.y * impact / max(sqrt(h2), 1e-5);

    vec3 color = vec3(0.0);
    float transmit = 1.0;
    bool captured = false;
    bool escaped = false;
    float limit = max(70.0, cameraR * 1.15);
    float lastY = position.y;
    vec3 horizonHit = vec3(0.0);

    for (int i = 0; i < RAY_STEPS; i += 1) {
      float r = length(position);
      if (r < 1.0) {
        captured = true;
        horizonHit = position;
        break;
      }
      if (r > limit && dot(position, velocity) > 0.0) {
        escaped = true;
        break;
      }
      if (transmit < 0.02) break;

      float dt = uStepScale * 0.07 * r * r / (1.0 + 0.13 * r);
      dt = clamp(dt, 0.03, 9.0);

      vec3 mid = position + velocity * dt * 0.5;
      float m2 = dot(mid, mid);
      velocity += -1.5 * h2 * mid / (m2 * m2 * sqrt(m2)) * dt;
      vec3 next = mid + velocity * dt * 0.5;

      // Plasma around the hole, and the jet along the spin axis.
      float mr = sqrt(m2);
      if (uCorona > 0.0 && mr < 16.0) {
        float height = 0.3 + 0.32 * mr;
        float glow = exp(-mid.y * mid.y / (2.0 * height * height)) * smoothstep(1.2, 2.6, mr) / (m2 + 0.6);
        color += transmit * mix(uCool, uHot, 1.0 / mr + 0.15) * glow * uCorona * dt * 0.16;
      }
      if (uJet > 0.0) {
        float axial = length(mid.xz);
        float width = 0.34 + 0.11 * pow(abs(mid.y), 0.8);
        float q = axial / width;
        float beam = exp(-q * q) * (0.45 + 0.55 * smoothstep(0.1, 0.9, q)) * smoothstep(1.2, 3.2, abs(mid.y)) * exp(-abs(mid.y) / 34.0);
        float knots = 0.72 + 0.28 * sin(abs(mid.y) * 1.3 - uTime * 2.0);
        color += transmit * uJetColor * beam * knots * uJet * dt * 0.34;
      }

      // Disc: wherever the path crosses the equatorial plane.
      if (next.y * lastY < 0.0) {
        float t = lastY / (lastY - next.y);
        vec3 hit = mix(position, next, t);
        vec4 disk = diskAt(hit, angularMomentum, rate);
        color += transmit * disk.rgb;
        transmit *= 1.0 - disk.a;
        if (uOverlay > 0.0) {
          float ring = 1.0 - smoothstep(0.0, 0.05, abs(length(hit.xz) - 3.0));
          color += transmit * vec3(1.0, 0.72, 0.35) * ring * uOverlay * 0.7;
        }
      }

      // Companion star, tested along the whole step so it cannot be skipped.
      if (uStar.w > 0.0) {
        vec3 toStar = uStar.xyz - position;
        vec3 step3 = next - position;
        float s = clamp(dot(toStar, step3) / dot(step3, step3), 0.0, 1.0);
        float d = length(toStar - step3 * s);
        if (d < uStar.w) {
          float limb = sqrt(1.0 - d * d / (uStar.w * uStar.w));
          color += transmit * uStarColor * (0.6 + 2.6 * limb);
          transmit = 0.0;
          break;
        }
        color += transmit * uStarColor * exp(-pow((d - uStar.w) / (uStar.w * 0.7), 2.0)) * 0.03 * dt;
      }

      position = next;
      lastY = position.y;
    }

    if (escaped && transmit > 0.0) {
      vec3 background = sky(normalize(velocity)) * 1.15;
      // A falling observer's speed brightens the sky ahead.
      color += transmit * background * mix(1.0, min(gamma * gamma, 6.0), step(0.0, along));
    }

    if (uOverlay > 0.0) {
      if (captured) {
        vec3 n = normalize(horizonHit);
        float lat = abs(fract(asin(n.y) / PI * 12.0 + 0.5) - 0.5);
        float lon = abs(fract(atan(n.z, n.x) / TAU * 24.0 + 0.5) - 0.5);
        float grid = 1.0 - smoothstep(0.0, 0.05, min(lat, lon));
        color += vec3(0.13, 0.82, 0.93) * grid * uOverlay * 0.42;
      }
      float edge = 1.0 - smoothstep(0.0, uPixel * 2.2, abs(impact - 2.598));
      color += vec3(0.13, 0.82, 0.93) * edge * uOverlay * 0.8;
    }

    // Bright enough to clip, but not so bright that bloom swamps the shadow.
    gl_FragColor = vec4(min(color, vec3(5.0)), 1.0);
  }
`

export const COMPOSITE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D uImage;
  uniform float uOpacity;
  uniform float uStrain;
  uniform float uBloom;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float reach = dot(centered, centered);

    // Tides pull the colour channels apart towards the edge of the view.
    vec2 shift = centered * reach * uStrain * 0.035;
    vec3 color = vec3(
      textureLod(uImage, vUv + shift, 0.0).r,
      textureLod(uImage, vUv, 0.0).g,
      textureLod(uImage, vUv - shift, 0.0).b
    );

    // Bloom from the image's own mip chain: no extra passes to pay for.
    vec3 bloom = textureLod(uImage, vUv, 2.5).rgb * 0.4
      + textureLod(uImage, vUv, 4.0).rgb * 0.34
      + textureLod(uImage, vUv, 5.5).rgb * 0.26;
    color += max(bloom - 0.55, 0.0) * uBloom;

    color *= 1.0 - reach * (0.75 + uStrain * 1.2);
    color = aces(color * 1.05);
    color = mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, color));
    color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

    gl_FragColor = vec4(color * uOpacity, 1.0);
  }
`
