import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/** The Sun sits at the centre of the system, so this is its world position. */
const ORIGIN = new THREE.Vector3(0, 0, 0)

/**
 * Flat annulus whose U coordinate runs radially (0 = inner edge, 1 = outer),
 * so a 1D baked profile maps straight onto it. THREE.RingGeometry's UVs are
 * planar, which would smear a radial profile across the ring.
 */
function createRadialRing(inner, outer, segments = 128) {
  const positions = []
  const uvs = []
  const normals = []
  const indices = []

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    positions.push(cos * inner, 0, sin * inner, cos * outer, 0, sin * outer)
    uvs.push(0, 0.5, 1, 0.5)
    normals.push(0, 1, 0, 0, 1, 0)

    if (i < segments) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

/**
 * Patches the ring's basic material so the planet casts a shadow across it.
 *
 * A shadow map would be the usual way, but it costs a second render pass of
 * the whole system for one object. The geometry here is simple enough to
 * solve directly: the planet is a sphere, so a ring point is in shadow when
 * the line from it to the Sun passes within the planet's radius. The
 * smoothstep across that radius stands in for the penumbra, and the floor
 * keeps the shadowed arc dark rather than black — ring particles still catch
 * light scattered off the planet.
 *
 * The planet's centre and radius are read from the model matrix in the
 * vertex shader, so this follows Saturn around its orbit with nothing to
 * update per frame.
 */
function addPlanetShadow(material, sun) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSun = { value: sun }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vRingWorld;
         varying vec3 vPlanetCenter;
         varying float vPlanetRadius;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vRingWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vPlanetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
         vPlanetRadius = length((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uSun;
         varying vec3 vRingWorld;
         varying vec3 vPlanetCenter;
         varying float vPlanetRadius;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec3 toSun = normalize(uSun - vRingWorld);
         vec3 toCenter = vPlanetCenter - vRingWorld;
         float along = dot(toCenter, toSun);
         float lit = 1.0;
         if (along > 0.0) {
           float miss = length(toCenter - toSun * along);
           lit = smoothstep(vPlanetRadius * 0.99, vPlanetRadius * 1.08, miss);
         }
         diffuseColor.rgb *= mix(0.22, 1.0, lit);`,
      )
  }
  // Two materials with different patches must not share a compiled program.
  material.customProgramCacheKey = () => 'saturn-ring-shadow'
  return material
}

/**
 * Unlit on purpose: the ring plane lies close to the Sun's direction, so a
 * Lambert term would render it almost black. Real rings are bright from
 * both faces at most viewing angles — the one place they do go dark is the
 * planet's shadow, which is drawn above.
 */
export default function SaturnRings({ inner, outer, texture, sunPosition = ORIGIN, opacity = 1 }) {
  const geometry = useMemo(() => createRadialRing(inner, outer), [inner, outer])
  const material = useMemo(
    () =>
      addPlanetShadow(
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false,
        }),
        sunPosition,
      ),
    [texture, sunPosition, opacity],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  return <mesh geometry={geometry} material={material} raycast={() => null} renderOrder={1} />
}
