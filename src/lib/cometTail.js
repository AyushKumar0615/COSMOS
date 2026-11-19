import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A comet tail as a camera-facing ribbon from the head: straight for the ion
 * tail, curved back along the orbit for the dust tail. Shared by the solar
 * system scene and the open universe. Lengths and brightness are a model.
 */
const tailVertex = /* glsl */ `
  uniform vec3 uHead;
  uniform vec3 uAway;      // unit: from the Sun
  uniform vec3 uLag;       // unit: opposite the comet's motion
  uniform float uLength;
  uniform float uWidth;
  uniform float uCurve;    // 0 for the straight ion tail
  varying float vAlong;
  varying float vAcross;
  void main() {
    float t = position.x;
    vec3 p = uHead + uAway * uLength * t + uLag * uLength * uCurve * t * t;
    vec3 tangent = normalize(uAway + uLag * uCurve * 2.0 * t + 1e-4);
    vec3 view = normalize(cameraPosition - p);
    vec3 side = normalize(cross(tangent, view));
    p += side * position.y * uWidth * (0.25 + 1.6 * t);
    vAlong = t;
    vAcross = position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`
const tailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vAlong;
  varying float vAcross;
  void main() {
    float a = exp(-vAcross * vAcross * 3.0) * pow(1.0 - vAlong, 1.6) * smoothstep(0.0, 0.04, vAlong) * uStrength;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`
export const TAIL_GEOMETRY = (() => {
  const g = new THREE.PlaneGeometry(1, 2, 24, 1)
  g.translate(0.5, 0, 0)
  return g
})()

export function tailMaterial(color, curve) {
  return new THREE.ShaderMaterial({
    vertexShader: tailVertex,
    fragmentShader: tailFragment,
    uniforms: {
      uHead: { value: new THREE.Vector3() },
      uAway: { value: new THREE.Vector3(1, 0, 0) },
      uLag: { value: new THREE.Vector3(0, 0, 1) },
      uLength: { value: 1 },
      uWidth: { value: 0.05 },
      uCurve: { value: curve },
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    // The ribbon's winding flips with the side it is seen from.
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
}


/** Comet activity: none beyond 5 AU, rising roughly as 1/r^2 towards the Sun (a model). */
export const cometActivity = (rAu) => Math.min(1, Math.max(0, (5 - rAu) / 4.5) * Math.min(1.6, 1.2 / (rAu * rAu)))

const comaFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = (exp(-r * r * 8.0) + exp(-r * 3.0) * 0.3) * (1.0 - smoothstep(0.85, 1.0, r)) * uStrength;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`

/** The coma: a soft camera-facing glow round the nucleus (a model). */
export function comaMaterial(color) {
  return new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: comaFragment,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

// An irregular rock shared by every asteroid and comet nucleus.
export const ROCK = (() => {
  // Shared vertices, so the surface shades smoothly rather than in facets.
  const base = new THREE.IcosahedronGeometry(1, 5)
  base.deleteAttribute('normal')
  base.deleteAttribute('uv')
  const g = mergeVertices(base)
  base.dispose()
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let k = 0; k < p.count; k += 1) {
    v.fromBufferAttribute(p, k)
    const bump = 1 + 0.2 * Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3 - v.x) + 0.06 * Math.sin(v.y * 7 + v.z * 5) + 0.025 * Math.sin(v.x * 17 + v.z * 13) + 0.012 * Math.sin(v.y * 31 + v.x * 23) * Math.cos(v.z * 29)
    v.multiplyScalar(bump)
    p.setXYZ(k, v.x, v.y * 0.8, v.z)
  }
  g.computeVertexNormals()
  return g
})()
