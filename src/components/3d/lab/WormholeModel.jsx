import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getSkyTexture } from '../../../lib/skyTexture.js'
import { quality } from '../../../lib/quality.js'

const QUAD = new THREE.PlaneGeometry(2, 2)
const THROAT = 2

const vertexShader = /* glsl */ `
  uniform mat4 uInvProjection;
  uniform mat4 uCameraWorld;
  varying vec3 vRay;
  void main() {
    vec4 view = uInvProjection * vec4(position.xy, 1.0, 1.0);
    vRay = mat3(uCameraWorld) * (view.xyz / view.w);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Null geodesics of the Ellis metric ds² = -dt² + dl² + (l² + b²) dΩ². Light
// moves in a plane, with l'' = h² l / (l² + b²)² and φ' = h / (l² + b²).
const fragmentShader = /* glsl */ `
  #define PI 3.14159265
  #define TAU 6.2831853
  uniform sampler2D uSky;
  uniform vec3 uRadial;
  uniform float uL;
  uniform float uThroat;
  uniform float uStepScale;
  uniform float uOpacity;
  varying vec3 vRay;

  vec3 skyNear(vec3 d) {
    vec2 uv = vec2(atan(d.z, d.x) / TAU + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    return textureLod(uSky, uv, 0.0).rgb * 1.3;
  }

  // The far side: an invented universe with a grid, so distortion is legible.
  vec3 skyFar(vec3 d) {
    vec2 uv = vec2(atan(d.z, d.x) / TAU + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    vec3 stars = textureLod(uSky, fract(uv + 0.37), 0.0).rgb;
    vec2 cell = abs(fract(uv * vec2(36.0, 18.0)) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.035, min(cell.x, cell.y));
    vec3 tone = mix(vec3(0.05, 0.03, 0.14), vec3(0.03, 0.09, 0.16), uv.y);
    return tone + stars * vec3(0.7, 0.8, 1.3) + vec3(0.36, 0.28, 0.85) * line * 0.5;
  }

  void main() {
    vec3 rd = normalize(vRay);
    float side = uL >= 0.0 ? 1.0 : -1.0;
    float b2 = uThroat * uThroat;

    float cosA = dot(rd, uRadial);
    vec3 tangent = rd - uRadial * cosA;
    float sinA = length(tangent);
    tangent = sinA > 1e-5 ? tangent / sinA : vec3(0.0);

    float l = uL;
    float lv = cosA * side;
    float h = sqrt(uL * uL + b2) * sinA;
    float phi = 0.0;
    float limit = max(abs(uL) * 1.4, 26.0);
    float closest = 1e6;

    for (int i = 0; i < RAY_STEPS; i += 1) {
      float R2 = l * l + b2;
      closest = min(closest, R2);
      float dt = uStepScale * (0.05 + 0.1 * sqrt(R2));
      float lm = l + lv * dt * 0.5;
      float Rm = lm * lm + b2;
      lv += h * h * lm / (Rm * Rm) * dt;
      phi += h / Rm * dt;
      l = lm + lv * dt * 0.5;
      if (abs(l) > limit && l * lv > 0.0) break;
    }

    vec3 direction = uRadial * cos(phi) + tangent * sin(phi);
    vec3 color = l * side > 0.0 ? skyNear(direction) : skyFar(direction);

    // A faint sheen at the throat, marking where light has grazed it.
    color += vec3(0.38, 0.3, 0.8) * exp(-(closest - b2) * 2.4) * 0.26;

    color = color / (1.0 + color * 0.2);
    color = pow(color, vec3(1.0 / 2.2));
    gl_FragColor = vec4(color * uOpacity, 1.0);
  }
`

/** Ellis wormhole, ray-traced straight to the screen. It is hypothetical. */
export default function WormholeModel({ control, reducedMotion }) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)

  const material = useMemo(() => {
    const steps = Math.round(quality().raySteps * 0.75)
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      defines: { RAY_STEPS: steps },
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uInvProjection: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uSky: { value: getSkyTexture(gl) },
        uRadial: { value: new THREE.Vector3() },
        uL: { value: 10 },
        uThroat: { value: THROAT },
        uStepScale: { value: 72 / steps },
        uOpacity: { value: 1 },
      },
    })
  }, [gl])

  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const c = control.current
    const u = material.uniforms
    camera.updateMatrixWorld()
    u.uInvProjection.value.copy(camera.projectionMatrixInverse)
    u.uCameraWorld.value.copy(camera.matrixWorld)
    u.uRadial.value.copy(camera.position).normalize()

    const r = Math.max(camera.position.length(), THROAT * 1.02)
    const free = Math.sqrt(r * r - THROAT * THROAT)
    if (c.travelling) {
      c.progress = Math.min(1, c.progress + Math.min(delta, 0.1) / (reducedMotion ? 0.01 : 7))
      if (c.progress >= 1) {
        c.travelling = false
        c.side = -c.side
        c.progress = 0
      }
    }
    const eased = c.progress * c.progress * (3 - 2 * c.progress)
    u.uL.value = c.side * free * (1 - 2 * eased)
  })

  return <mesh geometry={QUAD} material={material} frustumCulled={false} renderOrder={-20} raycast={() => null} />
}
