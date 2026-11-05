import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uMaxSize;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vColor = aColor;
    float size = aSize * uScale * uPixelRatio * (300.0 / max(-viewPosition.z, 0.001));
    // Capped, so flying through a cloud never paints screen-sized points.
    gl_PointSize = min(size, uMaxSize * uPixelRatio);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float disc = 1.0 - smoothstep(0.0, 0.5, d);
    float alpha = pow(disc, 2.2) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

/**
 * Generic GPU point cloud for galaxy stars, dust and nebula stars.
 * `opacityRef` ({ value }) lets a scene fade the whole cloud without a
 * React render. Additive for light, normal blending for dust that should
 * dim whatever is behind it.
 */
export default function PointCloud({
  positions,
  colors,
  sizes,
  blending = 'additive',
  alpha = 1,
  scale = 1,
  maxSize = 40,
  opacityRef,
  renderOrder = 0,
}) {
  const materialRef = useRef(null)
  const viewport = useThree((state) => state.viewport)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.computeBoundingSphere()
    return geo
  }, [positions, colors, sizes])

  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(
    () => ({
      uPixelRatio: { value: 1 },
      uScale: { value: scale },
      uMaxSize: { value: maxSize },
      uOpacity: { value: alpha },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(() => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uPixelRatio.value = Math.min(viewport.dpr, 2)
    material.uniforms.uScale.value = scale
    material.uniforms.uMaxSize.value = maxSize
    material.uniforms.uOpacity.value = alpha * (opacityRef ? opacityRef.current.value : 1)
  })

  return (
    <points geometry={geometry} renderOrder={renderOrder} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  )
}
