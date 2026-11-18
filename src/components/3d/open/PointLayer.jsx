import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Sizes are in CSS pixels: a star is a point of light at any distance.
    gl_PointSize = aSize * uPixelRatio;
    if (aAlpha <= 0.0) gl_PointSize = 0.0;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = exp(-r * r * 6.0);
    float halo = exp(-r * 2.6) * 0.35;
    float a = (core + halo) * vAlpha * (1.0 - smoothstep(0.85, 1.0, r));
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
  }
`

/**
 * A pool of screen-sized points the frame loop writes directly: positions
 * (render space), colours, pixel sizes and alphas. One draw call, no React
 * render per frame. `layer.current` exposes the arrays and a commit().
 */
export default function PointLayer({ capacity, layer, renderOrder = 0 }) {
  const viewport = useThree((state) => state.viewport)
  const built = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const attribute = (size, name) => {
      const a = new THREE.BufferAttribute(new Float32Array(capacity * size), size)
      a.setUsage(THREE.DynamicDrawUsage)
      geometry.setAttribute(name, a)
      return a
    }
    const position = attribute(3, 'position')
    const color = attribute(3, 'aColor')
    const size = attribute(1, 'aSize')
    const alpha = attribute(1, 'aAlpha')
    geometry.setDrawRange(0, 0)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry, material, position, color, size, alpha }
  }, [capacity])

  useEffect(() => {
    built.material.uniforms.uPixelRatio.value = Math.min(viewport.dpr, 2)
  }, [built, viewport.dpr])

  useEffect(() => {
    layer.current = {
      ...built,
      commit(count) {
        built.geometry.setDrawRange(0, count)
        built.position.needsUpdate = true
        built.color.needsUpdate = true
        built.size.needsUpdate = true
        built.alpha.needsUpdate = true
      },
    }
    return () => {
      layer.current = null
      built.geometry.dispose()
      built.material.dispose()
    }
  }, [built, layer])

  return <points geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={renderOrder} raycast={() => null} />
}
