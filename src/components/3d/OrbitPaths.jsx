import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PLANETS } from '../../data/planets.js'

const SEGMENTS = 256

const vertexShader = /* glsl */ `
  attribute float aOrbit;
  varying float vOrbit;
  void main() {
    vOrbit = aOrbit;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uSelected;
  uniform float uHovered;
  uniform float uBase;
  varying float vOrbit;

  void main() {
    float isSelected = 1.0 - step(0.5, abs(vOrbit - uSelected));
    float isHovered = 1.0 - step(0.5, abs(vOrbit - uHovered));

    vec3 base = vec3(0.55, 0.62, 0.82);
    vec3 accent = vec3(0.133, 0.827, 0.933);

    float alpha = uBase + isHovered * 0.12 + isSelected * 0.38;
    vec3 color = mix(base, accent, max(isSelected, isHovered * 0.6));
    gl_FragColor = vec4(color, alpha);
  }
`

/**
 * All eight orbits in one LineSegments draw call. A per-vertex orbit index
 * lets the selected and hovered orbits brighten without splitting the mesh.
 */
export default function OrbitPaths({ selectedId, hoveredId }) {
  const materialRef = useRef(null)

  const geometry = useMemo(() => {
    const positions = []
    const orbitIndex = []

    PLANETS.forEach((planet, index) => {
      const r = planet.sim.orbitRadius
      for (let i = 0; i < SEGMENTS; i += 1) {
        const a0 = (i / SEGMENTS) * Math.PI * 2
        const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2
        positions.push(Math.cos(a0) * r, 0, Math.sin(a0) * r)
        positions.push(Math.cos(a1) * r, 0, Math.sin(a1) * r)
        orbitIndex.push(index, index)
      }
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('aOrbit', new THREE.Float32BufferAttribute(orbitIndex, 1))
    return geo
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(
    () => ({
      uSelected: { value: -1 },
      uHovered: { value: -1 },
      uBase: { value: 0.13 },
    }),
    [],
  )

  const selectedIndex = PLANETS.findIndex((p) => p.id === selectedId)
  const hoveredIndex = PLANETS.findIndex((p) => p.id === hoveredId)

  useFrame(() => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uSelected.value = selectedIndex
    material.uniforms.uHovered.value = hoveredIndex
  })

  return (
    <lineSegments geometry={geometry} raycast={() => null} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  )
}
