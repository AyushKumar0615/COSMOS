import { useMemo } from 'react'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

// Fresnel rim, masked to the sunlit hemisphere. The Sun sits at the origin,
// so the light direction is just the negated world position.
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - max(dot(normal, viewDirection), 0.0);
    rim = pow(rim, 3.0);

    vec3 lightDirection = normalize(-vWorldPosition);
    float lit = smoothstep(-0.25, 0.5, dot(normal, lightDirection));

    float alpha = rim * lit * uIntensity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`

export default function PlanetAtmosphere({ geometry, color, intensity }) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    }),
    [color, intensity],
  )

  return (
    <mesh geometry={geometry} scale={1.06} raycast={() => null}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
