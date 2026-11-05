import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scaleCount } from '../../lib/quality.js'

/**
 * Near-field instanced particles with a real lit material. These are what the
 * scene lighting acts on, and they give the camera something to parallax
 * against so depth reads correctly during the fly-in.
 *
 * One instanced draw call; icosahedron detail 0 is 20 triangles per instance.
 */
export default function Debris({
  count: requestedCount = 170,
  motion = 1,
  innerRadius = 28,
  outerRadius = 70,
  minScale = 0.05,
  maxScale = 0.17,
}) {
  const meshRef = useRef(null)
  const groupRef = useRef(null)
  const count = scaleCount(requestedCount, 50)

  const instances = useMemo(() => {
    const list = []
    for (let i = 0; i < count; i += 1) {
      // A spherical shell that starts beyond Neptune's orbit, so debris can
      // never drift between the planets.
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      list.push({
        position: new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ),
        rotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ),
        scale: minScale + Math.pow(Math.random(), 2) * (maxScale - minScale),
      })
    }
    return list
  }, [count, innerRadius, outerRadius, minScale, maxScale])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    instances.forEach((instance, index) => {
      quaternion.setFromEuler(instance.rotation)
      scale.setScalar(instance.scale)
      matrix.compose(instance.position, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [instances])

  useFrame((_, delta) => {
    if (!groupRef.current || motion === 0) return
    // Barely perceptible drift: enough to feel alive, not enough to distract.
    groupRef.current.rotation.y += delta * 0.012 * motion
    groupRef.current.rotation.x += delta * 0.004 * motion
  })

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#b8c6e8"
          roughness={0.4}
          metalness={0.5}
          emissive="#101a38"
          emissiveIntensity={0.35}
          flatShading
        />
      </instancedMesh>
    </group>
  )
}
