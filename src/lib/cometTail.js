import * as THREE from 'three'

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
