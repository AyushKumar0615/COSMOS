import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MASS_TYPES } from '../../../data/phenomena.js'
import { quality } from '../../../lib/quality.js'

const SIZE = 60
const MAX_MASSES = 6

const vertexShader = /* glsl */ `
  uniform vec4 uMasses[${MAX_MASSES}];   // x, z, mass, width
  varying float vDepth;
  varying vec2 vGrid;

  void main() {
    vGrid = position.xz;
    float depth = 0.0;
    for (int i = 0; i < ${MAX_MASSES}; i += 1) {
      vec4 m = uMasses[i];
      float d2 = dot(position.xz - m.xy, position.xz - m.xy);
      depth += m.z / sqrt(d2 / (m.w * m.w) + 1.0);
    }
    vDepth = depth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, -depth, position.z, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying float vDepth;
  varying vec2 vGrid;
  void main() {
    vec2 scaled = vGrid / 1.5;
    vec2 width = fwidth(scaled) * 1.1;
    vec2 cell = abs(fract(scaled - 0.5) - 0.5);
    vec2 lines = 1.0 - smoothstep(vec2(0.0), width, cell);
    float grid = max(lines.x, lines.y);
    float t = clamp(vDepth / 7.0, 0.0, 1.0);
    vec3 color = mix(vec3(0.13, 0.55, 0.7), vec3(0.49, 0.3, 1.0), smoothstep(0.0, 0.5, t));
    color = mix(color, vec3(1.0, 0.6, 0.25), smoothstep(0.5, 1.0, t));
    float edge = 1.0 - smoothstep(0.72, 1.0, length(vGrid) / ${(SIZE / 2).toFixed(1)});
    gl_FragColor = vec4(color * (grid * 0.85 + 0.03), (grid * 0.9 + 0.05) * edge);
  }
`

function depthAt(masses, x, z) {
  let depth = 0
  for (const m of masses) {
    const type = MASS_TYPES[m.type]
    const d2 = (x - m.x) ** 2 + (z - m.z) ** 2
    depth += type.mass / Math.sqrt(d2 / type.width ** 2 + 1)
  }
  return depth
}

/**
 * A rubber-sheet model of curvature. The well shape is one profile for every
 * mass, with depth and width set per type, so compact objects dig narrow,
 * deep wells. Clicking the grid places the mass chosen in the interface.
 */
export default function SpacetimeModel({ control, onChange }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uMasses: { value: Array.from({ length: MAX_MASSES }, () => new THREE.Vector4()) } },
      }),
    [],
  )
  const geometry = useMemo(() => {
    const detail = quality().tier === 'low' ? 150 : 260
    const plane = new THREE.PlaneGeometry(SIZE, SIZE, detail, detail)
    plane.rotateX(-Math.PI / 2)
    return plane
  }, [])
  const hit = useMemo(() => new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), [])
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 32, 24), [])
  const refs = useRef([])

  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
      hit.dispose()
      sphere.dispose()
    },
    [material, geometry, hit, sphere],
  )

  useFrame(() => {
    const { masses } = control.current
    material.uniforms.uMasses.value.forEach((value, index) => {
      const m = masses[index]
      if (m) {
        const type = MASS_TYPES[m.type]
        value.set(m.x, m.z, type.mass, type.width)
      } else {
        value.set(0, 0, 0, 1)
      }
    })
    refs.current.forEach((mesh, index) => {
      const m = masses[index]
      if (!mesh) return
      mesh.visible = Boolean(m)
      if (!m) return
      const type = MASS_TYPES[m.type]
      mesh.position.set(m.x, -depthAt(masses, m.x, m.z) + type.radius, m.z)
      mesh.scale.setScalar(type.radius)
      mesh.material.color.set(type.color)
      mesh.material.emissive.set(m.type === 'hole' ? '#000000' : type.color)
    })
  })

  const place = (event) => {
    event.stopPropagation()
    const c = control.current
    if (c.masses.length >= MAX_MASSES) c.masses.shift()
    c.masses.push({ type: c.place, x: event.point.x, z: event.point.z })
    onChange?.()
  }

  return (
    <group>
      <mesh geometry={geometry} material={material} raycast={() => null} frustumCulled={false} />
      <mesh geometry={hit} onClick={place}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {Array.from({ length: MAX_MASSES }, (_, index) => (
        <mesh key={index} ref={(node) => (refs.current[index] = node)} geometry={sphere} visible={false} raycast={() => null}>
          <meshStandardMaterial emissiveIntensity={1} toneMapped={false} />
        </mesh>
      ))}
      <ambientLight intensity={0.5} />
    </group>
  )
}
