import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE_GLSL } from '../shaders/noise.glsl.js'

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  ${NOISE_GLSL}
  uniform vec3 uCentre;   // direction to the Galactic Centre from the ship
  uniform float uInside;  // 1 inside the disc, 0 far outside the galaxy
  varying vec3 vDir;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  // One faint star per occupied cell of a grid laid over the sphere.
  vec3 stars(vec3 dir, float cells, float density, float size) {
    vec3 base = floor(dir * cells);
    vec3 result = vec3(0.0);
    for (int i = 0; i < 8; i += 1) {
      vec3 cell = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
      if (hash31(cell + 3.7) < 1.0 - density) continue;
      vec3 centre = normalize(cell + vec3(hash31(cell), hash31(cell + 17.1), hash31(cell + 41.7)));
      float d = length(dir - centre) * cells;
      float tint = hash31(cell + 9.1);
      vec3 colour = tint < 0.34 ? vec3(0.72, 0.82, 1.0) : tint < 0.72 ? vec3(1.0, 0.95, 0.86) : vec3(1.0, 0.78, 0.6);
      result += colour * exp(-d * d / (size * size)) * (0.3 + 0.7 * pow(hash31(cell + 5.3), 3.0));
    }
    return result;
  }

  void main() {
    vec3 dir = normalize(vDir);
    // The galactic plane is the world's XZ plane: |y| is sin(latitude).
    float lat = dir.y;
    float band = exp(-pow(lat / 0.13, 2.0));
    float towardCentre = max(dot(dir, uCentre), 0.0);
    float bulge = exp(-pow((1.0 - towardCentre) / 0.09, 2.0)) * exp(-pow(lat / 0.22, 2.0));
    float clouds = fbm3(dir * 4.0) * 0.5 + 0.5;
    float fine = fbm3(dir * 14.0 + 3.0) * 0.5 + 0.5;
    float lane = 1.0 - 0.75 * exp(-pow(lat / 0.03, 2.0)) * smoothstep(0.35, 0.75, fine);

    vec3 glow = vec3(0.16, 0.17, 0.24) * band * clouds * (0.6 + 0.8 * towardCentre);
    glow += vec3(0.32, 0.25, 0.17) * bulge * clouds;
    glow *= lane;

    vec3 field = stars(dir, 90.0, 0.06, 0.045) * 0.55 + stars(dir, 220.0, 0.05 + band * 0.12, 0.09) * 0.32;
    vec3 colour = (glow * 0.55 + field) * uInside;
    gl_FragColor = vec4(colour, 1.0);
  }
`

const SPHERE = new THREE.SphereGeometry(1, 48, 32)

/**
 * The Milky Way seen from inside it: a faint band in the galactic plane,
 * brightest toward the centre, with unresolved background stars. It fades
 * away as the ship leaves the disc, where the galaxy model takes over.
 * A procedural model, not a photograph.
 */
export default function Sky({ state }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uCentre: { value: new THREE.Vector3(1, 0, 0) }, uInside: { value: 1 } },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    material.uniforms.uCentre.value.set(...state.current.centreDir)
    material.uniforms.uInside.value = state.current.inside
  })
  return <mesh geometry={SPHERE} material={material} scale={30000} renderOrder={-100} frustumCulled={false} raycast={() => null} />
}
